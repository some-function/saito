const FileUploadTemplate = require('./file-upload.template');
const SaitoOverlay = require('./../../../../../lib/saito/ui/saito-overlay/saito-overlay');


class FileUpload {

  constructor(app, mod, container = '') {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    this.file = null;
    this.submit_button_active = false;
  }

  render() {
    this.overlay.show(FileUploadTemplate(this.app, this.mod, this));
    setTimeout(() => this.attachEvents(), 25);
  }

  attachEvents() {

try {

    this.app.browser.addDragAndDropFileUploadToElement(

      'vault-file-upload',

      async (file) => {
try {
        let html = `<div class="vault-upload-notice"><div>click below to continue</div><img style='visibility="hidden"' class="spinner" src="/saito/img/spinner.svg"></div>`;
        document.querySelector('.nft-creator .textarea-container').innerHTML = "click below to continue...";
        document.querySelector('.vault-upload-overlay .saito-overlay-form-header .saito-overlay-form-header-title div').innerHTML = "Ready to Upload";


console.log("our file is: " + file);
        this.file = file;
	let submit_button = document.querySelector("#confirm-button");
	submit_button.classList.remove("disabled");
	this.submit_button_active = true;
} catch (err) {
console.log("ERROR: " + err);
}
      },
      true
    );

    document.querySelector('#confirm-button').onclick = async (e) => {

      if (!this.submit_button_active) { return ; }

      let html = `<div class="vault-upload-notice"><div>Uploading File</div><img class="spinner" src="/saito/img/spinner.svg"></div>`;
      document.querySelector('.nft-creator .textarea-container').innerHTML = html;
      document.querySelector('.vault-upload-overlay .saito-button-row').style.visibility = "hidden";
      document.querySelector('.vault-upload-overlay .saito-overlay-form-header .saito-overlay-form-header-title div').innerHTML = "One Moment Please...";

      siteMessage("encoding file...", 1000);

      let newtx = await this.app.wallet.createUnsignedTransaction(this.mod.publicKey);
      let msg = {
	access_hash : "XXXXXXXXXX" ,
	data : { file : this.file } ,
      }

      newtx.msg = msg;
      await newtx.sign(); 

      siteMessage("binding to nft...", 1000);

      let callback_func = (res="") => {
	alert("received back add file to vault: " + JSON.stringify(res));
	this.overlay.hide();
      }

      if (this.mod.peer) {
        this.app.network.sendRequestAsTransaction(
          'vault add file' ,
          newtx.serialize_to_web(this.app) ,
          callback_func,
          this.mod.peer.peerIndex
        );
        siteMessage('Transferring File to Archive...', 3000);
      } else {
	alert("ERROR: issue connecting to server. Please try again later.");
      }

    };
} catch (err) {
  console.log("ERROR: " + err);
}
  }

}

module.exports = FileUpload;

