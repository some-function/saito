module.exports = (app, mod, self) => {
  return `
    <style>

    .purchase-container {
      background: var(--saito-background-color);
      display: flex;
      height: fit-content;
      width: 75rem;
      justify-content: space-between;
      padding: 3rem;
      font-size: 2rem;
      display: flex;
      flex-direction: column;
      text-align: center;
      font-size: 2rem;
      gap: 3rem;
    }

       .purchase-crypto-list {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;                
      justify-content: flex-start;  
      column-gap: 1rem;
      row-gap: 2rem;
    }

    /* Exactly 3 items per row:
       For 3 columns, there are 2 gaps (2 * 1rem) to subtract */
    .purchase-crypto-item {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex: 0 1 calc((100% - 2rem) / 3);  /* 3 columns */
      box-sizing: border-box;
    }

    .purchase-select-crypto-msg {
      text-align: left;
    }

    #purchase-crypto-generate {
      width: fit-content;
      align-self: end;
    }

    .purchase-crypto-item input:hover {
      cursor: pointer;
    }

    </style>

    <div class="purchase-container" id="purchase-container">
      <div class="purchase-select-crypto-msg">Select crypto to generate purchase address</div> 
      <div class="purchase-crypto-list">
          <div class="purchase-crypto-item">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='btc'>
            <div>BTC</div> 
          </div>

          <div class="purchase-crypto-item">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='eth'>
            <div>ETH</div> 
          </div>

          <div class="purchase-crypto-item">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='trx'>
            <div>TRX</div> 
          </div>

          <div class="purchase-crypto-item">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='ltc'>
            <div>LTC</div> 
          </div>

          <div class="purchase-crypto-item">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='bnb'>
            <div>BNB</div> 
          </div>

          <div class="purchase-crypto-item">
            <input type='radio' name='purchase-crypto' class='purchase-crypto' value='sol'>
            <div>SOL</div> 
          </div>
      </div>

      <button id="purchase-crypto-generate">Generate</button>
    </div>
  `;
};
