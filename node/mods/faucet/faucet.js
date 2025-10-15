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

		this.amount = 100;

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
		btn.onclick = (e) => {

			alert("Issuing Testnet Tokens");
			let tx = this.createFaucetTransaction();
			this.app.network.propagateTransaction(tx);
		}

	}


        async onConfirmation(blk, tx, conf = 0) {
                //
                // only process the first conf
                //
                if (conf != 0) {
                        return;
                }
                
                //
                // sanity check
                //
                if (this.hasSeenTransaction(tx, Number(blk.id))) {
                        return; 
                }

                console.log('###############################');
                console.log('onConfirmation: ', tx);
                console.log('###############################');

                //
                // Bound Transactions (monitor NFT transfers)
                //
		let txmsg = tx.returnMessage();

		if (txmsg.request === "faucet request") {
			if (!this.app.BROWSER) {
				this.receiveFaucetRequestTransaction(tx);
			} else {
				if (tx.from[0].publicKey === this.publicKey) {
					siteMessage("Your request has been received by the server...");
				}
			}
			return;
		}

		if (txmsg.request === "faucet issuance") {
			if (this.app.BROWSER && tx.to[0].publicKey === this.publicKey) {
				siteMessage("Faucet Payment -- 100 SAITO Received...");
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
			request: 'request tokens' ,
		};
		newtx.type = 0;
		newtx.packData();
		await newtx.sign();
		return newtx;
	}

	async receiveFaucetRequestTransaction(tx, blk) {

		//
		// sanity check transaction is valid
		//
		if (tx == null || blk == null) {
			console.warn('Nope out of addListing');
			return;
		}

		let receiver = tx.from[0].publicKey;
		let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(receiver, 100, 0);
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
