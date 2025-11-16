let ListNft = require('./../../../../../lib/saito/ui/saito-nft/overlays/list-overlay');
let FileUploadOverlay = require('./file-upload.js');


class ListNftsOverlay extends ListNft {

  constructor(app, mod) {

    super(app, mod, false);

    this.file_upload_overlay = new FileUploadOverlay(app, mod);

    app.connection.on('wallet-updated', async () => {
        let { updated, rebroadcast, persisted } = await this.app.wallet.updateNftList();
        if (persisted) {
          siteMessage(`NFT updated in wallet`, 3000);
        }
        if (this.overlay.visible) {
          this.render();
        }
    });

  }

  async render() {

    let list_self = this;
    await super.render();

    if (this.nft_list) {
      for (let z = 0; z < this.card_list.length; z++) {
	let nft = this.card_list[z].nft;
        this.card_list[z].callback = () => {

	  //
	  // extract the slips and create the script 
	  //
	  this.file_upload_overlay.render();
	  list_self.overlay.hide();

        };
      }
    }

  }

}

module.exports = ListNftsOverlay;
