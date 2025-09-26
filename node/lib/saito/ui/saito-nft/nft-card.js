const NftTemplate = require('./nft-card.template');

class NftCard {
  constructor(app, mod, container = '', tx = null, data = null, callback = null) {
    this.app = app;
    this.mod = mod;
    this.container = container;

    //
    // nft details
    //
    this.id = data?.id;
    this.tx_sig = data?.tx_sig;
    this.slip1 = data?.slip1;
    this.slip2 = data?.slip2;
    this.slip3 = data?.slip3;

    //
    // tx details
    //
    this.tx = tx;

    this.amount = BigInt(0); // nolans
    this.deposit = BigInt(0); // nolans
    this.image = '';
    this.text = '';

    this.load_failed = false;

    //
    // UI helpers
    //
    this.uuid = null;
    this.callback = callback;

    //
    // for auction
    //
    this.seller = '';
    this.ask_price = BigInt(0);

    this.reconstruct();
  }

  render() {
    if (!document.querySelector(this.container)) {
      console.warn('nft card -- missing container');
      return;
    }

    // Single record (backward-compatible behavior)
    this.app.browser.prependElementToSelector(
      NftTemplate(this.app, this.mod, this),
      this.container
    );

    this.insertNftDetails();

    // Ensure DOM is in place
    setTimeout(() => this.attachEvents(), 0);
  }

  /**
   *  Lazy load images and render when available
   */
  insertNftDetails() {
    if (this.app.BROWSER != 1) {
      return 0;
    }
    let elm = document.querySelector(`#nft-card-${this.uuid} .nft-card-img`);
    if (elm) {
      if (this.text) {
        elm.innerHTML = `<div class="nft-card-text">${this.text}</div>`;
        return;
      }
      if (this.image) {
        elm.innerHTML = '';
        elm.style.backgroundImage = `url("${this.image}")`;
        return;
      }

      if (this.load_failed) {
        elm.innerHTML = `<i class="fa-solid fa-heart-crack"></i>`;
      } else {
        elm.innerHTML = `<img class="spinner" src="/saito/img/spinner.svg">`;
      }
    } else {
      console.log('Element not rendered');
    }
  }

  async attachEvents() {
    const el = document.querySelector(`#nft-card-${this.uuid}`);
    if (el) {
      el.onclick = () => {
        if (this.callback) {
          this.callback(this);
        } else {
          this.app.connection.emit('saito-nft-details-render-request', this);
        }
      };
    }
  }

  /**
   *  Depending on whether we are creating the nft[card] with a tx or the wallet.options saved data
   *  recover the missing information and update rendering (if needed)
   *
   *  CALLBACK > AWAIT
   */
  reconstruct() {
    let this_self = this;
    if (!this.tx && !this.id) {
      console.error('Insufficient data to make an nft!');
      return;
    }

    if (this.tx && this.id) {
      console.log('Huzzah have a perfectly good nft!');
      // already set
      return;
    }

    if (this.tx) {
      //
      // tx is available we can extract slips & txmsg data (img/text)
      //
      this.tx_sig = this.tx?.signature;
      this.id = this.computeNftIdFromTx(this.tx);

      this.slip1 = this.extractSlipObject(this.tx?.to[0] ?? null);
      this.slip2 = this.extractSlipObject(this.tx?.to[1] ?? null);
      this.slip3 = this.extractSlipObject(this.tx?.to[2] ?? null);
    } else {
      //
      // tx isn't available (probably creating nft from id)
      // load tx from archive to get txmsg data (image/text)
      //
      this.app.storage.loadTransactions(
        { field4: this.id },

        async (txs) => {
          if (txs?.length > 0) {
            this.tx = txs[0];
            this.extractNFTData();
            this.insertNftDetails();
          } else {
            //
            // Try remote host (which **IS NOT** CURRENTLY INDEXING NFT TXS)
            //
            let peer = await this.app.network.getPeers();

            this.app.storage.loadTransactions(
              { field4: this.id },
              (txs) => {
                if (txs?.length > 0) {
                  this.tx = txs[0];
                  this.extractNFTData();
                  this.insertNftDetails();
                  //
                  // And save locally!
                  //
                  this.app.storage.saveTransaction(this.tx, { field4: this.id }, 'localhost');
                } else {
                  this.load_failed = true;
                  this.insertNftDetails();
                }
              },
              peer?.length ? peer[0] : null
            );
          }
        },
        'localhost'
      );
    }

    this.extractNFTData();

    if (this.slip1?.amount) {
      this.amount = BigInt(this.slip1.amount);
    }

    if (this.slip2?.amount) {
      this.deposit = BigInt(this.slip2.amount);
    }
    this.uuid = this.slip1?.utxo_key;
  }

  /**
   * Extracts NFT image/text data from a transaction
   * and assigns it to this.image / this.text.
   */
  extractNFTData() {
    if (!this.tx) {
      return;
    }

    const tx_msg = this.tx.returnMessage();
    this.data = tx_msg?.data ?? {};

    if (typeof this.data.image !== 'undefined') {
      this.image = this.data.image;
    }

    if (typeof this.data.text !== 'undefined') {
      this.text =
        typeof this.data.text === 'object' && this.data.text !== null
          ? JSON.stringify(this.data.text, null, 2)
          : String(this.data.text);
    }
  }

  extractSlipObject(slip) {
    if (slip == null) return {};

    const toStr = (v) => (typeof v === 'bigint' ? v.toString() : String(v));
    const toNum = (v) => (typeof v === 'number' ? v : Number(v ?? 0));

    return {
      amount: toStr(slip.amount),
      block_id: toStr(slip.blockId),
      public_key: slip.publicKey,
      slip_index: toNum(slip.index),
      slip_type: toNum(slip.type),
      tx_ordinal: toStr(slip.txOrdinal),
      utxo_key: slip.utxoKey
    };
  }

  //
  // We need a way to get nft_id from NFT tx.
  //
  // If the NFT belongs to us we can simply get nft_id
  // from storage (app.options.wallet.nfts[i].id). But in cases
  // where NFT doesnt belong to us (e.g listed on assetstore) we
  // need to compute nft_id based on the NFT tx we have.
  //
  // This situation isnt unqiue to assetstore, other mods will be
  // creating NFT objects based on NFT tx so doesnt makes sense for this
  // method below to be placed in assetstore.
  //

  //
  // Ideal way would be to let rust comoute this by sending NFT tx
  // to rust. For now temporarily JS is handling this.
  //

  // Derive an NFT id from a tx
  computeNftIdFromTx(tx) {
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
        bytes = this.hexToBytes(pk);
      } else {
        // Assume Base58 (Saito-style pubkey encoding)
        bytes = this.base58ToBytes(pk);
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

  hexToBytes(hex) {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
  }

  base58ToBytes(str) {
    // Bitcoin Base58 alphabet
    const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const B58_MAP = (() => {
      const m = new Map();
      for (let i = 0; i < B58_ALPHABET.length; i++) m.set(B58_ALPHABET[i], i);
      return m;
    })();

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

  async setPrice(saitoAmount) {
    if (saitoAmount == null) throw new Error('setPrice: amount is required');
    const saitoStr =
      typeof saitoAmount === 'bigint' ? saitoAmount.toString() : String(saitoAmount).trim();
    if (!saitoStr || isNaN(Number(saitoStr))) throw new Error('setPrice: invalid amount');
    const nolan = await this.app.wallet.convertSaitoToNolan(saitoStr);
    if (nolan == null) throw new Error('setPrice: conversion failed');
    this.deposit = BigInt(nolan);
    return this;
  }

  async getPrice() {
    return await this.app.wallet.convertNolanToSaito(this.deposit);
  }

  async setSeller(public_key) {
    if (public_key) {
      this.seller = public_key;
    }
  }

  async getSeller() {
    return this.seller;
  }
}

module.exports = NftCard;
