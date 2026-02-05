const InstallAppOverlayTemplate = require("./install-app.template.js");
const SaitoOverlay = require("../../../../lib/ui/saito-overlay/saito-overlay");


class InstallAppOverlay {
	constructor(app, mod) {
		this.app = app;
		this.mod = mod;
		this.overlay = new SaitoOverlay(app, mod);

		this.base64 = "";
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
				const modData = await this.app.storage.loadLocalModules(this.slug);

				if (modData.length > 0) {
					if (await sconfirm(`Module "${this.slug}" already exists. Do you want to overwrite it?`)) {
						await this.app.storage.removeLocalModule(this.slug);
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
		await this.app.storage.saveLocalModule(this.name.toLowerCase(), this.base64);

		salert("Module saved. Reloading page...");
		this.overlay.close();

		reloadWindow(1500);
	}
}

module.exports = InstallAppOverlay;