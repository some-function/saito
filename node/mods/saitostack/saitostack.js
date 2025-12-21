const ModTemplate = require('../../lib/templates/modtemplate');
const SaitoHeader = require('../../lib/saito/ui/saito-header/saito-header');
const SaitoOverlay = require('../../lib/saito/ui/saito-overlay/saito-overlay');
const Transaction = require('../../lib/saito/transaction').default;
const JSON = require('json-bigint');
const HomePage = require('./index');

//
// SaitoStack - Permissioned Blogging Platform
//
// An open-source alternative to Substack that allows creators to publish
// subscription-based content on the Saito network. Supports:
// - Free and paid subscriptions
// - Permissioned content access
// - Creator monetization
// - Subscriber management
//
class SaitoStack extends ModTemplate {
  constructor(app) {
    super(app);

    this.app = app;
    this.name = 'SaitoStack';
    this.slug = 'saitostack';
    this.description = 'Permissioned blogging platform - an open-source alternative to Substack';
    this.categories = 'Social Media Blogging Publishing';
    this.icon_fa = 'fa-solid fa-newspaper';

    this.social = {
      twitter: '@SaitoOfficial',
      title: 'SaitoStack - Permissioned Blogging',
      url: 'https://saito.io/saitostack',
      description: 'Open-source subscription-based blogging platform',
      image: 'https://saito.tech/wp-content/uploads/2022/04/saito_card.png'
    };

    // Cache for posts and subscriptions
    this.postsCache = {
      byAuthor: new Map(),
      bySubscription: new Map(),
      allPosts: [],
      lastFetch: 0
    };

    this.overlay = new SaitoOverlay(app, this);
    this.header = null;

    this.styles = ['/saito/saito.css', '/saitostack/style.css'];
    this.scripts = [];

  }

  ////////////////////////////
  // Initialization        //
  ////////////////////////////
  async initialize(app) {
    await super.initialize(app);
    this.publicKey = await this.app.wallet.getPublicKey();
  }

  ////////////////////////////
  // Rendering             //
  ////////////////////////////
  async render(app) {

    if (!this.browser_active) {
      return;
    }

    this.header = new SaitoHeader(this.app, this);
    await this.header.initialize(this.app);
    this.addComponent(this.header);

    await super.render(this.app, this);

  }


  ////////////////////////////
  // Inter-module Communication //
  ////////////////////////////
  respondTo(type = '', obj) {
    if (type === 'saito-header') {
      let x = [];
      if (!this.browser_active) {
        x.push({
          text: 'SaitoStack',
          icon: this.icon_fa,
          rank: 100,
          type: 'navigation',
          callback: function (app, id) {
            navigateWindow('/saitostack');
          }
        });
      }
      return x;
    }

    return super.respondTo(type, obj);
  }

  ////////////////////////////
  // Transaction Handling  //
  ////////////////////////////
  async onConfirmation(blk, tx, conf) {

    if (!tx.isTo(this.publicKey) && !tx.isFrom(this.publicKey)) {
      return;
    }

    const txmsg = tx.returnMessage();
    if (txmsg.module !== this.name) {
      return;
    }

  }
}

module.exports = SaitoStack;


