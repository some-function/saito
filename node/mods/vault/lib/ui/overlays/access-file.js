const AccessFileTemplate = require('./access-file.template');
const SaitoOverlay = require('./../../../../../lib/saito/ui/saito-overlay/saito-overlay');


class AccessFile {

  constructor(app, mod, container = '') {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    this.file = null;
    this.submit_button_active = false;
  }

  render() {
    this.overlay.show(AccessFileTemplate(this.app, this.mod, this));
    setTimeout(() => this.attachEvents(), 25);
  }

  attachEvents() {
try {
    document.querySelector('#confirm-button').onclick = async (e) => {

      alert("Accessing File!");

      if (!this.submit_button_active) { return; }

      let html = `<div class="vault-upload-notice"><div>Requesting File</div><img class="spinner" src="/saito/img/spinner.svg"></div>`;
      document.querySelector('.nft-creator .textarea-container').innerHTML = html;
      document.querySelector('.vault-upload-overlay .saito-button-row').style.visibility = "hidden";
      document.querySelector('.vault-upload-overlay .saito-overlay-form-header .saito-overlay-form-header-title div').innerHTML = "One Moment Please...";

      siteMessage("preparing request...", 1000);

      let newtx = await this.app.wallet.createUnsignedTransaction(this.mod.publicKey);
      let msg = {
	request : "vault download transaction" ,
	data : { txsig : "HELLO WORLD" } ,
	access_script : "HELLO WORLD" ,
	access_witness : "HELLO WORLD" 
      }

      siteMessage("signing proof of ownership...", 1000);

      newtx.msg = msg;
      await newtx.sign(); 

      siteMessage("sharing cryptographic proof with archive...", 1000);

      let callback_func = (res="") => {
	alert("received back add file to vault: " + JSON.stringify(res));
	this.overlay.hide();
      }

      if (this.mod.peer) {
        this.app.network.sendRequestAsTransaction(
          'vault download transaction' ,
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

module.exports = AccessFile;

