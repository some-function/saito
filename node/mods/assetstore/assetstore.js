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
		this.auction_list = [];

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
	    
	    console.log("onPeerServiceUp: ", service.service);

	    if (service.service === 'relay') {
	        this.app.network.sendRequestAsTransaction(
	          "assetstore retreive records",
	           {
	           	module: "AssetStore",
	           	request: "assetstore retreive records",
	           },
	          (records) => {

	          	console.log("onPeerServiceUp records: ", records);
	            this.auction_list = records;
	            this.app.connection.emit('assetstore-render-auction-list-request');
	          },
	          peer.peerIndex
	        );
	      
	    }
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

		// if (this.app.BROWSER) {
		// return;
		// }

		if (this.hasSeenTransaction(tx)) {
			return;
		}

		let txmsg = tx.returnMessage();
		let assetstore_self = this.app.modules.returnModule('AssetStore');

		if (tx.type == 8) { // Bound
			// if from slips less than 3 then its create not send nft tx
			if (tx.from.length < 3) return;

			let to_publicKey = tx.to[1].publicKey;
			let from_publicKey = tx.from[1].publicKey;

			// nft is sent to assestore (list)
			if (tx.isTo(to_publicKey)) {
				console.log("(");
				console.log("(");
				console.log("( AssetStore Receives Bound TX for ITSELF!");
				console.log("(");
				console.log("(");
				let nft = new SaitoNft(this.app, this);
				nft.createFromTx(tx);
				let nft_id = nft.returnId();

				let seller = from_publicKey;;
				let res = await this.setActive(seller, nft_id);
				this.app.connection.emit('assetstore-update-auction-list-request');
				
			}

			
			// assestore is sending nft (delist)
			if (from_publicKey == this.publicKey) {

				console.log("(");
				console.log("(");
				console.log("( AssetStore Sends NFT");
				console.log("(");
				console.log("(");

				let nft = new SaitoNft(this.app, this);
				nft.createFromTx(tx);
				let nft_id = nft.returnId();

				// console.log("created NFT from tx...", nft);
				
				let seller = to_publicKey;
				let res = await this.setInactive(seller, nft_id);
				this.app.connection.emit('assetstore-update-auction-list-request');
			}
		
		}

		try {
			if (conf == 0) {
				if (txmsg.module === 'AssetStore') {

					//
					// public & private invites processed the same way
					//
					if (txmsg.request === 'create_list_asset_transaction') {
						await this.receiveListAssetTransaction(tx, blk);
					}

					if (txmsg.request === 'create_delist_asset_transaction') {
						await this.receiveDelistAssetTransaction(tx, blk);
					}

					if (txmsg.request === 'create_delist_asset_transaction') {
						await this.receiveDelistAssetTransaction(tx, blk);
						await this.receivePurchaseAssetTransaction(tx, blk);
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
	async handlePeerTransaction(app, tx = null, peer, mycallback = null) {
		if (tx == null) return 0;
		const txmsg = tx.returnMessage();

		if (txmsg?.request === 'assetstore retreive records') {
			return this.receiveRetreiveRecordsTransaction(mycallback);
		}

		return super.handlePeerTransaction(app, tx, peer, mycallback);
	}



	/////////////////
	// List Assets //
	/////////////////
	//
	async createListAssetTransaction(nft, receiver) {
		//
		// create the NFT transaction
		//
		const obj = {};
	        if (nft.image) obj.image = nft.image;
	        if (nft.text) obj.text = nft.text;

	        const tx_msg = {
	          data: obj,
	          module: 'AssetStore',
	          request: 'send nft'
	        };

	        let amount = BigInt(nft.amount);
	        let slip1Key = nft.slip1.utxo_key;
	        let slip2Key = nft.slip2.utxo_key;
	        let slip3Key = nft.slip3.utxo_key;

	        let nfttx = await this.app.wallet.createSendBoundTransaction(
	          amount,
	          slip1Key,
	          slip2Key,
	          slip3Key,
	          receiver,
	          tx_msg
	        );
	        nfttx.sign();

	        console.log("inner nft_tx: ", nfttx);


		//	
		// create the auction transaction
		//
		let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee();
		newtx.msg = {
			module: "AssetStore" ,
			request: "create_list_asset_transaction" ,
			tx : nfttx.serialize_to_web(this.app)
		};

		newtx.type = 0;

		newtx.packData();
		await newtx.sign();

		return newtx;
	}


	async receiveListAssetTransaction(tx, blk = null) {

		try {
			let txmsg = tx.returnMessage();

			let nfttx = new Transaction();
	                nfttx.deserialize_from_web(this.app, txmsg.tx);

			let nft = new SaitoNft(this.app, this);
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
			//console.log("nft_tx: " + nfttx);
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

	  const newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee();
	  
	  const obj = {
	    module: 'AssetStore',
	    request: 'create_delist_asset_transaction',
	    nft_id: nft.id,
	    seller: this.publicKey,

	  };
	    
          if (nft.image) obj.image = nft.image;
          if (nft.text) obj.text = nft.text;

	  newtx.msg = obj;
	  newtx.type = 0;
	  newtx.packData();
	  await newtx.sign();
	  return newtx;
	}


	async receiveDelistAssetTransaction(tx, blk = null) {
	  try {
	    if (this.app.BROWSER) return;

	    const msg    = tx.returnMessage();
	    const nft_id = msg.nft_id;
	    const seller = tx.from[0].publicKey; 

	    if (!nft_id) {
	      console.warn('Delist: missing nft_id');
	      return;
	    }

	    // verify record exists having same seller and is active
	    const rows = await this.app.storage.queryDatabase(
	      'SELECT * FROM records WHERE nft_id = $nft_id AND seller = $seller AND active = 1 LIMIT 1',
	      { $nft_id: nft_id, $seller: seller },
	      'assetstore'
	    );
	    if (!rows || rows.length === 0) {
	      console.warn('Delist: record not found / not active / wrong seller');
	      return;
	    }

	    console.log("this.app.options.wallet: ", this.app.options.wallet);

	    // check if nft held by assetstore wallet
	    const raw  = await this.app.wallet.getNftList();

	    console.log("getNftList: ", raw);

	    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
	    console.log("getNftList list: ", list);
	    const nft_owned = (list || []).find(n => n.id === nft_id);

	    if (!nft_owned) {
	      console.warn('Delist: module wallet does not currently control this NFT');
	      return;
	    }

	    const slip1key = nft_owned.slip1?.utxo_key;
	    const slip2key = nft_owned.slip2?.utxo_key;
	    const slip3key = nft_owned.slip3?.utxo_key;	
    	    const amount = BigInt(nft_owned.slip2?.amount);


	    if (!slip1key || !slip2key || !slip3key) {
	      console.warn('Delist: missing slip keys on owned NFT');
	      return;
	    }

	    let obj = {};
	    if (msg.image) obj.image = msg.image;
	    if (msg.text) obj.text = msg.text;

    	    const txMsg = {
	    	data: obj, 
	    	module: 'AssetStore', 
	    	request: 'send nft' 
	    };

	    const nfttx = await this.app.wallet.createSendBoundTransaction(
	      amount, 
	      slip1key, 
	      slip2key, 
	      slip3key, 
	      seller, 
	      txMsg
	    );
	    await nfttx.sign();

	    console.log("delist send bound tx: ", nfttx);

	    this.app.network.propagateTransaction(nfttx);
	   // this.app.connection.emit('assetstore-update-auction-list-request');

	  } catch (err) {
	    console.error('receiveDelistAssetTransaction error:', err);
	  }
	}

	///////////////////
	// Retreive records //
	///////////////////
	//
	async sendRetreiveRecordsTransaction(peer, mycallback) {
		let this_self = this;
		let msg = {
			module: "AssetStore",
	        	request: 'assetstore retreive records',
	        };

	        this.app.network.sendRequestAsTransaction(
	          'assetstore retreive records',
	          msg,
	          function(records){
	          	this_self.auction_list = records;
	          	if (mycallback != null) {
	          		return mycallback(records);
	          	}
	          },
	          peer.peerIndex
	        );
	}

	async receiveRetreiveRecordsTransaction(mycallback = null) {
		if (mycallback == null) {
			console.warn('No callback');
			return 0;
		}
		if (this.app.BROWSER == 1) {
			console.warn("Browsers don't support backup/recovery");
			return 0;
		}

		let sql = 'SELECT * FROM records WHERE active = 1';
		let params = {
		};

		let results = await this.app.storage.queryDatabase(sql, params, 'assetstore');

		if (mycallback) {
			mycallback(results);
			return 1;
		} else {
			console.warn('No callback to process assestore records');
		}

		return 0;
	}


	///////////////////
	// Retreive records //
	///////////////////
	//
	async createPurchaseAssetTransaction(nft, opts = {}) {
	  // nft: { id, slip1, slip2, slip3, amount, seller? }
	  // opts: { price, fee }

	console.log("purchase nft: ", nft);

	  const price = BigInt(opts?.price ?? 0);
	  const fee   = BigInt(opts?.fee   ?? 0);
	  if (price <= 0n) { throw new Error('price must be > 0'); }
	  if (fee   <  0n) { throw new Error('fee must be >= 0'); }

	  const total = price + fee;

	  const seller = nft?.seller || opts?.seller;
	  if (!seller) { throw new Error('seller public key is required'); }


	 // create inner tx from buyer
  	let nolan_amount = this.app.wallet.convertSaitoToNolan();
	let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(
		seller,
		nolan_amount
	);

	newtx.msg = {
		module: this.name,
		request: 'crypto payment',
		amount,
		from: this.publicKey,
		to: seller,
	};

	  newtx.packData();
	  await newtx.sign();


	// create tx to send to server
	  const txmsg = {
	    module:  'AssetStore',
	    request: 'purchase_asset_transaction',
	    nft_id:  nft.id,
	    seller,
	     price:   String(price), // keeping as string to avoid JSON bigint issues
	     fee:     String(fee),

	    tx : newtx.serialize_to_web(this.app)
	  };

	if (nft.image) txmsg.image = nft.image;
	if (nft.text) txmsg.text = nft.text;

	  paytx.msg  = txmsg;
	  paytx.packData();
	  await paytx.sign();

	  return paytx;
	}

	async receivePurchaseAssetTransaction(tx, blk = null) {
	  try {
	    if (this.app.BROWSER) return;

	    const txmsg = tx.returnMessage();
	    

		let buytx = new Transaction();
	        buytx.deserialize_from_web(this.app, txtxmsg.tx);

	    const buyer  = tx.from?.[0]?.publicKey || tx.returnSender();
	    const nft_id = txmsg.nft_id;
	    const seller = txmsg.seller;
	    const price  = BigInt(txmsg.price ?? 0);
	    const fee    = BigInt(txmsg.fee   ?? 0);
	    if (!nft_id || !seller) {
	      console.warn('Purchase: missing nft_id/seller'); return;
	    }
	    if (price <= 0n || fee < 0n) {
	      console.warn('Purchase: invalid price/fee'); return;
	    }

	    // Verify record exists & active & belongs to seller
	    const rows = await this.app.storage.queryDatabase(
	      'SELECT * FROM records WHERE nft_id = $nft_id AND seller = $seller AND active = 1 LIMIT 1',
	      { $nft_id: nft_id, $seller: seller },
	      'assetstore'
	    );
	    if (!rows || rows.length === 0) {
	      console.warn('Purchase: record not found / not active / wrong seller');
	      return;
	    }

	    // Verify module currently controls the NFT (like your delist)
	    const raw  = await this.app.wallet.getNftList();
	    const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : []);
	    const nft_owned = (list || []).find(n => n.id === nft_id);
	    if (!nft_owned) {
	      console.warn('Purchase: module wallet does not hold the NFT right now');
	      return;
	    }

	    // Verify if payment done to AssetStore
	    const total = price + fee;
	    const paidToMe = this.amountToMe(tx); 
	    if (paidToMe < total) {
	      console.warn(`Purchase: insufficient payment to module. got=${paidToMe} need=${total}`);
	      return;
	    }

	    // Create NFT transfer to buyer (bound send)
	    const slip1key = nft_owned.slip1?.utxo_key;
	    const slip2key = nft_owned.slip2?.utxo_key;
	    const slip3key = nft_owned.slip3?.utxo_key;
	    const amount   = BigInt(nft_owned.slip2?.amount ?? 0);
	    if (!slip1key || !slip2key || !slip3key) {
	      console.warn('Purchase: missing slip keys for owned NFT');
	      return;
	    }
	    if (amount <= 0n) {
	      console.warn('Purchase: NFT amount is zero/invalid'); return;
	    }

	    let obj = {};
	    if (msg.image) obj.image = msg.image;
	    if (msg.text) obj.text = msg.text;

    	    const txMsg = {
	    	data: obj, 
	    	module: 'AssetStore', 
	    	request: 'send nft' 
	    };

	    const nftMsg = {
	      data: txMsg,
	      module: 'AssetStore',
	      request: 'send nft',
	      context: 'purchase',
	      nft_id,
	      buyer,
	      seller
	    };

	    const nftTx = await this.app.wallet.createSendBoundTransaction(
	      amount, slip1key, slip2key, slip3key, buyer, nftMsg
	    );
	    await nftTx.sign();

	    // 6) Broadcast both, prefer NFT first (so seller is paid when transfer is on the way)
	    this.app.network.propagateTransaction(nftTx);
	    this.app.network.propagateTransaction(paySellerTx);

	    // 7) DB: mark inactive/sold (optimistic); UI update
	    await this.setInactive(seller, nft_id);
	    this.app.connection.emit('assetstore-update-auction-list-request');

	  } catch (err) {
	    console.error('receivePurchaseAssetTransaction error:', err);
	  }
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

                console.log("setActive res: ", res);
                return res?.changes;
	}

	async setInactive(
		seller = "",
		nft_id = ""
	) {

		console.log("inside setInactive ///");

                let sql = `UPDATE records SET active = 0 WHERE seller = $seller AND nft_id = $nft_id`;
                let params = {
                        $seller : seller,
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
	  lc = 1,
	  bsh = "",
	  bid = 0,
	  tid = 0
	) {
	  // prevent empty nft_id, we have UNIQUE('') in table will cause it to be ignored
	  if (!nft_id || (typeof nft_id === "string" && nft_id.trim() === "")) {
	    console.warn("addRecord: empty nft_id — not inserting");
	    return 0;
	  }

	console.log("seller: " + seller);
	console.log("nft_id: " + nft_id);
	//console.log("nft_tx: " + nft_tx);
	console.log("nft_sig: " + nft_sig);
	console.log("lc: " + lc);
	console.log("bsh: " + bsh);
	console.log("bid: " + bid);
	console.log("tid: " + tid);


	  const lcNum  = typeof lc  === "bigint" ? Number(lc)  : Number(lc)  || 0;
	  const bidNum = typeof bid === "bigint" ? Number(bid) : Number(bid) || 0; // handles `3n`
	  const tidStr = String(tid);

	  //
	  // insert if nft_id unique, else update existing row
	  //
	  const sql = `
	    INSERT INTO records (
	      seller, nft_id, nft_tx, lc, bsh, bid, tid
	    ) VALUES (
	      $seller, $nft_id, $nft_tx, $lc, $bsh, $bid, $tid
	    )
	    ON CONFLICT(nft_id) DO UPDATE SET
	      seller = excluded.seller,
	      nft_tx = excluded.nft_tx,
	      lc     = excluded.lc,
	      bsh    = excluded.bsh,
	      bid    = excluded.bid,
	      tid    = excluded.tid;
	  `;

	  const params = {
	    $seller: seller,
	    $nft_id: nft_id,
	    $nft_tx: nft_tx,
	    $lc: lcNum,
	    $bsh: bsh,
	    $bid: bidNum,
	    $tid: tidStr
	  };

	  const res = await this.app.storage.runDatabase(sql, params, "assetstore");
	  console.log("addRecord changes:", res);
	  return res?.changes ?? 0;
	}

	amountToMe(tx) {
	  try {
	    const mine = (tx?.to || []).filter(o => o?.publicKey === this.publicKey);
	    return mine.reduce((acc, o) => acc + BigInt(o?.amount ?? 0), 0n);
	  } catch {
	    return 0n;
	  }
	}


}

module.exports = AssetStore;

