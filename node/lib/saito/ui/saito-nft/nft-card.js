const SaitoNftCardTemplate = require('./nft-card.template');
const SaitoNft = require('./saito-nft');

class SaitoNftCard {
  constructor(app, mod, container = '', tx = null, data = null, callback = null) {
    this.app = app;
    this.mod = mod;
    this.container = container;

    this.nft = new SaitoNFT(app, mod, tx, data);

    //
    // UI helpers
    //
    this.callback = callback;
  }

  async render() {
    if (!document.querySelector(this.container)) {
      console.warn('nft card -- missing container');
      return;
    }

    await this.nft.fetchTransaction();

    // Single record (backward-compatible behavior)
    this.app.browser.prependElementToSelector(
      SaitoNftCardTemplate(this.app, this.mod, this),
      this.container
    );

    // Ensure DOM is in place
    setTimeout(() => this.attachEvents(), 0);
  }
}

module.exports = SaitoNftCard;
