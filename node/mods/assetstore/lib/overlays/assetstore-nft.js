const SaitoNFT = require('./../../../../lib/saito/ui/saito-nft/saito-nft');

class AssetStoreNft extends SaitoNFT {

  constructor(app, mod, tx = null, data = null, callback = null, nft_card = null) {
    super(app, mod, tx, data, callback);
    this.card = nft_card;
  }


  async fetchTransaction(callback = null) {

    if (!this.id) {
      console.error('Unable to fetch NFT transaction (no nft id found)');
      if (callback) {
        this.tx_fetched = false;
        return callback();
      }
    }

    if (this.tx && this.txmsg && (this.image || this.text)) {
      //
      // Avoiding fetchTransaction (tx, txmsg, img/txt already set);
      //
      if (callback) {
        this.tx_fetched = false;
        return callback();
      }
    }

    if (this.tx == null) {

      this.app.network.sendRequestAsTransaction(
        'request nft image',
        { nfttx_sig : this.tx_sig },
        (txs) => {
  	  if (txs?.length > 0) { 
           this.tx = new Transaction();
           this.tx.deserialize_from_web(this.app, txs[0]);
           this.tx_fetched = true;
	   if (this.card != null) {
if (this.app.BROWSER) { alert("about to re-render card..."); }
	      this.buildNFTData();
 	      this.card.render(); 
 	      this.card.attachEvents();
	    }
	  } else {
	    this.tx_fetched = false;
	    console.log("could not log tx for: " + this.tx_sig);
 	  }
        },
        this.mod.assetStore.peerIndex
      );

    } else {

    }      

  }




}

module.exports = AssetStoreNft;

