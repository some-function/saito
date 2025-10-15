const SaitoPurchaseTemplate = require('./saito-purchase.template');
const SaitoPurchaseEmptyTemplate = require('./saito-purchase-empty.template');
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
	}

	async render() {
		let this_self = this;
		this.purchase_overlay.remove();

		if (!this.address){
			this.purchase_overlay.show(SaitoPurchaseEmptyTemplate(this.app, this.mod, this));
		} else {
			this.purchase_overlay.show(SaitoPurchaseTemplate(this.app, this.mod, this));
			this.app.browser.generateQRCode(this.address, 'purchase-qrcode');
		}

		this.attachEvents();
	}

	attachEvents() {
	}
}

module.exports = AssetstoreSaitoPurchaseOverlay;
