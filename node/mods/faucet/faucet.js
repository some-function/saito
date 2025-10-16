const PeerService = require('saito-js/lib/peer_service').default;
const Transaction = require('../../lib/saito/transaction').default;
const saito = require('./../../lib/saito/saito');
const ModTemplate = require('../../lib/templates/modtemplate');
const SaitoHeader = require('./../../lib/saito/ui/saito-header/saito-header');
const FaucetHome = require('./index');

//
// This application provides an auction clearing platform for NFT sales on Saito.
//
// Users can submit NFTs in transactions that specify sales conditions. The application
// can receive and list them, and returns a transaction that can be used to withdraw
// the NFT from the platform and move it back into the original wallet. This withdrawal
// transaction can be submitted to the network any-time before sale.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
//
class Faucet extends ModTemplate {

	constructor(app) {
		super(app);

		this.name = 'Faucet';
		this.slug = 'faucet';

		this.description = 'Testnet Faucet for Testing and Application Development';
		this.categories = 'Utility Ecommerce NFTs';

		this.amount = BigInt(10000000000);

		this.social = {
			twitter: '@SaitoOfficial',
			title: '🟥 Saito Faucet',
			url: 'https://saito.io/faucet/',
			description: 'Get Testnet Saito',
			image: 'https://saito.tech/wp-content/uploads/2023/11/faucet-300x300.png'
		};
	}

	async render() {

		//
		// browsers only!
		//
		if (!this.app.BROWSER || !this.browser_active) {
			return;
		}

		if (this.main == null) {
			this.header = new SaitoHeader(this.app, this);
			await this.header.initialize(this.app);
			this.header.header_class = 'arcade';
			this.addComponent(this.header);
		}

		await super.render();

		this.attachEvents();


	}

	attachEvents() {

		let btn = document.querySelector(".faucet-button");
		btn.onclick = async (e) => {

			siteMessage("Creating Faucet Request...", 3000);

			try {
				let btn = document.querySelector(".faucet-button");
				let spinner = document.querySelector(".faucet-spinner");
				btn.style.display = "none";
				spinner.style.display = "block";
			} catch (err) {
			}

			let tx = await this.createFaucetTransaction();
			this.app.network.propagateTransaction(tx);

			siteMessage("Broadcasting Faucet Request to Server...", 5000);

		}

	}


        async onConfirmation(blk, tx, conf = 0) {

                //
                // only process the first conf
                //
                if (conf != 0) {
                        return;
                }
                
                console.log('###############################');
                console.log('Faucet onConfirmation: ', tx);
                console.log('###############################');
                //
                // sanity check
                //
                if (this.hasSeenTransaction(tx, Number(blk.id))) {
                        return; 
                }

                console.log('###############################');
                console.log('Faucet onConfirmation2: ', tx);
                console.log('###############################');

                //
                // Bound Transactions (monitor NFT transfers)
                //
		let txmsg = tx.returnMessage();

		if (txmsg.request === "faucet request") {
			if (!this.app.BROWSER) {
                console.log('###############################');
                console.log('Faucet onConfirmation3: ', tx);
                console.log('###############################');
				await this.receiveFaucetRequestTransaction(tx, blk);
			} else {
				if (tx.isFrom(this.publicKey)) {
					siteMessage("Faucet Token Request received by Server...", 5000);
				}
			}
			return;
		}

		if (txmsg.request === "faucet issuance") {
			if (tx.isTo(this.publicKey)) {
				siteMessage("Faucet Payment Received...", 3000);
				try {
					let msg = document.querySelector(".saito-container p");
					let spinner = document.querySelector(".faucet-spinner");
					spinner.style.display = "none";
					msg.innerHTML = "please check your wallet...";
				} catch (err) {
				}
			}
			return;
		}

	}

	async createFaucetTransaction() {

		//
		// create the wrapper transaction
		//
		let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee();
		newtx.msg = {
			module: 'Faucet',
			request: 'faucet request' ,
		};
		newtx.type = 0;
		newtx.packData();
		await newtx.sign();
		return newtx;
	}

	async receiveFaucetRequestTransaction(tx=null, blk=null) {

		//
		// sanity check transaction is valid
		//
		if (tx == null || blk == null) {
			return;
		}

		let receiver = tx.from[0].publicKey;
		let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(receiver, this.amount);
		newtx.msg = {
			module: 'Faucet',
			request: 'faucet issuance',
		};
		newtx.packData();
		await newtx.sign();
		this.app.network.propagateTransaction(newtx);

	}


        webServer(app, expressapp, express) {
                let webdir = `${__dirname}/../../mods/${this.dirname}/web`;
                let faucet_self = this;

                expressapp.get('/' + encodeURI(this.returnSlug()), async function (req, res) {
                        let reqBaseURL = req.protocol + '://' + req.headers.host + '/';

                        let updatedSocial = Object.assign({}, faucet_self.social);

                        let html = FaucetHome(app, faucet_self, app.build_number, updatedSocial);
                        if (!res.finished) {
                                res.setHeader('Content-type', 'text/html');
                                res.charset = 'UTF-8';
                                return res.send(html);
                        }
                        return;
                });

                expressapp.use('/' + encodeURI(this.returnSlug()), express.static(webdir));
        }


}

module.exports = Faucet;
