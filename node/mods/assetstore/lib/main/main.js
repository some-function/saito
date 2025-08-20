const JSON = require('json-bigint');
const AssetStoreMainTemplate = require('./main.template');
const Nft = require('./../../../../lib/saito/ui/saito-nft/nft');

class AssetStoreMain {

	constructor(app, mod, container = 'body') {

		this.app = app;
		this.mod = mod;
		this.container = container;
		this.nft_list = [];
		this.nft_cards = [];
	}

	async render() {

    		if (!document.querySelector('.saito-container')) {
      		  this.app.browser.addElementToDom(AssetStoreMainTemplate(this.app, this.mod));
    		}

    		this.nft_list = await this.fetchNFT();
    		await this.buildNftComponents();

		this.attachEvents();
	}

  async buildNftComponents() {
	    // Map of UTXO-key -> component (one component may render multiple cards)
	    this.nft_cards = this.nft_cards || {};

	    console.log(this.nft_list);

	    if (Array.isArray(this.nft_list) && this.nft_list.length > 0) {
	      const seenIds = new Set(); // avoid spinning up multiple components for same id

	      for (const rec of this.nft_list) {
	        const id = rec?.id;
	        if (!id || seenIds.has(id)) continue;
	        seenIds.add(id);

	        const comp = new Nft(this.app, this.mod, '.assetstore-table');

	        try {
	          // Populate all matches (comp.items will be filled for same-id duplicates)
	          await comp.createFromId(id);

	          // Render: comp will render 1 or many cards depending on comp.items
	          await comp.render();

	          
	        } catch (e) {
	          console.warn('NFT failed to init/render id:', id, e);
	        }
	      }
	  }
	    
  }

async fetchNFT() {
    await this.app.wallet.updateNftList();

    const data = this.app.options.wallet.nfts || [];

    //console.log('SEND-WALLET: nfts - ', data);
    return data;
 }


	attachEvents() {

		let list_asset_btn = document.querySelector(".list-asset");
		if (list_asset_btn) {
			list_asset_btn.onclick = async (e) => {

				let newtx = await this.mod.createListAssetTransaction();
alert("TX Created!");
console.log(JSON.stringify(newtx.returnMessage()));
				this.app.network.propagateTransaction(newtx);

			}
		}

	}

}

module.exports = AssetStoreMain;
