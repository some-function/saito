module.exports = (self) => {
	return `
    <div class="saito-module-overlay saito-app-install-overlay">
      <div class="saito-module-header" style="background-image: url(${self.modDetails.image});">
        <h1 class="saito-module-titlebar">${self.modDetails.name}</h1>
      </div>

      <div class="saito-module-details">
        <div class="detail-key">Version</div>
        <div class="detail-value">${self.modDetails.version}</div>

        <div class="detail-key">Publisher</div>
        <div class="detail-value" id="publisher"><div>${self.modDetails.publisher}</div></div>

        <div class="detail-key">Categories</div>
        <div class="detail-value">${self.modDetails.categories}</div>

        <div class="detail-key">Description</div>
        <div class="detail-value">${self.modDetails.description}</div>
      </div>

      <button type="submit" class="withdraw-submit saito-button-primary fat saito-overlay-form-submit" id="saito-app-generate-btn">
        Generate App
      </button>
    </div>
  `;
};