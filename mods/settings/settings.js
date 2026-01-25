const Module = require('../../lib/saito/module');
const SettingsAppspace = require('./lib/appspace/main');
const AppSettings = require('./lib/settings-settings');


class Settings extends Module {
	constructor(app) {
		super(app);
		this.app = app;
		this.name = 'Settings';
		this.appname = 'Settings';
		this.slug = 'settings';
		this.description = 'Convenient Email plugin for managing Saito account settings';
		this.class = 'utility';
		this.utilities = 'Core Utilities';
		this.link = '/email?module=settings';
		this.icon = 'fas fa-cog';
		this.description = 'User settings module.';
		this.categories = 'Admin Users';
		this.styles = ['/settings/style.css', '/saito/lib/jsonTree/jsonTree.css'];
		this.main = null;

		return this;
	}

	async initialize(app) {
		await super.initialize(app);

		this.app.connection.on('registry-update-identifier', (publickey) => {
			if (publickey === this.publicKey) {
				if (document.getElementById('register-identifier-btn')) {
					let username = app.keychain.returnIdentifierByPublicKey(this.publicKey);
					document.getElementById('register-identifier-btn').innerHTML = username;
					document.getElementById('register-identifier-btn').onclick = null;
				}
			}
		});

		this.app.connection.on('settings-overlay-render-request', async () => {
			if (!this.main) {
				this.main = new SettingsAppspace(this.app, this);
				this.attachStyleSheets();
			}
			setTimeout(() => {
				this.main.render();
			}, 50);
		});

		if (!app.options.settings) {
			app.options.settings = { debug: false };
		}
	}

  async render() {
    if (this.app.BROWSER && this.browser_active) {
      document.documentElement.setAttribute("data-theme", "dark");

      const linkElement1 = document.createElement("link");
      linkElement1.setAttribute("rel", "stylesheet");
      linkElement1.setAttribute("href", "/saito/lib/font-awesome-6/css/fontawesome.min.css");
      linkElement1.setAttribute("type", "text/css");
      linkElement1.setAttribute("media", "screen");
      document.head.appendChild(linkElement1);

      const linkElement2 = document.createElement("link");
      linkElement2.setAttribute("rel", "stylesheet");
      linkElement2.setAttribute("href", "/saito/lib/font-awesome-6/css/all.css");
      linkElement2.setAttribute("type", "text/css");
      linkElement2.setAttribute("media", "screen");
      document.head.appendChild(linkElement2);

      this.app.connection.emit("settings-overlay-render-request");
    }
  }

	canRenderInto(qs) {
		return false;
	}

	renderInto(qs) {
		if (qs == '.theme-selector') {
			if (!this.renderIntos[qs]) {
				this.renderIntos[qs] = [];
			}
			this.renderIntos[qs].forEach((comp) => {
				comp.render();
			});
		}
	}

	respondTo() {
		return null;
	}

	hasSettings() {
		return true;
	}

	loadSettings(container) {
		let as = new AppSettings(this.app, this, container);
		as.render();
	}
}

module.exports = Settings;
