module.exports = (app, mod, self) => {
  const identicon = app.keychain.returnIdenticon(self.id);
  const depositSaito = self.getDepositInSaito(self.deposit);
  let owner = app.keychain.returnUsername(self.slip1.public_key);

  console.log('owner:', owner);
  let html = `

    <div class="nft-details-container">

     
      <div class="nft-details-data" nft-index="${self.idx}">

        <input
          type="radio"
          name="hidden-nft-radio"
          class="hidden-nft-radio"
          value="${self.idx}"
          style="display: none;"
        />

        <div class="nft-card-img ${self.text != '' ? `text` : ``}" style="background-image: url('${self.image || '/saito/img/dreamscape.png'}');">

   `;

  if (self.text != '') {
    html += `<div class="nft-card-text">${self.text}</div>`;
  }

  html += ` 

        </div>
      </div>


      <div class="nft-details-info">
    
        <!-- DETAILS -->
        <div class="nft-details-header">

            <div class="nft-details-id-cont">
              <div class="nft-details-identicon">
              <img class="nft-identicon" src="${identicon}">
              </div>
              <div class="nft-details-id">${self.id}</div>
            </div>

            <div class="nft-details-section">
              <div class="nft-details-section-title">WORTH</div>
              <div class="nft-details-section-content nft-details-worth">
                <div class="nft-details-value">${app.browser.formatDecimals(depositSaito, true)}</div>
                <div class="nft-details-ticker">SAITO</div>
              </div>
            </div>

            <div class="nft-details-row">
              <div class="nft-details-section">
                <div class="nft-details-section-title">OWNER</div>
                <div class="nft-details-section-content nft-details-owner">
                  <div class="nft-details-value">
                    ${owner}
                  </div>
                </div>
              </div>

              <div class="nft-details-section">
                <div class="nft-details-section-title">AMOUNT</div>
                <div class="nft-details-section-content nft-details-owner">
                  <div class="nft-details-value">
                    ${self.amount}
                  </div>
                </div>
              </div>
            </div>

<!--
            <div class="nft-card-details">
               <div class="nft-card-amount">
                  <div class="nft-card-info-title">AMOUNT</div>
                  <div class="nft-card-info-amount">${self.amount}</div>
               </div>
               <div class="nft-card-deposit">
                  <div class="nft-card-info-title">DEPOSIT</div>
                  <div class="nft-card-info-deposit">${app.browser.formatDecimals(depositSaito, true)} SAITO</div>
               </div>
              <img class="nft-identicon" src="${identicon}" />
            </div>
-->

        </div>

        <div class="nft-details-actions">
          
          <!-- SEND -->
           <div class="nft-details-send">
              <h4>SEND <i>✈️</i></h2>
              <div class="nft-receiver">
                <input
                  type="text"
                  placeholder="Receiver public key"
                  id="nfts-receiver"
                  value=""
                />
              </div>
              
              <div class="nft-details-action-btns">
                <button id="send_nft" class="disabled">Send</button>
              </div>
           </div>

          <!-- SPLIT -->
           <div class="nft-details-split">
              <div class="nft-details-section-header">
                <h4>SPLIT <i>🪓</i></h2>
                <p>Turn one NFT with many units into smaller NFTs. This lets you keep some units and send or trade others.”</p>
                <div class="nft-details-action-btns">
                  <button id="send-nft-cancel-split" style="display: none;">Cancel</button>
                  <button id="send-nft-confirm-split" style="display: none;">Confirm Split</button>
                  <button id="send-nft-split" class="disabled">Split</button>
                </div>
              </div>
           </div>

          <!-- MERGE -->
          <div class="nft-details-merge">
              <div class="nft-details-section-header">
                <h4>MERGE <i>🔗</i></h2>
                <p>Combine multiple NFTs of the same type back into a single larger NFT, making them easier to manage.</p>
                <div class="nft-details-action-btns">
                  <button id="send-nft-merge" class="disabled">Merge</button>
                </div>
              </div>
           </div>
        
        </div>
      </div>


    </div>
  `;
  return html;
};
