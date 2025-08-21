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
    this.tx_sig = null;
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
    this.nft_list = [];
  }

  async render() {
    const containerExists = this.container && document.querySelector(this.container);
    if (!containerExists) return;

    // If there are multiple items for same id, render them all.
    if (Array.isArray(this.items) && this.items.length > 1) {
      for (const item of this.items) {
        // VM inherits methods from the instance so template can call class methods
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

    // ensure DOM is in place
    setTimeout(() => this.attachEvents(), 0);
  }

  async createFromId(id) {
    this.id = id;
    if (!this.id) return;

    // Optional: count how many wallet entries share this.id
    const walletNfts = this.app?.options?.wallet?.nfts || [];
    const sameIdCount = walletNfts.filter((n) => n?.id === this.id).length;
    // (sameIdCount available if you want to use it)

    // Try local archive
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

    // Populate slips for all entries with this.id (and tx_sig if we have it).
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

    // Filter candidates by id OR tx_sig
    const candidates = nfts.filter(
      (n) => (id != null && n?.id === id) || (tx_sig != null && n?.tx_sig === tx_sig)
    );

    if (candidates.length === 0) return;

    // Build items for each candidate; dedupe by any available utxo_key
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

      let amt = BigInt(0);
      try {
        if (s1?.amount != null && s1.amount !== '') amt = BigInt(s1.amount);
      } catch (e) {
        /* ignore parse errors; default 0 */
      }

      let dep = BigInt(0);
      try {
        if (s2?.amount != null && s2.amount !== '') dep = BigInt(s2.amount);
      } catch (e) {
        /* ignore parse errors; default 0 */
      }

      const item = {
        id: c?.id ?? null,
        tx_sig: c?.tx_sig ?? null,
        slip1: s1,
        slip2: s2,
        slip3: s3,
        amount: amt,
        deposit: dep,
        idx: s1?.utxo_key ?? null // prefer slip1.utxo_key as the card key
      };

      this.items.push(item);
    }

    if (this.items.length === 0) return;

    // Populate top-level fields from the first item for backward-compat
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
    const el = document.querySelector(`#nft-card-${this.idx}`);
    if (el) {
      el.onclick = () => {
        this.overlay.show(NftDetailsTemplate(this.app, this.mod, this));
        // ensure overlay DOM exists before binding
        setTimeout(() => this.setupNftDetailsEvents(), 50);
      };
    }
  }

  setupNftDetailsEvents() {
    this.mergeBtn = document.querySelector('#send-nft-merge');
    this.splitBtn = document.querySelector('#send-nft-split');
    this.cancelSplitBtn = document.querySelector('#send-nft-cancel-split');
    this.confirmSplitBtn = document.querySelector('#send-nft-confirm-split');
    this.sendBtn = document.querySelector('#send_nft');
    this.receiver_input = document.querySelector('#nft-receiver-address');

    this.nft_list = this.app?.options?.wallet?.nfts || [];

    this.setupValidateAddress();
    this.setupSendButton();
  }

  setupValidateAddress() {
    if (!this.receiver_input || !this.sendBtn) {
      console.warn('receiver_input or sendBtn not found in DOM');
      return;
    }

    const syncBtn = () => {
      const empty = this.receiver_input.value.trim() === '';
      this.sendBtn.classList.toggle('disabled', empty);
      this.sendBtn.toggleAttribute('disabled', empty);
      console.log('syncBtn triggered, empty:', empty);
    };

    // bind event
    this.receiver_input.addEventListener('input', syncBtn);

    // run once immediately
    syncBtn();
  }

  setupSendButton() {
    if (!this.sendBtn) return;

    this.sendBtn.onclick = async (e) => {
      e.preventDefault();

      // validate receiver's public_key
      const receiver = this.receiver_input ? this.receiver_input.value.trim() : '';
      let pc = this.app.wallet.returnPreferredCrypto();
      let valid = pc.validateAddress(receiver);

      if (!valid) {
        salert('Receiver’s public key is not valid');
        return;
      }

      const prevLabel = this.sendBtn.innerText;
      this.sendBtn.classList.add('disabled');
      this.sendBtn.setAttribute('disabled', 'disabled');
      this.sendBtn.innerText = 'Submitting...';

      try {
        const nftItem = this.getNftItem(this.slip1?.utxo_key);
        if (!nftItem) throw new Error('Selected NFT not found.');

        const slip1Key = nftItem?.slip1?.utxo_key;
        const slip2Key = nftItem?.slip2?.utxo_key;
        const slip3Key = nftItem?.slip3?.utxo_key;
        if (!slip1Key || !slip2Key || !slip3Key) {
          throw new Error('Missing required UTXO keys for NFT.');
        }

        const amt = BigInt(1);

        const obj = {};
        if (this.image) obj.image = this.image;
        if (this.text) obj.text = this.text;

        const tx_msg = {
          data: obj,
          module: 'NFT',
          request: 'send nft'
        };

        await this.app.wallet.createSendBoundTransaction(
          amt,
          slip1Key,
          slip2Key,
          slip3Key,
          receiver,
          tx_msg
        );

        salert('Send NFT tx sent');
        this.overlay.close();
        if (document.querySelector('.send-nft-container')) {
          this.app.connection.emit('saito-send-nft-render-request', {});
        }
      } catch (err) {
        salert('Failed to send NFT: ' + (err?.message || err));
      } finally {
        this.sendBtn.classList.remove('disabled');
        this.sendBtn.removeAttribute('disabled');
        this.sendBtn.innerText = prevLabel;
      }
    };
  }

  // Returns the NFT item object instead of an index
  getNftItem(slip1_utxokey) {
    if (!slip1_utxokey) return null;
    return this.nft_list.find((nft) => nft?.slip1?.utxo_key === slip1_utxokey) || null;
  }

  // If you still want the index variant, keep this:
  getNftIndex(slip1_utxokey) {
    return this.nft_list.findIndex((nft) => nft?.slip1?.utxo_key === slip1_utxokey);
  }
}

module.exports = Nft;
