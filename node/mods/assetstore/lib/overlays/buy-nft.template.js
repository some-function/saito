module.exports = (app, mod, nft) => {

  let identicon = app.keychain.returnIdenticon(nft.id);
  let deposit = nft.getDeposit();
  let title = "TEMPORARY NFT TITLE";
  let description = "this is a temporary description that exists in the template file so we can check how it looks printed on the AssetStore sales tab...";


  let html = `

    <div class="nft-details-container">

      <!-- DETAILS -->
      <div class="nft-details-header">
        <div class="nft-details-id-cont">
          <div class="nft-details-identicon">
            <img class="nft-identicon" src="${identicon}">
          </div>
          <div class="nft-details-id">${nft.id}</div>
        </div>

        <div class="nft-details-section">
          <div class="nft-details-section-title">DEPOSIT</div>
          <div class="nft-details-section-content">
            <div class="nft-details-value">${app.browser.formatDecimals(deposit, true)}</div>
            <div class="nft-details-ticker">SAITO</div>
          </div>
        </div>

        <div class="nft-details-section left-justify">
          <div class="nft-details-section-title">OWNER</div>
          <div class="nft-details-section-content">
            <div class="nft-details-value">${nft.seller || nft.slip1.public_key}</div>
          </div>
        </div>

        <div class="nft-details-section">
          <div class="nft-details-section-title">QUANTITY</div>
          <div class="nft-details-section-content">
            <div class="nft-details-value">${nft.amount}</div>
          </div>
        </div>
      </div>

      <!-- CONTENTS -->
      <div class="nft-details-data assetstore-nft-data">
    `;

    if (description != "") {

      html += `
	<div class="nft-details-left">
          <div class="nft-card-img" style="background-image: url('${nft?.image || '/saito/img/dreamscape.png'}');">
            ${nft.text ? `<div class="nft-card-text">${nft.text}</div>` : ''}
          </div>
	</div>
	<div class="nft-details-right">
          <div class="nft-card-title">
  	    TITLE OF NFT
	  </div>
	  <div class="nft-card-description">
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque tempor vel tellus venenatis faucibus. Ut ut risus ac erat eleifend fermentum. Nam vitae risus quis dolor tempor malesuada. Vestibulum in convallis nulla, in finibus ligula. Etiam lacinia metus a auctor pulvinar. Vivamus auctor est ac mattis porttitor. Ut nisl nisl, malesuada quis risus non, semper efficitur mi. Donec sodales lorem id nulla varius auctor. Praesent tristique ligula at risus congue ullamcorper. Vestibulum interdum leo in iaculis consectetur. Nunc non sapien quam.
	  </div>
        </div>
      `;

    } else {

      html += `
          <div class="nft-card-img" style="background-image: url('${nft?.image || '/saito/img/dreamscape.png'}');">
            ${nft.text ? `<div class="nft-card-text">${nft.text}</div>` : ''}
          </div>
      `;

    }

    html += `

      </div>

      <!-- ACTIONS -->
      <div class="nft-details-actions" data-show="none">
        <!-- SEND -->
        <div class="nft-details-action" id="nft-details-send">
          <div class="nft-receiver">
            <input type="text" placeholder="Recipient public key" id="nft-receiver-address" value="" />
          </div>
          <div class="saito-button-row auto-fit">
            <button id="cancel" class='saito-button-secondary cancel-action'>Cancel</button>
            <button id="confirm_send" class="saito-button-primary disabled">Send</button>
          </div>
        </div>
      </div>

      <div id="action-buttons" class="saito-button-row auto-fit">
        <button id="send" class="saito-button-primary">Send</button>
      </div>
    </div>
  `;

  return html;

};

