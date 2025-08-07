module.exports = (app, mod, nft_self) => {

   const slip1 = nft_self.nft.slip1;
   const slip2 = nft_self.nft.slip2;
   const amount = BigInt(slip1.amount);
   const depositNolan = BigInt(slip2.amount);
   const nftValue = app.wallet.convertNolanToSaito(depositNolan);
   const nftCreator = slip1.public_key;
   const identicon = app.keychain.returnIdenticon(nft_self.nft.id);

   console.log('nft_self:',nft_self);

   let html = `

      <div class="nft-card" nft-index="${nft_self.idx}">
            <input
              type="radio"
              name="hidden-nft-radio"
              class="hidden-nft-radio"
              value="${nft_self.idx}"
              style="display: none;"
            />

         <div class="nft-card-img ${(nft_self.text != '') ? `text` : ``}" style="background-image: url('${nft_self.image || '/saito/img/dreamscape.png'}');">

   `;

         if (nft_self.text != '') {
            
   html +=  `<div class="nft-card-text">${nft_self.text}</div>`;

         }

   html += `      
         </div>

         <div class="nft-card-info">
            <!--
            <div class="nft-card-identity">
               <div class="nft-card-id">${nft_self.nft.id}</div>
               
            </div>
      -->

            <div class="nft-card-details">
               <div class="nft-card-amount">
                  <div class="nft-card-info-title">amount</div>
                  <div class="nft-card-info-amount">${amount}</div>
               </div>
               <div class="nft-card-deposit">
                  <div class="nft-card-info-title">deposit</div>
                  <div class="nft-card-info-deposit">${app.browser.formatDecimals(nftValue, true)} SAITO</div>
               </div>
               <img class="nft-identicon" src="${identicon}" />
            </div>
         </div>
      </div>
   `;

   return html;
};
