const NftTemplate = require('./nft.template');
const NftDetailsTemplate = require('./nft-details-overlay.template');
const SaitoOverlay = require('./../saito-overlay/saito-overlay');

class Nft {
  constructor(app, mod, container = '', tx = null) {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this.overlay = new SaitoOverlay(this.app, this.mod);

    //
    // tx details
    //
    this.tx = tx;
    this.id = null;
    this.slip1 = null;
    this.slip2 = null;
    this.slip3 = null;

    //
    // nft details
    //
    this.amount = BigInt(0); // nolans
    this.deposit = BigInt(0); // nolans
    this.image = '';
    this.text = '';
    this.items = []; // multiple nfts of same id saved here

    //
    // UI helpers
    //
    this.idx = null;
    this.has_local_tx = false;
  }

  async render() {
    const containerExists = this.container && document.querySelector(this.container);
    if (!containerExists) return;

    // If there are multiple items for same id, render them all.
    if (Array.isArray(this.items) && this.items.length > 1) {
      for (const item of this.items) {
        // Create a view-model whose prototype is the instance,
        // so nft.template.js can access all class methods.
        const vm = Object.create(this);
        Object.assign(vm, {
          id: item.id,
          slip1: item.slip1,
          slip2: item.slip2,
          slip3: item.slip3,
          amount: item.amount,
          deposit: item.deposit,
          idx: item.idx
        });

        this.app.browser.prependElementToSelector(
          NftTemplate(this.app, this.mod, vm),
          this.container
        );
      }
    } else {
      // Single record (backward-compatible behavior)
      this.app.browser.prependElementToSelector(
        NftTemplate(this.app, this.mod, this),
        this.container
      );
    }

    // makes sure DOM is loaded before attaching events
    setTimeout(() => this.attachEvents(), 0);
  }

  async createFromId(id) {
    this.id = id;
    if (!this.id) return;

    // Optional (informational): how many wallet entries share this.id
    const walletNfts = this.app?.options?.wallet?.nfts || [];
    const sameIdCount = walletNfts.filter((n) => n?.id === this.id).length;

    //  Try local archive
    await this.app.storage.loadTransactions(
      { field4: this.id },
      (txs) => {
        if (Array.isArray(txs) && txs.length > 0) {
          this.createFromTx(txs[0]);
        }
      },
      'localhost'
    );

    // Try remote if not found locally
    if (!this.has_local_tx) {
      const peers = await this.mod.app.network.getPeers();
      if (Array.isArray(peers) && peers.length > 0) {
        await this.app.storage.loadTransactions(
          { field4: this.id },
          (txs) => {
            if (Array.isArray(txs) && txs.length > 0) {
              this.createFromTx(txs[0]);
            }
          },
          peers[0]
        );
      }
    }

    // At this point we may or may not have a tx; either way we can populate slips
    // for ALL entries in wallet with this.id (and/or the tx_sig if we have it).
    this.getSlips(this.id, this.tx_sig ?? null);
  }

  createFromTx(tx) {
    this.has_local_tx = true;
    this.tx = tx;

    const tx_msg = typeof tx.returnMessage === 'function' ? tx.returnMessage() : {};
    this.tx_sig = this.tx?.signature;

    const data = tx_msg?.data ?? {};
    if (typeof data.image !== 'undefined') this.image = data.image;

    if (typeof data.text !== 'undefined') {
      this.text =
        typeof data.text === 'object' && data.text !== null
          ? JSON.stringify(data.text, null, 2)
          : String(data.text);
    }

    // Collect slips for all matches (by id and/or tx_sig)
    const hasWallet =
      Array.isArray(this.app?.options?.wallet?.nfts) && this.app.options.wallet.nfts.length > 0;
    if (hasWallet) this.getSlips(this.id, this.tx_sig);
  }

  getSlips(id = null, tx_sig = null) {
    const nfts = this.app?.options?.wallet?.nfts || [];
    if (!Array.isArray(nfts) || nfts.length === 0) return;

    // Filter all candidates by id OR tx_sig
    const candidates = nfts.filter(
      (n) => (id != null && n?.id === id) || (tx_sig != null && n?.tx_sig === tx_sig)
    );

    if (candidates.length === 0) return;

    // Build items for each candidate; dedupe by slip1.utxo_key to be safe
    const seen = new Set();
    this.items = [];

    for (const c of candidates) {
      const s1 = c?.slip1 ?? null;
      const s2 = c?.slip2 ?? null;
      const s3 = c?.slip3 ?? null;

      const key =
        s1?.utxo_key ||
        s2?.utxo_key ||
        s3?.utxo_key ||
        `${c?.tx_sig || ''}:${s1?.slip_index ?? ''}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const item = {
        id: c?.id ?? null,
        tx_sig: c?.tx_sig ?? null,
        slip1: s1,
        slip2: s2,
        slip3: s3,
        amount: s1?.amount != null && s1.amount !== '' ? BigInt(s1.amount) : BigInt(0),
        deposit: s2?.amount != null && s2.amount !== '' ? BigInt(s2.amount) : BigInt(0),
        idx: s1?.utxo_key ?? null // prefer slip1.utxo_key as the card key
      };

      this.items.push(item);
    }

    if (this.items.length === 0) return;

    // Preserve backward compatibility by populating fields from the first item
    const p = this.items[0];
    this.id = p.id;
    this.slip1 = p.slip1;
    this.slip2 = p.slip2;
    this.slip3 = p.slip3;
    this.amount = p.amount;
    this.deposit = p.deposit;
    this.idx = p.idx;
  }

  getDepositInSaito(deposit = this.deposit) {
    return this.app.wallet.convertNolanToSaito(deposit);
  }

  attachEvents() {
    let nft_self = this;

    console.log(document.querySelector(`#nft-card-${nft_self.idx}`));

    if (document.querySelector(`#nft-card-${nft_self.idx}`)) {
      document.querySelector(`#nft-card-${nft_self.idx}`).onclick = (e) => {
        console.log('clicked on nft card');

        nft_self.overlay.show(NftDetailsTemplate(nft_self.app, nft_self.mod, nft_self));
      };
    }
  }
}

module.exports = Nft;
