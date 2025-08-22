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
    this.render_type = null;
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
    setTimeout(async () => await this.attachEvents(), 0);
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
    if (hasWallet) { this.getSlips(this.id, this.tx_sig); }

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

  async attachEvents() {
    // Multiple cards
    if (Array.isArray(this.items) && this.items.length > 1) {
      for (const item of this.items) {
        const el = document.querySelector(`#nft-card-${item.idx}`);
        if (!el) continue;

        // Avoid stacking listeners when re-rendering
        el.onclick = null;
        el.onclick = () => {
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

          vm.overlay.show(NftDetailsTemplate(vm.app, vm.mod, vm));
          setTimeout(() => vm.setupNftDetailsEvents(), 0);
        };
      }
      return;
    }

    // Single card (backward compatible)
    const el = document.querySelector(`#nft-card-${this.idx}`);
    if (el) {
      el.onclick = () => {
        this.overlay.show(NftDetailsTemplate(this.app, this.mod, this));
        setTimeout(async () => await this.setupNftDetailsEvents(), 50);
      };
    }
  }

  async setupNftDetailsEvents() {
    // Scope to the most recently rendered overlay instance
    const overlays = document.querySelectorAll('.nft-details-container');
    this._overlayRoot = overlays.length ? overlays[overlays.length - 1] : document;

    this.mergeBtn = this._overlayRoot.querySelector('#send-nft-merge');
    this.splitBtn = this._overlayRoot.querySelector('#send-nft-split');
    this.cancelSplitBtn = this._overlayRoot.querySelector('#send-nft-cancel-split');
    this.confirmSplitBtn = this._overlayRoot.querySelector('#send-nft-confirm-split');
    this.sendBtn = this._overlayRoot.querySelector('#send_nft');
    this.receiver_input = this._overlayRoot.querySelector('#nft-receiver-address');

    this.nft_list = this.app?.options?.wallet?.nfts || [];

    this.setupValidateAddress();
    this.setupSendButton();
    this.setupMergeButton();
    this.setupSplitButton();
    this.setupCancelSplitButton();
    this.setupConfirmSplitButton();
    await this.setupListBtn();
  }

  async setupListBtn() {
    if (document.querySelector('#assetstore-list-nft')) {
      this.list_btn = document.querySelector('#assetstore-list-nft');
      this.list_btn.onclick = async (e) => {
        e.preventDefault();
        let newtx = await this.mod.createListAssetTransaction();
        alert('TX Created!');
        console.log(JSON.stringify(newtx.returnMessage()));
        this.app.network.propagateTransaction(newtx);
      };
    }
  }

  setupValidateAddress() {
    if (!this.receiver_input || !this.sendBtn) {
      console.warn('setupValidateAddress: receiver_input or sendBtn not found');
      return;
    }

    const syncBtn = (e) => {
      // Always read from the event target if present; fall back to the current node
      const val = (e?.currentTarget?.value ?? this.receiver_input.value ?? '').trim();
      const empty = val.length === 0;

      this.sendBtn.classList.toggle('disabled', empty);
      this.sendBtn.toggleAttribute('disabled', empty);

      // console.log('syncBtn:', { empty, val, node: this.receiver_input, sameNode: e?.currentTarget === this.receiver_input });
    };

    // Avoid stacking listeners if overlay opens multiple times
    if (this._syncBtnListener) {
      this.receiver_input.removeEventListener('input', this._syncBtnListener);
      this.receiver_input.removeEventListener('change', this._syncBtnListener);
    }
    this._syncBtnListener = syncBtn;

    this.receiver_input.addEventListener('input', this._syncBtnListener);
    this.receiver_input.addEventListener('change', this._syncBtnListener);

    // Initialize once right away
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

  setupMergeButton() {
    if (!this.mergeBtn) return;

    const sameIdCount = this.nft_list.filter((nft) => nft?.id === this.id).length;
    if (sameIdCount > 1) {
      this.mergeBtn.classList.remove('disabled');
    } else {
      this.mergeBtn.classList.add('disabled');
    }

    this.mergeBtn.onclick = async (e) => {
      e.preventDefault();
      if (this.mergeBtn.classList.contains('disabled')) return;

      const confirmMerge = confirm(`Merge all NFTs with id: ${this.id}?`);
      if (!confirmMerge) return;

      try {
        const obj = {};
        if (this.image) obj.image = this.image;
        if (this.text) obj.text = this.text;

        const tx_msg = { data: obj, module: 'NFT', request: 'merge nft' };

        await this.app.wallet.mergeNft(this.id, tx_msg);

        if (typeof this.app.options.wallet.nftMergeIntents !== 'object') {
          this.app.options.wallet.nftMergeIntents = {};
        }
        this.app.options.wallet.nftMergeIntents[this.id] = Date.now();

        this.app.wallet.saveWallet();

        salert('Merge NFT tx sent');
        this.overlay.close();
        if (document.querySelector('.send-nft-container')) {
          this.app.connection.emit('saito-send-nft-render-request', {});
        }
      } catch (err) {
        salert('Merge failed: ' + (err?.message || err));
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

  setupSplitButton() {
    if (!this.splitBtn) return;

    if (this.amount > 1) {
      this.splitBtn.classList.remove('disabled');
    } else {
      this.splitBtn.classList.add('disabled');
    }

    this.splitBtn.onclick = (e) => {
      e.preventDefault();
      if (this.splitBtn.classList.contains('disabled')) return;
      const splitBar = document.querySelector('#nft-details-split-bar');
      let splitText = document.querySelector('.nft-details-split p');

      this.cancelSplitBtn.style.display = 'block';
      this.confirmSplitBtn.style.display = 'block';
      this.splitBtn.style.display = 'none';
      splitBar.style.display = 'block';
      splitText.style.display = 'none';

      if (!splitBar) return;
      this.showSplitOverlay(splitBar);
    };
  }

  setupCancelSplitButton() {
    if (!this.cancelSplitBtn) return;

    this.cancelSplitBtn.onclick = (e) => {
      e.preventDefault();

      let splitBar = document.querySelector('#nft-details-split-bar');
      let splitText = document.querySelector('.nft-details-split p');

      // Hide confirm/cancel
      this.cancelSplitBtn.style.display = 'none';
      this.confirmSplitBtn.style.display = 'none';
      this.splitBtn.style.display = 'block';
      splitText.style.display = 'block';
      splitBar.style.display = 'none';
      splitBar.innerHTML = ``;
    };
  }

  setupConfirmSplitButton() {
    if (!this.confirmSplitBtn) return;

    this.confirmSplitBtn.onclick = async (e) => {
      e.preventDefault();

      const splitBar = document.querySelector('#nft-details-split-bar');
      if (!splitBar) return;

      const leftCount = parseInt(splitBar.querySelector('.split-left')?.innerText || '0', 10);
      const rightCount = parseInt(splitBar.querySelector('.split-right')?.innerText || '0', 10);

      const slip1UtxoKey = this.slip1?.utxo_key;
      const slip2UtxoKey = this.slip2?.utxo_key;
      const slip3UtxoKey = this.slip3?.utxo_key;
      if (!slip1UtxoKey || !slip2UtxoKey || !slip3UtxoKey) {
        salert('Missing required UTXO keys for NFT.');
        return;
      }

      const obj = {};
      if (this.image || this.image) obj.image = this.image || this.image;
      if (this.text || this.text) obj.text = this.text || this.text;

      const tx_msg = {
        data: obj,
        module: 'NFT',
        request: 'split nft'
      };

      try {
        const newtx = await this.app.wallet.splitNft(
          slip1UtxoKey,
          slip2UtxoKey,
          slip3UtxoKey,
          leftCount,
          rightCount,
          tx_msg
        );
        console.log('split tx:', newtx);
        salert('Split NFT tx sent');
        this.overlay.close();
        if (document.querySelector('.send-nft-container')) {
          this.app.connection.emit('saito-send-nft-render-request', {});
        }
      } catch (err) {
        salert('Split failed: ' + (err?.message || err));
      }
    };
  }

  returnId() {
    if (tx.to.length < 3) { return ""; }
    return tx.to[0].publicKey + tx.to[2].publicKey;
  }

  showSplitOverlay(rowElement) {
    let totalAmount = Number(this.amount);
    console.log('amount: ', totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount < 2) {
      salert('This NFT cannot be split (amount < 2).');
      return;
    }

    const overlay = document.createElement('div');
    overlay.classList.add('split-overlay');
    Object.assign(overlay.style, {
      position: 'relative',
      width: '100%',
      backgroundColor: 'var(--saito-background-color)',
      display: 'flex',
      zIndex: '10',
      padding: '1rem 0rem',
      border: '1px solid var(--saito-border-color-dark)'
    });

    const leftDiv = document.createElement('div');
    leftDiv.classList.add('split-left');
    Object.assign(leftDiv.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      fontSize: '1.4rem'
    });

    const bar = document.createElement('div');
    bar.classList.add('split-bar');
    Object.assign(bar.style, {
      width: '2px',
      backgroundColor: 'var(--saito-primary)',
      cursor: 'col-resize',
      position: 'relative'
    });
    bar.innerHTML = `<div class="resize-icon horizontal"></div>`;

    const dragIcon = bar.querySelector('.resize-icon.horizontal');
    Object.assign(dragIcon.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-45%, -50%)',
      pointerEvents: 'none'
    });

    const rightDiv = document.createElement('div');
    rightDiv.classList.add('split-right');
    Object.assign(rightDiv.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      fontSize: '1.4rem'
    });

    overlay.append(leftDiv, bar, rightDiv);
    rowElement.appendChild(overlay);

    const rowRect = rowElement.getBoundingClientRect();
    const rowWidth = rowRect.width || 0;
    const barWidth = parseInt(getComputedStyle(bar).width, 10) || 2;

    const halfWidth = Math.max(0, (rowWidth - barWidth) / 2);
    leftDiv.style.width = `${halfWidth}px`;
    rightDiv.style.width = `${Math.max(0, rowWidth - barWidth - halfWidth)}px`;

    let leftCount = Math.round((halfWidth / rowWidth) * totalAmount);
    let rightCount = totalAmount - leftCount;
    leftDiv.innerText = leftCount;
    rightDiv.innerText = rightCount;

    const minLeftW = (0.5 / totalAmount) * rowWidth;
    const maxLeftW = rowWidth - barWidth - minLeftW;

    const dragSplit = (e) => {
      const rect = rowElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      let newLeftW = x - barWidth / 2;

      newLeftW = Math.max(minLeftW, Math.min(newLeftW, maxLeftW));

      leftDiv.style.width = `${newLeftW}px`;
      const newRightW = rect.width - barWidth - newLeftW;
      rightDiv.style.width = `${newRightW}px`;

      leftCount = Math.round((newLeftW / rect.width) * totalAmount);
      rightCount = totalAmount - leftCount;
      leftDiv.innerText = leftCount;
      rightDiv.innerText = rightCount;
    };

    bar.addEventListener('mousedown', () => {
      document.addEventListener('mousemove', dragSplit);
      document.addEventListener(
        'mouseup',
        () => document.removeEventListener('mousemove', dragSplit),
        { once: true }
      );
    });
  }
}

module.exports = Nft;
