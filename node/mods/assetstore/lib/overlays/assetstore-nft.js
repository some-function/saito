let SaitoNFT = require('./../../../../lib/saito/ui/saito-nft/saito-nft');
let Transaction = require('./../../../../lib/saito/transaction').default;

class AssetStoreNft extends SaitoNFT {

  constructor(app, mod, tx = null, data = null, callback = null, nft_card = null) {
console.log("creating the AssetStore NFT!");
    super(app, mod, tx, data, callback);
    this.card = nft_card;
    if (tx != null) { 
console.log("tx is not null! : " + JSON.stringify(tx));
this.tx_fetched = true; 
    }
console.log("creating the AssetStore NFT 2! is fetched? " + this.tx_fetched);
  }

  async fetchTransaction(callback = null) {

    //
    // skip if we already have the transaction
    //
    if (this.tx) {
      this.tx_fetched = true;
console.log("TX FETCHED SUBMITTING NFT TO CALLBACK: " + JSON.stringify(this.tx));
      if (callback) { callback(this.nft); }
      return;
    }

    //
    // try to fetch locally before remote request
    //
    await this.app.storage.loadTransactions(

      { sig : this.tx_sig } ,

      (txs) => {
        if (txs?.length > 0) {
          this.tx = txs[0];
console.log("ASSIGNED TRANSACTION TO NFT: " + JSON.stringify(this.tx));
	  this.tx_fetched = true;
          this.buildNFTData();
	  if (this.card != null) {
	    this.card.render();
	    this.card.attachEvents();
          }
        }
      },

      'localhost'

    );




    if (this.tx == null) {

      this.app.network.sendRequestAsTransaction(
        'request nft image',
        { nfttx_sig : this.tx_sig },
        (txs) => {
console.log("*");
console.log("*");
console.log("*");
console.log("*");
console.log("*");
console.log("*");
console.log("we have sent the request for the nft as a transaction...");
  	  if (txs?.length > 0) { 
           this.tx = new Transaction();
           this.tx.deserialize_from_web(this.app, txs[0]);
           this.tx_fetched = true;
	   if (this.card != null) {
	      this.buildNFTData();
 	      this.card.render();
 	      this.card.attachEvents();
	    }
	  } else {
	    this.tx_fetched = false;
 	  }
        },
        this.mod.assetStore.peerIndex
      );

    }

  }




}

module.exports = AssetStoreNft;

