const Transaction = require('./../../../../lib/saito/transaction').default;
const NftDetailsOverlay = require('./../../../../lib/saito/ui/saito-nft/overlays/nft-overlay');

class DelistNftOverlay extends NftDetailsOverlay {
  constructor(app, mod) {
    super(app, mod, false);
  }

  async render() {
    await super.render();

    const root  = this.overlay?.el || document;

    const panel = root.getElementById('nft-details-send');
    if (!panel) return;

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

    const header_send_btn = root.getElementById('send');
    if (header_send_btn) header_send_btn.textContent = 'Delist';

    const cancel2 = root.getElementById('cancel2');
    if (cancel2) cancel2.onclick = () => this.overlay.close();

    const delist = root.getElementById('confirm_delist');
    if (delist) {
      delist.onclick = async (e) => {
        e.preventDefault();
        try {
          const nfttx_sig = this.nft?.tx_sig;
          const drafts = this.app.options?.assetstore?.delist_drafts || {};
          const delist_tx_serialized = drafts[nfttx_sig];
          if (!delist_tx_serialized) return siteMessage('Unable to find delist transaction', 3000);

          let delist_tx = new Transaction();
          delist_tx.deserialize_from_web(this.app, delist_tx_serialized);

          console.log("delist tx:", delist_tx);
          this.app.network.propagateTransaction(delist_tx);


          this.overlay.close();
          siteMessage('Delist request submitted. Waiting for network confirmation…', 3000);
        } catch (err) {
          salert('Failed to delist: ' + (err?.message || err));
        }
      };
    }

    this.showDelist();
  }

  showDelist() {
    const root = this.overlay?.el || document;
    const buy_section    = root.querySelector('.nft-details-buy');
    const delist_section = root.querySelector('.nft-details-delist');
    const header_send_btn = root.getElementById('send');

    if (buy_section)    buy_section.style.display = 'none';
    if (delist_section) delist_section.style.display = '';
    if (header_send_btn) header_send_btn.textContent = 'Delist';
  }
}


module.exports = DelistNftOverlay;
