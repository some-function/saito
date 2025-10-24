const SaitoPurchaseTemplate = require('./saito-purchase.template');
const SaitoPurchaseEmptyTemplate = require('./saito-purchase-empty.template');
const SaitoPurchaseCryptoTemplate = require('./saito-purchase-select-crypto.template');
const SaitoOverlay = require('./../saito-overlay/saito-overlay');

class AssetstoreSaitoPurchaseOverlay {
  constructor(app, mod, container = 'body') {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this.purchase_overlay = new SaitoOverlay(app, mod, false, true);

    //
    // init
    //
    this.address = '';
    this.ticker = '';
    this.amount = 0;
    this.crypto_selected = false;
    this.tx = null;
    this.saito_amount = 0;
    this.title = '';
    this.description = '';
    this.exchange_rate = '';

    this.addr_obj = {}; // { id, ticker, address, asset_id, chain_id, created_at, reserved_until, reserved_by }
    this.req_obj = {}; // { id, reserved_until, remaining_minutes, expected_amount }
    this.pool = {}; // { ticker, total, limit }

    this.countdown_interval = null;
  }

  async render() {
    console.log('render saito-purchase');
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
        try {
          console.log('Response from reserve payment: ', res);
          //
          // failure handling
          //
          if (!res || res.ok !== true || !res.address) {
            const msg = res && res.err ? res.err : 'Unable to create purchase address';
            salert(msg);
            self.purchase_overlay.remove();
            return;
          }

          //
          // success, extract info
          //
          self.addr_obj = res.address; // { id, ticker, address, asset_id, chain_id, created_at, reserved_until, reserved_by }
          self.req_obj = res.request; // { id, reserved_until, remaining_minutes, expected_amount }
          self.pool = res.pool; // { ticker, total, limit }
          self.exchange_rate = '0.003 SAITO / USDC';

          //
          // assign values
          //
          self.ticker = (self.addr_obj.ticker || ticker || '').toUpperCase();
          self.address = self.addr_obj.address;
          self.title = 'Purchase on Saito Store';
          self.description = '';

          self.render();

          //
          // start countdown timer
          //
          if (self.req_obj && Number.isFinite(+self.req_obj.reserved_until)) {
            self.startReservationCountdown(+self.req_obj.reserved_until);
          }
        } catch (e) {
          console.error('reserve payment callback error:', e);
          salert('error');
          self.purchase_overlay.remove();
        }
      }
    );
  }

  startReservationCountdown(expiryMs) {
    // clear any previous countdown
    if (this.countdown_interval) {
      clearInterval(this.countdown_interval);
      this.countdown_interval = null;
    }

    const formatHMS = (msLeft) => {
      const total = Math.max(0, Math.floor(msLeft / 1000));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    };

    const tick = () => {
      const el = document.querySelector('.payment-box .timer');
      if (!el) {
        // timer element no longer exists — stop
        clearInterval(this.countdown_interval);
        this.countdown_interval = null;
        return;
      }

      const now = Date.now();
      const msLeft = expiryMs - now;

      if (msLeft <= 0) {
        el.textContent = '00:00:00';
        clearInterval(this.countdown_interval);
        this.countdown_interval = null;
        return;
      }

      el.textContent = formatHMS(msLeft);
    };

    // prime once immediately and then every second
    tick();
    this.countdown_interval = setInterval(tick, 1000);
  }

  reset() {
    //
    // reset values (incase we want to reuse the overlay)
    //
    this.address = '';
    this.ticker = '';
    this.amount = 0;
    this.crypto_selected = false;
    this.tx = null;
    this.saito_amount = 0;
    this.title = '';
    this.description = '';
    this.exchange_rate = '';
    this.addr_obj = {};
    this.req_obj = {};
    this.pool = {};

    //
    // reset countdown timer
    //
    if (this.countdown_interval) {
      clearInterval(this.countdown_interval);
      this.countdown_interval = null;
    }
  }
}

module.exports = AssetstoreSaitoPurchaseOverlay;
