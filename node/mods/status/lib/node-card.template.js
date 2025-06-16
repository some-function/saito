module.exports = (app, mod, props = {}) => {
  const { title = '' } = props;
  return `
    <div class="node-card">
      <div class="node-card-title">
        <span>${title}</span>
        <div>
          <button class="node-card-tab-btn active" data-tab="summary">Summary</button>
          <button class="node-card-tab-btn" data-tab="peerStats">Peers</button>
          <button class="node-card-tab-btn" data-tab="stats">Stats</button>
          <button class="node-card-tab-btn" data-tab="peers">Explore</button>
          <button class="node-card-close" aria-label="Close">×</button>
        </div>
      </div>
      <div class="node-card-content padded"></div>
    </div>
  `;
};
