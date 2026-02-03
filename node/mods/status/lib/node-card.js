const NodeCardTemplate = require("./node-card.template");
const S = require("saito-js/saito").default;
const jsonTree = require("json-tree-viewer");


class NodeCard {
  constructor(app, mod, props) {
    this.app = app;
    this.mod = mod;
    this.props = {...props};
    this.container = "#status-container";
    this.root = null;
    this.contentElement = null;
    this.stats = {};
    this.peers = [];
    this.congestion = {};
  }

  async render() {
    try {
      const html = NodeCardTemplate(this.app, this.mod, {title: this.props.title});
      this.app.browser.addElementToSelector(html, this.container);

      this.root = document.querySelector(this.container).lastElementChild;
      this.contentElement = this.root.querySelector(".node-card-content");

      this.hookTabButtons();
      this.hookCloseButton();

      await this.loadData();
    } catch (err) {
      console.log("Status Mod: " + err);
    }
  }

  async loadData() {
    if (this.contentElement) {
      try {
        const [statsRaw, peerRaw, congestionRaw] = await Promise.all([
          this.fetchData("stats"), this.fetchData("stats/peers"), this.fetchData("stats/congestion")
        ]);
        
        this.stats = this.safeParse(statsRaw);
        this.peers = Object.values(this.safeParse(peerRaw, {index_to_peers: {}}).index_to_peers);
        this.congestion = this.safeParse(congestionRaw);
    
        console.log("congestion: ", this.congestion);
      } catch (e) {
        console.error("Error loading data:", e);
        this.contentElement.textContent = "Error loading data";
        return;
      }
  
      this.renderContent();
    }
  }

  fetchData(path) {
    return this.props.endpoint    ? fetch(`${this.props.endpoint}/${path}`).then((r) => r.text()) :
           path.includes("peers") ? S.getLibInstance().get_peer_stats()                           : S.getLibInstance().get_stats();
  }

  safeParse(data, fallback={}) {
    try {
      return JSON.parse(data);
    } catch {
      return fallback;
    }
  }


  buildSummary() {
    const state     = this.stats.current_wallet_state || {};
    const coreObj   = state.core_version   || {};
    const walletObj = state.wallet_version || {};

    const nodeType = (() => {
      if (this.props.config && Object.keys(this.props.config).length > 0) {
        const url = this.props.config.block_fetch_url;
        return (url && url !== "") ? "full" : "lite";
      } else {
        return "lite";
      }
    })();

    const fmtVersion = (v) => (["major", "minor", "patch"].every((s) => typeof v[s] === "number") ? `${v.major}.${v.minor}.${v.patch}` : "—");

    const summary = {
      nodeType: nodeType, blockHeight: this.stats?.current_blockchain_state?.longest_chain_length ?? "—",
      walletVersion: fmtVersion(walletObj), coreVersion: fmtVersion(coreObj)
    };

    if (Object.keys(this.props.options).length > 0) {
      summary.nodeType = nodeType;
      summary.blockHeight = this.props.options.blockchain.last_block_id;
      summary.walletVersion = this.props.options.wallet.version;
      summary.coreVersion = "—";
    }

    if (Object.keys(this.props.config).length > 0) {
      summary.walletVersion = fmtVersion(this.props.config.wallet_version);
      summary.coreVersion = fmtVersion(this.props.config.core_version);
    }


    const array = [
      {strong: "Node type",                 span: summary.nodeType                                                                       },
      {strong: "Number of attached peers",  span: this.peers.length                                                                      },
      {strong: "Number of full node peers", span: this.peers.filter((peer) => peer.block_fetch_url && peer.block_fetch_url !== "").length},
      {strong: "Number of browser peers",   span: this.peers.filter((peer) => !peer.block_fetch_url).length                              },
      {strong: "Block Height",              span: summary.blockHeight                                                                    },
      {strong: "Wallet version",            span: summary.walletVersion                                                                  },
      {strong: "Core version",              span: summary.coreVersion                                                                    }
    ];
    return `
      <div class="summary-tab">
        ${array.map((obj) => `<p><strong>${obj.strong}:</strong> <span>${obj.span}</span></p>`).join("\n")}
      </div>
    `;
  }


  renderContent() {
    if (this.contentElement && this.root) {
      this.contentElement.innerHTML = "";
      const activeTab = this.root.querySelector(".node-card-tab-btn.active").dataset.tab;
  
      console.log("node-card options: ", this.props.options);
      console.log("node-card configs: ", this.props.config);
  
      let ip = "";
      let pubkey = "";
      if (Object.keys(this.props.options).length > 0) {
        ip = `(${window.location.host})`;
        pubkey = this.props.options.wallet.publicKey;
  
        this.root.querySelector(".node-card-info .ip").innerHTML = ip;
        this.root.querySelector(`.node-card-menu .monitors`).style.display = "none";
      } else {
        if (this.props.config) {
          const config = this.props.config;
          ip = config.ip_address;
          pubkey = config.public_key;
        }
      }
  
      this.root.querySelector(".node-card-info .pubkey").innerHTML = pubkey;
      this.contentElement.setAttribute("data-key", pubkey);
  
      switch (activeTab) {
        case "summary":   this.contentElement.innerHTML = this.buildSummary();   break;
        case "peerStats": jsonTree.create(this.peers,      this.contentElement); break;
        case "stats":     jsonTree.create(this.stats,      this.contentElement); break;
        case "monitors":  jsonTree.create(this.congestion, this.contentElement); break;
        case "peers":
          console.log("this.peers:", this.peers);
          for (const peer of this.peers) {
            this.contentElement.appendChild(this.makePeerLink(peer));
          }
      }
    }
  }

  makePeerLink(peer) {
    console.log("make peer link");
    console.log("peer: ", peer);
    let url = "";
    const element = document.createElement("div");

    if (peer.block_fetch_url == "") {
      url = `
        <div class="peer-link-info">
          <div class="peer-title-container">
            <span class="peer-title">Browser</span>            
            <span class="peer-ip">(${peer.ip_address})</span>
          </div>

          <div class="perr-pubkey">${peer.public_key}</div>
        </div>
      `

      element.className = "peer-item browser";
      element.innerHTML = `<span>${url}</span>`;
    } else {
      url = `${peer.static_peer_config.protocol}://${peer.static_peer_config.host}`;
      if (
        (peer.static_peer_config.protocol === "https" && peer.static_peer_config.port !== 443) ||
        (peer.static_peer_config.protocol === "http"  && peer.static_peer_config.port !== 80)
      ) {
        url += `:${peer.static_peer_config.port}`;
      }

      element.className = "peer-item";
      element.innerHTML = `<span>${url}</span><i>↗</i>`;
    } 

    element.onclick = () => {
      if (!element.classList.contains("browser")) {
        for (const match of document.querySelectorAll(`.node-card-content[data-key="${peer.public_key}"]`)) {
          const parent = match.parentElement;
          if (parent) {
            parent.remove();
          }
        }

        this.props.onExplore(url, peer);
      }
    }
    return element;
  }

  hookTabButtons() {
    for (const button of this.root.querySelectorAll(".node-card-tab-btn")) {
      button.addEventListener("click", () => {
        for (const b of this.root.querySelectorAll(".node-card-tab-btn")) {
          b.classList.toggle("active", b === button)
        }
        this.renderContent();
      });
    }
  }

  hookCloseButton() {
    this.root.querySelector(".node-card-close").addEventListener("click", () => this.props.onClose?.());
  }

  remove() {
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}

module.exports = NodeCard;