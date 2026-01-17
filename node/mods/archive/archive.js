const ModTemplate = require('../../lib/templates/modtemplate');
const saito = require('../../lib/saito/saito');
const JsStore = require('jsstore');
const JSON = require('json-bigint');
const Transaction = require('../../lib/saito/transaction').default;
const PeerService = require('saito-js/lib/peer_service').default;
const ArchiveTemplate = require('./lib/archive.template');
const ArchiveSummary = require('./lib/archive-summary.template');
const SaitoOverlay = require('../../lib/saito/ui/saito-overlay/saito-overlay');
const jsonTree = require('json-tree-viewer');


class Archive extends ModTemplate {
	constructor(app) {
		super(app);

		this.name = 'Archive';
		this.slug = 'archive';
		this.description = 'Supports the saving and serving of network transactions';
		this.categories = 'Utilities Core';
		this.class = 'utility';
		this.localDB = null;
		this.opt_out = ['Chat', 'RedSquare', 'Blog'];

		this.access_hash = 0;

		this.schema = [
			'id',
			'user_id',
			'publickey',
			'owner',
			'sig',
			'field1',
			'field2',
			'field3',
			'field4',
			'field5',
			'block_id',
			'block_hash',
			'created_at',
			'updated_at',
			'tx',
			'tx_size',
			'flagged',
			'preserve'
		];

		this.prune_public_ts = 600000000;
		this.prune_private_ts = 450000000;

		this.archive = {
			index_blockchain: 0,
			last_prune: 0
		};

		if (this.app.BROWSER == 0) {
			this.archive.index_blockchain = 1;
		} else {
			this.localDB = new JsStore.Connection(new Worker('/saito/lib/jsstore/jsstore.worker.js'));
		}
	}

	async initialize(app) {
		await super.initialize(app);
		this.load();

		if (app.BROWSER) {
			await this.initInBrowserDatabase();

			if (this.archive?.wallet_version) {
				let wv = this.archive.wallet_version;
				try {
					wv = parseFloat(wv);
				} catch (err) {
					console.error(err);
					wv = 0;
				}
				if (wv <= 5.555) {
					console.warn('PURGING LOCAL DB ', wv);
					await this.localDB.dropDb();
					await this.initInBrowserDatabase();
				}
			}
		} else {
			const path = this.app.storage.returnPath();
			const fs = this.app.storage.returnFileSystem();
			if (fs && path) {
				let data_dir = `${__dirname}/../../data/archive`;
				if (!fs.existsSync(path.normalize(data_dir))) {
					fs.mkdirSync(data_dir);
					console.info('Created directory for archive to store large transactions');
				}
			}
		}

		let now = new Date().getTime();
		if (!this.archive?.last_prune || this.archive.last_prune + 24 * 60 * 60 * 1000 < now) {
			this.pruneArchive();
		}

		setInterval(
			() => {
				this.pruneArchive();
			},
			24 * 60 * 60 * 1000 + 5000
		);
	}

	async initInBrowserDatabase() {
		if (!this.app.BROWSER) {
			return;
		}

		let archives = {
			name: 'archives',
			columns: {
				id: { primaryKey: true, autoIncrement: true },
				user_id: { dataType: 'number', default: 0 },
				publicKey: { dataType: 'string', default: '' },
				owner: { dataType: 'string', default: '' },
				sig: { dataType: 'string', default: '' },
				field1: { dataType: 'string', default: '' },
				field2: { dataType: 'string', default: '' },
				field3: { dataType: 'string', default: '' },
				field4: { dataType: 'string', default: '' },
				field5: { dataType: 'string', default: '' },
				block_id: { dataType: 'number', default: 0 },
				block_hash: { dataType: 'string', default: '' },
				created_at: { dataType: 'number', default: 0 },
				updated_at: { dataType: 'number', default: 0 },
				tx: { dataType: 'string', default: '' },
				tx_size: { dataType: 'number', default: '' },
				flagged: { dataType: 'number', default: 0 },
				preserve: { dataType: 'number', default: 0 }
			}
		};

		let db = {
			name: 'archive_db',
			tables: [archives]
		};

		await this.localDB.initDb(db);
	}

	async render() {
		let ct = 0;
		let mem = 0;
		let ts = Date.now();

		this.app.browser.prependElementToDom(ArchiveSummary(this.app));

		this.app.browser.replaceElementBySelector(`<div class="local-archive-table"></div>`, '.main');
		this.app.browser.addElementToSelector(ArchiveTemplate(this.app, null), '.local-archive-table');

		const cHook = document.getElementById('tx-ct');
		const sHook = document.getElementById('db-size');

		let cont = true;
		while (cont) {
			let rows = await this.loadTransactions({ updated_earlier_than: ts });

			for (let row of rows) {
				this.app.browser.addElementToSelector(
					ArchiveTemplate(this.app, row),
					'.local-archive-table'
				);
				mem += row.tx_size;
				ts = Math.min(ts, row.updated_at);
			}

			ct += rows.length;

			cHook.innerHTML = ct;
			sHook.innerHTML = mem;

			cont = rows.length;
		}

		siteMessage('Achive fully loaded!');
		this.attachEvents();
	}

	attachEvents() {
		document.querySelectorAll('.archive-button').forEach((tx_handle) => {
			tx_handle.onclick = (e) => {
				let tx_json = e.currentTarget.dataset.tx;

				let tx = new Transaction();
				tx.deserialize_from_web(this.app, tx_json);

				let overlay = new SaitoOverlay(this.app, this);
				overlay.show(`<div class="tx_overlay"></div>`);

				let txmsg = tx.returnMessage();

				let el = document.querySelector('.tx_overlay');

				var tree = jsonTree.create(txmsg, el);
				tree.expand(function (node) {
					return node.label !== 'images';
				});

				if (tx?.optional) {
					let tree2 = jsonTree.create(tx.optional, el);
					tree2.expand();
				}
			};
		});

		document.querySelectorAll('.delete-me').forEach((btn) => {
			btn.onclick = async (e) => {
				let sig = e.currentTarget.dataset.id;

				let row = e.currentTarget.parentElement;

				e.currentTarget.onclick = null;

				let res = await this.deleteTransaction(sig);

				if (res) {
					row.remove();
				}
			};
		});
	}

	returnServices() {
		let services = [];
		if (this.app.BROWSER == 0) {
			services.push(new PeerService(null, 'archive'));
		}
		return services;
	}


	async onConfirmation(blk, tx, conf) {
		if (this.app.BROWSER && !tx.isTo(this.publicKey)) {
			return;
		}

		if (Number(conf) == 0 && this.archive.index_blockchain == 1) {
			let block_id = Number(blk.id || 0);
			let block_hash = blk?.hash || '';

			let txmsg = tx.returnMessage();

			if (txmsg?.module == 'spam') {
				return;
			}

			setTimeout(async () => {
				let txs = await this.loadTransactions({
					signature: tx.signature
				});
				if (txs?.length > 0) {
					this.updateTransaction(tx, { block_id, block_hash });
				} else {
					this.app.storage.saveTransaction(tx, { block_id, block_hash }, 'localhost');
				}
			}, 10000);
		}
	}

	async handlePeerTransaction(app, tx = null, peer, mycallback) {
		if (tx == null) {
			return 0;
		}

		let req = tx.returnMessage();

		if (!req?.request || !req?.data) {
			return 0;
		}

		if (req.request === 'archive') {
			if (req.data.request === 'load') {
				let ts1 = Date.now();

				let txs = await this.loadTransactions(req.data);

				if (mycallback) {
					mycallback(txs);
					return 1;
				}
			}

			let newtx = new Transaction();
			newtx.deserialize_from_web(app, req.data.serial_transaction);

			if (req.data.request === 'delete') {
				await this.deleteTransaction(newtx, req.data);
			}
			if (req.data.request === 'multidelete') {
				await this.deleteTransactions(req.data);
			}
			if (req.data.request === 'save') {
				await this.saveTransaction(newtx, req.data);
			}
			if (req.data.request === 'update') {
				await this.updateTransaction(newtx, req.data);
			}

			return 0;
		}

		return super.handlePeerTransaction(app, tx, peer, mycallback);
	}

	async saveTransaction(tx, obj = {}) {
		let newObj = {};

		newObj.user_id = obj?.user_id || 0;

		newObj.publicKey = obj?.publicKey || tx.from[0].publicKey;
		newObj.owner = obj?.owner || '';
		newObj.sig = obj?.signature || tx.signature || obj?.sig;
		newObj.field1 = obj?.field1 || '';
		newObj.field2 = obj?.field2 || '';
		newObj.field3 = obj?.field3 || '';
		newObj.field4 = obj?.field4 || '';
		newObj.field5 = obj?.field5 || '';
		newObj.block_id = obj?.block_id || 0;
		newObj.block_hash = obj?.block_hash || '';
		newObj.flagged = 0;
		newObj.preserve = obj?.preserve || 0;
		newObj.created_at = obj?.created_at || tx.timestamp;
		newObj.updated_at = obj?.updated_at || tx.timestamp;

		if (!tx.optional) {
			tx.optional = {};
		}
		tx.optional.updated_at = newObj.updated_at;

		newObj.tx = tx.serialize_to_web(this.app);
		newObj.tx_size = newObj.tx.length;

		if (this.app.BROWSER) {
			let numRows = await this.localDB.insert({
				into: 'archives',
				values: [newObj]
			});

			if (numRows) {
				console.log(
					'Local Archive index successfully inserted: ',
					JSON.parse(JSON.stringify(newObj))
				);
			} else {
				console.log('Local Archive index not inserted...');
			}
		} else {
			let sql = `INSERT
                  OR IGNORE INTO archives (
                    publickey, 
                    owner, 
                    sig, 
                    field1, 
                    field2, 
                    field3, 
                    field4, 
                    field5, 
                    block_id, 
                    block_hash, 
                    created_at, 
                    updated_at, 
                    tx,
                    tx_size,
                    flagged,
                    preserve
                  ) VALUES (
                  $publickey,
                  $owner,
                  $sig,
                  $field1,
                  $field2,
                  $field3,
                  $field4,
                  $field5,
                  $block_id,
                  $block_hash,
                  $created_at,
                  $updated_at,
                  $tx,
                  $tx_size,
                  $flagged,
                  $preserve
                  )`;
			let params = {
				$publickey: newObj.publicKey,
				$owner: newObj.owner,
				$sig: newObj.sig,
				$field1: newObj.field1,
				$field2: newObj.field2,
				$field3: newObj.field3,
				$field4: newObj.field4,
				$field5: newObj.field5,
				$block_id: newObj.block_id,
				$block_hash: newObj.block_hash,
				$created_at: newObj.created_at,
				$updated_at: newObj.updated_at,
				$tx: newObj.tx,
				$tx_size: newObj.tx_size,
				$flagged: newObj.flagged,
				$preserve: newObj.preserve
			};

			if (newObj.tx_size > 50000) {
				console.log('Save large tx: ', tx.length);
				const fs = this.app?.storage?.returnFileSystem();
				if (fs) {
					let filename = `${__dirname}/../../data/archive/${newObj.sig}`;
					console.log(filename);
					fs.writeFileSync(filename, newObj.tx);
					params['$tx'] = '';
				}
			}

			await this.app.storage.runDatabase(sql, params, 'archive');
		}
	}

	async updateTransaction(tx, obj = {}) {
		let newObj = {};

		let tx_to_update = obj?.signature || obj?.sig || tx?.signature || '';

		if (!obj.updated_at) {
			obj.updated_at = new Date().getTime();
		}

		if (!tx.optional) {
			tx.optional = {};
		}
		tx.optional.updated_at = obj.updated_at;

		newObj.tx = tx.serialize_to_web(this.app);
		newObj.tx_size = newObj.tx.length;

		if (!tx_to_update) {
			console.error('No tx signature for archive update:', tx);
			return 0;
		}

		let sql = `UPDATE archives SET tx = $tx, tx_size = $tx_size`;

		let params = {
			$tx: newObj.tx,
			$tx_size: newObj.tx_size,
			$sig: tx_to_update
		};

		for (let key in obj) {
			if (key != 'tx') {
				if (this.schema.includes(key)) {
					sql += `, ${key} = $${key}`;
					params[`$${key}`] = obj[key];
					newObj[key] = obj[key];
				}
			}
		}

		sql += ` WHERE sig = $sig`;

		if (this.app.BROWSER) {
			let results = await this.localDB.update({
				in: 'archives',
				set: newObj,
				where: {
					sig: tx_to_update
				}
			});
		} else {
			if (newObj.tx_size > 50000) {
				const fs = this.app?.storage?.returnFileSystem();
				if (fs) {
					const filename = `${__dirname}/../../data/archive/${tx_to_update}`;
					fs.writeFileSync(filename, newObj.tx);
					params['$tx'] = '';
				}
			}

			await this.app.storage.runDatabase(sql, params, 'archive');
		}

		return 1;
	}

	async loadTransactionsWithCallback(obj = {}, callback = null) {
		let txs = await this.loadTransactions(obj);
		if (callback) {
			return callback(txs);
		} else {
			return txs;
		}
	}

	async loadTransactions(obj = {}) {
		let limit = 10;
		let timestamp_limiting_clause = '';

		let order_clause = ' ORDER BY archives.id';
		let sort = 'DESC';
		let request_tx = obj.request_tx || null;

		let order_obj = { by: 'id', type: 'desc' };
		let where_obj = {};

		if (obj.created_later_than || obj.hasOwnProperty('created_later_than')) {
			timestamp_limiting_clause += ' AND created_at > ' + parseInt(obj.created_later_than);
			where_obj = {
				created_at: { '>': parseInt(obj.created_later_than) }
			};
			order_clause = ' ORDER BY archives.created_at';
			order_obj.by = 'created_at';
		}
		if (obj.created_earlier_than || obj.hasOwnProperty('created_earlier_than')) {
			timestamp_limiting_clause += ' AND created_at < ' + parseInt(obj.created_earlier_than);
			where_obj = {
				created_at: { '<': parseInt(obj.created_earlier_than) }
			};
			order_clause = ' ORDER BY archives.created_at';
			order_obj.by = 'created_at';
		}
		if (obj.tx_size_greater_than) {
			timestamp_limiting_clause += ' AND tx_size > ' + parseInt(obj.tx_size_greater_than);
			where_obj = {
				tx_size: { '>': parseInt(obj.tx_size_greater_than) }
			};
		}
		if (obj.tx_size_less_than) {
			timestamp_limiting_clause += ' AND tx_size < ' + parseInt(obj.tx_size_less_than);
			where_obj = { tx_size: { '<': parseInt(obj.tx_size_less_than) } };
		}
		if (obj.updated_later_than || obj.hasOwnProperty('updated_later_than')) {
			timestamp_limiting_clause += ' AND updated_at > ' + parseInt(obj.updated_later_than);
			where_obj = {
				updated_at: { '>': parseInt(obj.updated_later_than) }
			};
			order_clause = ' ORDER BY archives.updated_at';
			order_obj.by = 'updated_at';
		}
		if (obj.updated_earlier_than || obj.hasOwnProperty('updated_earlier_than')) {
			timestamp_limiting_clause += ' AND updated_at < ' + parseInt(obj.updated_earlier_than);
			where_obj = {
				updated_at: { '<': parseInt(obj.updated_earlier_than) }
			};
			order_clause = ' ORDER BY archives.updated_at';
			order_obj.by = 'updated_at';
		}
		if (obj.flagged) {
			timestamp_limiting_clause += ' AND flagged = ' + parseInt(obj.flagged);
			where_obj = { flagged: { '=': parseInt(obj.flagged) } };
		}

		if (obj.ascending || obj.hasOwnProperty('ascending')) {
			sort = 'ASC';
			order_obj.type = 'asc';
		}

		if (obj.limit) {
			limit = Math.max(limit, obj.limit);
			limit = Math.min(limit, 100);
			delete obj.limit;
		}

		if (obj.signature) {
			obj.sig = obj.signature;
			delete obj.signature;
		}

		let param_count = 0;

		let params = { $limit: limit };

		let sql = `SELECT * FROM archives WHERE`;

		if (obj.field5 || obj.hasOwnProperty('field5')) {
			if (obj.field5_sort) {
				where_obj['field5'] = { '>=': obj.field5 };
				sql += ' archives.field5 >= $field5 AND';
				params['$field5'] = obj.field5;
				order_clause = ' ORDER BY archives.field5';
				order_obj.by = 'field5';
				delete obj.field5;
				delete obj.field5_sort;
			}
		}

		for (let key in obj) {
			if (this.schema.includes(key)) {
				sql += ` archives.${key} = $${key} AND`;
				params[`$${key}`] = obj[key];
				where_obj[key] = obj[key];
			}
		}

		sql = sql.substring(0, sql.length - 4);

		sql += timestamp_limiting_clause + order_clause + ` ${sort} LIMIT $limit`;

		let ts = Date.now();
		let rows = await this.app.storage.queryDatabase(sql, params, 'archive');

		if (this.app.BROWSER && !rows?.length) {
			rows = await this.localDB.select({
				from: 'archives',
				where: where_obj,
				order: order_obj,
				limit
			});
		} else {
			const fs = this.app?.storage?.returnFileSystem();
			if (!fs) {
				console.warn('!!!!!!!! NO FILESYSTEM !!!!!!!!!');
			} else {
				for (let r of rows) {
					if (!r.tx) {
						let filename = `${__dirname}/../../data/archive/${r.sig}`;
						if (fs.existsSync(filename)) {
							r.tx = fs.readFileSync(filename, { encoding: 'UTF-8' });
						}
					}
				}
			}

			let time_elapsed = Date.now() - ts;
			if (time_elapsed > 0) {
				if (!obj?.sig) {
					console.debug(
						`==> Archive SQL query time: ${time_elapsed}ms -- `,
						sql,
						params,
						rows.length
					);
				}
			}
		}

		if (this.access_hash == 1) {
			console.log('*****************');
			console.log('ACCESS HASH CHECK');
			console.log('*****************');
			let altered_rows = [];

			for (let r of rows) {
				if (r.owner) {
					if (!obj.access_script || !obj.access_witness) {} else {
						if (obj.access_hash === r.owner) {
							let include_row = false;
							let scripting_mod = this.app.modules.returnModule('Scripting');
							if (scripting_mod) {
								if (
									scripting_mod.evaluate(
										obj.access_hash,
										obj.access_script,
										obj.access_witness,
										{},
										request_tx,
										null
									)
								) {
									include_row = true;
								}
							}
							if (include_row) {
								altered_rows.push(r);
							}
						}
					}
				}
			}

			rows = altered_rows;
			console.log('ROWS RETURNING: ' + JSON.stringify(rows));
		}

		return rows;
	}

	async deleteTransaction(tx, obj = {}) {
		let sql = '';
		let params = {};
		let rows = [];
		let timestamp_limiting_clause = '';
		let where_obj = {};

		let sig;
		if (tx?.signature) {
			sig = tx.signature;
		} else if (typeof tx === 'string') {
			sig = tx;
		} else {
			console.error('Not a valid tx/signature');
			return false;
		}

		let select_sql = `SELECT sig, owner FROM archives WHERE archives.sig = $sig`;
		let select_params = { $sig: sig };
		let existing_rows = await this.app.storage.queryDatabase(select_sql, select_params, 'archive');

		if (this.app.BROWSER && (!existing_rows || existing_rows.length === 0)) {
			existing_rows = await this.localDB.select({
				from: 'archives',
				where: { sig: sig },
				limit: 1
			});
		}

		if (!existing_rows || existing_rows.length === 0) {
			console.log('Transaction not found in archive, cannot delete');
			return false;
		}

		let existing_row = existing_rows[0];

		if (existing_row.owner && existing_row.owner !== '') {
			console.log('*****************');
			console.log('DELETE ACCESS HASH CHECK');
			console.log('*****************');
			console.log('Transaction owner:', existing_row.owner);

			if (!obj.access_script || !obj.access_witness) {
				console.log('DELETE DENIED: No access_script or access_witness provided');
				return false;
			}

			if (!obj.access_hash || obj.access_hash !== existing_row.owner) {
				console.log('DELETE DENIED: access_hash does not match owner');
				return false;
			}

			let can_delete = false;
			let scripting_mod = this.app.modules.returnModule('Scripting');
			if (scripting_mod) {
				let request_tx = obj.request_tx || tx || null;
				let eval_result = await scripting_mod.evaluate(
					obj.access_hash,
					obj.access_script,
					obj.access_witness,
					{},
					request_tx,
					null
				);

				if (eval_result) {
					can_delete = true;
					console.log('DELETE ACCESS GRANTED: Script evaluation passed');
				} else {
					console.log('DELETE DENIED: Script evaluation failed');
				}
			} else {
				console.log('DELETE DENIED: Scripting module not available');
			}

			if (!can_delete) {
				return false;
			}
		} else {
			console.log('No owner specified for transaction, proceeding with deletion');
		}

		sql = `DELETE FROM archives WHERE archives.sig = $sig`;
		params = { $sig: sig };
		await this.app.storage.runDatabase(sql, params, 'archive');

		where_obj['sig'] = sig;
		if (this.app.BROWSER) {
			rows = await this.localDB.remove({
				from: 'archives',
				where: where_obj
			});
			if (rows) {
				console.log('DELETED FROM localDB! ');
			} else {
				console.log('Record not found in localDB to delete');
			}
		} else {
			const fs = this.app.storage.returnFileSystem();
			const path = this.app.storage.returnPath();
			if (fs && path) {
				const filepath = path.normalize(`${__dirname}/../../data/archive/${sig}`);
				if (fs.existsSync(filepath)) {
					fs.unlink(filepath, (err) => {
						if (err) {
							console.error(err);
						} else {
							console.info(`Deleted ${filepath}`);
						}
					});
				}
			}
		}

		return true;
	}


	async deleteTransactions(obj = {}) {
		let rows = [];

		let timestamp_limiting_clause = ' archives.preserve = 0';
		let where_obj1 = {};

		if (obj.created_later_than) {
			timestamp_limiting_clause += ' AND archives.created_at > ' + parseInt(obj.created_later_than);
			where_obj1 = {
				created_at: { '>': parseInt(obj.created_later_than) }
			};
		}
		if (obj.created_earlier_than) {
			timestamp_limiting_clause +=
				' AND archives.created_at < ' + parseInt(obj.created_earlier_than);
			where_obj1 = {
				created_at: { '<': parseInt(obj.created_earlier_than) }
			};
		}
		if (obj.updated_later_than) {
			timestamp_limiting_clause += ' AND archives.updated_at > ' + parseInt(obj.updated_later_than);
			where_obj1 = {
				updated_at: { '>': parseInt(obj.updated_later_than) }
			};
		}
		if (obj.updated_earlier_than) {
			timestamp_limiting_clause +=
				' AND archives.updated_at < ' + parseInt(obj.updated_earlier_than);
			where_obj1 = {
				updated_at: { '<': parseInt(obj.updated_earlier_than) }
			};
		}

		where_obj1['preserve'] = 0;

		let sql = `DELETE FROM archives WHERE `;
		let sql_substring = '';
		let params = {};
		let where_obj2 = {};
		let param_ct = 0;

		for (let key in obj) {
			if (this.schema.includes(key)) {
				sql_substring += `archives.${key} = $${key} OR `;
				params[`$${key}`] = obj[key];
				if (param_ct++ > 0) {
					if (where_obj2['or']) {
						where_obj2.or[key] = obj[key];
					} else {
						where_obj2['or'] = {};
						where_obj2.or[key] = obj[key];
					}
				} else {
					where_obj2[key] = obj[key];
				}
			}
		}

		sql_substring = sql_substring.substring(0, sql_substring.length - 4);

		if (param_ct > 1) {
			sql += `(${sql_substring})`;
		} else {
			sql += sql_substring;
		}

		let where_obj;
		if (param_ct > 1) {
			where_obj = [where_obj1, where_obj2];
			sql += ' AND' + timestamp_limiting_clause;
		} else if (param_ct == 1) {
			where_obj = Object.assign(where_obj1, where_obj2);
		} else {
			where_obj = where_obj1;
			sql += timestamp_limiting_clause;
		}

		rows = await this.app.storage.runDatabase(sql, params, 'archive');

		if (this.app.BROWSER) {
			rows = await this.localDB.remove({
				from: 'archives',
				where: where_obj
			});
		}

		return;
	}

	async pruneArchive() {
		console.log('$');
		console.log('$');
		console.log('$ PURGING ARCHIVE');
		console.log('$');
		console.log('$');

		let now = new Date().getTime();

		let ts = now - this.prune_public_ts;

		if (this.app.BROWSER) {
			where_obj = { updated_at: { '<': ts } };
			where_obj['preserve'] = 0;
			rows = await this.localDB.remove({
				from: 'archives',
				where: where_obj
			});
			console.log(rows, 'automatically pruned from local archive');
		} else {
			let pruned_ct = 0;
			let sql = `DELETE FROM archives WHERE owner = "" AND updated_at < $ts AND preserve = 0 AND tx != ''`;
			let params = { $ts: now - this.prune_public_ts };
			let results = await this.app.storage.runDatabase(sql, params, 'archive');
			if (results?.changes) {
				pruned_ct += results?.changes;
			}

			sql = `DELETE FROM archives WHERE owner != "" AND updated_at < $ts AND preserve = 0 AND tx != ''`;
			params = { $ts: now - this.prune_private_ts };
			results = await this.app.storage.runDatabase(sql, params, 'archive');
			if (results?.changes) {
				pruned_ct += results?.changes;
			}

			sql = `DELETE FROM archives WHERE ( tx_size = 0 or field1 = 'RedSquare') and updated_at < $ts`;
			params = { $ts: now - 50 * this.prune_public_ts };
			results = await this.app.storage.runDatabase(sql, params, 'archive');
			if (results?.changes) {
				pruned_ct += results?.changes;
			}

			console.log(`Deleted ${pruned_ct} txs from archive`);

			params = { $ts: now - this.prune_public_ts };
			sql = `SELECT sig FROM archives WHERE updated_at < $ts AND preserve = 0 AND tx = ''`;
			let rows = await this.app.storage.queryDatabase(sql, params, 'archive');
			for (let r of rows) {
				await this.deleteTransaction(r.sig);
			}

			sql = 'SELECT COUNT(*) FROM archives';
			rows = await this.app.storage.queryDatabase(sql, {}, 'archive');
			console.log(rows);
		}

		this.archive.last_prune = now;
		this.save();
	}

	shouldAffixCallbackToModule(modname) {
		if (this.opt_out.includes(modname)) {
			return 0;
		}

		return 1;
	}

	load() {
		if (this.app.options.archive) {
			this.archive = this.app.options.archive;
		} else {
			this.archive = {};
			this.archive.index_blockchain = 0;
			if (this.app.BROWSER == 0) {
				this.archive.index_blockchain = 1;
			}
			this.save();
		}
	}

	save() {
		this.archive.wallet_version = this.app.options.wallet.version;
		this.app.options.archive = this.archive;
		this.app.storage.saveOptions();
	}

	async onUpgrade(type, privatekey, walletfile) {
		if (type == 'nuke' && this.localDB) {
			await this.localDB.dropDb();
			await this.initInBrowserDatabase();
		}
		return 1;
	}
}

module.exports = Archive;