const JSON = require('json-bigint');
const AssetStoreMainTemplate = require('./main.template');

class AssetStoreMain {

	constructor(app, mod, container = 'body') {

		this.app = app;
		this.mod = mod;
		this.container = container;
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

				let newtx = await this.mod.createListAssetTransaction();
alert("TX Created!");
console.log(JSON.stringify(newtx.returnMessage()));
				this.app.network.propagateTransaction(newtx);

			}
		}

	}

}

module.exports = AssetStoreMain;
