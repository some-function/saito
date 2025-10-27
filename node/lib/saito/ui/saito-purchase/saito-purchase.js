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
    let self = this;
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
    let self = this;
    let generate_add_btn = document.querySelector('#purchase-crypto-generate');

    console.log('generate_add_btn:', generate_add_btn);

    if (generate_add_btn) {
      generate_add_btn.onclick = async (e) => {
        console.log('clicked on btn');

        //
        // fetch selected ticker
        //
        let selected = document.querySelector('input[name="purchase-crypto"]:checked');
        if (!selected) {
          salert('Please select a crypto option.');
          return;
        }

        let value = selected.value;
        console.log('Selected crypto:', value);

        //
        // re-render self to show spinning loader
        //
        self.crypto_selected = true;
        self.render();

        //
        // conversion rate logic (todo: replace with actual conversion prices)
        //
        let ticker = selected.value;
        let saito_rate = 0.00213; // SAITO USD value
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

        let converted_amount = (this.saito_amount * saito_rate) / conversion_rate;

        siteMessage('Broadcasting BuySaito Request to Server...', 5000);

        self.requestPaymentAddressFromServer(converted_amount, ticker);
      };
    }

    let extend_timer = document.querySelector('#extend_timer');
    if (extend_timer) {
      extend_timer.onclick = async (e) => {
        salert('Sending purchase request again to extend timer...');
      };
    }
  }

  requestPaymentAddressFromServer(converted_amount, ticker) {
    let self = this;
    //
    // send request to mixin to create purchase address
    //
    let data = {
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
            let msg = res && res.err ? res.err : 'Unable to create purchase address';
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
    //
    // clear any previous countdown
    //
    if (this.countdown_interval) {
      console.log('[countdown] clearing existing interval');
      clearInterval(this.countdown_interval);
      this.countdown_interval = null;
    }

    console.log(
      '[countdown] startReservationCountdown called with expiryMs:',
      expiryMs,
      '=>',
      new Date(expiryMs).toISOString()
    );

    let formatHMS = (msLeft) => {
      let total = Math.max(0, Math.floor(msLeft / 1000));
      let h = Math.floor(total / 3600);
      let m = Math.floor((total % 3600) / 60);
      let s = total % 60;
      let pad = (n) => String(n).padStart(2, '0');
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    };

    let tick = () => {
      //
      // locate timer element
      //
      let el = document.querySelector('.payment-box .timer');

      if (!el) {
        console.log('[countdown] .payment-box .timer not found — stopping interval');
        clearInterval(this.countdown_interval);
        this.countdown_interval = null;
        return;
      }

      //
      // compute time remaining
      //
      let now = Date.now();
      let msLeft = expiryMs - now;

      console.log('[countdown] tick', { now, expiryMs, msLeft });

      if (msLeft <= 0) {
        console.log('[countdown] expired — setting 00:00:00 and stopping');
        salert('Countdown for crypto payment expired');
        el.textContent = '00:00:00';
        clearInterval(this.countdown_interval);
        this.countdown_interval = null;
        return;
      }

      let fmt = formatHMS(msLeft);
      console.log('[countdown] updating display to', fmt);
      el.textContent = fmt;
    };

    //
    // prime once immediately and then every second
    //
    tick();
    this.countdown_interval = setInterval(tick, 1000);
    console.log('[countdown] interval started (1s)');
  }

  //
  // method to identify if we have any inbound deposit
  //
  checkPendingDeposit() {

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
