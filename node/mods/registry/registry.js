const ModTemplate = require('./../../lib/templates/modtemplate');
const RegisterUsernameOverlay = require('./lib/register-username');
const PeerService = require('saito-js/lib/peer_service').default;
const AppSettings = require('./lib/registry-settings');

class Registry extends ModTemplate {
	constructor(app) {
		super(app);

		this.app = app;
		this.name = 'Registry';
		this.slug = 'registry';
		this.description = 'Saito DNS support';
		this.categories = 'Core Utilities Messaging';
		this.class = 'utility';

		this.registry_publickey = 'sFQuGQ6teVaHs6AAtBBWeDwtGMCGCPNyhTJqYDXCvvVK';

		this.peers = [];

		this.cached_keys = {};
		this.keys_to_look_up = [];
		this.identifier_timeout = null;

		this.publicKey = '';

		this.local_dev = 0;

		this.app.connection.on('registry-fetch-identifiers-and-update-dom', async (keys) => {
			if (Math.random() < 0.05) {
				for (let i of Object.keys(this.cached_keys)) {
					if (i == this.cached_keys[i]) {
						delete this.cached_keys[i];
					}
				}
			}

			for (let i = 0; i < keys.length; i++) {
				if (this.cached_keys[keys[i]]) {
					this.app.browser.updateAddressHTML(keys[i], this.cached_keys[keys[i]]);
				} else {
					if (!this.keys_to_look_up.includes(keys[i])) {
						this.keys_to_look_up.push(keys[i]);
					}
				}
			}

			this.app.connection.emit('update-username-in-game');

			if (this.identifier_timeout) {
				clearTimeout(this.identifier_timeout);
			}

			this.identifier_timeout = setTimeout(() => {
				let unidentified_keys = Array.from(this.keys_to_look_up);
				this.keys_to_look_up = [];

				this.fetchManyIdentifiers(unidentified_keys, (answer) => {
					Object.entries(answer).forEach(([key, value]) => {
						if (value !== this.publicKey) {
							if (this.app.keychain.returnKey(key, true) && key !== value) {
								this.app.keychain.addKey({
									publicKey: key,
									identifier: value
								});
							}

							this.app.browser.updateAddressHTML(key, value);
						}
					});

					this.app.connection.emit('update-username-in-game');

					for (let i = 0; i < unidentified_keys.length; i++) {
						if (!this.cached_keys[unidentified_keys[i]]) {
							this.cached_keys[unidentified_keys[i]] = unidentified_keys[i];
						}
					}
				});
			}, 250);
		});

		this.app.connection.on('register-username-or-login', (obj) => {
			let key = this.app.keychain.returnKey(this.publicKey);
			if (key?.has_registered_username) {
				return;
			}
			if (!this.register_username_overlay) {
				this.register_username_overlay = new RegisterUsernameOverlay(this.app, this);
			}
			if (obj?.success_callback) {
				this.callback = obj.success_callback;
			}
			this.register_username_overlay.render(obj?.msg);
		});

		if (this.app.BROWSER) {
			let xhr = new XMLHttpRequest();
			xhr.open('GET', '/saito/lib/adjectives.json', true);
			xhr.responseType = 'json';
			xhr.send();
			xhr.onload = () => {
				if (xhr.status != 200) {
					console.error('problem loading dictionary!');
				} else {
					this.wordlist1 = xhr.response;
				}
			};

			let xhr2 = new XMLHttpRequest();
			xhr2.open('GET', '/saito/lib/nouns.json', true);
			xhr2.responseType = 'json';
			xhr2.send();
			xhr2.onload = () => {
				if (xhr2.status != 200) {
					console.error('problem loading dictionary!');
				} else {
					this.wordlist2 = xhr2.response;
				}
			};
		}

		return this;
	}

	async initialize(app) {
		await super.initialize(app);

		if (this.app.BROWSER == 0) {
			if (this.local_dev) {
				this.registry_publickey = this.publicKey;
				console.log('Registry public key: ' + this.registry_publickey);
			}
		}

		if (!this.app.options.registry) {
			this.app.options.registry = {};
		}
	}

	returnServices() {
		let services = [];

		if (this.app.BROWSER == 0) {
			services.push(new PeerService(null, 'registry', 'saito'));
		}
		return services;
	}

	fetchManyIdentifiers(publickeys = [], mycallback = null) {
		let registry_self = this;

		if (mycallback == null) {
			return;
		}

		const found_keys = {};
		const missing_keys = [];

		publickeys.forEach((publickey) => {
			const identifier = this.app.keychain.returnIdentifierByPublicKey(publickey);

			if (identifier) {
				found_keys[publickey] = identifier;
			} else {
				missing_keys.push(publickey);
			}
		});

		if (missing_keys.length == 0) {
			mycallback(found_keys);
			return 1;
		}

		if (this.publicKey == this.registry_publickey) {
			this.fetchIdentifiersFromDatabase(missing_keys, (identifiers) => {
				for (let key in identifiers) {
					registry_self.cached_keys[key] = identifiers[key];
					found_keys[key] = identifiers[key];
				}
				mycallback(found_keys);
			});
		} else {
			if (this.peers.length) {
				this.queryKeys(this.peers[0], missing_keys, (identifiers) => {
					for (let key in identifiers) {
						registry_self.cached_keys[key] = identifiers[key];
						found_keys[key] = identifiers[key];
					}
					mycallback(found_keys);
				});
			} else {
				console.warn('Cannot fetchManyIdentifiers until I connect to a peer with Registry service');
			}
		}
	}

	respondTo(type = '') {
		let registry_self = this;

		if (type == 'saito-return-key') {
			return {
				returnKey: (data = null) => {
					if (typeof data === 'string') {
						let d = { publicKey: '' };
						d.publicKey = data;
						data = d;
					}

					for (let key in registry_self.cached_keys) {
						if (key === data?.publicKey) {
							if (registry_self.cached_keys[key] && key !== registry_self.cached_keys[key]) {
								return {
									publicKey: key,
									identifier: registry_self.cached_keys[key]
								};
							} else {
								return { publicKey: key };
							}
						} else if (registry_self.cached_keys[key] === data?.identifier) {
							return {
								publicKey: key,
								identifier: registry_self.cached_keys[key]
							};
						}
					}

					return null;
				},

				returnKeys: () => {
					keyList = [];

					for (let key in registry_self.cached_keys) {
						keyList.push({
							publicKey: key,
							identifier: registry_self.cached_keys[key]
						});
					}

					return keyList;
				}
			};
		}

		if (type == 'saito-translate-anonymous') {
			return {
				translate: (publicKey) => {
					if (!this.app.options?.registry?.override_names) {
						return null;
					}

					let pk = this.app.crypto.fromBase58(publicKey);

					let p1 = pk.slice(-6, -5);
					let n1 = pk.slice(-5, -3);
					let n2 = pk.slice(-3);

					let f1 = 1 + (parseInt(p1, 16) % 8);

					let num1 = f1 * parseInt(n1, 16);
					let num2 = parseInt(n2, 16);

					return `<span class='saito-anon'>"${this.wordlist1[num1]} ${this.wordlist2[num2]}"</span><i class="fa-solid fa-user-secret"></i>`;
				}
			};
		}

		return super.respondTo(type);
	}

	async tryRegisterIdentifier(identifier, domain = '@saito') {
		let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(
			this.registry_publickey
		);
		if (!newtx) {
			throw Error('NULL TX CREATED IN REGISTRY MODULE');
		}

		if (typeof identifier === 'string' || identifier instanceof String) {
			var regex = /^[0-9A-Za-z]+$/;
			if (!regex.test(identifier)) {
				throw Error('Alphanumeric Characters only');
			}
			newtx.msg.module = 'Registry';
			newtx.msg.request = 'register';
			newtx.msg.identifier = identifier + domain;

			await newtx.sign();
			await this.app.network.propagateTransaction(newtx);

			return true;
		} else {
			throw TypeError('identifier must be a string');
		}
	}

	queryKeys(peer, keys, mycallback) {
		if (peer == undefined) {
			console.error('Attempting to query keys from undefined peer');
			console.log('Available Registry service peers:', this.peers);
			if (mycallback) {
				mycallback({});
			}
			return;
		}

		let data = {
			request: 'registry query',
			keys: keys
		};

		return this.app.network.sendRequestAsTransaction(
			'registry query',
			data,
			mycallback,
			peer.peerIndex
		);
	}

	onPeerServiceUp(app, peer, service = {}) {
		if (service.service === 'registry') {
			this.peers.push(peer);

			if (!app.BROWSER) {
				return;
			}

			if (this.local_dev) {
				this.registry_publickey = peer.publicKey;
			}

			let myKey = app.keychain.returnKey(this.publicKey, true);
			if (myKey?.identifier) {
				let registry_self = this;

				this.queryKeys(peer, [this.publicKey], function (identifiers) {
					for (let key in identifiers) {
						if (key == myKey.publicKey) {
							if (identifiers[key] !== myKey.identifier) {
								console.log('REGISTRY: Identifier mismatch...');
								console.log(
									`REGISTRY: Expecting ${myKey.identifier}, but Registry has ${identifiers[key]}`
								);
							}
							return;
						}
					}

					let identifier = myKey.identifier.split('@');
					if (identifier.length !== 2) {
						console.log('REGISTRY: Invalid identifier', myKey.identifier);
						return;
					}
					registry_self.tryRegisterIdentifier(identifier[0], '@' + identifier[1]);
					console.log('REGISTRY: Attempting to register our name again');
				});
			} else if (myKey?.has_registered_username) {
				console.log('REGISTRY: unset registering... status');
				this.app.keychain.addKey(this.publicKey, {
					has_registered_username: false
				});
				this.app.connection.emit('registry-update-identifier', this.publicKey);
			}

			let msg = {
				request: 'cached keys'
			};

			this.app.network.sendRequestAsTransaction(
				'registry',
				msg,
				(keys) => {
					for (let key in keys) {
						if (!this.cached_keys[key] || key == this.cached_keys[key]) {
							this.cached_keys[key] = keys[key];
						}
					}
					this.app.connection.emit('registry-cache-loaded');
				},
				peer.peerIndex
			);
		}
	}

	async handlePeerTransaction(app, newtx = null, peer, mycallback = null) {
		if (newtx == null) {
			return 0;
		}
		let txmsg = newtx.returnMessage();
		if (!txmsg?.data) {
			return 0;
		}

		if (txmsg.request == 'registry query') {
			if (txmsg.data.request === 'registry query') {
				let keys = txmsg.data?.keys;
				return this.fetchIdentifiersFromDatabase(keys, mycallback);
			}

			if (txmsg.data.request === 'registry namecheck') {
				let identifier = txmsg.data?.identifier;
				return this.checkIdentifierInDatabase(identifier, mycallback);
			}
		}

		if (txmsg.request == 'registry') {
			if (txmsg.data.request === 'cached keys') {
				if (mycallback) {
					mycallback(this.cached_keys);
				}
			}
		}

		return super.handlePeerTransaction(app, newtx, peer, mycallback);
	}

	async onConfirmation(blk, tx, conf) {
		let txmsg = tx.returnMessage();

		if (Number(conf) == 0) {
			if (txmsg?.module === 'Registry') {
				console.log(`REGISTRY: ${tx.from[0].publicKey} -> ${txmsg.identifier}`);

				if (tx.isTo(this.publicKey) && this.publicKey === this.registry_publickey) {
					console.log('I AM THE REGISTERING MACHINE!');
					let identifier = txmsg.identifier;
					let publickey = tx.from[0].publicKey;
					let unixtime = new Date().getTime();
					let bid = blk.id;
					let bsh = blk.hash;
					let lock_block = 0;
					let signed_message = identifier + publickey + bid + bsh;
					let sig = this.app.crypto.signMessage(
						signed_message,
						await this.app.wallet.getPrivateKey()
					);
					let signer = this.registry_publickey;
					let lc = 1;

					let res = await this.addRecord(
						identifier,
						publickey,
						unixtime,
						bid,
						bsh,
						lock_block,
						sig,
						signer,
						1
					);
					let fee = BigInt(0);

					let newtx = await this.app.wallet.createUnsignedTransaction(
						tx.from[0].publicKey,
						BigInt(0),
						fee
					);

					if (res == 1) {
						newtx.msg.module = 'Email';
						newtx.msg.origin = 'Registry';
						newtx.msg.title = 'Address Registration Success!';
						newtx.msg.identifier = identifier;
						newtx.msg.publickey = publickey;
						newtx.msg.unixtime = unixtime;
						newtx.msg.bid = bid;
						newtx.msg.bsh = bsh;
						newtx.msg.lock_block = lock_block;
						newtx.msg.bsh = unixtime;
						newtx.msg.signer = signer;
						newtx.msg.signed_message = signed_message;
						newtx.msg.signature = sig;
					} else {
						newtx.msg.module = 'Email';
						newtx.msg.title = 'Address Registration Failed!';
						newtx.msg.identifier = identifier;
						newtx.msg.publickey = publickey;
						newtx.msg.unixtime = unixtime;
						newtx.msg.bid = bid;
						newtx.msg.bsh = bsh;
						newtx.msg.lock_block = lock_block;
						newtx.msg.bsh = unixtime;
						newtx.msg.signer = signer;
						newtx.msg.signed_message = '';
						newtx.msg.signature = '';
					}

					console.log('REGISTRY signing transaction...');
					await newtx.sign();
					console.log('REGISTRY propagating transaction...');
					await this.app.network.propagateTransaction(newtx);
					console.log('REGISTRY done propagating transaction...');

					return;
				}
			}

			if (txmsg?.module == 'Email') {
				console.log('REGISTRY EMAIL: ' + txmsg.title, 'to: ', tx.to[0].publicKey);
				console.log(tx);

				if (tx.from[0].publicKey == this.registry_publickey) {
					console.log('FROM THE REGISTRAR!');
					try {
						let publickey = tx.to[0].publicKey;
						let identifier = tx.msg.identifier;
						let signed_message = tx.msg.signed_message;
						let sig = tx.msg.signature;
						let bid = tx.msg.bid;
						let bsh = tx.msg.bsh;
						let unixtime = tx.msg.unixtime;
						let lock_block = tx.msg.lock_block;
						let signer = tx.msg.signer;
						let lc = 1;

						if (this.app.crypto.verifyMessage(signed_message, sig, this.registry_publickey)) {
							if (this.publicKey != this.registry_publickey) {
								if (!this.app.BROWSER) {
									let res = await this.addRecord(identifier, publickey, unixtime, bid, bsh, lock_block, sig, signer, 1);
								}

								if (tx.isTo(this.publicKey)) {
									this.app.keychain.addKey(tx.to[0].publicKey, {
										identifier: identifier,
										watched: true,
										block_id: blk.id,
										block_hash: blk.hash,
										lc: 1
									});
									console.info('***********************');
									console.info('verification success for : ' + identifier);
									console.info('***********************');

									this.app.browser.updateAddressHTML(tx.to[0].publicKey, identifier);
									this.app.connection.emit('registry-update-identifier', tx.to[0].publicKey);

									if (this.callback) {
										this.callback(identifier);
									}
								}
							}
						}
					} catch (err) {
						console.error('ERROR verifying username registration message: ', err);
					}
				}
			}
		}
	}

	async fetchIdentifiersFromDatabase(keys, mycallback = null) {
		let registry_self = this;
		let found_keys = {};
		let missing_keys = [];

		let myregexp = new RegExp('^([a-zA-Z0-9])*$');
		for (let i = keys.length - 1; i >= 0; i--) {
			if (!myregexp.test(keys[i])) {
				keys.splice(i, 1);
				continue;
			}
		}

		if (keys.length > 0) {
			const where_statement = `publickey in ("${keys.join('","')}")`;
			const sql = `SELECT * 
                   FROM records
                   WHERE ${where_statement}`;

			let rows = await this.app.storage.queryDatabase(sql, {}, 'registry');
			if (rows?.length > 0) {
				for (let i = 0; i < rows.length; i++) {
					found_keys[rows[i].publickey] = rows[i].identifier;
					registry_self.cached_keys[rows[i].publickey] = rows[i].identifier;
				}
			}
		}

		let found_check = Object.keys(found_keys);

		for (let key of keys) {
			if (!found_check.includes(key)) {
				missing_keys.push(key);
			}
		}

		if (missing_keys.length > 0 && this.publicKey !== this.registry_publickey) {
			let has_peer = false;
			for (let i = 0; i < this.peers.length; i++) {
				if (this.peers[i].publicKey == this.registry_publickey) {
					has_peer = true;
					return this.queryKeys(this.peers[i], missing_keys, (res) => {
						for (let key in res) {
							if (res[key] !== key) {
								registry_self.cached_keys[key] = res[key];
								found_keys[key] = res[key];
							}
						}

						if (mycallback) {
							mycallback(found_keys);
							return 1;
						}
					});
				}
			}

			if (!has_peer) {
				console.log('REGISTRY: Not a peer with the central DNS');
				mycallback(found_keys);
			}

			return 0;
		} else if (mycallback) {
			mycallback(found_keys);
			return found_check.length > 0;
		}
	}

	async checkIdentifierInDatabase(identifier, mycallback = null) {
		if (!mycallback) {
			console.warn('No callback');
			return 0;
		}

		if (this.publicKey == this.registry_publickey) {
			const sql = `SELECT * FROM records WHERE identifier = ?`;

			let rows = await this.app.storage.queryDatabase(sql, [identifier], 'registry');

			mycallback(rows);
			return 1;
		} else {
			await this.sendPeerDatabaseRequestWithFilter(
				'Registry',
				`SELECT * FROM records WHERE identifier = "${identifier}"`,
				(res) => {
					mycallback(res?.rows);
					return 1;
				},

				(p) => {
					if (p.publicKey == this.registry_publickey) {
						return 1;
					}
					return 0;
				}
			);
		}
		return 0;
	}

	async addRecord(
		identifier = '',
		publickey = '',
		unixtime = 0,
		bid = 0,
		bsh = '',
		lock_block = 0,
		sig = '',
		signer = '',
		lc = 1
	) {
		let sql = `INSERT OR IGNORE INTO records (identifier,
                                    publickey,
                                    unixtime,
                                    bid,
                                    bsh,
                                    lock_block,
                                    sig,
                                    signer,
                                    lc)
               VALUES ($identifier,
                       $publickey,
                       $unixtime,
                       $bid,
                       $bsh,
                       $lock_block,
                       $sig,
                       $signer,
                       $lc)`;
		let params = {
			$identifier: identifier,
			$publickey: publickey,
			$unixtime: unixtime,
			$bid: Number(bid),
			$bsh: bsh,
			$lock_block: lock_block,
			$sig: sig,
			$signer: signer,
			$lc: lc
		};

		let res = await this.app.storage.runDatabase(sql, params, 'registry');

		return res?.changes;
	}

	async onChainReorganization(bid, bsh, lc) {
		var sql = 'UPDATE records SET lc = $lc WHERE bid = $bid AND bsh = $bsh';
		var params = { $bid: bid, $bsh: bsh };
		await this.app.storage.runDatabase(sql, params, 'registry');
		return;
	}

	shouldAffixCallbackToModule(modname) {
		if (modname == this.name) {
			return 1;
		}
		if (modname == 'Email') {
			return 1;
		}
		return 0;
	}

	hasSettings() {
		return true;
	}

	loadSettings(container) {
		let as = new AppSettings(this.app, this, container);
		as.render();
	}
}

module.exports = Registry;
