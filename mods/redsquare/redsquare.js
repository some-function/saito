const ModTemplate = require('../../lib/templates/modtemplate');
const SaitoHeader = require('../../lib/saito/ui/saito-header/saito-header');
const SaitoMain = require('./lib/main');
const redsquareHome = require('./index');


class RedSquare extends ModTemplate {
  constructor(app) {
    super(app);

    this.appname = 'Red Square';
    this.name = 'RedSquare';
    this.slug = 'redsquare';
    this.description = 'Open Source Twitter-clone for the Saito Network';
    this.categories = 'Social Entertainment';
    this.icon_fa = 'fas fa-square-full';

    this.debug = false;
    
    this.peers = [];
    this.keylist = {};

    this.possibleHome = 1;

    this.use_floating_plus = 1;

    this.allowed_upload_types = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];

    this.styles = ['/redsquare/style.css'];
    this.postScripts = [];

    this.enable_profile_edits = true;

    this.social = {
      twitter: '@SaitoOfficial',
      title: '🟥 Saito RedSquare - Web3 Social Media',
      url: 'https://saito.io/redsquare/',
      description: 'Peer to peer Web3 social media platform',
      image: 'https://saito.tech/wp-content/uploads/2022/04/saito_card.png'
    };

    return this;
  }

  returnServices() {
    return [];
  }

  respondTo(type = '', obj) {
    if (type === 'saito-header') {
      let x = [];
      if (!this.browser_active) {
        x.push({
          text: 'RedSquare',
          icon: 'fa-solid fa-square',
          rank: 20,
          type: 'navigation',
          callback: () => { navigateWindow('/redsquare'); },
          event: () => {}
        });
      }
      return x;
    }

    if (type === 'saito-floating-menu') {
      return [];
    }

    if (type === 'post-content') {
      return {
        icon: this.icon_fa,
        text: 'Continue with post to RedSquare',
        callback: async (content, image) => {
          this.app.connection.emit('continue-with-redsquare');
        }
      };
    }

    return null;
  }

  async initialize(app) {
    await super.initialize(app);

    if (this.app.BROWSER && !this.browser_active) {
      this.debug = false;
    }

    this.publicKey = await app.wallet.getPublicKey();

    if (!app.BROWSER) {
      this.addPeer('localhost', 100);
      return;
    }

    this.addPeer('localhost');
  }

  async render() {
    if (this.app.BROWSER && this.browser_active) {
      this.app.connection.emit("settings-overlay-render-request");
    }
  }

  addPeer(peer) {
    let publicKey = peer?.publicKey || this.publicKey;

    let peer_idx = -1;

    for (let i = 0; i < this.peers.length; i++) {
      if (this.peers[i].publicKey === publicKey) {
        peer_idx = i;
      }
    }

    let peer_obj;

    if (peer_idx == -1) {
      peer_obj = {peer: peer, publicKey: publicKey, busy: {}};
      this.peers.push(peer_obj);
    } else {
      this.peers[peer_idx].peer = peer;
      peer_obj = this.peers[peer_idx];
      console.log('RS.addPeer: peer refreshed -- ', peer_obj);
      return peer_obj;
    }

    return peer_obj;
  }

  async onPeerServiceUp(app, peer, service = {}) {
    if (!this.browser_active) {
      return;
    }

    if (service.service === 'redsquare') {
      this.addPeer(peer);
      if (this.browser_active) {
        siteMessage('Syncing Redsquare...', 2000);
        this.main.render();
      }
    }
  }

  webServer(app, expressapp, express, alternative_slug = null) {
    const webdir = `${__dirname}/../../mods/${this.dirname}/web`;
    const uri = alternative_slug || '/' + encodeURI(this.returnSlug());
    const redsquare_self = this;

    expressapp.use(uri, express.static(webdir));

    expressapp.get(uri, async function (req, res) {
      if (!res.finished) {
        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        return res.send(redsquareHome(app, redsquare_self, app.build_number, redsquare_self.social));
      }
      return;
    });
  }
}

module.exports = RedSquare;