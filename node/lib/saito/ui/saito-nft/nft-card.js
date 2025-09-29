const SaitoNftCardTemplate = require('./nft-card.template');
const SaitoNft = require('./saito-nft');

class SaitoNftCard {
  constructor(app, mod, container = '', tx = null, data = null, callback = null) {
    this.app = app;
    this.mod = mod;
    this.container = container;

    this.nft = new SaitoNft(app, mod, tx, data);

    //
    // UI helpers
    //
    this.callback = callback;
  }

  async render() {
    let this_self = this;
    if (!document.querySelector(this.container)) {
      console.warn('nft card -- missing container');
      return;
    }

    // Single record (backward-compatible behavior)
    this.app.browser.prependElementToSelector(
      SaitoNftCardTemplate(this.app, this.mod, this),
      this.container
    );

    this.nft.fetchTransaction(function () {
      this_self.insertNftDetails();
    });

    // Ensure DOM is in place
    setTimeout(() => this.attachEvents(), 0);
  }

  async attachEvents() {
    const el = document.querySelector(`#nft-card-${this.nft.uuid}`);
    if (el) {
      el.onclick = () => {
        if (this.callback) {
          this.callback(this);
        } else {
          this.app.connection.emit('saito-nft-details-render-request', this.nft);
        }
      };
    }
  }

  /**
   *  Lazy load images and render when available
   */
  insertNftDetails() {
    if (this.app.BROWSER != 1) {
      return 0;
    }
    let elm = document.querySelector(`#nft-card-${this.nft.uuid} .nft-card-img`);
    if (elm) {
      if (this.nft.text) {
        elm.innerHTML = `<div class="nft-card-text">${this.nft.text}</div>`;
        return;
      }
      if (this.nft.image) {
        elm.innerHTML = '';
        elm.style.backgroundImage = `url("${this.nft.image}")`;
        return;
      }

      if (this.nft.load_failed) {
        elm.innerHTML = `<i class="fa-solid fa-heart-crack"></i>`;
      } else {
        elm.innerHTML = `<img class="spinner" src="/saito/img/spinner.svg">`;
      }
    } else {
      console.log('Element not rendered');
    }
  }
}

module.exports = SaitoNftCard;
