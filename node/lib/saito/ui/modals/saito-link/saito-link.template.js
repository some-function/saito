module.exports = (app, link_self) => {
  let data = link_self.data;
  let game = data.name || data.game;

  let html = `
      <div class="saito-modal saito-modal-share-link">
         <div class="saito-modal-title">Share Options</div>
         <div class="saito-modal-content saito-menu-select-heavy">
           <div id="copy-invite-link" class="saito-modal-menu-option"><i class="fas fa-link"></i><div>Copy ${game} Link</div></div>`;

  if (link_self.share_to_chat) {
    let chat_mod = app.modules.returnModuleBySlug('chat');
    if (chat_mod?.communityGroupName) {
      html += `<div id="chat-invite-link" class="saito-modal-menu-option"><i class="fas fa-comments"></i><div>Share Link in ${chat_mod.communityGroupName}</div></div>`;
    }
  }

  html += `</div>
      </div>
    `;

  return html;
};