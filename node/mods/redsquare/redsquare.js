const ModTemplate = require('../../lib/templates/modtemplate');
const SaitoHeader = require('../../lib/saito/ui/saito-header/saito-header');
const SaitoMain = require('./lib/main');
const redsquareHome = require('./index');
const SaitoOverlay = require('./../../lib/saito/ui/saito-overlay/saito-overlay');
const AppSettings = require('./lib/settings');


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

    this.last_cache = 0;

    this.special_threads_hmap = {};
    this.unknown_children = [];
    this.orphan_edits = [];

    this.blogs = [];

    this.peers = [];
    this.keylist = {};

    this.jedi_council = new Map();

    this.curated = !this.debug;

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
    let this_mod = this;

    if (type === 'user-menu') {
      return {
        text: `${obj?.publicKey && obj.publicKey === this.publicKey ? 'My' : 'View'} RedSquare Profile`,
        icon: 'fa fa-user',
        callback: function (app, publicKey) {
          navigateWindow(`/redsquare/?user_id=${publicKey}`);
        }
      };
    }

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
      } else {
        if (this.app.browser.isMobileBrowser() || window.innerWidth < 600) {
          x.push({
            text: 'RedSquare Home',
            icon: 'fa-solid fa-house',
            rank: 21,
            type: 'appspace',
            callback: (app, id) => { document.querySelector('.redsquare-menu-home').click(); }
          });
          x.push({
            text: 'Profile',
            icon: 'fas fa-user',
            rank: 26,
            type: 'appspace',
            callback: function (app, id) {
              document.querySelector('.redsquare-menu-profile').click();
            }
          });
        }
      }

      return x;
    }

    if (type === 'saito-floating-menu') {
      return [];
    }

    if (type === 'post-content') {
      return {
        icon: this_mod.icon_fa,
        text: 'Continue with post to RedSquare',
        callback: async (content, image) => {
          this_mod.app.connection.emit('continue-with-redsquare');
        }
      };
    }

    if (type === 'saito-moderation-app') {
      return {
        filter_func: (mod = null, tx = null) => {
          if (tx == null || mod == null || !tx?.from) {
            return 0;
          }

          if (mod.name !== this.name) {
            return 0;
          }

          return 0;
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

    this.loadOptions();

    if (!app.BROWSER) {
      this.addPeer('localhost', 100);

      let archive_mod = this.app.modules.returnModule('Archive');
      if (archive_mod) {
        archive_mod.loadTransactionsWithCallback({ field1: 'Blog', limit: 50 }, (res) => {
          for (let i = 0; i < res.length; i++) {
            this.blogs.push({ts: res[i].updated_at, publicKey: res[i].field2, tx_id: res[i].sig});
          }
        });
      }

      return;
    }

    this.addPeer('localhost');
  }

  async render() {
    if (!this.app.BROWSER || !this.browser_active) {
      return;
    }

    if (this.main == null) {
      this.main = new SaitoMain(this.app, this);
      this.header = new SaitoHeader(this.app, this);
      await this.header.initialize(this.app);

      this.addComponent(this.header);
      this.addComponent(this.main);
    }

    await super.render();

    this.app.modules.renderInto('.redsquare-sidebar');

    if (!this.app.modules.returnModule('Archive')) {
      salert('RedSquare will not work without Archive installed!');
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

      this.archive_connected = true;

      if (this.browser_active) {
        siteMessage('Syncing Redsquare...', 2000);
        this.main.render();
      }
    }
  }

  async handlePeerTransaction(app, tx = null, peer, mycallback) {
    if (tx == null) {
      return 0;
    }

    let txmsg = tx.returnMessage();

    if (!txmsg.request || !mycallback) {
      return 0;
    }

    if (txmsg.request === 'load thread') {
      let thread_id = txmsg.data.sig;
      let by_thread = false;

      if (by_thread) {
        this.app.storage.loadTransactions(
          {field1: 'RedSquare', field5: thread_id, flagged: 0, limit: 100},
          (txs) => {
            if (txs.length > 0) {
              mycallback(txs);
            }
          },
          'localhost',
          0
        );
      } else {
        this.app.storage.loadTransactions(
          {sig: thread_id, field1: 'RedSquare'},
          (txs) => {
            if (txs.length > 0) {
              txs[0].decryptMessage(this.app);
              this.app.storage.loadTransactions(
                {field1: 'RedSquare', flagged: 0, limit: 100},
                (txs) => {
                  if (txs.length > 0) {
                    mycallback(txs);
                  }
                },
                'localhost',
                0
              );
            }
          },
          'localhost'
        );
      }
      return 1;
    }

    return super.handlePeerTransaction(app, tx, peer, mycallback);
  }

  async onConfirmation(blk, tx, conf) {}

  addToCouncil(key) {
    let trust_rating = this.jedi_council.has(key) ? this.jedi_council.get(key) : 0;
    trust_rating++;
    this.jedi_council.set(key, trust_rating);
    if (trust_rating > 12) {
      this.app.connection.emit('saito-whitelist', { publicKey: key });
    }
  }

  async receiveFlagTransaction(blk, tx, conf, app) {}

  loadOptions() {
    if (!this.app.BROWSER) {
      return;
    }

    if (this.app.options.redsquare && this.app.options.redsquare?.curated == 0) {
      this.curated = false;
    }

    this.saveOptions();
  }

  saveOptions() {
    if (!this.app.BROWSER) {
      return;
    }

    let rso = {};

    rso.curated = this.curated;

    this.app.options.redsquare = rso;

    this.app.storage.saveOptions();
  }

  fetchMissingUsernames(mycallback = null) {
    let rMod = this.app.modules.returnModule('Registry');
    if (rMod) {
      rMod.fetchManyIdentifiers([], (answer) => {
        if (mycallback != null) {
          mycallback(answer);
        }
      });
    } else {
      console.warn('No Registry');
    }
  }

  hasSettings() {
    return true;
  }

  loadSettings(container = null) {
    if (!container) {
      let overlay = new SaitoOverlay(this.app, this.mod);
      overlay.show(`<div class="module-settings-overlay"><h2>Redsquare Settings</h2></div>`);
      container = '.module-settings-overlay';
    }
    let as = new AppSettings(this.app, this, container);
    as.render();
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

  curate(tx) {
    let moderation_score = this.app.modules.moderate(tx, this.name);

    if (moderation_score == 1) {
      return 1;
    }
    if (moderation_score == -1) {
      return -1;
    }

    if (this.app.keychain.hasPublicKey(tx.from[0].publicKey)) {
      return 1;
    }

    if (tx.to[0].amount) {
      return 1;
    }

    if (tx.optional.curated !== undefined) {
      return tx.optional.curated;
    }

    return 0;
  }


  async dbCleanUp(earlier_than = Date.now()) {
    this.app.storage.loadTransactions(
      {field1: 'RedSquare', field5: '', created_earlier_than: earlier_than, limit: 100},
      async (txs) => {
        for (let tx of txs) {
          if (tx.timestamp < earlier_than) {
            earlier_than = tx.timestamp;
          }
        }

        if (txs.length) {
          setTimeout(() => { this.dbCleanUp(earlier_than); }, 15000);
        }
      },
      'localhost'
    );
  }
}

module.exports = RedSquare;