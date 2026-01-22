module.exports = (app, mod, headerClass) => {
  let html = `
    <header id="saito-header" class="${headerClass}">
        <div class="hamburger-container">
            <div id="saito-header-menu-toggle"><i class="fa-solid fa-bars"></i></div>
            <div class="saito-header-backdrop"></div>
            <div class="saito-header-hamburger-contents">
                <div class="saito-header-profile">
                    <div class="wallet-btn-container">
                        <div class="wallet-btn" id="wallet-btn-settings">
                            <i class="fas fa-cog"></i>
                            <span class="option-more">ACCOUNT</span>
                        </div>
                    </div>
                </div>
                <div class="header-wallet">
                    <div class="saito-header-wallet-menu saito-menu-select-subtle"></div>
                </div>
            </div>
        </div>
    </header>
  `;
  return html;
};