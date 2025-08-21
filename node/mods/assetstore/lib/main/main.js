const JSON = require('json-bigint');
const AssetStoreMainTemplate = require('./main.template');
const List = require('./list');

class AssetStoreMain {

	constructor(app, mod, container = 'body') {

		this.app = app;
		this.mod = mod;
		this.container = container;
		this.list = new List(app, mod);
	}

	async render() {

    		if (!document.querySelector('.saito-container')) {
      		  this.app.browser.addElementToDom(AssetStoreMainTemplate(this.app, this.mod));
    		}


		this.attachEvents();
	}


	attachEvents() {

		let list_asset_btn = document.querySelector(".list-asset");
		if (list_asset_btn) {
			list_asset_btn.onclick = async (e) => {

				this.list.render();

				// let newtx = await this.mod.createListAssetTransaction();
				// alert("TX Created!");
				// console.log(JSON.stringify(newtx.returnMessage()));
				// this.app.network.propagateTransaction(newtx);

			}
		}

	}

}

module.exports = AssetStoreMain;
