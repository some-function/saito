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
if (this.app.BROWSER) {
  alert("NO ID!");
}
        return callback();
      }
    }

    if (this.tx && this.txmsg && (this.image || this.text)) {
if (this.app.BROWSER) {
  alert("EVERYTHING IS SET!");
}
      //
      // Avoiding fetchTransaction (tx, txmsg, img/txt already set);
      //
      if (callback) {
        this.tx_fetched = false;
        return callback();
      }
    }

if (this.app.BROWSER) {
  alert("BEFORE LOAD TRANSACTIONS");
}

    await this.app.storage.loadTransactions(

      { field4: this.id },

      async (txs) => {
        if (txs?.length > 0) {
          this.tx = txs[0];
          this.buildNFTData();
          if (callback) {
            this.tx_fetched = true;
            return callback();
          }
        } else {

if (this.app.BROWSER) {
  alert("trying to fetch assetstore tx");
}

        }
      },
      'localhost'
    );

    this.tx_fetched = false;
    return null;
  }




}

module.exports = AssetStoreNft;

