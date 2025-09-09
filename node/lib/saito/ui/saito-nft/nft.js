const NftTemplate = require('./nft.template');
const SendOverlay = require('./send-overlay');
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
    this.send_overlay = new SendOverlay(this.app, this.mod);

    // DOM cache
    this._rootEl = null;
  }

  get rootEl() {
    if (!this._rootEl && this.container) {
      this._rootEl = document.querySelector(this.container);
    }
    return this._rootEl;
  }

  async render() {
    if (!this.rootEl) return;

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

    // Ensure DOM is in place
    requestAnimationFrame(() => this.attachEvents());
  }

  async attachEvents() {
    const root = this.rootEl || document;

    // Multiple cards
    if (Array.isArray(this.items) && this.items.length > 1) {
      for (const item of this.items) {
        const el = root.querySelector(`#nft-card-${item.idx}`);
        if (!el) continue;

        // Avoid stacking listeners when re-rendering
        el.onclick = null;
        el.onclick = () => {
          const nft = Object.create(this);
          Object.assign(nft, {
            id: item.id,
            slip1: item.slip1,
            slip2: item.slip2,
            slip3: item.slip3,
            amount: item.amount,
            deposit: item.deposit,
            idx: item.idx
          });

          this.send_overlay.render(nft);
        };
      }
      return;
    }

    // Single card (backward compatible)
    const el = root.querySelector(`#nft-card-${this.idx}`);
    if (el) {
      el.onclick = () => {
        this.send_overlay.render(this);
      };
    }
  }

  async createFromId(id) {
    this.id = id;
    if (!this.id) return;

    // Try local archive
    await this.app.storage.loadTransactions(
      { field4: this.id },
      (txs) => {
        if (Array.isArray(txs) && txs.length > 0) {
          // ✅ only extract image/text
          this.setImageTextFromTx(txs[0]);
        }
      },
      'localhost'
    );

    // Try remote if not found locally
    if (!this.has_local_tx) {
      const peers = await this.mod.app.network.getPeers();
      const peer = peers?.[0] ?? null;
      if (peer) {
        await this.app.storage.loadTransactions(
          { field4: this.id },
          (txs) => {
            if (Array.isArray(txs) && txs.length > 0) {
              // ✅ only extract image/text
              this.setImageTextFromTx(txs[0]);
            }
          },
          peer
        );
      }
    }

    console.log('nft.createFromId() id: ', this.id);

    // Populate slips for all entries with this.id
    this.getSlipsFromWallet(this.id, this.tx_sig ?? null);
  }

  createFromTx(tx) {
    this.has_local_tx = true;
    this.tx = tx;
    this.tx_sig = this.tx?.signature ?? this.tx_sig ?? null;

    // ✅ use the new method here
    this.setImageTextFromTx(tx);

    // Build items directly from the provided tx
    this.getSlipsFromTx(tx);
  }

  /**
   * Wallet-backed slip resolution (used by createFromId).
   * Reads from app.options.wallet.nfts.
   */
  getSlipsFromWallet(id = null, tx_sig = null) {
    const nfts = this.app?.options?.wallet?.nfts || [];
    if (!Array.isArray(nfts) || nfts.length === 0) return;

    const candidates = nfts.filter(
      (n) => (id != null && n?.id === id) || (tx_sig != null && n?.tx_sig === tx_sig)
    );
    if (candidates.length === 0) return;

    // keep helpers meaningful
    this.nft_list = candidates;

    const records = candidates.map((c) => ({
      id: c?.id ?? null,
      tx_sig: c?.tx_sig ?? null,
      slip1: c?.slip1 ?? null,
      slip2: c?.slip2 ?? null,
      slip3: c?.slip3 ?? null
    }));

    console.log('nft.createFromId() records: ', records);

    buildItemsFromRecords(this, records);
  }

  /**
   * TX-backed slip resolution (used by createFromTx).
   * Derives nft_id and slips entirely from the provided tx, without needing wallet entries.
   */
  getSlipsFromTx(tx = this.tx) {
    if (!tx) return;

    this.tx = tx;
    this.tx_sig = tx?.signature ?? this.tx_sig ?? null;

    const msg = tx?.returnMessage ? tx.returnMessage() : {};
    const data = msg?.data ?? {};

    const slip1 = tx?.to[0] ?? null;
    const slip2 = tx?.to[1] ?? null;
    const slip3 = tx?.to[2] ?? null;

    // Derive id if not already set
    this.id = this.id ?? computeNftIdFromTx(tx);

    const records = [
      {
        id: this.id ?? null,
        tx_sig: this.tx_sig ?? null,
        slip1,
        slip2,
        slip3
      }
    ];

    buildItemsFromRecords(this, records);
  }

  /**
   * Extracts NFT image/text data from a transaction
   * and assigns it to this.image / this.text.
   */
  setImageTextFromTx(tx) {
    if (!tx) return;

    const tx_msg = typeof tx?.returnMessage === 'function' ? tx.returnMessage() : {};
    const data = tx_msg?.data ?? {};

    if (typeof data.image !== 'undefined') {
      this.image = data.image;
    }

    if (typeof data.text !== 'undefined') {
      this.text =
        typeof data.text === 'object' && data.text !== null
          ? JSON.stringify(data.text, null, 2)
          : String(data.text);
    }
  }

  getDepositInSaito(deposit = this.deposit) {
    return this.app.wallet.convertNolanToSaito(deposit);
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

  returnId() {
    const to = this?.tx?.to;
    if (!Array.isArray(to) || to.length < 3) return '';
    return computeNftIdFromTx(this.tx);
  }
}

module.exports = Nft;

// helper functions

function asBigIntOrZero(v) {
  try {
    return v !== '' && v != null ? BigInt(v) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

// Normalize an array of records { id, tx_sig, slip1, slip2, slip3 } into ctx.items
function buildItemsFromRecords(this_self, records) {
  const seen = new Set();
  const nextItems = [];
  let firstAccepted = null;

  for (const r of records) {
    const s1 = r?.slip1 ?? null;
    const s2 = r?.slip2 ?? null;
    const s3 = r?.slip3 ?? null;

    const dedupeKey =
      s1?.utxo_key || s2?.utxo_key || s3?.utxo_key || `${r?.tx_sig || ''}:${s1?.slip_index ?? ''}`;

    if (!dedupeKey || seen.has(dedupeKey)) {
      // Skip adding to items, but still remember this as a candidate fallback
      if (!firstAccepted && (s1 || s2 || s3)) {
        firstAccepted = { r, s1, s2, s3 };
      }
      continue;
    }

    seen.add(dedupeKey);

    const amount = asBigIntOrZero(s1?.amount);
    const deposit = asBigIntOrZero(s2?.amount);
    const idx = s1?.utxo_key;

    const item = {
      id: r?.id ?? null,
      tx_sig: r?.tx_sig ?? null,
      slip1: s1,
      slip2: s2,
      slip3: s3,
      amount,
      deposit,
      idx
    };

    nextItems.push(item);
    if (!firstAccepted) firstAccepted = { r, s1, s2, s3, item };
  }

  // Commit items
  this_self.items = nextItems;

  // Populate top-level fields (backward-compat)
  if (this_self.items.length > 0) {
    const p = this_self.items[0];
    Object.assign(this_self, {
      id: p.id,
      slip1: p.slip1,
      slip2: p.slip2,
      slip3: p.slip3,
      amount: p.amount,
      deposit: p.deposit,
      idx: p.idx
    });
    return;
  }

  // Fallback: no items due to dedupe, but we had a candidate record
  if (firstAccepted) {
    const { r, s1, s2, s3 } = firstAccepted;
    const amount = asBigIntOrZero(s1?.amount);
    const deposit = asBigIntOrZero(s2?.amount);
    const idx = sanitizeId(s1?.utxo_key ?? `${r?.tx_sig || ''}:${s1?.slip_index ?? ''}`);

    Object.assign(this_self, {
      id: r?.id ?? this_self.id ?? null,
      slip1: s1 ?? this_self.slip1 ?? null,
      slip2: s2 ?? this_self.slip2 ?? null,
      slip3: s3 ?? this_self.slip3 ?? null,
      amount: amount ?? this_self.amount ?? BigInt(0),
      deposit: deposit ?? this_self.deposit ?? BigInt(0),
      idx: idx ?? this_self.idx ?? null
    });
  }
}

// Derive an NFT id from a tx
function computeNftIdFromTx(tx) {
  if (!tx) return null;

  // Prefer outputs; fall back to inputs
  const s3 = (tx?.to && tx.to[2]) || (tx?.from && tx.from[2]);
  if (!s3 || !s3.publicKey) return null;

  let pk = s3.publicKey;
  let bytes = null;

  // Normalize to Uint8Array
  if (pk instanceof Uint8Array || (typeof Buffer !== 'undefined' && pk instanceof Buffer)) {
    bytes = new Uint8Array(pk);
  } else if (typeof pk === 'string') {
    if (/^[0-9a-fA-F]{66}$/.test(pk)) {
      // Hex (33 bytes = 66 hex chars)
      bytes = hexToBytes(pk);
    } else {
      // Assume Base58 (Saito-style pubkey encoding)
      bytes = base58ToBytes(pk);
    }
  } else if (pk && typeof pk === 'object' && pk.data) {
    bytes = new Uint8Array(pk.data);
  }

  if (!bytes) return null;

  // Some encoders may prepend a 0x00; tolerate 34→33
  if (bytes.length === 34 && bytes[0] === 0) bytes = bytes.slice(1);
  if (bytes.length !== 33) return null;

  // Return as hex string
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* Helpers */

function hexToBytes(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

// Bitcoin Base58 alphabet
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP = (() => {
  const m = new Map();
  for (let i = 0; i < B58_ALPHABET.length; i++) m.set(B58_ALPHABET[i], i);
  return m;
})();

function base58ToBytes(str) {
  // Count leading zeros
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;

  // Base58 decode to a big integer in bytes (base256)
  const bytes = [];
  for (let i = zeros; i < str.length; i++) {
    const val = B58_MAP.get(str[i]);
    if (val == null) throw new Error('Invalid Base58 character');
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      const x = bytes[j] * 58 + carry;
      bytes[j] = x & 0xff;
      carry = x >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Add leading zeros
  for (let k = 0; k < zeros; k++) bytes.push(0);

  // Output is little-endian; reverse to big-endian
  bytes.reverse();
  return new Uint8Array(bytes);
}

function parseNftTypeFromUuidBytes(uuid33) {
  if (!(uuid33 instanceof Uint8Array) || uuid33.length !== 33) return '';
  const typeBytes = uuid33.slice(17, 33);
  const raw = new TextDecoder().decode(typeBytes);
  return raw.replace(/\0+$/g, '');
}
