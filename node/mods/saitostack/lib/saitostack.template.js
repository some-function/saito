module.exports = (app, mod) => {
  return `
    <div class="saitostack-container">
      <div class="saitostack-header">
        <h1>SaitoStack</h1>
        <p class="saitostack-subtitle">Permissioned Blogging Platform</p>
      </div>

      <div class="saitostack-content">
        <div class="saitostack-sidebar">
          <div class="saitostack-sidebar-section">
            <h3>My Publications</h3>
            <div id="saitostack-my-publications" class="saitostack-publications-list">
              <!-- Publications will be loaded here -->
            </div>
            <button class="saitostack-btn saitostack-btn-primary" id="saitostack-create-publication">
              <i class="fa-solid fa-plus"></i> Create Publication
            </button>
          </div>

          <div class="saitostack-sidebar-section">
            <h3>Subscriptions</h3>
            <div id="saitostack-my-subscriptions" class="saitostack-subscriptions-list">
              <!-- Subscriptions will be loaded here -->
            </div>
          </div>
        </div>

        <div class="saitostack-main">
          <div class="saitostack-feed" id="saitostack-feed">
            <div class="saitostack-loading">Loading posts...</div>
          </div>
        </div>
      </div>
    </div>
  `;
};


