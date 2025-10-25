module.exports = (app, mod, self) => {
  return `
    <div class="payment-box">

      <h2>Crypto Payment</h2>

      <div class="price">
        ${app.browser.formatDecimals(self.req_obj.expected_amount)} ${self.ticker}
      </div>

      <div class="pqrcode qr-code" id="pqrcode"></div>

      <div class="wallet-address">
        <input type="text" value="${self.addr_obj.address}" readonly onclick="this.select();" />
      </div>

      <div class="product-desc">${self.description}</br>${self.exchange_rate}</div>

      <div class="instructions">
        Please send payment in the next <span class="timer">30:00</span> minutes.
        <br />
	If you need more time, just <span class="extend-timer" id="extend-timer">click here</span>.
      </div>

      <div class="help">
        any problems? support@saito.io
      </div>

    </div>
  `;
};
