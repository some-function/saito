const SaitoNFTCard = require('./../../../../lib/saito/ui/saito-nft/nft-card');
const AssetStoreNFT = require('./assetstore-nft');


class AssetStoreNftCard extends SaitoNFTCard {

  constructor(app, mod, tx = null, data = null) {

    this.app = app;
    this.mod = mod;
    this.container = container;

    this.nft = new AssetStoreNft(app, mod, tx, data);

    //
    // UI helpers
    //
    this.callback = callback;

  }

}

module.exports = AssetStoreNftCard;

