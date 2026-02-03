module.exports = (self) => {
	return `
    <div class="saito-module-overlay saito-app-install-overlay">
      <div class="saito-module-header" style="background-image: url(${self.image});">
        <h1 class="saito-module-titlebar">${self.name}</h1>
      </div>

      <div class="saito-module-details">
        <div class="detail-key">Version</div>
        <div class="detail-value">${self.version}</div>

        <div class="detail-key">Publisher</div>
        <div class="detail-value" id="publisher"><div>${self.publisher}</div></div>

        <div class="detail-key">Categories</div>
        <div class="detail-value">${self.categories}</div>

        <div class="detail-key">Description</div>
        <div class="detail-value">${self.description}</div>
      </div>

      <button type="submit" class="withdraw-submit saito-button-primary fat saito-overlay-form-submit" id="saito-app-install-btn">
        Install
      </button>
    </div>
  `;
};