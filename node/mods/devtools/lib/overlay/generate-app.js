const GenerateAppOverlayTemplate = require("./generate-app.template.js");
const SaitoOverlay = require("./../../../../lib/saito/ui/saito-overlay/saito-overlay");


class GenerateAppOverlay {
	constructor(app, mod) {
		this.app = app;
		this.mod = mod;
		this.overlay = new SaitoOverlay(app, mod);
		this.modDetails = {};
		this.zipFile = null;
	}

	render() {
		this.overlay.show(GenerateAppOverlayTemplate(this));
		this.overlay.blockClose();
		this.attachEvents();
	}

	attachEvents() {
		try {
      const buttonElement = document.querySelector("#saito-app-generate-btn");
			buttonElement.onclick = async () => {
				buttonElement.innerHTML = "Generating app, please wait...";
				buttonElement.classList.add("active");

				await this.mod.sendSubmitModuleTransaction(this.zipFile, this.modDetails.slug, async (res) => {
					const newtx = await this.app.wallet.createUnsignedTransaction(this.publicKey, BigInt(0), BigInt(0));
					newtx.msg = {
            module: "DevTools", request: "submit application", bin: res.DYN_MOD_WEB, name: this.modDetails.name,
            description: this.modDetails.description, slug: this.modDetails.slug, image: this.modDetails.image,
            version: this.modDetails.version, publisher: this.mod.publicKey, categories: this.modDetails.categories
          };

					const jsonData = newtx.serialize_to_web(this.app);
					this.mod.download(JSON.stringify(jsonData), `${this.modDetails.slug}.saito`, "text/plain", () => { this.overlay.close(); });
				});
			}
		} catch (error) {
			console.error(error);
			salert("An error occurred while compiling application. Check console for details.");
		}
	}
}

module.exports = GenerateAppOverlay;