const SaitoNFT = require('./../../../../lib/saito/ui/saito-nft/saito-nft');

class AssetStoreNft extends SaitoNFT {

  constructor(app, mod, tx = null, data = null, callback = null) {
    super(app, mod, tx, data, callback);
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

if (this.app.BROWSER) {
  alert("BEFORE LOAD TRANSACTIONS: " + this.id + " / " + this.tx_sig);
}

    this.app.network.sendRequestAsTransaction(
      'request nft image',
      { nfttx_sig : this.tx_sig },
      (txs) => {
	if (txs?.length > 0) { 
if (this.app.BROWSER) {
  alert("we got some txs back: " + txs.length);
}
	  this.tx = txs[0]; 
          this.tx_fetched = true;
	} else {
	  this.tx_fetched = false;
	  console.log("could not log tx for: " + this.tx_sig);
	}
      },
      this.mod.assetStore.peerIndex
    );      

  }




}

module.exports = AssetStoreNft;

