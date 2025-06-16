const ModTemplate      = require('../../lib/templates/modtemplate');
const statusIndex      = require('./index');
const SaitoHeader      = require('../../lib/saito/ui/saito-header/saito-header');
const NodeCardManager  = require('./lib/node-card-manager');

class Status extends ModTemplate {
  constructor(app) {
    super(app);
    this.name        = 'status';
    this.description = 'Node + Peer Status Dashboard';
    this.categories  = 'Utilities Dev';

    this.cardManager = new NodeCardManager(app, this, '#status-container');
  }

  async initialize(app) {
    await super.initialize(app);
  }

  async render() {
    if (!this.app.BROWSER) return;

    // header
    this.header = new SaitoHeader(this.app, this);
    await this.header.initialize(this.app);
    this.addComponent(this.header);

    await this.cardManager.render();

    await super.render();
    this.attachEvents();
  }

  attachEvents() {
    if (!this.browser_active) return;
  }

  onPeerHandshakeComplete(app, peer) {
    if (typeof window !== 'undefined') {
    }
  }

  webServer(app, expressApp, express) {
    const slug   = this.returnSlug();
    const webDir = `${__dirname}/web`;

    expressApp.get(`/${encodeURI(slug)}`, async (req, res) => {
      res.type('html').charset = 'UTF-8';
      res.send(statusIndex(app, this));
    });

    expressApp.use(`/${encodeURI(slug)}`, express.static(webDir));
  }
}

module.exports = Status;
