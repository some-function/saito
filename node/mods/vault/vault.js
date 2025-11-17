const saito = require('./../../lib/saito/saito');
const Transaction = require('../../lib/saito/transaction').default;
const SaitoHeader = require('./../../lib/saito/ui/saito-header/saito-header');
const ModTemplate = require('./../../lib/templates/modtemplate');
const VaultMain = require('./lib/ui/main');
const VaultHome = require('./index');

class Vault extends ModTemplate {

	constructor(app) {

		super(app);

		this.appname = 'Vault';
		this.name = 'Vault';
		this.slug = 'vault';
		this.description = 'Storage Vault regulated by NFT Keys';
		this.categories = 'Utility Cryptography Programming';

		this.peer_connected = false;
		this.peer = null;

		//
		// vars for users / uploads
		//
		this.file = null;
		this.mode = "private";

	}

	initialize(app) {

		this.header = new SaitoHeader(this.app, this);
		this.main = new VaultMain(this.app, this, ".saito-container");

		this.load();

	}

	render() {

		this.header.render();
		this.main.render();

	}

        /////////////////////////////////
  	// inter-module communications //
  	/////////////////////////////////
  	respondTo(type = '', obj) {
  	  let this_mod = this;

  	  if (type === 'saito-create-nft') {
  	    return {
	      title : "NFT Access Key" ,
  	      class : ["vault-nft-key"] ,
  	      content: { 
		txsig 	: "YYYYY" ,
		archive : "ZZZZZ" ,
	      }
  	    };
  	  }

	  return null;

        }


  	returnServices() {
    		let services = [];
    		if (!this.app.BROWSER || this.offerService) {
      			services.push(
				this.app.network.createPeerService(null, 'vault', 'Secure File Vault')
      			);
    		}
    		return services;
	}

	async onPeerServiceUp(app, peer, service = {}) {
    		if (!this.browser_active) {
			return;
		}
    		if (service.service === 'vault') {
			this.peer = peer;
      			this.peer_connected = true;
		}
  	}   

  	async handlePeerTransaction(app, tx = null, peer, mycallback) {

    		if (tx == null) {
      			return 0;
    		}
  
    		let txmsg = tx.returnMessage();

    		if (!txmsg.request || !mycallback) {
      			return 0; 
    		}
    
    		if (txmsg.request === 'vault add file') {

console.log("....");
console.log("....");
console.log("....");
console.log("....");
console.log("HERE WE ARE IN HPT in VAULT!");
console.log("..^..");
console.log("..^..");
console.log("..^..");
console.log("..^..");

			//
			// extract the transaction
			//
			try {

				let archive_mod = app.modules.returnModule("Archive");
				archive_mod.access_hash = 1; // ownership restricted

				let peer_tx = new Transaction;
                		peer_tx.deserialize_from_web(this.app, txmsg.data);
console.log("about to save tx 1");
				await peer_tx.decryptMessage(this.app);
console.log("about to save tx 2");
				let peer_txmsg = peer_tx.returnMessage();

console.log("about to save tx 3");

				let access_hash = peer_txmsg.access_hash || "";
				
				let data = {};
				data.owner = peer_txmsg.access_hash;

				//
				// now we save the transaction locally with access_hash

				//
console.log("about to save tx 4");
				this.app.storage.saveTransaction(peer_tx, data, 'localhost');
console.log("about to save tx 5");

				mycallback({ status : "success" , err : "" });

			} catch (err) {
				mycallback({ status : "err" , err : JSON.stringify(err) });
			}

			let access_hash = txmsg.access_hash;

			//
			// save to local archive but protect
			//


		}
	}


        webServer(app, expressapp, express) {
                let webdir = `${__dirname}/../../mods/${this.dirname}/web`;
                let vault_self = this;

                expressapp.get('/' + encodeURI(this.returnSlug()), async function (req, res) {
                        let reqBaseURL = req.protocol + '://' + req.headers.host + '/';

                        let updatedSocial = Object.assign({}, vault_self.social);

                        let html = VaultHome(app, vault_self, app.build_number, updatedSocial);
                        if (!res.finished) {
                                res.setHeader('Content-type', 'text/html');
                                res.charset = 'UTF-8';
                                return res.send(html);
                        }
                        return;
                });

                expressapp.use('/' + encodeURI(this.returnSlug()), express.static(webdir));
        }


	load() {
		if (!this.app.options.vault) { this.app.options.vault = {}; }
		if (!this.app.options.vault.files) { this.app.options.vault.files = []; }
	}

	save() {
		if (!this.app.options.vault) { this.app.options.vault = {}; }
		this.app.storage.saveOptions();
	}



	//
	//
	//


}

module.exports = Vault;

