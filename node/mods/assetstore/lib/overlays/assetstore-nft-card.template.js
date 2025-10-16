module.exports = (app, mod, nft) => {

  let identicon = '';
  if (nft.id == null || nft.id == '') {
    identicon = app.keychain.returnIdenticon('');
  } else {
    identicon = app.keychain.returnIdenticon(nft.id);
  }

  let price = nft.getBuyPriceSaito();
  let title = "Unique Item";
  if (nft.title) { title = nft.title; }

  let html = `

<div class="store-card nft-card nfttxsig${nft.tx_sig}" id="nft-card-${nft.uuid}">
  <div class="store-card-image">
    <img src="https://via.placeholder.com/400x300" alt="Product Image">
    <div class="store-card-overlay">
      <button class="store-buy-now-btn">Buy Now</button>
      <img class="store-nft-identicon nft-identicon" src="${identicon}" alt="NFT Identicon">
    </div>
  </div>
  <div class="store-card-info">
    <h3 class="store-card-title">Vintage Saito Poster</h3>
    <div class="store-card-price">${app.browser.formatDecimals(price, true)} SAITO</div>
  </div>
</div>

  `;

return html;

}


