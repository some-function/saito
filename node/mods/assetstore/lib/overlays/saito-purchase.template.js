module.exports = (app, mod, self) => {
  return `
    <div class="payment-box">

      <h2>Payment with ${self.ticker}</h2>

      <div class="price">
        ${app.browser.formatDecimals(self.amount)} ${self.ticker}
      </div>

      <div class="pqrcode qr-code" id="pqrcode"></div>

      <div class="product-desc">
        1 × Premium Widget<br>
        Exchange Rate: 0.0025 BTC/USD
      </div>

      <div class="wallet-address">
        <input type="text" value="${self.address}" readonly onclick="this.select();" />
      </div>

      <div class="instructions">
        Send the exact amount to the address above.
        <br />
        Please complete payment in the next <span class="timer">30:00</span> minutes.
      </div>

      <div class="help">
        Need Support? info@saito.io
      </div>

    </div>
  `;

};
