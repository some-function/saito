const SaitoPurchaseTemplate = require('./saito-purchase.template');
const SaitoPurchaseEmptyTemplate = require('./saito-purchase-empty.template');
const SaitoPurchaseCryptoTemplate = require('./saito-purchase-select-crypto.template');
const SaitoOverlay = require('./../../../../lib/saito/ui/saito-overlay/saito-overlay');
const ListNftsOverlay = require('./../overlays/list-nfts');

class AssetstoreSaitoPurchaseOverlay {

	constructor(app, mod, container = 'body') {
		this.app = app;
		this.mod = mod;
		this.container = container;

		this.address = '';
		this.ticker = '';
		this.amount = 0;
		this.purchase_overlay = new SaitoOverlay(app, mod, false, true);
		this.crypto_selected = false;
		this.nft = null;
	}

	async render() {

		let self = this;
		this.purchase_overlay.remove();

		if (!this.crypto_selected) {
			this.purchase_overlay.show(SaitoPurchaseCryptoTemplate(this.app, this.mod, this));
		} else {
			if (!this.address){
				this.purchase_overlay.show(SaitoPurchaseEmptyTemplate(this.app, this.mod, this));
			} else {
				this.purchase_overlay.show(SaitoPurchaseTemplate(this.app, this.mod, this));
				this.app.browser.generateQRCode(this.address, 'pqrcode');
			}
		}

		this.attachEvents();
	}

	attachEvents() {
		let self = this;

		let generate_add_btn = document.querySelector('#purchase-crypto-generate');


		console.log("generate_add_btn:", generate_add_btn);

		if (generate_add_btn) {
			generate_add_btn.onclick = async (e) => {

				console.log("clicked on btn");
				//
				// fetch selected ticker
				//

    			let selected = document.querySelector('input[name="purchase-crypto"]:checked');
				if (!selected) {
					salert('Please select a crypto option.');
					return;
				}

				let value = selected.value;
				console.log('Selected crypto:', value);

				//
				// re-render self to show spinning loader
				//
				self.crypto_selected = true;
				self.render()

				//
				// create purchase tx to be embedded inside mixin request
				//
				let newtx = await self.mod.createWeb3CryptoPurchase(self.nft);

				//
	            // conversion rate logic (todo: replace with actual conversion prices)
	            //
	            let ticker = selected.value;
	            let saito_rate = 0.00213;
	            let conversion_rate = 0;

				switch (ticker) {
					case 'btc':
					  conversion_rate = 0.000001; // TODO: replace with real BTC rate
					  break;
					case 'eth':
					  conversion_rate = 0.00002;  
					  break;
					case 'trx':
					  conversion_rate = 1.0;     
					  break;
					default:
					  conversion_rate = 1.0;     
				}

	            let nft_price = self.nft.getBuyPriceSaito();
	            let converted_amount = (nft_price * saito_rate) / conversion_rate;


	            //
	            // send request to mixin to create purchase address
	            //
	            let data = { 
	              purchase_txmsg : newtx.returnMessage(),
	              ticker: ticker,
	              amount: converted_amount
	            };
	            console.log("Request data:", data);

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
	                    self.ticker = ticker.toUpperCase();
	                    self.address = res.destination;
	                    self.amount = converted_amount;
	                    self.render(); 
	                  }, 1500);
	                } else {
	                  salert("Unable to create purchase address");
	                }

	              },
	              self.mod.assetStore.peerIndex
	            );

			};
		}


	}

	reset() {
		this.address = '';
		this.ticker = '';
		this.amount = 0;
		this.crypto_selected = false;
		this.nft = null;
	}
}

module.exports = AssetstoreSaitoPurchaseOverlay;
