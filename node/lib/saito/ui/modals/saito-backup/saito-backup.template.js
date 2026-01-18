module.exports = (this_self) => {
  return `
    <div id="backup-template" class="saito-overlay-form saito-backup-container saito-overlay-backup-reminder">
      <div class="saito-overlay-form-header">
        <div class="saito-overlay-form-header-title">${this_self.title}</div>
      </div>
      
      <div class="saito-overlay-form-text">
        ${this_self.msg}
      </div>
            
      <div class="saito-button-row">
        <button class="saito-button-primary" id="saito-backup-manual">
          <i class="fa-solid fa-download"></i>
          Download copy
        </button>
	    </div>
	  </div>
  `;
};