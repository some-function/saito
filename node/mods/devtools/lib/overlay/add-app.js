const AddAppOverlayTemplate = require("./add-app.template.js");
const SaitoOverlay = require("./../../../../lib/saito/ui/saito-overlay/saito-overlay");
const InstallAppOverlay = require("./install-app.js");


class AddAppOverlay {
	constructor(app, mod) {
		this.app = app;
		this.mod = mod;
		this.overlay = new SaitoOverlay(app, mod);
		this.installOverlay = new InstallAppOverlay(app, mod);

		this.app.connection.on("saito-app-app-render-request", () => { this.render(); });
	}

	render() {
		this.overlay.show(AddAppOverlayTemplate());
		this.attachEvents();
	}

	attachEvents() {
		try {
			this.app.browser.addDragAndDropFileUploadToElement("saito-app-upload", (base64) => {
				document.querySelector(".saito-app-upload").innerHTML = "Uploading file...";
				
        this.installOverlay.base64 = base64;
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