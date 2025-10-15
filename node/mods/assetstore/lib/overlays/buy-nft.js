let NftDetailsOverlay = require('./../../../../lib/saito/ui/saito-nft/overlays/nft-overlay');
let SaitoPurchaseOverlay = require('./saito-purchase');

class BuyNftOverlay extends NftDetailsOverlay {
  constructor(app, mod) {
    super(app, mod, false);
    this.purchase_saito = new SaitoPurchaseOverlay(app, mod);
  }

  async render() {
    let self = this;
    await super.render();

    let root = this._overlayRoot || document;
    let mount = root.getElementById ? root : document;

    let container = mount.getElementById('nft-details-send');
    if (!container) return;

    let priceRaw = await this.nft.getBuyPriceSaito?.();
    let price = typeof priceRaw === 'bigint' ? priceRaw.toString() : (priceRaw ?? '');

    container.innerHTML = `
      <div class="nft-details-action" id="nft-details-action">
        <div class="nft-details-buy" style="display:none">
          <div class="nft-buy-row">
            <div class="nft-details-confirm-msg">
              Confirm buy this asset for <span id="nft-buy-price"></span> SAITO?
            </div>
          </div>
          <div class="saito-button-row auto-fit">
            <button id="cancel" class="saito-button-secondary cancel-action">Close</button>
            <button id="confirm_buy" class="saito-button-primary">Buy Now</button>
          </div>
        </div>
      </div>
    `;

    let priceNode = mount.getElementById('nft-buy-price');
    if (priceNode) priceNode.textContent = `${price}`;

    let send_btn_label = mount.getElementById('send');
    if (send_btn_label) send_btn_label.textContent = 'Buy';

    let cancel = mount.getElementById('cancel');
    if (cancel) cancel.onclick = () => { this.overlay?.close?.(); };

    let buyBtn = mount.getElementById('confirm_buy');
    if (buyBtn) {
      buyBtn.onclick = async (e) => {
        e.preventDefault();
        buyBtn.disabled = true;
        try {
          let newtx = await this.mod.createPurchaseAssetTransaction(this.nft);
          await this.app.network.propagateTransaction(newtx);
          this.overlay?.hide?.();
          siteMessage('Purchase submitted. Waiting for network confirmation...', 3000);
        } catch (err) {
          salert('Failed to buy: ' + err);
          buyBtn.disabled = false;
        }
      };
    }

    if (send_btn_label && !mount.getElementById('send_other_crypto')) {
      let purchase_btn = document.createElement('button');
      purchase_btn.id = 'send_other_crypto';
      purchase_btn.className = send_btn_label.className || 'saito-button-secondary';
      purchase_btn.textContent = 'Buy with other crypto';
      purchase_btn.type = 'button';
      purchase_btn.setAttribute('aria-label', 'Buy with other crypto');
      send_btn_label.insertAdjacentElement('afterend', purchase_btn);

      purchase_btn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            purchase_btn.disabled = true;
            
            siteMessage('Creating purchase address & QRCode', 1500);

            //
            // empty render, just show loader for now
            //
            self.purchase_saito.render();

            let newtx = await self.mod.createWeb3CryptoPurchase(self.nft);

            // hardcoded price, ticker values
            let ticker = 'TRX';
            let saito = 0.00213;
            let trx = 0.3124;
            let nft_price = self.nft.getBuyPriceSaito();
            let converted_amount = (nft_price * saito) / trx;

            let data = { 
              purchase_txmsg : newtx.returnMessage(),
              ticker: ticker,
              amount: converted_amount
            };

            console.log("Request data:", data);

            //
            // send request to mixin to create purchase address
            //
            self.app.network.sendRequestAsTransaction(
              'request create purchase address',
              data,
              (res) => {

                console.log("Received callback from mixin");

                //
                // re-render with updated values to show qrcode etc
                //           

                //
                // hardcoded delay to check spinning loader before qrcode
                //
                if (res?.destination) {
                  setTimeout(function() {
                    self.purchase_saito.ticker = ticker;
                    self.purchase_saito.address = res.destination;
                    self.purchase_saito.amount = converted_amount;
                    self.purchase_saito.render(); 
                  }, 1500);
                } else {
                  salert("Unable to create purchase address");
                }

              },
              self.mod.assetStore.peerIndex
            );

        } catch (err) {
          console.log(err);
          salert('Could not create purchase saito address: ' + err);
        } finally {
          purchase_btn.disabled = false;
        }

      });
    }

    this.showBuy();
  }

  async createDepositAddress(mixin, asset_id, chain_id, ticker) {
    let deposit = await mixin.createDepositAddress(asset_id, chain_id, false);
    if (!deposit) {
      if (this.app.BROWSER) {
        salert('Having problem generating key for ' + ' ' + ticker);
      }
      return null;
    }
    return deposit[0];
  }

  showBuy() {
    let root = this._overlayRoot || document;
    let buySection = root.querySelector('.nft-details-buy');
    let delistSection = root.querySelector('.nft-details-delist');
    let sendSection = root.querySelector('.nft-details-send-section');

    if (buySection) buySection.style.display = '';
    if (delistSection) delistSection.style.display = 'none';
    if (sendSection) sendSection.style.display = 'none';

    let headerBtn = root.getElementById
      ? root.getElementById('send')
      : document.getElementById('send');
    if (headerBtn) headerBtn.textContent = 'Buy';
  }
}

module.exports = BuyNftOverlay;
