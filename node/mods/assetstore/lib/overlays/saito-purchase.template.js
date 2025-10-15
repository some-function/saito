module.exports = (app, mod, self) => {
  return `
    <style>

    #purchase-container {
      background: var(--saito-background-color);
      display: flex;
      height: fit-content;
      width: 75rem;
      justify-content: space-between;
      padding: 5rem;
      font-size: 2rem;
    }

    .purchase-address-main {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    </style>

    <div class="" id="purchase-container">

      <div class="deposit-heading">
        Deposit <b>${app.browser.formatDecimals(self.amount)} ${self.ticker}</b>
      </div>

      <div class="purchase-address-main">
        <div id="purchase-address">${self.address}</div>
        <div id="purchase-qrcode"></div>
      </div>
    </div>
  `;
};
