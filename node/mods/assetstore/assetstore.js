const PeerService = require('saito-js/lib/peer_service').default;
const Transaction = require('../../lib/saito/transaction').default;
const saito = require('./../../lib/saito/saito');
const ModTemplate = require('../../lib/templates/modtemplate');
const AssetStoreMain = require('./lib/main/main');
const SaitoHeader = require('./../../lib/saito/ui/saito-header/saito-header');
const AssetStoreHome = require('./index');

class AssetStore extends ModTemplate {

	constructor(app) {
		super(app);

		this.debug = false;

		this.name = 'AssetStore';
		this.slug = 'assetstore';
		this.description = 'NFT Interface for creating and joining games coded for the Saito Open Source Game Engine.';
		this.categories = 'Utility Ecommerce NFTs';
		this.icon = 'fa-solid fa-cart-shopping';


		//
		// master registry publickey
		//
		this.assetstore_publickey = 'zYCCXRZt2DyPD9UmxRfwFgLTNAqCd5VE8RuNneg4aNMK';

		this.nfts = {};

		this.styles = ['/assetstore/style.css'];

		//this.services = [this.app.network.createPeerService(null, 'assetstore', '', 'saito')];

		this.social = {
			twitter: '@SaitoOfficial',
			title: '🟥 Saito AssetStore',
			url: 'https://saito.io/assetstore/',
			description: 'Buy or Sell Saito NFTs and other On-Chain Assets',
			image: 'https://saito.tech/wp-content/uploads/2023/11/assetstore-300x300.png'
		};

	}

	//////////////////////////////
	// INITIALIZATION FUNCTIONS //
	//////////////////////////////
	//
	// runs when the module initializes, note that at this point the network
	// may not be up. use onPeerHandshakeCompete() to make requests over the
	// network and process the results.
	//
	async initialize(app) {

		await super.initialize(app);

		//
		// compile list of assetstore games
		//
		app.modules.returnModulesRespondingTo('assetstore-games').forEach((game_mod) => {
			this.assetstore_games.push(game_mod);
			//
			// and listen to their transactions
			//
			this.affix_callbacks_to.push(game_mod.name);
		});

		if (!app.options.assetstore) {
			app.options.assetstore = {};
		}

	}


	async onPeerServiceUp(app, peer, service = {}) {
	}


	////////////
	// RENDER //
	////////////
	async render() {

    		//
    		// browsers only!
    		//  
    		if (!this.app.BROWSER || !this.browser_active) {
    		  return;
    		}   

		if (this.main == null) {
			this.main = new AssetStoreMain(this.app, this);
			this.header = new SaitoHeader(this.app, this);
			await this.header.initialize(this.app);
			this.header.header_class = 'arcade';
			this.addComponent(this.header);
			this.addComponent(this.main);
		}

		await super.render();

	}

	respondTo(type = '', obj) {

		if (type === 'saito-header') {
			let x = [];
			if (!this.browser_active) {
				this.attachStyleSheets();
				x.push({
					text: 'Store',
					icon: 'fa-solid fa-cart-shopping',
					rank: 15,
					callback: function (app, id) {
						navigateWindow('/assetstore');
					}
				});
			}

			return x;
		}

		return super.respondTo(type, obj);
	}

	////////////////////////////////////////////////////
	// NETWORK FUNCTIONS -- sending and receiving TXS //
	////////////////////////////////////////////////////
        //
	async onConfirmation(blk, tx, conf) {

		let txmsg = tx.returnMessage();
		let assetstore_self = this.app.modules.returnModule('AssetStore');

		try {
			if (conf == 0) {
				if (txmsg.module === 'AssetStore') {

					if (this.hasSeenTransaction(tx)) {
						return;
					}

					//
					// public & private invites processed the same way
					//
					if (txmsg.request === 'create_list_asset_transaction') {
console.log("RECEIVE LIST ASSET TX");
						this.receiveListAssetTransaction(tx, blk);
					}

				}
			}
		} catch (err) {
			console.error('ERROR in assetstore onconfirmation block: ', err);
		}
	}

	/////////////////////////////
	// HANDLE PEER TRANSACTION //
	/////////////////////////////
	//
	async handlePeerTransaction(app, newtx = null, peer, mycallback = null) {

		if (newtx == null) {
			return 0;
		}
		let message = newtx.returnMessage();

		//if (message.request === 'assetstore invite list') {
		//	// Process stuff on server side, then...
		//	if (mycallback) {
		//		mycallback(txs);
		//		return 1;
		//	}
		//}

		return super.handlePeerTransaction(app, newtx, peer, mycallback);
	}


	/////////////////
	// List Assets //
	/////////////////
	//
	async createListAssetTransaction(nft) {

		let sendto = this.publicKey;
		let moduletype = 'AssetStore';

		//
		// create the NFT transaction
		//
		let nfttx = await this.app.wallet.createUnsignedTransactionWithDefaultFee();
		nfttx.msg = {
			module: "AssetStore" ,
			request: "internal_nft_transaction" ,
			text : "This transaction goes inside another transaction..."
		};
		nfttx.packData();
		await nfttx.sign();

		//
		// create the auction transaction
		//
		let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee();
		newtx.msg = {
			module: "AssetStore" ,
			request: "create_list_asset_transaction" ,
			tx : nfttx.serialize_to_web(this.app)
		};

		newtx.packData();
		await newtx.sign();

		return newtx;
	}

	async receiveListAssetTransaction(tx, blk = null) {

		try {

			let txmsg = tx.returnMessage();

			let nfttx = new Transaction();
	                nfttx.deserialize_from_web(this.app, txmsg.tx);

			let seller = tx.from[0].publicKey;
			let lc = 1;
			let nft_id = nfttx.signature;
			let nft_tx = txmsg.tx;
			let bsh = blk.hash;
			let bid = blk.id;
			let tid = tx.signature;
	
console.log("seller: " + seller);
console.log("nft_id: " + nft_id);
console.log("nft_tx: " + nft_tx);
console.log("lc: " + lc);
console.log("bsh: " + bsh);
console.log("bid: " + bid);
console.log("tid: " + tid);

			this.addRecord(
				seller , 
				nft_id ,
				nft_tx ,
				lc , 
				bsh ,
				bid ,
				tid 
			);

		} catch (err) {

		}

        }



	///////////////////
	// Delist Assets //
	///////////////////
	//
	async createDelistAssetTransaction(nft) {

		let sendto = this.publicKey;
		let moduletype = 'AssetStore';

		let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee();
		//newtx.addTo(this.publicKey);

		newtx.msg = {
			module: "AssetStore" ,
			request: "create_delist_asset_transaction"
		};

		newtx.packData();
		await newtx.sign();

		return newtx;
	}

	async receiveDelistAssetTransaction(tx, blk = null) {
		let txmsg = tx.returnMessage();
	}

	////////////////
	// Buy Assets //
	////////////////
	//
	async createBuyAssetTransaction(nft) {

		let sendto = this.publicKey;
		let moduletype = 'AssetStore';

		let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee();
		//newtx.addTo(this.publicKey);

		newtx.msg = {
			module: "AssetStore" ,
			request: "create_buy_asset_transaction"
		};

		newtx.packData();
		await newtx.sign();

		return newtx;
	}

	async receiveBuyAssetTransaction(tx, blk = null) {
		let txmsg = tx.returnMessage();
	}







	//
	// purges invites unaccepted
	//
	purgeAssets() {
	}



	shouldAffixCallbackToModule(modname) {
		if (modname == 'AssetStore') {
			return 1;
		}
		return 0;
	}


	//
	// SQL Database Management
	//
	async addRecord(
		seller = "",
		nft_id = "", 
		nft_tx = "", 
                lc = 1 ,
		bsh = "" ,
		bid = 0 ,
		tid = 0 ,
        ) {
                let sql = `INSERT OR IGNORE INTO records (
			seller ,
			nft_id ,
			nft_tx ,
                        lc ,
                        bsh ,
                        bid ,
                        tid 
		) VALUES (
			$seller ,
			$nft_id ,
			$nft_tx ,
			$lc ,
			$bsh ,
			$bid ,
			$tid
                )`;
                let params = {
                        $seller : seller ,
                        $nft_id : nft_id ,
                        $nft_tx : nft_tx ,
                        $lc : lc , 
                        $bsh : bsh ,
                        $bid : bid ,
                        $tid : tid
                };

                let res = await this.app.storage.runDatabase(sql, params, 'assetstore');

                return res?.changes;
        }


        async onChainReorganization(bid, bsh, lc) {
                var sql = 'UPDATE records SET lc = $lc WHERE bid = $bid AND bsh = $bsh';
                var params = { $bid: bid, $bsh: bsh };
                await this.app.storage.runDatabase(sql, params, 'registry');
                return;
        }

}

module.exports = AssetStore;
