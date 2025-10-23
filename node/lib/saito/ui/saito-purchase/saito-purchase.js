const SaitoPurchaseTemplate = require('./saito-purchase.template');
const SaitoPurchaseEmptyTemplate = require('./saito-purchase-empty.template');
const SaitoPurchaseCryptoTemplate = require('./saito-purchase-select-crypto.template');
const SaitoOverlay = require('./../saito-overlay/saito-overlay');

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
    this.tx = null;
    this.saito_amount = 0;
  }

  async render() {
    const self = this;
    this.purchase_overlay.remove();

    if (!this.crypto_selected) {
      this.purchase_overlay.show(SaitoPurchaseCryptoTemplate(this.app, this.mod, this));
    } else {
      if (!this.address) {
        this.purchase_overlay.show(SaitoPurchaseEmptyTemplate(this.app, this.mod, this));
      } else {
        this.purchase_overlay.show(SaitoPurchaseTemplate(this.app, this.mod, this));
        this.app.browser.generateQRCode(this.address, 'pqrcode');
      }
    }

    this.attachEvents();
  }

  attachEvents() {
    const self = this;
    const generate_add_btn = document.querySelector('#purchase-crypto-generate');

    console.log('generate_add_btn:', generate_add_btn);

    if (generate_add_btn) {
      generate_add_btn.onclick = async (e) => {
        console.log('clicked on btn');

        //
        // fetch selected ticker
        //
        const selected = document.querySelector('input[name="purchase-crypto"]:checked');
        if (!selected) {
          salert('Please select a crypto option.');
          return;
        }

        const value = selected.value;
        console.log('Selected crypto:', value);

        //
        // re-render self to show spinning loader
        //
        self.crypto_selected = true;
        self.render();

        //
        // conversion rate logic (todo: replace with actual conversion prices)
        //
        const ticker = selected.value;
        const saito_rate = 0.00213; // SAITO USD value
        let conversion_rate = 0;

        //
        // get SAITO/TICKER conversion rate
        // TODO: replace with real conversion rates
        //
        switch (ticker) {
          case 'btc':
            conversion_rate = 0.000001;
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

        const converted_amount = (this.saito_amount * saito_rate) / conversion_rate;

        siteMessage('Broadcasting BuySaito Request to Server...', 5000);

        self.requestPaymentAddressFromServer(converted_amount, ticker);
      };
    }
  }

  requestPaymentAddressFromServer(converted_amount, ticker) {
    let self = this;
    //
    // send request to mixin to create purchase address
    //
    const data = {
      public_key: self.mod.publicKey,
      amount: converted_amount,
      minutes: 30,
      ticker,
      tx: self.tx.serialize_to_web(self.app)
    };
    console.log('Request data:', data);

    self.app.network.sendRequestAsTransaction(
      'mixin request payment address',
      data,
      function (res) {
        console.log('Response from reserve payment: ', res);

        //if (res?.address) {

        //
        // temporary hardcoded address response
        //
        let address = 'TRZiP1cLYxg8cgubEH6rGDoeXBgg4D4ZHN';

        setTimeout(function () {
          self.ticker = ticker.toUpperCase();
          self.title = 'Purchase on Saito Store';
          self.description = '';
          self.exchange_rate = '0.003 SAITO / USDC';
          self.address = address; //res.address;
          self.amount = converted_amount;
          self.render();
        }, 1500);
        // } else {
        //   salert('Unable to create purchase address');
        //   self.purchase_overlay.close();
        // }
      }
    );

    //
    // need to find a way how to request to mixin peer
    // or just use empty peerIndex option
    //
  }

  reset() {
    this.address = '';
    this.ticker = '';
    this.amount = 0;
    this.crypto_selected = false;
    this.tx = null;
    this.saito_amount = 0;
  }
}

module.exports = AssetstoreSaitoPurchaseOverlay;
