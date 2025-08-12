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
    this.has_local_tx = false;
  }

  async render() {
    let nft_self = this;
    let nft_id = this.send_nft.nft_list[this.idx].id || '';
    
    if (nft_id != '') {
      // first check if nft tx exists in local archive
      await this.app.storage.loadTransactions(
        { field4: nft_id },
        function (txs) {
          nft_self.extract_nft_data(txs);
        },
        'localhost'
      );

      // if local archive doesnt have nft tx, fetch from peer
      // (leaving peer param empty lets saito.ts decide which peer to select)
      if (this.has_local_tx == false) { 
        let peers = await this.mod.app.network.getPeers();
        let peer = peers[0];

        console.log("fetching nft tx from remote");
        console.log("peers: ", peers);
        await this.app.storage.loadTransactions(
          { field4: nft_id },
          function (txs) {
            console.log("remote nft txs: ", txs);
            nft_self.extract_nft_data(txs);
          },
          peer
        );
      }

      this.app.browser.prependElementToSelector(
        NftCardTemplate(this.app, this.mod, this),
        this.container
      );
    }

    this.attachEvents();
  }

  extract_nft_data(txs) {
    if (txs.length > 0) {
      this.has_local_tx = true;

      let nft_tx = txs[0];
      let tx_msg = nft_tx.returnMessage();

      if (typeof tx_msg.data.image != 'undefined') {
        this.image = tx_msg.data.image;
      }

      if (typeof tx_msg.data.text != 'undefined') {
        this.text = JSON.stringify(tx_msg.data.text, null, 2);
      }
    }
  }

  attachEvents() {
    let nft_self = this;

    if (document.querySelectorAll('.nft-card')) {
      document.querySelectorAll('.nft-card').forEach((row) => {
        row.onclick = (e) => {
          console.log('clicked on .nft-card');

          if (
            nft_self.send_nft.cancelSplitBtn &&
            nft_self.send_nft.cancelSplitBtn.style.display !== 'none'
          )
            return;
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
}

module.exports = NftCard;
