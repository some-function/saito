const PeerService = require('saito-js/lib/peer_service').default;
const Transaction = require('../../lib/saito/transaction').default;
const saito = require('./../../lib/saito/saito');
const ModTemplate = require('../../lib/templates/modtemplate');
const AssetStoreMain = require('./lib/main/main');
const SaitoHeader = require('./../../lib/saito/ui/saito-header/saito-header');
const AssetStoreHome = require('./index');
const SaitoNft = require('./../../lib/saito/ui/saito-nft/nft');

//
// This application provides an auction clearing platform for NFT sales on Saito.
//
// Users can submit NFTs in transactions that specify sales conditions. The application
// can receive and list them, and returns a transaction that can be used to withdraw
// the NFT from the platform and move it back into the original wallet. This withdrawal
// transaction can be submitted to the network any-time before sale.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT 
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION 
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
//
class AssetStore extends ModTemplate {

	constructor(app) {

		super(app);

		this.debug = false;

		this.name = 'AssetStore';
		this.slug = 'assetstore';
		this.description = 'NFT Interface for creating and joining games coded for the Saito Open Source Game Engine.';
		this.categories = 'Utility Ecommerce NFTs';
		this.icon = 'fa-solid fa-cart-shopping';

		this.nfts = {};

		this.styles = ['/assetstore/style.css'];

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

			if (tx.type == 8) { // Bound

console.log("key1: " + tx.to[1].publicKey);
console.log("key2: " + this.publicKey);

				if (tx.to[1].publicKey == this.publicKey) {
console.log("(");
console.log("(");
console.log("( AssetStore Receives Bound TX for ITSELF!");
console.log("(");
console.log("(");
					let nft = new SaitoNft(this.app, this);
					nft.createFromTx(tx);
					let nft_id = nft.returnId();

console.log("created NFT from tx...", nft);


				}

			}

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

			let nft = new SaitoNew(this.app, this);
			nft.createFromTx(nfttx);

			let seller = tx.from[0].publicKey;
			let lc = 1;
			let nft_id = nft.returnId();
			let nft_tx = txmsg.tx;
			let nft_sig = nfttx.signature;
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

			//
			// insert the NFT into our platform
			//
			await this.addRecord(
				seller , 
				nft_id ,
				nft_tx ,
				nft_sig ,
				lc , 
				bsh ,
				bid ,
				tid 
			);

			//
			// and broadcast the embedded tx
			//
			this.app.network.propagateTransaction(nfttx);

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


	async receiveNFTTransfer(tx, blk = null) {
		let txmsg = tx.returnMessage();
	}






	//
	// purges invites unaccepted
	//
	purgeAssets() {
	}



	shouldAffixCallbackToModule(modname, tx=null) {
		if (modname == 'AssetStore') {
			return 1;
		}
		if (tx != null) {
			//
			// NFT transaction / Bound transaction type
			//
			if (tx.type == 8) {
				return 1;
			}
		}
		return 0;
	}


	//
	// SQL Database Management
	//
	async setActive(
		seller = "",
		nft_id = ""
	) {

                let sql = `UPDATE records SET active = 1 WHERE seller = $seller AND nft_id = $nft_id`;
                let params = {
                        $seller : seller ,
                        $nft_id : nft_id ,
                };
                let res = await this.app.storage.runDatabase(sql, params, 'assetstore');
                return res?.changes;
	}

	async setInactive(
		nft_sig = "",
		nft_id = ""
	) {

                let sql = `UPDATE records SET active = 0 WHERE nft_sig = $nft_sig AND nft_id = $nft_id`;
                let params = {
                        $nft_sig : nft_sig ,
                        $nft_id : nft_id ,
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



	//
	// SQL Database Management
	//
	async addRecord(
		seller = "",
		nft_id = "", 
		nft_tx = "", 
		nft_sig = "", 
                lc = 1 ,
		bsh = "" ,
		bid = 0 ,
		tid = 0 ,
        ) {
                let sql = `INSERT OR IGNORE INTO records (
			seller ,
			nft_id ,
			nft_tx ,
			nft_sig ,
                        lc ,
                        bsh ,
                        bid ,
                        tid 
		) VALUES (
			$seller ,
			$nft_id ,
			$nft_tx ,
			$nft_sig ,
			$lc ,
			$bsh ,
			$bid ,
			$tid
                )`;
                let params = {
                        $seller : seller ,
                        $nft_id : nft_id ,
                        $nft_tx : nft_tx ,
                        $nft_tx : nft_sig ,
                        $lc : lc , 
                        $bsh : bsh ,
                        $bid : bid ,
                        $tid : tid
                };

                let res = await this.app.storage.runDatabase(sql, params, 'assetstore');

                return res?.changes;
        }

}

module.exports = AssetStore;

