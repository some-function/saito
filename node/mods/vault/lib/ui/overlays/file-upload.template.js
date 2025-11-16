module.exports = (app, mod) => {
  let html = `
<div class="vault-upload-overlay">

      <div class="saito-overlay-form-header">
         <div class="saito-overlay-form-header-title">
            <div>
               Select File
            </div>
         </div>
      </div>

      <div class="nft-creator">
        <div class="textarea-container">
          <div class="saito-app-upload active-tab paste_event" id="vault-file-upload">
            <span class="vault-file-upload-text">drag-and-drop file</span>
    	  </div>
        </div>
      </div>

      <div class="saito-button-row">
         <button class="saito-primary confirm-button disabled" id="confirm-button">Next Step: Review</button>
      </div>

</div>
`;
  return html;
};
