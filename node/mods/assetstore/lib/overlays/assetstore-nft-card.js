const SaitoNFTCard = require('./../../../../lib/saito/ui/saito-nft/nft-card');
const AssetStoreNFT = require('./assetstore-nft');


class AssetStoreNftCard extends SaitoNFTCard {

  constructor(app, mod, container = '', tx = null, data = null, callback = null) {

    super(app, mod, container, null, data, callback);
    this.tx = tx;
    this.nft = new AssetStoreNft(app, mod, tx, data, callback);
    this.nft.buildNFTData();

  }

}

module.exports = AssetStoreNftCard;

