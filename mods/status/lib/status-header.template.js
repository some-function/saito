module.exports = (app, mod) => {
  return `
    <img src="/saito/img/logo.svg" alt="Saito Logo" />
      <h1 class="saito-header-title">Status</h1>
      <div class="header-controls">
        <div class="header-menu-container" id="menu-container">
          <div class="hamburger-button" id="hamburger-button"  aria-label="Toggle menu">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </div>
          <ul class="header-dropdown-menu" id="dropdown-menu">
              <li><a href="#">Placeholder Option</a></li>
          </ul>  
        </div>
      </div>
  `;
};
