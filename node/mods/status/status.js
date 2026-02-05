const Module = require("../../lib/saito/module");
const statusIndex = require("./index");
const NodeCardManager = require("./lib/node-card-manager");


class Status extends Module {
  constructor(app) {
    super(app);
    this.name = "status";
    this.description = "Node + Peer Status Dashboard";
    this.categories = "Utilities Dev";

    this.styles = ["/settings/style.css", "/saito/lib/jsonTree/jsonTree.css"];

    this.cardManager = new NodeCardManager(app, this, "#status-container");
  }

  async render() {
    if (this.app.BROWSER) {
      await super.render();
      this.attachEvents();
    }
  }

  attachEvents() {}

  async onPeerHandshakeComplete(app, peer) {
    if (app.BROWSER && this.browserActive == 1) {
      console.log("onPeerHandshakeComplete peer:", peer);
      await this.cardManager.render();
    }
  }

  webServer(app, expressApp, express) {
    const slugRoute = `/${encodeURI(this.returnSlug())}`;

    expressApp.get(slugRoute, (req, res) => {
      res.type("html").charset = "UTF-8";
      res.send(statusIndex(app, this));
    });

    expressApp.use(slugRoute, express.static(`${__dirname}/web`));
  }
}

module.exports = Status;