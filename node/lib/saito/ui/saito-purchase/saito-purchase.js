const SaitoPurchaseTemplate = require('./saito-purchase.template');
const SaitoPurchaseLoaderTemplate = require('./saito-purchase-loader.template');
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
    this.deposit_confirmed = false;

    this.addr_obj = {}; // { id, ticker, address, asset_id, chain_id, created_at, reserved_until, reserved_by }
    this.req_obj = {}; // { id, reserved_until, remaining_minutes, expected_amount }
    this.pool = {}; // { ticker, total, limit }

    this.countdown_interval = null;
    this.pending_interval = null;
  }

  async render() {
    console.log('render saito-purchase');
    let self = this;
    this.purchase_overlay.remove();

    if (!this.crypto_selected) {
      //
      // 1. user selects crypto
      //
      this.purchase_overlay.show(SaitoPurchaseCryptoTemplate(this.app, this.mod, this));
    } else {
      if (!this.address) {
        //
        // 2. show loading screen after selecting crypto ticker
        //
        this.purchase_overlay.show(
          SaitoPurchaseLoaderTemplate(this.app, this.mod, this, 'Requesting Payment Instructions')
        );
      } else {
        //
        // 3. Show address screen when deposit address is created/fetched
        //
        if (!this.deposit_confirmed) {
          this.purchase_overlay.show(SaitoPurchaseTemplate(this.app, this.mod, this));
          this.app.browser.generateQRCode(this.address, 'pqrcode');
        } else {
          //
          // 4. Show loading screen when payment, deposited by user, is confirmed
          //
          this.purchase_overlay.show(
            SaitoPurchaseLoaderTemplate(
              this.app,
              this.mod,
              this,
              'Payment confirmed. Depositing SAITO in your wallet...'
            )
          );
        }
      }
    }

    this.attachEvents();
  }

  attachEvents() {
    let self = this;

    document.querySelectorAll('.purchase-crypto-item').forEach((el) => {
      el.onclick = (e) => {
        let ticker = e.currentTarget.id;
        let saito_rate = 0.005; // SAITO USD value
        let conversion_rate = 0;

        switch (ticker) {
          case 'btc':
            conversion_rate = 0.000001;
            break;
          case 'eth':
            conversion_rate = 0.00002;
            break;
          case 'trx':
            conversion_rate = 0.5;
            break;
          default:
            conversion_rate = 1.0;
        }

        let converted_amount = (this.saito_amount * saito_rate) / conversion_rate;

        self.requestPaymentAddressFromServer(converted_amount, ticker);

        //
        // re-render self to show spinning loader
        //
        self.crypto_selected = true;
        self.render();

      }
    });


    let extend_timer = document.querySelector('.extend-timer');
    if (extend_timer) {
      extend_timer.onclick = async (e) => {
        salert('Sending purchase request again to extend timer...');
      };
    }

  }

  //
  // reserve address -> poll pending deposit -> fetch receipts
  //
  async requestPaymentAddressFromServer(converted_amount, ticker) {
    let self = this;

    //
    // build request payload
    //
    let data = {
      publickey: self.mod.publicKey,
      amount: converted_amount,
      minutes: 30,
      ticker,
      tx: self.tx.serialize_to_web(self.app)
    };
    console.log('Request data:', data);

    //
    // reserve address
    //
    let res = await new Promise((resolve) => {
      self.app.network.sendRequestAsTransaction('mixin request payment address', data, (r) =>
        resolve(r || { ok: false, err: 'no_response' })
      );
    });

    try {
      console.log('            ');
      console.log('/////////////////////////////////////');
      console.log('/////////////////////////////////////');
      console.log('RESERVE ADDRESS RESPONSE');
      console.log(res);
      console.log('/////////////////////////////////////');
      console.log('/////////////////////////////////////');
      console.log('            ');

      //
      // reserve address - failure handling
      //
      if (!res || res.ok !== true || !res.address) {
        let msg = res && res.err ? res.err : 'Unable to create purchase address';
        salert(msg);
        self.purchase_overlay.remove();
        return { ok: false, err: msg };
      }

      //
      // reserve address success — extract info
      //
      self.addr_obj = res.address; // { id, ticker, address, asset_id, chain_id, ... }
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

      //
      // update UI
      //
      self.render();
      //siteMessage('Deposit request fetched', 1000);

      //
      // start countdown
      //
      if (self.req_obj && Number.isFinite(+self.req_obj.reserved_until)) {
        self.startReservationCountdown(+self.req_obj.reserved_until);
      }

      //
      // poll pending deposit (returns status only)
      //
      let pollStatus = await self.pollPendingDeposits();

      //
      // if confirmed, save receipt and then fetch receipts
      //
      if (pollStatus && pollStatus.ok && pollStatus.status === 'confirmed') {
        let ack = await self.updatePaymentReceipt({
          status: 'pending'
        });

        if (ack && ack.ok) {
          let receipts = await self.fetchPaymentReceipts({
            recipient_pubkey: self.mod.publicKey,
            limit: 200
          });
          console.log('Payment receipts after poll:', receipts);
        }

        //
        // return ack
        //
        return ack || { ok: false, err: 'no_ack' };
      }

      //
      // return poll result (expired / cancelled / other)
      //
      return pollStatus;
    } catch (e) {
      console.error('reserve payment callback error:', e);
      salert('error');
      self.purchase_overlay.remove();
      return { ok: false, err: 'exception' };
    }
  }

  //
  // checks pending deposit -> on confirmed save receipt -> return status
  //
  async pollPendingDeposits(opts = {}) {
    let self = this;

    //
    // default values (can send values in opts param)
    //
    let status = opts.status ?? 'pending';
    let issued_amount = self.saito_amount ?? 0;
    let recipient_pubkey = opts.recipient_pubkey ?? self.mod.publicKey;
    let reason = opts.reason ?? '';

    //
    // ask server to check the pending deposit
    //
    let res = await new Promise((resolve) => {
      self.app.network.sendRequestAsTransaction(
        'mixin fetch pending deposit',
        {
          asset_id: self.addr_obj.asset_id,
          address: self.addr_obj.address,
          expected_amount: self.req_obj?.expected_amount || '',
          reserved_until: self.req_obj?.reserved_until || 0,
          ticker: self.ticker
        },
        (r) => resolve(r || { ok: false, err: 'no_response' })
      );
    });

    try {
      console.log('            ');
      console.log('/////////////////////////////////////');
      console.log('/////////////////////////////////////');
      console.log('POLLING DEPOSIT RESPONSE');
      console.log(res);
      console.log('/////////////////////////////////////');
      console.log('/////////////////////////////////////');
      console.log('            ');

      //
      // error or polling expired on server side
      //
      if (!res || res.ok !== true) {
        let err = res?.err || 'Payment check failed/expired';
        salert(err);
        return { ok: false, err };
      }

      //
      // success
      //
      if (res.status === 'confirmed') {
        this.stopCountDownIterval();
        siteMessage('Payment detected! Confirming…', 1000);

        //
        // re-render to show loader msg
        //
        self.deposit_confirmed = true;
        self.render();

        //
        // return status only; the caller will save receipt and fetch receipts
        //
        return { ok: true, status: 'confirmed' };
      }

      //
      // payment window expired/cancelled or any other status
      //
      if (res.status === 'expired') {
        salert('Payment window expired');
        return { ok: true, status: 'expired' };
      }

      if (res.status === 'cancelled') {
        salert('Payment check cancelled');
        return { ok: true, status: 'cancelled' };
      }

      return { ok: true, status: res.status };
    } catch (e) {
      console.error('poll callback error', e);
      return { ok: false, err: 'exception' };
    }
  }

  //
  // save receipt return its status
  //
  async updatePaymentReceipt(opts = {}) {
    let self = this;

    //
    // build payload; allow overrides via opts
    //
    let status = opts.status ?? 'pending';
    let issued_amount = opts.issued_amount ?? self.saito_amount ?? 0;
    let recipient_pubkey = opts.recipient_pubkey ?? self.mod.publicKey;
    let reason = opts.reason ?? '';

    let payload = {
      request_id: self?.req_obj?.id,
      address_id: self?.addr_obj?.id,
      recipient_pubkey,
      issued_amount: String(issued_amount ?? ''),
      status, // 'pending' by default unless overridden
      reason,
      tx: self.tx ? self.tx.serialize_to_web(self.app) : ''
    };

    let ack = await new Promise((resolve) => {
      self.app.network.sendRequestAsTransaction('mixin save payment receipt', payload, (r) =>
        resolve(r || { ok: false, err: 'no_response' })
      );
    });

    console.log('            ');
    console.log('/////////////////////////////////////');
    console.log('/////////////////////////////////////');
    console.log('SAVING PAYMENT RECEIPT RESPONSE');
    console.log(ack);
    console.log('/////////////////////////////////////');
    console.log('/////////////////////////////////////');
    console.log('            ');

    if (ack && ack.ok) {
      siteMessage('Saved payment receipt', 1000);
    }

    return ack || { ok: false, err: 'no_ack' };
  }

  //
  // fetch receipts with optional filters
  //
  async fetchPaymentReceipts(filters = {}) {
    let res = await new Promise((resolve) => {
      this.app.network.sendRequestAsTransaction('mixin list payment receipts', filters, (r) =>
        resolve(r || { ok: false, err: 'no_response' })
      );
    });

    console.log('            ');
    console.log('/////////////////////////////////////');
    console.log('/////////////////////////////////////');
    console.log('CURRENT DB PAYMENT RECEIPTS (PAYMENT DONE BY USERS, WAITING FOR SAITO PAYMENT)');
    console.log(res);
    console.log('/////////////////////////////////////');
    console.log('/////////////////////////////////////');
    console.log('            ');

    //
    // send only "pending" rows for issuance
    //
    if (res && res.ok && Array.isArray(res.rows) && res.rows.length > 0) {
      let pending = res.rows.filter((r) => r.status === 'pending');

      if (pending.length > 0) {
        let issueAck = await this.sendPendingReceiptsForIssuance(pending);

        console.log('            ');
        console.log('/////////////////////////////////////');
        console.log('/////////////////////////////////////');
        console.log('PENDING RECEIPTS SENT FOR ISSUANCE — SERVER ACK');
        console.log(issueAck);
        console.log('/////////////////////////////////////');
        console.log('/////////////////////////////////////');
        console.log('            ');
      }
    }

    return res || { ok: false, err: 'no_response' };
  }

  async sendPendingReceiptsForIssuance(pendingRows = []) {
    //
    // fetch following from rows: id, recipient_pubkey, issued_amount
    //
    let payload = {
      rows: pendingRows.map((r) => ({
        id: r.id,
        recipient_pubkey: r.recipient_pubkey,
        issued_amount: r.issued_amount
      }))
    };

    let ack = await new Promise((resolve) => {
      this.app.network.sendRequestAsTransaction('mixin issue purchased saito', payload, (r) =>
        resolve(r || { ok: false, err: 'no_response' })
      );
    });

    this.purchase_overlay.remove();

    //
    // check first item of response
    //
    if (!ack || ack.ok !== true) {
      salert('error');
      return ack || { ok: false, err: 'no_ack' };
    }

    let first = Array.isArray(ack.results) ? ack.results[0] : null;

    if (!first || first.ok === false || first.err) {
      salert(`Error while sending SAITO to your wallet: ${first.err}`);
    } else {
      salert('SAITO issuance transaction sent. Check balance after network confirmation.');
    }

    return ack || { ok: false, err: 'no_ack' };
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
      return `${pad(m)}:${pad(s)}`;
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

      //console.log('[countdown] tick', { now, expiryMs, msLeft });

      if (msLeft <= 0) {
        console.log('[countdown] expired — setting 00:00:00 and stopping');
        salert('Countdown for crypto payment expired');
        el.textContent = '00:00:00';
        clearInterval(this.countdown_interval);
        this.countdown_interval = null;
        return;
      }

      let fmt = formatHMS(msLeft);
      //console.log('[countdown] updating display to', fmt);
      el.textContent = fmt;
    };

    siteMessage('Crypto payment countdown started....', 1000);

    //
    // prime once immediately and then every second
    //
    tick();
    this.countdown_interval = setInterval(tick, 1000);
    console.log('[countdown] interval started (1s)');
  }

  stopCountDownIterval() {
    if (this.countdown_interval) {
      clearInterval(this.countdown_interval);
      this.countdown_interval = null;
    }
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

    //
    // clear any intervals
    //
    this.stopCountDownIterval();
  }
}

module.exports = AssetstoreSaitoPurchaseOverlay;
