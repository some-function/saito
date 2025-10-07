const NftDetailsOverlay = require('./../../../../lib/saito/ui/saito-nft/overlays/nft-overlay');

class DelistNftOverlay extends NftDetailsOverlay {
  constructor(app, mod) {
    super(app, mod, false);
  }

  async render() {
    // 1) Render base overlay first
    await super.render();

    // 3) Find the overlay root and the existing SEND panel container
    const root  = this.overlay?.el || document;

    console.log("root: ", root);
    const panel = root.getElementById('nft-details-send');
    if (!panel) return;

    // 4) Replace ONLY the contents — no duplicate id!
    panel.innerHTML = `
      <div class="nft-details-delist" style="display:none">
        <div class="nft-buy-row">
          <div class="nft-details-confirm-msg">
            Confirm delist this asset from assetstore?
          </div>
        </div>
        <div class="saito-button-row auto-fit">
          <button id="cancel2" class="saito-button-secondary cancel-action">Close</button>
          <button id="confirm_delist" class="saito-button-primary">Delist</button>
        </div>
      </div>
    `;

    // 5) Header button text
    const headerSendBtn = root.getElementById('send');
    if (headerSendBtn) headerSendBtn.textContent = 'Delist';

    // 6) Wire up buttons
    const cancel2 = root.getElementById('cancel2');
    if (cancel2) cancel2.onclick = () => this.overlay.close();

    const delist = root.getElementById('confirm_delist');
    if (delist) {
      delist.onclick = async (e) => {
        e.preventDefault();
        try {
          const nft_txsig = this.nft?.tx_sig;
          const drafts = this.app.options?.assetstore?.delist_drafts || {};
          const raw = drafts[nft_txsig];
          if (!raw) return siteMessage('Unable to find delist transaction', 3000);

          let delist_tx = new Transaction();
          delist_tx.deserialize_from_web(this.app, raw);
          this.app.network.propagateTransaction(delist_tx);
          this.overlay.close();
          siteMessage('Delist request submitted. Waiting for network confirmation…', 3000);
        } catch (err) {
          salert('Failed to delist: ' + (err?.message || err));
        }
      };
    }

    // 7) Show the delist section (and hide the buy one)
    this.showDelist();
  }

  showDelist() {
    const root = this.overlay?.el || document;
    const buySection    = root.querySelector('.nft-details-buy');
    const delistSection = root.querySelector('.nft-details-delist');
    const headerSendBtn = root.getElementById('send');

    if (buySection)    buySection.style.display = 'none';
    if (delistSection) delistSection.style.display = '';
    if (headerSendBtn) headerSendBtn.textContent = 'Delist';
  }
}


module.exports = DelistNftOverlay;
