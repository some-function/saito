cons = require('json-bigint');
const AssetStoreMainTemplate = require('./main.template');
const Transaction = require('../../../../lib/saito/transaction').default;
const NftCard = require('./../../../../lib/saito/ui/saito-nft/nft-card');

const ListNftsOverlay = require('./../overlays/list-nfts');
const SendNftOverlay = require('./../overlays/send-nft');
const BuyNftOverlay = require('./../overlays/buy-nft');

class AssetStoreMain {

	constructor(app, mod, container = 'body') {

		this.app = app;
		this.mod = mod;
		this.container = container;

		this.list_nfts_overlay = new ListNftsOverlay(this.app, this.mod);
		this.send_nft_overlay = new SendNftOverlay(this.app, this.mod);


		this.app.connection.on('assetstore-render', async () => {
			await this.render();
		});

		this.app.connection.on('assetstore-render-listings', async () => {
			await this.renderListings();
		});
	}

	async render() {
		let this_self = this;

		if (!document.querySelector('.saito-container')) {
			this.app.browser.addElementToDom(AssetStoreMainTemplate(this.app, this.mod, this));
		} else {
			this.app.browser.replaceElementBySelector(
				AssetStoreMainTemplate(this.app, this.mod, this),
				'.saito-container'
			);
		}

		await this.renderListings();

		this.attachEvents();
	}

	attachEvents() {

		let this_self = this;
		let list_asset_btn = document.querySelector('.list-asset');
		if (list_asset_btn) {
			list_asset_btn.onclick = async (e) => {
				this.list_nfts_overlay.render();
			};
		}

	}


	async renderListings() {

		if (document.querySelector('.assetstore-table-list')) {
			document.querySelector('.assetstore-table-list').innerHTML = ``;
		}

		let empty_msg = document.querySelector('#assetstore-empty');
		let title = document.querySelector('#assetstore-table-title');

		//
		//
		//
		if (this.mod.listings.length > 0) {

			empty_msg.style.display = 'none';
			title.style.display = 'block';

			console.log("this.mod.listings: ", this.mod.listings);

			for (let i = 0; i < this.mod.listings.length; i++) {
				let record = this.mod.listings[i];

				let data = {
					id: record.nft_id,
					tx_sig: record.nfttx_sig
				};

				const nft_card = new NftCard(this.app, this.mod, '.assetstore-table-list', null, data, async (nft1) => {

					const seller_publicKey = nft1?.seller || '';

					if (seller_publicKey === this.mod.publicKey) {
						this.delist_nft_overlay.nft = nft1;
						this.delist_nft_overlay.render();
					} else {
						this.buy_nft_overlay.nft = nft1;
						this.buy_nft_overlay.render();
					}
				});


				await nft_card.nft.setPrice(record?.reserve_price);
				await nft_card.nft.setSeller(record?.seller);
				await nft_card.render();

			}

		} else {

			empty_msg.style.display = 'block';
			title.style.display = 'none';
		}


	  const buy = mount.getElementById('confirm_buy');
	  if (buy) {
	    buy.onclick = async (e) => {
	      e.preventDefault();
	      try {
	        const buyTx = await this.mod.createPurchaseAssetTransaction(nft);
	        await this.app.network.propagateTransaction(buyTx);
	        this.app.connection.emit('saito-nft-details-close-request');
	        siteMessage('Purchase submitted. Waiting for network confirmation...', 3000);
	      } catch (err) {
	        salert('Failed to buy: ' + (err));
	      }
	    };
	  }

	  const delist = mount.getElementById('confirm_delist');
	  if (delist) {
	    delist.onclick = async (e) => {
	      e.preventDefault();
	      try {
	
	      	let nft_txsig = this.nft.tx_sig
	      	let delist_drafts = this.app.options?.assetstore?.delist_drafts;

	      	console.log("this.nft: ", this.nft);
	      	console.log("delist_drafts: ", delist_drafts);

	      	if (delist_drafts[nft_txsig]) {

	      		let delist_tx = new Transaction();
				delist_tx.deserialize_from_web(this.app, delist_drafts[nft_txsig]);

				console.log("delist_tx: ", delist_tx);

				this_self.app.network.propagateTransaction(delist_tx);

		        this.app.connection.emit('saito-nft-details-close-request');
		        siteMessage('Delist request submitted. Waiting for network confirmation…', 3000);
	      	} else {
	      		siteMessage('Unable to find delist transaction', 3000);
	      	}

	      } catch (err) {
	        salert('Failed to delist: ' + (err?.message || err));
	      }
	    };
	  }

	  this.applySellerToggle();
	}

	applySellerToggle() {
	  const root = this._overlayRoot || document;
	  const buySection  = root.querySelector('.nft-details-buy');
	  const delistSection = root.querySelector('.nft-details-send');
	  const headerSendBtn = root.getElementById ? root.getElementById('send') : document.getElementById('send');

	  const showBuy = () => {
	    if (buySection) buySection.style.display = '';
	    if (delistSection) delistSection.style.display = 'none';
	    if (headerSendBtn) headerSendBtn.textContent = 'Buy';
	  };
	  const showDelist = () => {
	    if (buySection) buySection.style.display = 'none';
	    if (delistSection) delistSection.style.display = '';
	    if (headerSendBtn) headerSendBtn.textContent = 'Delist';
	  };

	  console.log('toggle delist (mod pk): ', this.mod.publicKey);
	  console.log('toggle delist (nft): ', this.nft);

	  const sellerPk = this.nft?.seller || this.nft?.slip1?.public_key || '';
	  if (sellerPk && sellerPk === this.mod.publicKey) {
	    showDelist();
	  } else {
	    showBuy();
	  }
	}


}

module.exports = AssetStoreMain;
