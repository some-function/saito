const saito = require('../../lib/saito/saito');
const Transaction = require('../../lib/saito/transaction').default;
const ModTemplate = require('../../lib/templates/modtemplate');
const PhotoUploader = require('../../lib/saito/ui/saito-photo-uploader/saito-photo-uploader');
const UpdateDescription = require('./lib/ui/update-description');
const SaitoHeader = require('../../lib/saito/ui/saito-header/saito-header');
const SaitoProfile = require('../../lib/saito/ui/saito-profile/saito-profile');
const pageHome = require('./index');

class Profile extends ModTemplate {
	constructor(app) {
		super(app);
		this.app = app;
		this.name = 'Profile';
		this.slug = 'profile';
		this.description = 'Profile Module';
		this.archive_public_key;
		this.cache = {};
		this.enable_profile_edits = true;

		this.social = {
			twitter: '@SaitoOfficial',
			title: '🟥 Saito User - Web3 Social Media',
			url: 'https://saito.io/redsquare#profile',
			description: 'Peer to peer Web3 social media platform',
			image: 'https://saito.tech/wp-content/uploads/2022/04/saito_card.png'
		};

		app.connection.on('profile-fetch-content-and-update-dom', async (key) => {
			console.info('profile-fetch-content-and-update-dom --- ' + key);

			if (!this.cache[key]) {
				if (this.app.keychain.isWatched(key)) {
					let returned_key = this.app.keychain.returnKey(key);

					if (returned_key?.profile) {
						this.cache[key] = await this.fetchProfileFromArchive(returned_key);
						console.debug(
							'PROFILE: cache from local Archive of my watched key',
							key,
							this.cache[key]
						);
					}
				}
			}

			if (this.cache[key]) {
				this.app.connection.emit('profile-update-dom', key, this.cache[key]);
				return;
			}

			this.cache[key] = {};


			this.app.storage.loadTransactions(
				{ field1: 'Profile', field2: key },
				async (txs) => {
					let data_found = {};
					if (txs?.length > 0) {
						for (let i = txs.length - 1; i >= 0; i--) {
							let txmsg = txs[i].returnMessage();
							Object.assign(data_found, txmsg.data);
						}

						console.debug('PROFILE: cache from remote archive', key, this.cache[key], data_found);
						Object.assign(this.cache[key], data_found);
						this.app.connection.emit('profile-update-dom', key, this.cache[key]);
					} else {
						console.debug('No profile txs for: ' + key);
					}
				},
				null
			);
		});

		app.connection.on('profile-edit-banner', (profile_key) => {
			this.photoUploader = new PhotoUploader(this.app, this.mod, 'banner');
			this.photoUploader.callbackAfterUpload = async (photo) => {
				let banner = await this.app.browser.resizeImg(photo);
				this.sendProfileTransaction({ banner }, profile_key);
			};
			this.photoUploader.render(this.photo);
		});

		app.connection.on('profile-edit-description', (key) => {
			const elementId = `profile-description-${key}`;
			const element = document.querySelector(`#${elementId}`);
			this.updateDescription = new UpdateDescription(this.app, this, key);
			this.updateDescription.render(element ? element.textContent : '');
		});
	}

	async onConfirmation(blk, tx, conf) {
		let txmsg = tx.returnMessage();
		if (Number(conf) == 0) {
			if (txmsg.request === 'update profile') {
				if (this.app.BROWSER) {
					console.debug('Profile onConfirmation');
				}
				await this.receiveProfileTransaction(tx);
			}
		}
	}

	async onPeerServiceUp(app, peer, service = {}) {
		if (!app.BROWSER) {
			return;
		}

		if (service.service === 'archive') {
			let keys_to_check = app.keychain.returnKeys({ watched: true, profile: undefined });

			console.debug('PROFILE -- check friends keys in Archive!');

			for (let key of keys_to_check) {
				app.keychain.addKey(key.publicKey, { profile: {} });

				app.storage.loadTransactions(
					{ field1: 'Profile', field2: key.publicKey },
					async (txs) => {
						let txs_found = {};
						if (txs?.length > 0) {
							for (let i = txs.length - 1; i >= 0; i--) {
								let txmsg = txs[i].returnMessage();
								for (let k in txmsg.data) {
									txs_found[k] = txs[i];
								}
							}
						}
						for (let k in txs_found) {
							await this.receiveProfileTransaction(txs_found[k]);
						}
					},
					peer
				);
			}
		}
	}

	async render() {
		let param = this.app.browser.returnURLParameter('load_key');
		if (param) {
			let key = JSON.parse(this.app.crypto.base64ToString(param));

			if (key.publicKey !== this.publicKey) {
				let result = await this.app.wallet.onUpgrade('import', key.privateKey);
				if (result) {
					let c = await sconfirm(`Import key ${this.app.keychain.returnUsername(key.publicKey)}?`);
					if (c) {
						reloadWindow(300);
					}
					return;
				}
			}
		}

		this.main = new SaitoProfile(this.app, this);
		this.header = new SaitoHeader(this.app, this);

		await this.header.initialize(this.app);

		this.main.reset(this.publicKey);

		this.addComponent(this.main);
		this.addComponent(this.header);

		await super.render(this.app, this);
	}

	async sendProfileTransaction(data) {
		this.app.connection.emit('saito-header-update-message', { msg: 'broadcasting profile update' });

		let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(this.publicKey);
		newtx.msg = {
			module: this.name,
			request: 'update profile',
			data
		};

		await newtx.sign();

		this.app.connection.emit('profile-update-dom', this.publicKey, data);

		await this.app.network.propagateTransaction(newtx);
	}

	async receiveProfileTransaction(tx) {
		let from = tx?.from[0]?.publicKey;

		if (!from) {
			console.error('Profile: Invalid TX');
			return;
		}

		let txmsg = tx.returnMessage();

		if (!this.cache[from]) {
			this.cache[from] = {};
		}

		Object.assign(this.cache[from], txmsg.data);

		if (this.app.BROWSER && this.app.keychain.isWatched(from)) {
			console.info(`PROFILE UPDATE for ${this.app.keychain.returnUsername(from)}: `, txmsg.data);

			let data = {};

			for (let key in txmsg.data) {
				if (key == 'archive') {
					data[key] = txmsg.data[key];
				} else {
					data[key] = tx.signature;
				}
			}

			let returned_key = this.app.keychain.returnKey(from);

			let profile = Object.assign({}, returned_key?.profile);

			for (let field in txmsg.data) {
				if (profile[field]) {
					await this.app.storage.deleteTransaction(profile[field], '', 'localhost');
				}
			}

			profile = Object.assign(profile, data);


			this.app.keychain.addKey(from, { profile });

			await this.saveProfileTransaction(tx);
		} else if (!this.app.BROWSER) {
			await this.saveProfileTransaction(tx);
		}

		if (tx.isFrom(this.publicKey)) {
			this.app.connection.emit('saito-header-update-message', { msg: '' });
			siteMessage('Profile updated', 2000);
		}

		if (this.app.keychain.isWatched(from)) {
			this.app.connection.emit('profile-update-dom', from, this.cache[from]);
		}
	}

	async fetchProfileFromArchive(key) {
		console.info('PROFILE: Fetching local profile for: ', key);
		return this.app.storage.loadTransactions(
			{ field2: key.publicKey, field1: 'Profile' },
			(txs) => {
				if (txs?.length > 0) {
					let obj = {};
					for (let tx of txs) {
						let txmsg = tx.returnMessage();

						for (let field in key.profile) {
							if (key.profile[field] === tx.signature) {
								if (txmsg.data[field]) {
									obj[field] = txmsg.data[field];
								}
							}
						}
					}
					return obj;
				}
				return null;
			},
			'localhost'
		);
	}

	async saveProfileTransaction(tx) {
		await this.app.storage.saveTransaction(tx, { field1: 'Profile', preserve: 1 }, 'localhost');
	}

	webServer(app, expressapp, express) {
		let webdir = `${__dirname}/../../mods/${this.dirname}/web`;
		let mod_self = this;

		expressapp.get('/' + encodeURI(this.returnSlug()), async function (req, res) {
			let reqBaseURL = req.protocol + '://' + req.headers.host + '/';

			let updatedSocial = Object.assign({}, mod_self.social);

			updatedSocial.url = reqBaseURL + encodeURI(mod_self.returnSlug());

			let html = pageHome(app, mod_self, app.build_number, updatedSocial);
			if (!res.finished) {
				res.setHeader('Content-type', 'text/html');
				res.charset = 'UTF-8';
				return res.send(html);
			}
			return;
		});

		expressapp.use('/' + encodeURI(this.returnSlug()), express.static(webdir));
	}
}

module.exports = Profile;