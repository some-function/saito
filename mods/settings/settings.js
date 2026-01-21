const ModTemplate = require('../../lib/templates/modtemplate');
const SettingsAppspace = require('./lib/appspace/main');
const SettingsThemeSwitcherOverlay = require('./lib/theme-switcher-overlay');
const AppSettings = require('./lib/settings-settings');


class Settings extends ModTemplate {
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

	canRenderInto(qs) {
		return false;
	}

	renderInto(qs) {
		if (qs == '.theme-selector') {
			if (!this.renderIntos[qs]) {
				this.renderIntos[qs] = [];
				this.renderIntos[qs].push(new SettingsThemeSwitcherOverlay(this.app, this, ''));
			}
			this.renderIntos[qs].forEach((comp) => {
				comp.render();
			});
		}
	}

	respondTo(type = '') {
		let settings_self = this;

		if (type === 'saito-header') {
			if (this.app.modules.returnActiveModule()) {
				this.attachStyleSheets();
				return [
					{
						text: 'Theme',
						icon: 'saito-theme-icon fa-solid fa-moon',
						rank: 120,
						type: 'utilities',
						callback: function (app, id) {
							settings_self.renderInto('.theme-selector');
						}
					},
					{
						text: 'Nuke',
						icon: 'fa-solid fa-radiation',
						rank: 130,
						type: 'utilities',
						callback: async function (app, id) {
							let c = await sconfirm('This will wipe out your wallet and delete your data....');
							if (c) {
								await app.wallet.onUpgrade('nuke');
								reloadWindow(150);
							}
						}
					}
				];
			}
		}
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
