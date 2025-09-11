const BaseSend = require('./../../../../lib/saito/ui/saito-nft/send-overlay');

class AuctionSendOverlay extends BaseSend {
  async render(nft) {
    await super.render(nft);
    this.hideMergeSplit();
    this.addDelistSection();
    this.addBuySection();
    this.attachEvents();
  }

  // Hide merge/split sections
  hideMergeSplit() {
    const overlays = document.querySelectorAll('.nft-details-container');
    this._overlayRoot = overlays.length ? overlays[overlays.length - 1] : document;
    this.mergeSplitCont = this._overlayRoot.querySelector('#nft-merge-split');
    this.mergeCont = this._overlayRoot.querySelector('#nft-details-merge');
    this.splitCont = this._overlayRoot.querySelector('#nft-details-split');
    this.mergeSplitCont && (this.mergeSplitCont.style.display = 'none');
    this.mergeCont && (this.mergeCont.style.display = 'none');
    this.splitCont && (this.splitCont.style.display = 'none');
  }

  // Prepare list/delist section (hide input, set title)
  addDelistSection() {
    const overlays = document.querySelectorAll('.nft-details-container');
    this._overlayRoot = overlays.length ? overlays[overlays.length - 1] : document;
    this.receiver_input = this._overlayRoot.querySelector('#nft-receiver-address');

    const header = this._overlayRoot?.querySelector('.nft-details-send h4');
    if (header) header.textContent = 'DELIST FROM ASSETSTORE 🧾';

    if (this.receiver_input) {
      if (this._syncBtnListener) {
        this.receiver_input.removeEventListener('input', this._syncBtnListener);
        this.receiver_input.removeEventListener('change', this._syncBtnListener);
      }
      const wrap = this.receiver_input.closest('.nft-receiver');
      if (wrap) wrap.style.display = 'none';
      this.receiver_input.value = '';
      this.receiver_input.setAttribute('disabled', 'disabled');
      this.receiver_input.style.display = 'none';
    }
  }

  // Clone send section as buy section
  addBuySection() {
    const overlays = document.querySelectorAll('.nft-details-container');
    const root = overlays.length ? overlays[overlays.length - 1] : document;
    const sendSection = root.querySelector('.nft-details-send');
    if (!sendSection || !sendSection.parentElement) return;

    const buy = sendSection.cloneNode(true);
    buy.classList.remove('nft-details-send');
    buy.classList.add('nft-details-buy');

    // remove the receiver input area for buy
    const inputWrap = buy.querySelector('.nft-receiver');
    if (inputWrap) inputWrap.remove();

    const h4 = buy.querySelector('h4');
    if (h4) h4.innerHTML = 'BUY ASSET <i>🛒</i>';

    const btn = buy.querySelector('#send_nft') || buy.querySelector('button');
    if (btn) {
      btn.id = 'buy_nft';
      btn.innerText = 'Buy';
      btn.classList.remove('disabled');
      btn.removeAttribute('disabled');
    }

    // OPTIONAL: surface price/fee if your template doesn’t already show them.
    // You can set data attributes on the container like:
    //   data-price="1000000000" data-fee="10000000"
    // This overlay will read them automatically (see createBuyData()).

    sendSection.parentElement.appendChild(buy);
    this.buyBtn = buy.querySelector('#buy_nft') || buy.querySelector('button');
  }

  async attachEvents() {
    let this_self = this;
    await super.attachEvents();

    if (this.sendBtn) {
      this.sendBtn.classList.remove('disabled');
      this.sendBtn.removeAttribute('disabled');
      this.sendBtn.innerText = 'Delist';
      this.sendBtn.onclick = async (e) => { 
        e?.preventDefault?.(); 

        try {
          const delistTx = await this_self.mod.createDelistAssetTransaction(this_self.nft);
          await this.app.network.propagateTransaction(delistTx);
          this.overlay.close();
          salert('Delist request submitted. Awaiting network confirmation.');
        } catch (err) {
          console.error('Delist error:', err);
          salert('Delist failed. See console for details.');
        }
      };
    }

    if (!this.buyBtn) {
      const overlays = document.querySelectorAll('.nft-details-container');
      const root = overlays.length ? overlays[overlays.length - 1] : document;
      this.buyBtn = root.querySelector('#buy_nft') || root.querySelector('.nft-details-buy button');
    }

    if (this.buyBtn) {
      this.buyBtn.onclick = async (e) => { 
        e?.preventDefault?.();
        try {
          this.buyBtn.setAttribute('disabled', 'disabled');
          this.buyBtn.classList.add('disabled');

          const { price, fee, seller } = this.createBuyData();

          const purchaseTx = await this.mod.createPurchaseAssetTransaction(this.nft, { price, fee, seller });
          await this.app.network.propagateTransaction(purchaseTx);

          this.overlay.close();
          salert('Purchase submitted. You will receive the NFT once confirmed.');
        } catch (err) {
          console.error('Purchase error:', err);
          salert(err?.message || 'Purchase failed. See console for details.');
        } finally {
          this.buyBtn.removeAttribute('disabled');
          this.buyBtn.classList.remove('disabled');
        }
      };
    }
  }


  createBuyData() {
    const root = this._overlayRoot || document;
    const priceAttr  = root?.dataset?.price;
    const feeAttr    = root?.dataset?.fee;
    const sellerAttr = root?.dataset?.seller;

    const priceNode = root.querySelector('[data-amount]') || root.querySelector('.nft-price');
    let priceText = (priceNode && (priceNode.getAttribute?.('data-amount') || priceNode.textContent)) || 1;

    const nftPrice = this.nft?.price ?? this.nft?.buy_now ?? this.nft?.buyNowPrice ?? null;
    const seller   = sellerAttr || this.nft?.seller || this.nft?.owner || this.nft?.slip1?.public_key || this.mod?.publicKey;

    const feeDefault = (typeof this.mod?.purchaseFee !== 'undefined') ? this.mod.purchaseFee : 0;

    const price = this.toBigInt(priceAttr ?? priceText ?? nftPrice ?? 0);
    const fee   = this.toBigInt(feeAttr ?? feeDefault);

    if (!seller) throw new Error('Missing seller public key');
    if (price <= 0n) throw new Error('Invalid or missing price');

    return { price, fee, seller };
  }

  toBigInt(v) {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number') return BigInt(Math.trunc(v));
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return 0n;
      // strip commas and possible currency symbols
      const cleaned = s.replace(/[, ]+/g, '').replace(/[^\d-]/g, '');
      if (cleaned === '' || cleaned === '-' ) return 0n;
      return BigInt(cleaned);
    }
    return 0n;
  }
}

module.exports = AuctionSendOverlay;
