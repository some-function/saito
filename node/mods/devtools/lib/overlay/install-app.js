const InstallAppOverlayTemplate = require("./install-app.template.js");
const SaitoOverlay = require("./../../../../lib/saito/ui/saito-overlay/saito-overlay");


class InstallAppOverlay {
	constructor(app, mod) {
		this.app = app;
		this.mod = mod;
		this.overlay = new SaitoOverlay(app, mod);

		this.bin = "";
		this.description = "";
		this.image = "";
		this.module = "";
		this.publisher = "";
		this.request = "";
		this.name = "";
		this.version = "";
		this.categories = "Utility";
		this.tx = null;
		this.tx_json = null;
		this.slug = null;
	}

	render() {
		this.overlay.show(InstallAppOverlayTemplate(this));
		this.attachEvents();
	}

	attachEvents() {
		try {
			document.querySelector("#saito-app-install-btn").onclick = async (e) => {
				const modData = await this.app.storage.loadLocalApplications(this.slug);

				if (modData.length > 0) {
					if (await sconfirm(`Application "${this.slug}" already exist. Do you want to overwrite it?`)) {
						await this.app.storage.removeLocalApplication(this.slug);
						await this.installApp();
					} else {
						this.overlay.close();
					}
				} else {
					await this.installApp();
				}
				
			}
		} catch (error) {
			console.error(error);
			salert("An error occurred while installing application. Check console for details.");
		}
	}

	async installApp() {
		await this.app.storage.saveLocalApplication(this.name.toLowerCase(), this.bin);

		salert("Applicaton saved. Reloading page...");
		this.overlay.close();

		reloadWindow(1500);
	}
}

module.exports = InstallAppOverlay;