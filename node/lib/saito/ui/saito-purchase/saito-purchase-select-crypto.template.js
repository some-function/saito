module.exports = (app, mod, self) => {
  return `
    <div class="purchase-container" id="purchase-container">

      <h3 class="purchase-select-crypto-msg">Select Payment Method</h3>
      <div class="purchase-crypto-list">

          <div class="purchase-crypto-item" id="btc">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='btc'>
            <div>BTC</div> 
          </div>

          <div class="purchase-crypto-item" id="eth">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='eth'>
            <div>ETH</div> 
          </div>

          <div class="purchase-crypto-item" id="trx">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='trx'>
            <div>TRX</div> 
          </div>

          <div class="purchase-crypto-item" id="ltc">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='ltc'>
            <div>LTC</div> 
          </div>

          <div class="purchase-crypto-item" id="bnb">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='bnb'>
            <div>BNB</div> 
          </div>

          <div class="purchase-crypto-item" id="sol">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='sol'>
            <div>SOL</div> 
          </div>
      </div>
    </div>
  `;
};
