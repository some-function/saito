const NodeCardTemplate = require('./node-card.template');
const S = require('saito-js/saito').default;
const jsonTree = require('json-tree-viewer');

class NodeCard {
  /**
   * props = { title, endpoint?, onExplore, onClose }
   */
  constructor(app, mod, props) {
    this.app = app;
    this.mod = mod;
    this.props = { ...props };
    this.container = '#status-container';
    this.root = null;
    this.contentEl = null;
    this.stats = {};
    this.peers = [];
  }

  async render() {
    // Insert template and capture our root element
    const html = NodeCardTemplate(this.app, this.mod, {
      title: this.props.title
    });
    this.app.browser.addElementToSelector(html, this.container);

    // Our root is the last appended node-card
    const containerEl = document.querySelector(this.container);
    this.root = containerEl.lastElementChild;
    this.contentEl = this.root.querySelector('.node-card-content');

    this.hookTabButtons();
    this.hookCloseButton();

    // Initial load and render content
    await this.loadData();
  }

  async loadData() {
    if (!this.contentEl) return;
    try {
        const [statsRaw, peerRaw] = await Promise.all([
          this.fetchData('stats'),
          this.fetchData('stats/peers')
        ]);
        this.stats = this.safeParse(statsRaw);
        this.peers = Object.values(
          this.safeParse(peerRaw, { index_to_peers: {} }).index_to_peers
        );
    } catch (e) {
      console.error('Error loading data:', e);
      this.contentEl.textContent = 'Error loading data';
      return;
    }

    // Render content based on active tab
    this.renderContent();
  }

  fetchData(path) {
    if (this.props.endpoint) {
      return fetch(`${this.props.endpoint}/${path}`).then(r => r.text());
    }
    // fallback to local stats
    return path.includes('peers')
      ? S.getLibInstance().get_peer_stats()
      : S.getLibInstance().get_stats();
  }

  safeParse(data, fallback = {}) {
    try {
      return JSON.parse(data);
    } catch {
      return fallback;
    }
  }


  buildSummary() {
    const stats = this.stats;
    const peers = this.peers;

    // wallet/core versions as before
    const state     = stats.current_wallet_state || {};
    const coreObj   = state.core_version   || {};
    const walletObj = state.wallet_version || {};

    const fmtVersion = v => (
      typeof v.major === 'number' &&
      typeof v.minor === 'number' &&
      typeof v.patch === 'number'
        ? `${v.major}.${v.minor}.${v.patch}`
        : '—'
    );

    const config  = stats.current_config_state || {};
    const isSpv   = config.is_spv_mode;
    const nodeType =
      isSpv === true ? 'lite'
      : isSpv === false  ? 'full'
      : '—';

    const summary = {
      nodeType,
      blockHeight   : stats?.current_blockchain_state?.longest_chain_length ?? '—',
      walletVersion : fmtVersion(walletObj),
      coreVersion   : fmtVersion(coreObj),
    };

    return `
      <div class="summary-tab">
        <p>
          <strong>Node type:</strong>
          <span>${summary.nodeType}</span>
        </p>
        <p>
          <strong>Number of attached peers:</strong>
          <span>${peers.length}</span>
        </p>
        <p>
          <strong>Number of full node peers:</strong>
          <span>${peers.filter(p => p.static_peer_config?.synctype === 'full').length}</span>
        </p>
        <p>
          <strong>Number of browser peers:</strong>
          <span>${peers.filter(p => !p.static_peer_config || p.static_peer_config.synctype === 'lite').length}</span>
        </p>
        <p>
          <strong>Block Height:</strong>
          <span>${summary.blockHeight}</span>
        </p>
        <p>
          <strong>Wallet version:</strong>
          <span>${summary.walletVersion}</span>
        </p>
        <p>
          <strong>Core version:</strong>
          <span>${summary.coreVersion}</span>
        </p>
      </div>
    `;
  }


  renderContent() {
    if (!this.contentEl || !this.root) return;
    this.contentEl.innerHTML = '';
    const activeTab = this.root.querySelector('.node-card-tab-btn.active')
      .dataset.tab;

    if (activeTab === 'summary') {

      let summaryHtml = this.buildSummary();
      this.contentEl.innerHTML = summaryHtml;
    
    } else if (activeTab === 'peerStats') {
    
      jsonTree.create(this.peers, this.contentEl);
    
    } else if (activeTab === 'stats') {
    
      jsonTree.create(this.stats, this.contentEl);
    
    } else if (activeTab === 'peers') {
      console.log("this.peers:", this.peers);
      this.peers.forEach(p => {
        this.contentEl.appendChild(this.makePeerLink(p));
      });
    }
  }

  makePeerLink(peer) {
    console.log("make peer link");
    console.log("peer: ", peer);
    let url = '';
    if (
      !peer.static_peer_config ||
      !peer.static_peer_config.protocol ||
      !peer.static_peer_config.host
    ) {
      url = 'Browser';
    } else {
      url = `${peer.static_peer_config.protocol}://${peer.static_peer_config.host}`;
      if (
        (peer.static_peer_config.protocol === 'https' && peer.static_peer_config.port !== 443) ||
        (peer.static_peer_config.protocol === 'http'  && peer.static_peer_config.port !== 80)
      ) {
        url += `:${peer.static_peer_config.port}`;
      }
    } 

    const el = document.createElement('div');
    el.className = 'peer-item';
    el.innerHTML = `<span>${url}</span><i>↗</i>`;
    el.onclick = () => this.props.onExplore?.(url);
    return el;
  }

  hookTabButtons() {
    this.root.querySelectorAll('.node-card-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.root
          .querySelectorAll('.node-card-tab-btn')
          .forEach(b => b.classList.toggle('active', b === btn));
        this.renderContent();
      });
    });
  }

  hookCloseButton() {
    const btn = this.root.querySelector('.node-card-close');
    btn.addEventListener('click', () => this.props.onClose?.());
  }

  remove() {
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}

module.exports = NodeCard;
