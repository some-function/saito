  const NftCardTemplate = require('./nft-card.template');
const SaitoOverlay = require('./../saito-overlay/saito-overlay');

class NftCard {
  constructor(app, mod, container = '') {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this.nft = null;
    this.idx = 0;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    this.image = '';
    this.text = '';
    this.send_nft = null;
  }

  async render() {
    let nft_self = this;

    console.log("loading nft tx: ", this.nft.tx_sig);
    await this.app.storage.loadTransactions(
      { sig: nft_self.nft.tx_sig },
      function (txs) {
        console.log('load nft txs from archive:', txs);

        if (txs.length > 0) {
          let nft_tx = txs[0];

          let tx_msg = nft_tx.returnMessage();


          if (typeof tx_msg.image != 'undefined') {
            nft_self.image = tx_msg.image;  
          }

          if (typeof tx_msg.text != 'undefined') {
            nft_self.text = JSON.stringify(tx_msg.text, null, 2);  
          }
          console.log(tx_msg);
        }
          
      },
      'localhost'
    );

    this.app.browser.prependElementToSelector(NftCardTemplate(this.app, this.mod, this), this.container);
  
    this.attachEvents();
  }

  attachEvents() {
    let nft_self = this;

    document.querySelectorAll('.nft-card').forEach((row) => {
      row.onclick = (e) => {

        console.log("clicked on .nft-card");

        if (nft_self.send_nft.cancelSplitBtn && nft_self.send_nft.cancelSplitBtn.style.display !== 'none') return;
        document.querySelectorAll('.nft-card').forEach((r) => {
          r.classList.remove('nft-selected');
          const rRadio = r.querySelector('input[type="radio"].hidden-nft-radio');
          if (rRadio) rRadio.checked = false;
        });
        row.classList.add('nft-selected');
        const hiddenRadio = row.querySelector('input[type="radio"].hidden-nft-radio');
        if (hiddenRadio) {
          hiddenRadio.checked = true;
          nft_self.send_nft.nft_selected = parseInt(hiddenRadio.value);
        }
        nft_self.send_nft.updateNavAfterRowSelect();
      };
    });
  }

}

module.exports = NftCard;
