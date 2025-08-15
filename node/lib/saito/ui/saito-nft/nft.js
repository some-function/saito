const NftTemplate = require('./nft.template');
const SaitoOverlay = require('./../saito-overlay/saito-overlay');

class Nft {
  constructor(app, mod, container = '', tx = null) {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this.overlay = new SaitoOverlay(this.app, this.mod);

    //
    // tx details
    //
    this.tx = tx;
    this.id = null;
    this.slip1 = null;
    this.slip2 = null;
    this.slip3 = null;
    
    //
    // nft details
    //
    this.amount = BigInt(0); // nolans
    this.deposit = BigInt(0); // nolans
    this.image = '';
    this.text = '';

    //
    // UI helpers
    //
    this.idx = null;
    this.has_local_tx = false;
  }

  async render() {

    this.app.browser.prependElementToSelector(
      NftTemplate(this.app, this.mod, this),
      this.container
    );
  
    this.attachEvents();
  }

  async createFromId(id) {
    let this_self = this;
    this.id = id;

    if (this.id != '') {
      //
      // first check if nft tx exists in local archive
      //
      await this.app.storage.loadTransactions(
        { field4: this_self.id },
        function (txs) {
          if (txs.length > 0) {
            let tx = txs[0];
            this_self.createFromTx(tx);
          }
        },
        'localhost'
      );

      //
      // if local archive doesnt have nft tx, fetch from peer
      // (leaving peer param empty lets saito.ts decide which peer to select)
      //
      if (this.has_local_tx == false) {
        let peers = await this.mod.app.network.getPeers();
        let peer = peers[0];

        await this.app.storage.loadTransactions(
          { field4: this_self.id },
          function (txs) {
            if (txs.length > 0) {

              console.log('remote nft txs: ', txs);

              let tx = txs[0];
              this_self.createFromTx(tx);
            }
          },
          peer
        );
      }

    }
  }

  createFromTx(tx) {
      this.has_local_tx = true;
      this.tx = tx;

      let tx_msg = tx.returnMessage();
      this.tx_sig = this.tx.signature;

      if (typeof tx_msg.data.image != 'undefined') {
        this.image = tx_msg.data.image;
      }

      if (typeof tx_msg.data.text != 'undefined') {
        this.text = JSON.stringify(tx_msg.data.text, null, 2);
      }

      if ((this.app.options.wallet.nfts).length > 0) {
        this.getSlips(null, this.tx_sig);
      }
  }

  getSlips(id = null, tx_sig = null) {
    this.idx = this.slip1.utxo_key;

    if ((this.app.options.wallet.nfts).length > 0) {
      let match = this.app.options.wallet.nfts.find(nft => nft.id === param || nft.tx_sig === param);
      this.id = match ? match.id : null;
      this.slip1 = match ? match.slip1 : null;
      this.slip2 = match ? match.slip2 : null;
      this.slip3 = match ? match.slip3 : null;

      // get nft value & deposit amount
      this.amount = BigInt(this.slip1.amount);
      this.deposit = BigInt(this.slip2.amount);
      
    }
  }

  getDepositInSaito(deposit) {
    return this.app.wallet.convertNolanToSaito(deposit);
  }

  attachEvents() {
    let nft_self = this;

    if (document.querySelectorAll('.nft-card')) {
      // document.querySelectorAll('.nft-card').forEach((row) => {
      //   row.onclick = (e) => {
      //     console.log('clicked on .nft-card');

      //     if (
      //       nft_self.send_nft.cancelSplitBtn &&
      //       nft_self.send_nft.cancelSplitBtn.style.display !== 'none'
      //     )
      //       return;
      //     document.querySelectorAll('.nft-card').forEach((r) => {
      //       r.classList.remove('nft-selected');
      //       const rRadio = r.querySelector('input[type="radio"].hidden-nft-radio');
      //       if (rRadio) rRadio.checked = false;
      //     });
      //     row.classList.add('nft-selected');
      //     const hiddenRadio = row.querySelector('input[type="radio"].hidden-nft-radio');
      //     if (hiddenRadio) {
      //       hiddenRadio.checked = true;

      //       //let idx = parseInt(hiddenRadio.value)

      //       nft_self.send_nft.nft_selected = parseInt(hiddenRadio.value);
      //     }
      //     nft_self.send_nft.updateNavAfterRowSelect();
      //   };
      // });
    }
  }
}

module.exports = Nft;
