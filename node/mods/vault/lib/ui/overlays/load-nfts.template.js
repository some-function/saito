module.exports = (app, mod) => {
  let html = `
    <div class="nft-list-container">

      <div class="saito-overlay-form-header">
        <div class="saito-overlay-form-header-title">My NFTs</div>
      </div>

      <div class="nft-page">
        <div class="nft-list" id="nft-list">
          <!-- SimpleNftList.renderNftList() will fill this -->
        </div>
      </div>

    </div>
  `;
  return html;
};
