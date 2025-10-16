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
  <div class="store-card-image nft-card-img">
    <div class="store-card-overlay">
      <button class="store-buy-now-btn">Buy Now</button>
      <img class="store-nft-identicon nft-identicon" src="${identicon}" alt="NFT Identicon">
    </div>
  </div>
  <div class="store-card-info">
    <div class="store-card-price">${app.browser.formatDecimals(price, true)} SAITO</div>
    <div class="store-card-title">Vintage Saito Poster</div>
    <div class="store-card-seller">seller: @omskian</div>
  </div>
</div>

  `;

return html;

};


