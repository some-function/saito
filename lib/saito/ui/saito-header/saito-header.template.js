let SaitoHeaderTemplate = (app, mod, headerClass) => {
  let identicon = app.keychain.returnIdenticon(mod.publicKey);

  let html = `
   <header id="saito-header" class="${headerClass}">
       <div class="hamburger-container">
           <div id="header-msg" class="header-msg"></div>
           <div id="saito-header-menu-toggle"><i class="fa-solid fa-bars"></i></div>
           <div class="saito-header-backdrop"></div>
           <div class="saito-header-hamburger-contents">
               <!-------- wallet start --------->
               <div class="saito-header-profile">
                   <div class="wallet-btn-container">
                       <div class="wallet-btn" id="wallet-btn-details">
                           <i class="fa-solid fa-wallet"></i>
                           <span>Wallet</span>
                           <i class="hideme fa-solid fa-list"></i>
                           <span class="hideme">Apps</span>
                       </div>
                       <!--div class="wallet-btn" id="wallet-btn-history">
                           <i class="fa-regular fa-clock"></i>
                           <span>History</span>
                       </div-->
                       <div class="wallet-btn" id="wallet-btn-settings">
                           <i class="fas fa-cog"></i>
                           <span class="option-more">ACCOUNT</span>
                       </div>
                   </div>

               </div>
               <!-------- wallet end ----------->
               <div class="saito-header-menu-section ">
                   <div class="appspace-menu saito-menu empty-menu-section">
                        <ul class="saito-menu-select-heavy"></ul>
                   </div>
                   <hr>
                   <div class="module-menu saito-menu empty-menu-section">
                        <ul class="saito-menu-select-heavy"></ul>
                   </div>
                   <hr>
                   <div class="utilities-menu saito-menu">
                        <ul class="saito-menu-select-heavy"></ul>
                   </div>
               </div>
               <div class="header-wallet">
                   <div class="saito-header-wallet-menu saito-menu-select-subtle">
                   </div>
               </div>
           </div>
       </div>
   </header>

  `;
  return html;
};

module.exports = SaitoHeaderTemplate;