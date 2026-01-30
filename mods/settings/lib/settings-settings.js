const SettingsTemplate = require("./settings-settings.template");


class Settings {
	constructor(app, mod, container=".saito-module-settings") {
		this.app = app;
		this.mod = mod;
		this.container = container;
	}

	render() {
		this.app.browser.addElementToSelector(SettingsTemplate(this.app, this.mod), this.container);
		this.attachEvents();
	}

	attachEvents() {	
		document.getElementById("show").addEventListener("change", (e) => {
			this.app.options.settings.debug = !!e.currentTarget.checked;
      for (const mod of this.app.modManager.mods) {
        mod.debug = this.app.options.settings.debug;
      }
		});
	}
}

module.exports = Settings;