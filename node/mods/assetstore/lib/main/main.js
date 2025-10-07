const JSON = require('json-bigint');
const AssetStoreMainTemplate = require('./main.template');
const Transaction = require('../../../../lib/saito/transaction').default;
const AssetStoreNftCard = require('./../overlays/assetstore-nft-card');

const ListNftsOverlay = require('./../overlays/list-nfts');
const SendNftOverlay = require('./../overlays/send-nft');
const BuyNftOverlay = require('./../overlays/buy-nft');
const DelistNftOverlay = require('./../overlays/delist-nft');

class AssetStoreMain {

	constructor(app, mod, container = 'body') {

		this.app = app;
		this.mod = mod;
		this.container = container;

		this.list_nfts_overlay = new ListNftsOverlay(this.app, this.mod);
		this.send_nft_overlay = new SendNftOverlay(this.app, this.mod);
		this.buy_nft_overlay = new BuyNftOverlay(this.app, this.mod);
		this.delist_nft_overlay = new DelistNftOverlay(this.app, this.mod);

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
		console.log("this.mod.listings: ", this.mod.listings);

		if (this.mod.listings.length > 0) {

			empty_msg.style.display = 'none';
			title.style.display = 'block';


			for (let i = 0; i < this.mod.listings.length; i++) {
				let record = this.mod.listings[i];

				let data = {
					id: record.nft_id,
					tx_sig: record.nfttx_sig
				};

				const nft_card = new AssetStoreNftCard(this.app, this.mod, '.assetstore-table-list', null, data, async (nft1) => {

					console.log("main-js nft-card callback:", nft1);

					const seller_publicKey = nft1?.seller || '';

					console.log("seller_publicKey:", seller_publicKey);
					console.log("this.mod.publicKey:", this.mod.publicKey);

					if (seller_publicKey === this.mod.publicKey) {

						this.delist_nft_overlay.nft = nft1;

						console.log("this.delist_nft_overlay:", this.delist_nft_overlay);

						this.delist_nft_overlay.render();
					} else {
						this.buy_nft_overlay.nft = nft1;

						console.log("this.buy_nft_overlay:", this.buy_nft_overlay);
						this.buy_nft_overlay.render();
					}
				});


				await nft_card.nft.setAskPrice(record?.reserve_price);

				console.log("nft-card after setPrice: ", nft_card);
				await nft_card.nft.setSeller(record?.seller);
				await nft_card.render();

			}

		} else {

			empty_msg.style.display = 'block';
			title.style.display = 'none';
		}

	}

}

module.exports = AssetStoreMain;
