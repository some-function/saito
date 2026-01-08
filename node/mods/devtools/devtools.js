const ModTemplate = require("../../lib/templates/modtemplate");
const SaitoHeader = require("../../lib/saito/ui/saito-header/saito-header");
const AddAppOverlay = require("./lib/overlay/add-app");
const GenerateAppOverlay = require("./lib/overlay/generate-app");
const {execFile} = require("child_process");


class DevTools extends ModTemplate {
	constructor(app) {
		super(app);

		this.app = app;

		this.name = "DevTools";
		this.appname = "DevTools";
		this.slug = "devtools";
		this.description = "Application manages installing, indexing, compiling and serving Saito modules.";
		this.categories = "Utilities Dev";
		this.header = null;
		this.icon = "fas fa-window-restore";

		this.styles = ["/saito/saito.css"];

		this.zipFile = null;
		this.title = null;
		this.description = null;
		this.version = null;
		this.publisher = null;
		this.category = null;
		this.img = null;
	}

	async initialize(app) {
		await super.initialize(app);
		new AddAppOverlay(this.app, this);
		this.generateAppOverlay = new GenerateAppOverlay(this.app, this);
	}

	async render() {
		if (this.app.BROWSER) {
      this.header = new SaitoHeader(this.app, this);
      await this.header.initialize(this.app);
  
      this.addComponent(this.header);
  
      await super.render();
      this.attachEvents();
		}
	}

	respondTo() {
		return null;
	}

	async sendSubmitModuleTransaction(zip, slug, callback) {
		const peers = await this.app.network.getPeers();
		if (peers.length == 0) {
			console.warn("No peers");
			return;
		}

		const message = {module: "DevTools", request: "submit module", moduleZip: zip, slug: slug};
		this.app.network.sendRequestAsTransaction("submit module", message, callback, peers[0].peerIndex);
	}

	async sendModuleDetailsTransaction(zip, callback) {
		const peers = await this.app.network.getPeers();
		if (peers.length == 0) {
			console.warn("No peers");
			return;
		}

		const message = {module: "DevTools", request: "get module details", moduleZip: zip};
		this.app.network.sendRequestAsTransaction("get module details", message, callback, peers[0].peerIndex);
	}

	async handlePeerTransaction(app, tx=null, peer, mycallback) {
		if (tx === null) { return 0; }

		const {request, data} = tx.returnMessage();

		if (!request) { return 0; }
		if (request === "submit module")      { await this.createAppBinary(data.moduleZip, data.slug, mycallback); }
		if (request === "get module details") { await this.getInfoFromZip(data.moduleZip, mycallback);             }

		return super.handlePeerTransaction(app, tx, peer, mycallback);
	}

	clear() {
		this.zipFile = null;
		this.title = null;
		this.description = null;
		this.version = null;
		this.publisher = null;
		this.category = null;
		this.img = null;
	}

	attachEvents() {
		try {
			if (this.app.BROWSER) {
				this.app.browser.addDragAndDropFileUploadToElement(
					"devtools-zip-upload",
					async (filesrc) => {
						this.clear();

						const startPoint = filesrc.indexOf("base64");
						if (startPoint < 0) {
							throw new Error("File not base64 zipped");
						}
						this.zipFile = filesrc.substring(startPoint + 7);

						await this.sendModuleDetailsTransaction(this.zipFile, (res) => {
							if (res.slug == "") {
								salert("Error: Application missing slug");
							} else {
                this.generateAppOverlay.modDetails = res;
                this.generateAppOverlay.modDetails.publisher = this.publicKey;
                this.generateAppOverlay.zipFile = this.zipFile;
                this.generateAppOverlay.render();
              }
						});
					},
					true, false, false
				);

        const installElement = document.getElementById("install");
				if (installElement) {
					installElement.onclick = () => { this.app.connection.emit("saito-app-app-render-request"); };
				}
			}
		} catch (error) {
			console.error("Error: ", error);
			salert("An error occurred while compiling application. Check console for details.");
		}
	}

	async createAppBinary(zipBin, slug, mycallback) {
    const path = require("path");
    const unzipper = require("unzipper");
    const {exec} = require("child_process/promises");
    const fs = require("fs/promises");

    try {
      const maxSize = 10 * 1024 * 1024;
      const base64Ratio = 1.37;
      if (zipBin.length > maxSize * base64Ratio) {
        throw new Error("Zip too large.");
      }
  
      if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
        throw new Error("Invalid slug.");
      }
  
      const zipPath = path.resolve(__dirname, "app.zip");
      await fs.writeFile(zipPath, Buffer.from(zipBin, "base64"));

      const directory = await unzipper.Open.file(zipPath);
      const fsObjects = directory.files;

      const extractPath = path.resolve("./tmp_mod/");
      for (const fsObject of fsObjects) {
        const targetPath = path.resolve(extractPath, fsObject.path);
        if (!targetPath.startsWith(extractPath) || fsObject.path.includes("..")) {
          throw new Error("Invalid file path in zip");
        }
      }
      await directory.extract({path: extractPath});

      const appPath = fsObjects.map((fsObject) => fsObject.path).find((path) => path === `${slug}.js` || path.endsWith(`/${slug}.js`));
      if (!appPath || appPath.includes("..") || path.isAbsolute(appPath)) {
        throw new Error("Invalid app path");
      }

      const {stderr1} = await execFile("./scripts/dyn-mod-compile.sh", [appPath]);
      if (stderr1) { console.error(stderr1); }

      await fs.unlink(zipPath);

      const DYN_MOD_WEB = await fs.readFile("./build/dyn_mod.js", {encoding: "binary"});

      await fs.rm(path.resolve("./tmp_mod"), {recursive: true, force: true}).catch(() => {});
      await fs.unlink(path.resolve("./build/dyn_mod.js")).catch(() => {});

      const {stderr2} = await exec(`truncate -s 0 ./build/dyn/web/base.txt && truncate -s 0 ./build/dyn/web/dyn.module.js`);
      if (stderr2) { console.error(stderr2); }

      if (mycallback) {
        return mycallback({DYN_MOD_WEB});
      }
		} catch (error) {
			console.error(error);
		}
	}

	async getInfoFromZip(zipBin, mycallback) {
    const fs = require("fs/promises");
    const path = require("path");
    const unzipper = require("unzipper");

		try {
			const zipPath = path.resolve(__dirname, "app.zip");
			await fs.writeFile(zipPath, Buffer.from(zipBin, "base64"));

      const info = {name: "Unknown Module", description: "unknown", categories: "unknown", slug: "", image: "", version: "1.0.0"};

      const fsObjects = (await unzipper.Open.file(zipPath)).files;
      await Promise.all(fsObjects.map(async (fsObject) => {
        if (fsObject.path === "web/img/arcade/arcade.jpg" || fsObject.path === "web/img/saito_icon.jpg") {
          info.image = "data:image/jpeg;base64," + (await fsObject.buffer()).toString("base64");
        }

        if (fsObject.path.substring(0, 3) == "lib" || fsObject.path.substring(fsObject.path.length -2) !== "js")     { return; }
        if (["web", "src", "www", "lib", "license", "docs", "sql"].some((s) => fsObject.path.indexOf(`${s}/`) > -1)) { return; }

        const zipLines = (await fsObject.buffer()).toString("utf-8").split("\n");

        const found = {name: false, description: false, categories: false, slug: false};

        const cleanString = (str) => {
          str = str.replace(/^\s+|\s+$/gm, "");
          return [...str.substring(1, str.length - 1)].map((char) => /[\w.,! -]/.test(char) ? char : "").join("");
        };

        for (let i = 0; i < Math.min(100, zipLines.length) && !(found.name && found.description && found.categories); i++) {
          for (const [field, bar] of [
            ["name",        () => { if (info.name.length > 50 || info.name === "name") { info.name = "Unknown"; found.name = false; } }],
            ["description", () => {}],
            ["categories",  () => {}],
            ["slug",        () => {}]
          ]) {
            if ((new RegExp(`this.${field}`)).test(zipLines[i]) && !found[field]) {
              found[field] = true;
              const indexOfEqual = zipLines[i].indexOf("=");
              if (indexOfEqual > 0) {
                info[field] = cleanString(zipLines[i].substring(indexOfEqual)).replace(/^\s+|\s+$/gm, "");
                bar();
              }
            }
          }
        }
      }));
      await fs.unlink(zipPath);

			if (mycallback) {
				return mycallback(info);
			}
		} catch (error) {
			console.error(error);
		}
	}

	download(content, fileName, contentType, callback) {
		const a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([content], {type: contentType}));
		a.download = fileName;
		a.click();

		if (callback) {
			return callback();
		}
	}
}

module.exports = DevTools;