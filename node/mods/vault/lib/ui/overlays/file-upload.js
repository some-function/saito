const ListNftsOverlay = require('./list-nfts.js');
const FileUploadTemplate = require('./file-upload.template');
const SaitoOverlay = require('./../../../../../lib/saito/ui/saito-overlay/saito-overlay');


class FileUpload {

  constructor(app, mod, container = '') {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    this.list_nfts_overlay = new ListNftsOverlay(this.app, this.mod);
    this.submit_button_active = false;
  }

  render() {
    this.overlay.show(FileUploadTemplate(this.app, this.mod, this));
    setTimeout(() => this.attachEvents(), 25);
  }

  attachEvents() {
try {
console.log("AE 1");
    document.querySelector('.nft-creator .button-container').style.display = "none";
    document.querySelector('.nft-creator .textarea-container').style.display = "flex";
console.log("AE 1");
    //
    // drag-and-drop file upload
    //
    this.app.browser.addDragAndDropFileUploadToElement(
      'vault-file-upload',
      async (file, confirm = false, fileobj = null) => {
	try {
          this.mod.file = file;
          this.mod.filename = fileobj.name;
          document.querySelector('.nft-creator .button-container').style.display = "flex";
          document.querySelector('.nft-creator .textarea-container').style.display = "none";
	} catch (err) {
	  console.log("ERROR: " + err);
	}
      },
      true
    );
console.log("AE 2");

    //
    // nft-binding buttons
    //
    document.querySelector('.private-nft').onclick = async (e) => {
      this.list_nfts_overlay.render();
    }
console.log("AE 3");
    document.querySelector('.public-nft').onclick = async (e) => {
      let newtx = await this.mod.createVaultAddFileTransaction();

      let callback_func = (res) => {
	this.overlay.hide();
      }
      if (this.mod.peer) {
        try { 
	  await this.app.network.sendRequestAsTransaction(
            'vault add file' ,
            newtx.serialize_to_web(this.app) ,
            callback_func,
            this.mod.peer.peerIndex
          );
	} catch (err) { 
  console.error("Type:", typeof err);

  // inspect all enumerables
  console.error("Keys:", Object.keys(err));

  // full expansions
  console.dir(err, { depth: 10 });

	}
        siteMessage('Transferring File to Archive...', 3000);
      } else {
	alert("ERROR: issue connecting to server. Please try again later.");
      }
    }
} catch (err) {
  console.log("ERROR: " + JSON.stringify(err));
  console.error("Type:", typeof err);
  console.error("Keys:", Object.keys(err));
  console.dir(err, { depth: 10 });
}
  }

}

module.exports = FileUpload;

