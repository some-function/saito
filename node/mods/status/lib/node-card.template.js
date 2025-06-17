module.exports = (app, mod, props = {}) => {
  const { title = '' } = props;
  return `
    <div class="node-card">
      <div class="node-card-header">
        <div class="node-card-info">
          <div class="title-container">
            <span class="title">${title}</span>            
            <span class="ip"></span>
          </div>
          <div class="pubkey"></div>
        </div>

        <div class="node-card-menu">
          <div class="node-card-tab-btn active" data-tab="summary">Summary</div>
          <div class="node-card-tab-btn" data-tab="peerStats">Peers</div>
          <div class="node-card-tab-btn" data-tab="stats">Stats</div>
          <div class="node-card-tab-btn" data-tab="peers">Explore</div>
          <div class="node-card-close" aria-label="Close">×</div>
        </div>
      </div>

      <div class="node-card-content padded"></div>
    </div>
  `;
};
