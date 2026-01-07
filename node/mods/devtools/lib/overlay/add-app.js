const AddAppOverlayTemplate = require("./add-app.template.js");
const SaitoOverlay = require("./../../../../lib/saito/ui/saito-overlay/saito-overlay");
const InstallOverlay = require("./install-app.js");
const Transaction = require("../../../../lib/saito/transaction").default;


class AddAppOverlay {
	constructor(app, mod) {
		this.app = app;
		this.mod = mod;
		this.overlay = new SaitoOverlay(app, mod);
		this.installOverlay = new InstallOverlay(app, mod);

		this.app.connection.on("saito-app-app-render-request", () => { this.render(); });
	}

	render() {
		this.overlay.show(AddAppOverlayTemplate());
		this.attachEvents();
	}

	attachEvents() {
		try {
			this.app.browser.addDragAndDropFileUploadToElement("saito-app-upload", async (filesrc) => {
				document.querySelector(".saito-app-upload").innerHTML = "Uploading file...";
				
				const data = (() => {
          try { 
            return JSON.parse(filesrc); 
          } catch (error) { 
            return (filesrc.indexOf("data:application/octet-stream;base64,") > 0) ? this.app.crypto.base64ToString(filesrc) : "";
          }
        })();

				const newtx = new Transaction();
		    newtx.deserialize_from_web(this.app, data);

		    const msg = newtx.returnMessage();
        this.installOverlay = {
          ...this.installOverlay, bin: msg.bin, categories: msg.categories, description: msg.description, image: msg.image,
          publisher: msg.publisher, request: msg.request, name: msg.name, version: msg.version, slug: msg.slug, tx: newtx, tx_json: data
        };
				this.installOverlay.render();
				this.overlay.close();

			}, true, false, true);

		} catch(error) {
			console.error(error);
			salert("An error occurred while getting application details. Check console for details.");
		}
	}
}

module.exports = AddAppOverlay;