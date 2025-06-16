const NodeCard  = require('./node-card');

class NodeCardManager {
  constructor(app, mod, containerSelector) {
    this.app = app;
    this.mod = mod;
    this.container = containerSelector;
    this.cards = new Set();
  }

  render() {
      this.addCard('Browser', '');
  }

  addCard(title, endpoint) {
    const onExplore = url => this.addCard(url.replace(/^https?:\/\//,''), url);
    const onClose = () => this.removeCard(card);

    const props     = { title, endpoint, onExplore, onClose };

    const card = new NodeCard(
      this.app,
      this.mod,
      props
    );
    card.render();
    this.cards.add(card);
  }

  removeCard(card) {
    if (!this.cards.has(card)) return;
    card.remove();
    this.cards.delete(card);
  }

  clearAll() {
    this.cards.forEach(card => this.removeCard(card));
    this.cards.clear();
  }
}

module.exports = NodeCardManager;