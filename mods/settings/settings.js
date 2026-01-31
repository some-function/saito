const Module = require("../../lib/saito/module");
const SettingsAppspace = require("./lib/appspace/main");
const SettingsSettings = require("./lib/settings-settings");


class Settings extends Module {
	constructor(app) {
		super(app);
		this.app = app;
		this.name = "Settings";
		this.appname = "Settings";
		this.slug = "settings";
		this.description = "Convenient Email plugin for managing Saito account settings";
		this.class = "utility";
		this.utilities = "Core Utilities";
		this.link = "/email?module=settings";
		this.icon = "fas fa-cog";
		this.description = "User settings module.";
		this.categories = "Admin Users";
		this.styles = ["/settings/style.css", "/saito/lib/jsonTree/jsonTree.css"];
		this.main = null;

		return this;
	}

	async initialize(app) {
		await super.initialize(app);

		this.app.connection.on("settings-overlay-render-request", async () => {
			if (!this.main) {
				this.main = new SettingsAppspace(this.app, this);
				this.attachStyleSheets();
			}
			setTimeout(() => { this.main.render(); }, 50);
		});

		if (!app.options.settings) {
			app.options.settings = {debug: false};
		}
	}

  async render() {
    if (this.app.BROWSER && this.browserActive) {
      document.documentElement.setAttribute("data-theme", "dark");

      for (const s of ["fontawesome.min", "all"]) {
        const linkElement = document.createElement("link");
        linkElement.setAttribute("rel", "stylesheet");
        linkElement.setAttribute("href", `/saito/lib/font-awesome-6/css/${s}.css`);
        linkElement.setAttribute("type", "text/css");
        linkElement.setAttribute("media", "screen");
        document.head.appendChild(linkElement);
      }

      this.app.connection.emit("settings-overlay-render-request");
    }
  }

	canRenderInto(qs) { return false; }
	respondTo() { return null; }
	hasSettings() { return true; }
	loadSettings(container) { (new SettingsSettings(this.app, this, container)).render(); }

	renderInto(qs) {
		if (qs == ".theme-selector") {
			if (!this.renderIntos[qs]) {
				this.renderIntos[qs] = [];
			}
      for (const comp of this.renderIntos[qs]) {
        comp.render();
      }
		}
	}
}

module.exports = Settings;