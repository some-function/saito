let SaitoNftCard = require('./../../../../lib/saito/ui/saito-nft/nft-card');
let AssetStoreNft = require('./assetstore-nft');


class AssetStoreNftCard extends SaitoNftCard {

  constructor(app, mod, container = '', tx = null, data = null, callback = null) {

    super(app, mod, container, tx, data, callback);
    this.tx = tx;
    this.nft = new AssetStoreNft(app, mod, tx, data, callback, this); // last argument is the card that is rendered
    this.nft.buildNFTData();

  }

}

module.exports = AssetStoreNftCard;

