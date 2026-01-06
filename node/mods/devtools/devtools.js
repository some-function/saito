const ModTemplate = require("../../lib/templates/modtemplate");
const SaitoHeader = require("../../lib/saito/ui/saito-header/saito-header");
const AddAppOverlay = require("./lib/overlay/add-app");
const GenerateAppOverlay = require("./lib/overlay/generate-app");
const { execFile } = require("child_process");


class DevTools extends ModTemplate {
	constructor(app) {
		super(app);

		this.app = app;

		this.name = "DevTools";
		this.appname = "DevTools";
		this.slug = "devtools";
		this.description = "Application manages installing, indexing, compiling and serving Saito modules.";
		this.categories = "Utilities Dev";
		this.featured_apps = [];
		this.header = null;
		this.icon = "fas fa-window-restore";

		this.bundling_timer = null;
		this.renderMode = "none";
		this.search_options = {};

		this.styles = ["/saito/saito.css"];

		this.addAppOverlay = null;
		this.zipFile = null;
		this.title = null;
		this.description = null;
		this.app_slug = null;
		this.version = null;
		this.publisher = null;
		this.category = null;
		this.img = null;
		this.generate_app = null;
	}

	async initialize(app) {
		await super.initialize(app);
		this.addAppOverlay = new AddAppOverlay(this.app, this);
		this.generateAppOverlay = new GenerateAppOverlay(this.app, this);
	}

	async render() {
		if (!this.app.BROWSER) {
			return;
		}

		this.header = new SaitoHeader(this.app, this);
		await this.header.initialize(this.app);

		this.addComponent(this.header);

		await super.render();
		this.attachEvents();
	}

	async initializeHTML(app) {
		await super.initializeHTML(app);

		if (this.header == null) {
			this.header = new SaitoHeader(app, this);
			await this.header.initialize(app);
		}
		await this.header.render(app, this);
		this.header.attachEvents(app, this);
	}

	respondTo(type) {
		return null;
	}

	async sendSubmitModuleTransaction(zip, slug, callback) {
		let peers = await this.app.network.getPeers();
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
		if (tx === null) {
			return 0;
		}

		const txMessage = tx.returnMessage();

		if (!txMessage.request) {
			return 0;
		}
		if (txMessage.request === "submit module") {
			await this.createAppBinary(txMessage.data.moduleZip, txMessage.data.slug, mycallback);
		}
		if (txMessage.request === "get module details") {
			await this.getNameAndDescriptionFromZip(txMessage.data.moduleZip, mycallback);
		}

		return super.handlePeerTransaction(app, tx, peer, mycallback);
	}

	clear() {
		this.zipFile = null;
		this.title = null;
		this.description = null;
		this.app_slug = null;
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
                this.generateAppOverlay.mod_details = res;
                this.generateAppOverlay.mod_details.publisher = this.publicKey;
                this.generateAppOverlay.zipFile = this.zipFile;
                this.generateAppOverlay.render();
              }
						});
					},
					true, false, false
				);

				if (document.getElementById("install")) {
					document.getElementById("install").onclick = (_) => {
						this.app.connection.emit("saito-app-app-render-request");
					};
				}
			}
		} catch (err) {
			console.error("Error: ", err);
			salert("An error occurred while compiling application. Check console for details.");
		}
	}

	async createAppBinary(zipBin, slug, mycallback) {
    const path = require("path");
    const unzipper = require("unzipper");
    const {exec} = require("child_process/promises");
    const fs = require("fs/promises");

    const maxSize = 10 * 1024 * 1024;
    const base64Ratio = 1.37;
    if (zipBin.length > maxSize * base64Ratio) {
      return;
    }

    const zipPath = path.resolve(__dirname, "app.zip");

    try {
      await fs.writeFile(zipPath, Buffer.from(zipBin, "base64"));

      const directory = await unzipper.Open.file(zipPath);
      const fsObjects = directory.files;
      const appPath = fsObjects.map((fsObject) => fsObject.path).find((path) => path === `${slug}.js` || path.endsWith(`/${slug}.js`));

      await directory.extract({path: "./tmp_mod/"});
      
      const {stderr1} = await execFile("./scripts/dyn-mod-compile.sh", [appPath]);
      if (stderr1) console.error(stderr1);

      await fs.unlink(zipPath);

      const DYN_MOD_WEB = await fs.readFile("./build/dyn_mod.js", {encoding: "binary"});

      await fs.rm(path.resolve("./tmp_mod"), {recursive: true, force: true}).catch(() => {});
      await fs.unlink(path.resolve("./build/dyn_mod.js")).catch(() => {});

      const {stderr2} = await exec(`truncate -s 0 ./build/dyn/web/base.txt && truncate -s 0 ./build/dyn/web/dyn.module.js`);
      if (stderr2) console.error(stderr2);

      if (mycallback) {
        return mycallback({DYN_MOD_WEB});
      }
		} catch (error) {
			console.error(error);
		}
	}


	async getNameAndDescriptionFromZip(zipBin, mycallback) {
		try {
			const fs = this.app.storage.returnFileSystem();
			const path = require("path");
			const unzipper = require("unzipper");
			let zipPath = "app.zip";

			console.log("zipPath:", zipPath);

			let zipBin2 = Buffer.from(zipBin, "base64").toString("binary");

			fs.writeFileSync(path.resolve(__dirname, zipPath), zipBin2, {encoding: "binary"});

			let name = "Unknown Module";
			let image = "";
			let description = "unknown";
			let categories = "unknown";
			let slug = "";
			let version = "1.0.0";

			try {
				const directory = await unzipper.Open.file(path.resolve(__dirname, zipPath));
				let promises = directory.files.map(async (file) => {
					console.log("file: ", file);

					if (file.path === "web/img/arcade/arcade.jpg") {
						let content = await file.buffer();
						image = "data:image/jpeg;base64," + content.toString("base64");
					}
					if (file.path === "web/img/saito_icon.jpg") {
						let content = await file.buffer();
						image = "data:image/jpeg;base64," + content.toString("base64");
					}

					if (file.path.substr(0, 3) == "lib") {
						return;
					}
					if (file.path.substr(-2) !== "js") {
						return;
					}
					if (file.path.indexOf("web/") > -1) {
						return;
					}
					if (file.path.indexOf("src/") > -1) {
						return;
					}
					if (file.path.indexOf("www/") > -1) {
						return;
					}
					if (file.path.indexOf("lib/") > -1) {
						return;
					}
					if (file.path.indexOf("license/") > -1) {
						return;
					}
					if (file.path.indexOf("docs/") > -1) {
						return;
					}
					if (file.path.indexOf("sql/") > -1) {
						return;
					}

					let content = await file.buffer();
					let zip_text = content.toString("utf-8");
					let zip_lines = zip_text.split("\n");

					let found_name = 0;
					let found_description = 0;
					let found_categories = 0;
					let found_slug = 0;

					for (let i = 0; i < zip_lines.length && i < 100 && (found_name == 0 || found_description == 0 || found_categories == 0); i++) {
						if (/this.name/.test(zip_lines[i]) && found_name == 0) {
							found_name = 1;
							if (zip_lines[i].indexOf("=") > 0) {
								name = zip_lines[i].substring(zip_lines[i].indexOf("="));
								name = cleanString(name);
								name = name.replace(/^\s+|\s+$/gm, "");
								if (name.length > 50) {
									name = "Unknown";
									found_name = 0;
								}
								if (name === "name") {
									name = "Unknown";
									found_name = 0;
								}
							}
						}

						if (/this.description/.test(zip_lines[i]) && found_description == 0) {
							found_description = 1;
							if (zip_lines[i].indexOf("=") > 0) {
								description = zip_lines[i].substring(zip_lines[i].indexOf("="));
								description = cleanString(description);
								description = description.replace(/^\s+|\s+$/gm, "");
							}
						}

						if (/this.categories/.test(zip_lines[i]) && found_categories == 0) {
							found_categories = 1;
							if (zip_lines[i].indexOf("=") > 0) {
								categories = zip_lines[i].substring(zip_lines[i].indexOf("="));
								categories = cleanString(categories);
								categories = categories.replace(/^\s+|\s+$/gm, "");
							}
						}

						if (/this.slug/.test(zip_lines[i]) && found_slug == 0) {
							found_slug = 1;
							if (zip_lines[i].indexOf("=") > 0) {
								slug = zip_lines[i].substring(zip_lines[i].indexOf("="));
								slug = cleanString(slug);
								slug = slug.replace(/^\s+|\s+$/gm, "");
							}
						}
					}

					function cleanString(str) {
						str = str.replace(/^\s+|\s+$/gm, "");
						str = str.substring(1, str.length - 1);
						return [...str]
							.map((char) => {
								if (char == " " || char == "."  || char == "," || char == "!") { return char; }
								if (char == "`" || char == "\\" || char == "'" || char == "\"" || char == ";") { return ""; }
								if (!/[a-zA-Z0-9_-]/.test(char)) { return ""; }
								return char;
							})
							.join("");
					}
				});
				await Promise.all(promises);
			} catch (err) {
				console.log("ERROR UNZIPPING: " + err);
			}

			try {
				await fs.unlink(path.resolve(__dirname, zipPath));
			} catch (error) {
				console.error(error);
			}

			if (mycallback) {
				return mycallback({name, image, description, categories, slug, version});
			}
		} catch (error) {
			console.error(error);
		}
	}

	download(content, fileName, contentType, callback) {
		const a = document.createElement("a");
		const file = new Blob([content], {type: contentType});
		a.href = URL.createObjectURL(file);
		a.download = fileName;
		a.click();

		if (callback) {
			return callback();
		}
	}
}

module.exports = DevTools;