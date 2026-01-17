import Decimal from 'decimal.js';
import JSON from 'json-bigint';
import BalanceSnapshot from 'saito-js/lib/balance_snapshot';
import SaitoWallet, { WalletSlip } from 'saito-js/lib/wallet';
import S from 'saito-js/saito';
import { Saito } from '../../apps/core';
import Slip from './slip';
import Transaction from './transaction';
const getUuid = require('uuid-by-string');

const CryptoModule = require('../templates/cryptomodule');

interface PreferredTx {
  sig: string;
  ts: number;
}

export default class Wallet extends SaitoWallet {
  public app: Saito;

  publicKey;
  preferred_crypto = 'SAITO';
  preferred_txs: PreferredTx[] = [];
  default_fee = BigInt(0);
  version = 5.677;
  nolan_per_saito = 100000000;
  cryptos = new Map<string, any>();
  public saitoCrypto: any;

  public async createUnsignedTransactionWithDefaultFee(
    publicKey = '',
    amount = BigInt(0),
    default_fee = this.default_fee
  ): Promise<Transaction> {
    if (publicKey == '') {
      publicKey = await this.getPublicKey();
    }
    return this.createUnsignedTransaction(publicKey, amount, default_fee);
  }

  public async createUnsignedTransaction(
    publicKey = '',
    amount = BigInt(0),
    fee = BigInt(0),
    force_merge = false
  ): Promise<Transaction> {
    if (publicKey == '') {
      publicKey = await this.getPublicKey();
    }
    return S.getInstance().createTransaction(publicKey, amount, fee, force_merge);
  }

  public async createUnsignedTransactionWithMultiplePayments(
    keys: string[],
    amounts: bigint[],
    fee: bigint = this.default_fee
  ): Promise<Transaction> {
    return S.getInstance().createTransactionWithMultiplePayments(keys, amounts, fee);
  }

  public async getNFTList(): Promise<String> {
    return S.getInstance().getNftList();
  }

  public async getBalance(ticker = 'SAITO'): Promise<bigint> {
    if (ticker === 'SAITO') {
      return this.instance.get_balance();
    }
    return BigInt(0);
  }

  async initialize() {
    let privateKey = await this.getPrivateKey();
    let publicKey = await this.getPublicKey();

    if (!privateKey || !publicKey) {
      await this.resetWallet();

      privateKey = await this.getPrivateKey();
      publicKey = await this.getPublicKey();
    }

    this.publicKey = publicKey;
    console.log('Initialize Wallet -- ', publicKey);

    let storedFee = this.app.options.wallet.default_fee;
    this.default_fee = !storedFee ? BigInt(0) : BigInt(storedFee);

    class SaitoCrypto extends CryptoModule {
      constructor(app, publicKey) {
        super(app, 'SAITO');
        this.name = 'Saito';
        this.description = 'Saito';
        this.balance = '0.0';
        this.address = publicKey;

        this.options.isActivated = true;

        app.connection.on('wallet-updated', async () => {
          this.checkBalanceUpdate();
        });
      }

      returnLogo() {
        return '/saito/img/touch/pwa-192x192.png';
      }

      isActivated() {
        return true;
      }

      returnPrivateKey() {
        return this.app.wallet.getPrivateKey();
      }

      checkWithdrawalFeeForAddress(
        address = '',
        mycallback: ((fee: string) => void) | null = null
      ) {
        if (mycallback) {
          mycallback(this.app.wallet.convertNolanToSaito(this.app.wallet.default_fee));
        }
      }

      savePaymentTransaction(tx) {
        let txmsg = tx.returnMessage();

        if (txmsg.module !== 'Saito' || txmsg.amount == 0) {
          console.log('Invalid Payment Transaction to save...', txmsg);
          return;
        }

        const obj = {
          counter_party: { publicKey: '' },
          timestamp: tx.timestamp,
          amount: 0,
          trans_hash: tx.signature,
          type: ''
        };

        if (tx.isFrom(this.publicKey)) {
          obj.counter_party.publicKey = txmsg.to;
          obj.type = 'send';
          obj.amount = -txmsg.amount;
        } else {
          obj.counter_party.publicKey = txmsg.from;
          obj.type = 'receive';
          obj.amount = txmsg.amount;
        }

        if (obj.timestamp < this.history_update_ts) {
          console.warn('Pushing an earlier (or same ts) payment record in SAITO history!');
          console.log(tx);
        } else {
          this.history.push(obj);
          this.history_update_ts = obj.timestamp + 1;
        }

        this.save();
      }

      async checkHistory(callback) {
        console.log(
          `Checking for missed SAITO transactions since ${new Date(this.history_update_ts)}`
        );

        const mycallback = (rows) => {
          let timestamp = 0;
          if (rows?.length) {
            for (let r of rows) {
              timestamp = r.timestamp;
              if (timestamp > this.history_update_ts) {
                if (Number(r.amount) == 0) {
                  continue;
                }
                let amount = this.app.wallet.convertNolanToSaito(BigInt(r.amount));
                const obj = {
                  counter_party: { address: '', publicKey: '' },
                  timestamp,
                  amount,
                  type: '',
                  trans_hash: r.tx_sig
                };

                if (r.from_key == this.publicKey) {
                  obj.counter_party.address = obj.counter_party.publicKey = r.to_key;
                  obj.type = 'send';
                  obj.amount = -obj.amount;
                } else {
                  obj.counter_party.address = obj.counter_party.publicKey = r.from_key;
                  obj.type = 'receive';
                }

                this.history.push(obj);
              } else {
                console.warn('Repeated/old transaction: ', r);
              }
            }

            this.history_update_ts = Math.max(this.history_update_ts, timestamp) + 1;

            this.save();
          }

          if (callback) {
            callback(this.history);
          }
        };

        this.app.network.sendRequestAsTransaction(
          'memento',
          {
            publicKey: this.publicKey,
            offset: this.history_update_ts
          },
          mycallback
        );
      }

      async sendPayment(amount: string, to_address: string, unique_hash: string = '') {
        let nolan_amount = this.app.wallet.convertSaitoToNolan(amount);

        if (!this.pending_balance) {
          this.pending_balance = await this.checkBalance();
        }

        console.log(`Sending ${amount} with balance of ${this.pending_balance}`);

        this.pending_balance = Number(this.pending_balance) - Number(amount);

        if (this.pending_balance < 0) {
          throw new Error('sendPayment: Attempting to send payment with insufficient balance');
        }

        let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(
          to_address,
          nolan_amount
        );

        newtx.msg = {
          module: this.name,
          request: 'crypto payment',
          amount,
          from: this.publicKey,
          to: to_address,
          hash: unique_hash
        };

        await this.app.wallet.signAndEncryptTransaction(newtx);

        await this.app.network.propagateTransaction(newtx);

        console.log('Expecting new balance of: ', this.pending_balance);

        return newtx.signature;
      }

      async sendPayments(amounts: bigint[], to_addresses: string[]) {
        const CHUNK_SIZE = 100;
        const signatures: string[] = [];

        for (let i = 0; i < amounts.length; i += CHUNK_SIZE) {
          const amountsChunk = amounts.slice(i, i + CHUNK_SIZE);
          const addressesChunk = to_addresses.slice(i, i + CHUNK_SIZE);

          let newTx = await this.app.wallet.createUnsignedTransactionWithMultiplePayments(
            addressesChunk,
            amountsChunk
          );
          await this.app.wallet.signAndEncryptTransaction(newTx);
          await this.app.network.propagateTransaction(newTx);
          signatures.push(newTx.signature);
        }

        return signatures.join(', ');
      }

      async receivePayment(howMuch, from, to, timestamp) {
        return false;
      }

      async checkBalance() {
        let x = await this.app.wallet.getBalance();
        this.balance = this.app.wallet.convertNolanToSaito(x);
        return this.balance;
      }

      validateAddress(address) {
        return this.app.wallet.isValidPublicKey(address);
      }

      async checkBalanceUpdate() {
        let balance = this.balance;
        await this.checkBalance();

        if (this.pending_balance || balance !== this.balance) {
          if (this.pending_balance == this.balance) {
            delete this.pending_balance;
            console.log('Pending transferred cleared!');
          }
          this.app.connection.emit('saito-header-update-crypto');
        }
      }
    }

    this.saitoCrypto = new SaitoCrypto(this.app, this.publicKey);

    if (this.app.options.wallet != null) {
      if (this.app.options.wallet.version < this.version) {
        if (this.app.BROWSER == 1) {
          console.log('upgrading wallet version to : ' + this.version);
          let tmpprivkey = this.app.options.wallet.privateKey;
          let tmppubkey = this.app.options.wallet.publicKey;

          if (this.app.options.wallet.privatekey) {
            tmpprivkey = this.app.options.wallet.privatekey;
          }

          if (this.app.options.wallet.publickey) {
            tmppubkey = this.app.options.wallet.publickey;
          }

          let crypto = this.app.options.crypto;

          let keys = this.app.options.keys;
          let chats = this.app.options.chat;

          let theme = this.app.options.theme;

          let modtools = this.app.options.modtools;

          let gameprefs = this.app.options.gameprefs;

          await this.setPrivateKey(tmpprivkey);
          await this.setPublicKey(tmppubkey);

          await this.onUpgrade('upgrade');

          await this.setPrivateKey(tmpprivkey);
          await this.setPublicKey(tmppubkey);

          this.app.options.wallet.preferred_crypto = this.preferred_crypto;
          this.app.options.wallet.version = this.version;
          this.app.options.wallet.default_fee = this.default_fee.toString();
          this.app.options.wallet.slips = [];

          this.app.options.games = [];
          this.app.options.gameprefs = gameprefs;

          this.app.options.crypto = crypto;

          this.app.options.keys = keys;
          this.app.options.chat = chats;

          this.app.options.theme = theme;

          this.app.options.modtools = modtools;

          await this.reset(true);
          await this.saveWallet();

          // @ts-ignore
          alert('Saito Upgrade: Wallet Version: ' + this.version);
        } else {
          this.app.options.wallet.version = this.version;
          this.app.options.wallet.slips = [];

          this.app.storage.saveOptions();
        }
      } else {
        if (typeof this.app.options.wallet.preferred_crypto != 'undefined') {
          this.preferred_crypto = this.app.options.wallet.preferred_crypto;
        }
        if (this.app.options.wallet.slips) {
          let slips = this.app.options.wallet.slips.map((json: any) => {
            let slip = new WalletSlip();
            slip.copyFrom(json);
            return slip;
          });
          console.log('preserving slips without a wallet reset..... : ' + slips.length);
          await this.addSlips(slips);
        }
      }

      if (!this.app.options.pending_txs) {
        this.app.options.pending_txs = [];
      }
      let pending_txs = this.app.options.pending_txs;
      this.app.options.pending_txs = [];
      for (let i = pending_txs.length - 1, k = 0; i >= 0; i--, k++) {
        try {
          if (pending_txs[i].instance) {
            delete pending_txs[i].instance;
          }
          if (!pending_txs[i].from) {} else {
            let newtx = new Transaction();
            newtx.deserialize_from_web(this.app, JSON.stringify(pending_txs[i]));
            if (newtx.timestamp > new Date().getTime() - 85000000) {
              await this.app.wallet.addTransactionToPending(newtx, false);
            }
          }
        } catch (err) {
          console.log('caught error: ' + JSON.stringify(err));
        }
      }

      this.app.connection.on('wallet-updated', async () => {
        await this.saveWallet();
      });

      this.app.connection.on('keychain-updated', () => {
        this.setKeyList(this.app.keychain.returnWatchedPublicKeys());
      });
    }

    await this.saitoCrypto.initialize(this.app);

    await this.addNFTList();
  }

  constructor(wallet: any) {
    super(wallet);
    this.saitoCrypto = null;
  }

  async resetWallet() {
    await this.reset(false);

    if (this.app.options.blockchain) {
      await this.app.blockchain.resetBlockchain();
    }

    await this.app.storage.clearLocalForage();

    await this.app.storage.resetOptions();

    if (this.app.options.keys) {
      this.app.options.keys = [];
    }

    this.app.options.invites = [];
    this.app.options.games = [];

    if (!this.app.options.wallet) {
      this.app.options.wallet = {};
    }

    this.app.options.wallet.backup_required = false;

    if (!this.app.options.gameprefs) {
      this.app.options.gameprefs = {};
    }

    this.preferred_crypto = 'SAITO';

    await this.saveWallet();
  }

  async saveWallet() {
    if (!this.app.options.wallet) {
      this.app.options.wallet = {};
    }

    this.app.options.wallet.preferred_crypto = this.preferred_crypto;
    this.app.options.wallet.preferred_txs = this.preferred_txs;
    this.app.options.wallet.version = this.version;
    this.app.options.wallet.default_fee = this.default_fee.toString();

    try {
      this.app.options.pending_txs = await this.getPendingTransactions();
      if (!this.app.options.pending_txs) {
        this.app.options.pending_txs = [];
      }
    } catch (err) {
      this.app.options.pending_txs = [];
    }

    let slips = await this.getSlips();
    this.app.options.wallet.slips = slips.map((slip) => slip.toJson());

    await this.save();
    this.app.storage.saveOptions();
  }

  returnBalance() {
    let s = this.returnCryptoModuleByTicker('SAITO');
    return s.returnBalance();
  }

  returnInstalledCryptos(filter = true) {
    const cryptoModules: (typeof CryptoModule)[] =
      this.app.modules.returnModulesBySubType(CryptoModule);
    if (this.saitoCrypto !== null) {
      cryptoModules.push(this.saitoCrypto);
    }

    cryptoModules.sort((a, b) => {
      if (!a.isActivated() && b.isActivated()) {
        return 1;
      }
      if (a.ticker == this.preferred_crypto) {
        return -1;
      }
      if (b.ticker == this.preferred_crypto) {
        return 1;
      }

      return Number(b.returnBalance()) - Number(a.returnBalance());
    });

    if (filter) {
      return cryptoModules.filter((m) => !m.hide_me);
    } else {
      return cryptoModules;
    }
  }

  returnActivatedCryptos() {
    const allMods = this.returnInstalledCryptos();
    const activeMods: (typeof CryptoModule)[] = [];
    for (let i = 0; i < allMods.length; i++) {
      if (allMods[i].isActivated()) {
        activeMods.push(allMods[i]);
      }
    }
    return activeMods;
  }

  returnCryptoModuleByTicker(ticker) {
    const mods = this.returnInstalledCryptos(false);
    for (let i = 0; i < mods.length; i++) {
      if (mods[i].ticker.toUpperCase() === ticker.toUpperCase()) {
        return mods[i];
      }
    }

    throw 'Module Not Found: ' + ticker;
  }

  async setPreferredCrypto(ticker) {
    try {
      let c_mod = this.returnCryptoModuleByTicker(ticker);
      this.preferred_crypto = ticker.toUpperCase();
      console.log('Activating cryptomod: ' + ticker);
      await c_mod.activate();
      await this.saveWallet();
      this.app.connection.emit('saito-header-update-crypto');
      return 1;
    } catch (err) {
      console.error(err);
    }
    return 0;
  }

  returnPreferredCrypto() {
    try {
      return this.returnCryptoModuleByTicker(this.preferred_crypto);
    } catch (err) {
      if (err.startsWith('Module Not Found:')) {
        console.warn(`Preferred crypto (${this.preferred_crypto}) not installed!`);
        this.preferred_crypto = 'SAITO';
        return this.returnCryptoModuleByTicker('SAITO');
      } else {
        throw err;
      }
    }
  }

  returnPreferredCryptoTicker() {
    return this?.preferred_crypto || 'SAITO';
  }

  returnPreferredCryptoAddress() {
    let preferred_crypto = this.returnPreferredCrypto();
    return preferred_crypto.returnAddress();
  }

  returnCryptoAddressByTicker(ticker = 'SAITO') {
    try {
      if (ticker === 'SAITO') {
        return this.publicKey;
      } else {
        const cmod = this.returnCryptoModuleByTicker(ticker);
        if (cmod) {
          return cmod.returnAddress();
        }
        console.log(`Crypto Module (${ticker}) not found`);
      }
    } catch (err) {
      console.error(err);
    }
    return '';
  }

  async returnAvailableCryptosAssociativeArray() {
    console.log('into wallet.returnAvailableCryptosAssociativeArray()');

    let cryptos = {};

    let ticker;
    try {
      let mods = this.returnActivatedCryptos();
      for (let i = 0; i < mods.length; i++) {
        ticker = mods[i].ticker;
        let address = mods[i].formatAddress();
        await mods[i].checkBalance();
        let balance = mods[i].returnBalance();

        if (!cryptos[ticker]) {
          cryptos[ticker] = { address, balance };
        }

        if (parseFloat(balance) > 0) {
          mods[i].save();
        }
      }
    } catch (err) {
      console.error(err);
      console.log(ticker);
    }
    console.log('done wallet.returnAvailableCryptosAssociativeArray()');
    return cryptos;
  }

  saveAvailableCryptosAssociativeArray(publicKey, cryptos) {
    for (let ticker in cryptos) {
      console.log('$$$ SAVE -- ', publicKey, ticker, cryptos[ticker].address);
      this.app.keychain.addCryptoAddress(publicKey, ticker, cryptos[ticker].address);
    }
    this.app.keychain.saveKeys();
  }

  async returnPreferredCryptoBalance() {
    const cryptomod = this.returnPreferredCrypto();
    await cryptomod.checkBalance();
    return cryptomod.returnBalance();
  }

  async sendPayment(
    ticker,
    senders = [],
    receivers = [],
    amounts = [],
    unique_hash = '',
    mycallback: ((response: { err?: string; hash?: string; rtnObj?: any }) => void) | null = null,
    saito_public_key = null
  ) {
    if (senders.length !== 1 || receivers.length !== 1 || amounts.length !== 1) {
      console.error('sendPayment ERROR: Only supports one transaction');
      console.log(senders, receivers, amounts);
      if (mycallback) {
        mycallback({ err: 'Only supports one transaction' });
      }
      return;
    }

    let rtnObj = {};

    if (!this.doesPreferredCryptoTransactionExist(unique_hash)) {
      console.log('preferred crypto transaction does not already exist');
      try {
        const cryptomod = this.returnCryptoModuleByTicker(ticker);
        for (let i = 0; i < senders.length; i++) {
          if (senders[i] === cryptomod.formatAddress()) {
            await this.savePreferredCryptoTransaction(unique_hash);
            try {
              const hash = await cryptomod.sendPayment(amounts[i], receivers[i], unique_hash);
              if (hash === '') {
                this.deletePreferredCryptoTransaction(unique_hash);
              }

              if (saito_public_key) {
                if (ticker !== 'SAITO') {
                  await cryptomod.sendPaymentTransaction(
                    saito_public_key,
                    senders[i],
                    receivers[i],
                    amounts[i],
                    unique_hash
                  );
                }
              }

              if (mycallback) {
                mycallback({ hash: hash });
              }
              return;
            } catch (err) {
              this.deletePreferredCryptoTransaction(unique_hash);
              rtnObj = { err };
            }
          } else {
            console.log(cryptomod.name);
            console.log(senders[i], cryptomod.formatAddress());
            rtnObj = { err: 'wrong address' };
          }
        }
      } catch (err) {
        rtnObj = { err };
      }
    } else {
      rtnObj = { err: 'already sent' };
    }

    console.error('sendPayment ERROR: ', rtnObj);

    if (mycallback) {
      mycallback(rtnObj);
    }
  }

  async sendPayments(
    senders = [],
    receivers = [],
    amounts = [],
    timestamp,
    unique_hash = '',
    mycallback: ((response: { err?: string; hash?: string }) => void) | null = null,
    ticker
  ) {
    console.log('wallet sendPayment 2');
    if (senders.length != receivers.length || senders.length != amounts.length) {
      return;
    }

    if (!this.doesPreferredCryptoTransactionExist(unique_hash)) {
      try {
        const cryptomod = this.returnCryptoModuleByTicker(ticker);
        await this.savePreferredCryptoTransaction(unique_hash);

        let amounts_to_send: bigint[] = [];
        let to_addresses = [];
        for (let i = 0; i < senders.length; i++) {
          amounts_to_send.push(BigInt(amounts[i]));
          to_addresses.push(receivers[i]);
        }
        const hash = await cryptomod.sendPayments(amounts_to_send, to_addresses);
        if (hash === '') {
          this.deletePreferredCryptoTransaction(unique_hash);
        }

        if (mycallback) {
          mycallback({ hash: hash });
        }
        return;
      } catch (err) {
        console.log('sendPayments ERROR: payment failed....\n' + err);
        this.deletePreferredCryptoTransaction(unique_hash);
        if (mycallback) {
          mycallback({ err: err });
        }
        return;
      }
    } else {
      console.log('sendPayment ERROR: already sent');
    }
  }

  async receivePayment(
    ticker,
    senders = [],
    receivers = [],
    amounts = [],
    unique_hash = '',
    mycallback: ((response?: { err?: string }) => void) | null = null,
    saito_public_key = null
  ) {
    if (senders.length !== 1 || receivers.length !== 1 || amounts.length !== 1) {
      console.error('receivePayment ERROR. Only supports one transaction');
      if (mycallback) {
        mycallback({ err: 'Only supports one transaction' });
      }
      return;
    }

    try {
      const cryptomod = this.returnCryptoModuleByTicker(ticker);
      await cryptomod.onIsActivated();
      await cryptomod.saveInboundPayment(unique_hash);

      if (mycallback) {
        mycallback();
      }
    } catch (err) {
      mycallback({ err });
    }
  }

  async savePreferredCryptoTransaction(unique_tx_hash) {
    this.preferred_txs.push({
      sig: unique_tx_hash,
      ts: new Date().getTime()
    });

    for (let i = this.preferred_txs.length - 1; i >= 0; i--) {
      if (this.preferred_txs[i].ts < new Date().getTime() - 100000000) {
        this.preferred_txs.splice(i, 1);
      }
    }

    await this.saveWallet();

    return 1;
  }

  doesPreferredCryptoTransactionExist(unique_tx_hash) {
    for (let i = 0; i < this.preferred_txs.length; i++) {
      if (this.preferred_txs[i].sig === unique_tx_hash) {
        return 1;
      }
    }
    return 0;
  }

  deletePreferredCryptoTransaction(unique_tx_hash) {
    console.log('Deleting preferred crypto transaction');

    for (let i = 0; i < this.preferred_txs.length; i++) {
      if (this.preferred_txs[i].sig === unique_tx_hash) {
        this.preferred_txs.splice(i, 1);
      }
    }
  }

  private async isSlipInPendingTransactions(input: Slip): Promise<boolean> {
    let pending = await this.getPendingTransactions();
    for (let i = 0; i < pending.length; i++) {
      let ptx = pending[i];
      for (let ii = 0; ii < ptx.from.length; ii++) {
        if (input.utxoKey === ptx.from[ii].utxoKey) {
          return true;
        }
      }
    }
    return false;
  }

  async getPendingTransactions() {
    return this.getPendingTxs();
  }

  exportWallet() {
    this.app.options.wallet.ts = Date.now();

    let newObj = JSON.parse(JSON.stringify(this.app.options));

    delete newObj.games;

    return JSON.stringify(newObj, null, 2);
  }

  async backupWallet() {
    try {
      if (this.app.BROWSER == 1) {
        let publicKey = await this.getPublicKey();

        delete this.app.options.wallet.backup_required;
        this.app.connection.emit('saito-header-update-message');

        let pom = document.createElement('a');
        pom.setAttribute('type', 'hidden');
        pom.setAttribute(
          'href',
          'data:application/json;utf-8,' + encodeURIComponent(this.exportWallet())
        );
        pom.setAttribute('download', `saito-wallet-${publicKey}.json`);
        document.body.appendChild(pom);
        pom.click();
        pom.remove();

        await this.saveWallet();
      }
    } catch (err) {
      console.log('Error backing-up wallet: ' + err);
    }
  }

  async signAndEncryptTransaction(tx: Transaction, recipient = '') {
    if (tx == null) {
      return null;
    }

    try {
      let encryptedMessage = '';

      if (this.app.keychain.hasSharedSecret(recipient)) {
        encryptedMessage = this.app.keychain.encryptMessage(recipient, tx.msg);
      }
      else if (this.app.keychain.hasSharedSecret(tx.to[0].publicKey)) {
        encryptedMessage = this.app.keychain.encryptMessage(tx.to[0].publicKey, tx.msg);
      }

      if (encryptedMessage) {
        tx.msg = encryptedMessage;
      }

      tx.data = Buffer.from(JSON.stringify(tx.msg), 'utf-8');
    } catch (err) {
      console.log('####################');
      console.log('### OVERSIZED TX ###');
      console.log('###   -revert-   ###');
      console.log('####################');
      console.log(err);
      tx.msg = {};
    }

    await tx.sign();

    return tx;
  }

  public async fetchBalanceSnapshot(key: string) {
    try {
      console.log('fetching balance snapshot for key : ' + key);
      let response = await fetch('/balance/' + key);
      let data = await response.text();
      let snapshot = BalanceSnapshot.fromString(data);
      if (snapshot) {
        await S.getInstance().updateBalanceFrom(snapshot);
      }
    } catch (error) {
      console.error(error);
    }
  }

  public isValidPublicKey(key: string): boolean {
    if (this.app.crypto.isBase58(key)) {
      return S.getInstance().isValidPublicKey(key);
    } else {
      return false;
    }
  }

  public async addTransactionToPending(tx: Transaction, save = true) {
    if (!this.app.options.pending_txs) {
      this.app.options.pending_txs = [];
    }
    if (save) {
      if (!this.app.options.pending_txs) {
        this.app.options.pending_txs = [];
      }
      this.app.options.pending_txs.push(tx.serialize_to_web(this.app));
    }
    return S.getInstance().addPendingTx(tx);
    if (save) {
      this.app.storage.saveOptions();
    }
  }

  public async onUpgrade(type = '', privatekey = '', decrypted_wallet = null) {
    let publicKey = await this.getPublicKey();

    if (type == 'nuke') {
      await this.resetWallet();
      publicKey = await this.getPublicKey();
    } else if (type == 'import') {
      if (decrypted_wallet != null) {
        try {
          let wobj = JSON.parse(decrypted_wallet);

          await this.reset(false);

          await this.setPublicKey(wobj.wallet.publicKey);
          await this.setPrivateKey(wobj.wallet.privateKey);
          wobj.wallet.version = this.version;
          wobj.wallet.inputs = [];
          wobj.wallet.outputs = [];
          wobj.wallet.spends = [];
          wobj.games = [];
          this.app.options = wobj;
        } catch (err) {
          console.error(err);
          return err;
        }

        publicKey = await this.getPublicKey();
      } else if (privatekey != '') {
        try {
          publicKey = this.app.crypto.generatePublicKey(privatekey);
          await this.setPublicKey(publicKey);
          await this.setPrivateKey(privatekey);
          this.app.options.wallet.version = this.version;
          this.app.options.wallet.inputs = [];
          this.app.options.wallet.outputs = [];
          this.app.options.wallet.spends = [];
          this.app.options.wallet.pending = [];

          await this.app.storage.resetOptionsFromKey(publicKey);
        } catch (err) {
          console.error(err);
          return err;
        }
      } else {
        console.error('Cannot import a wallet without a private key or json file!');
      }
    } else if (type == 'upgrade') {
      this.app.options.wallet.slips = [];
    }

    await this.app.modules.onUpgrade(type, privatekey, decrypted_wallet);

    await this.app.blockchain.resetBlockchain();

    await this.fetchBalanceSnapshot(publicKey);

    console.log(JSON.parse(JSON.stringify(this.app.options.wallet)));
    await this.saveWallet();
    return true;
  }

  public convertSaitoToNolan(amount = '0.0') {
    let nolan = 0;
    let num = Decimal(amount);
    if (Number(amount) > 0) {
      nolan = Number(num.times(this.nolan_per_saito).toFixed(0));
    }

    return BigInt(nolan);
  }

  public convertNolanToSaito(amount = BigInt(0)) {
    let string = '0.00';
    let num = 0;
    let bigint_divider = 100000000n;

    if (typeof amount == 'bigint') {
      num = Number((amount * 100000000n) / bigint_divider) / 100000000;
      string = num.toString();
    } else {
      console.error(`convertNolanToSaito: Type ` + typeof amount + ` provided. BigInt required`);
    }

    return string;
  }

  public async setKeyList(keylist: string[]): Promise<void> {
    return await this.instance.set_key_list(keylist);
  }

  public async disableProducingBlocksByTimer() {
    return S.getInstance().disableProducingBlocksByTimer();
  }

  public async produceBlockWithGt() {
    return S.getInstance().produceBlockWithGt();
  }

  public async produceBlockWithoutGt() {
    return S.getInstance().produceBlockWithoutGt();
  }

  async saveNFTList(nft_list) {
    if (!Array.isArray(nft_list)) {
      throw new Error('saveNFTList expects an array of NFTs');
    }

    this.app.options.wallet.nfts = nft_list;

    await this.saveWallet();
  }

  async addNFTList() {
    if (!this.app.options.wallet.nfts) {
      this.app.options.wallet.nfts = [];
    }
    let nfts = this.app.options.wallet.nfts;

    if (nfts.length > 0) {
      for (let i = 0; i < nfts.length; i++) {
        let nft = nfts[i];

        let slip1_utxokey = nft.slip1.utxo_key;
        let slip2_utxokey = nft.slip2.utxo_key;
        let slip3_utxokey = nft.slip3.utxo_key;
        let id = nft.id;
        let tx_sig = nft.tx_sig;

        this.addNft(slip1_utxokey, slip2_utxokey, slip3_utxokey, id, tx_sig);
      }
    }
  }

  async updateNFTList(): Promise<{
    updated: any[];
    rebroadcast: any[];
    persisted: boolean;
  }> {
    const raw = await this.app.wallet.getNFTList();
    const nfts: Array<{
      id: string;
      slip1: any;
      slip2: any;
      slip3: any;
      tx_sig: string;
    }> = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const local = (this.app.options.wallet.nfts as typeof nfts) ?? [];

    const intents: Record<string, number> = (this.app.options.wallet.nftMergeIntents ||=
      {} as Record<string, number>);
    let intentsMutated = false;

    const groupByKey = (arr: typeof nfts) => {
      const g: Record<string, typeof nfts> = Object.create(null);
      for (const it of arr) {
        if (!it || typeof it.id !== 'string') continue;
        (g[it.id] ??= []).push(it);
      }
      return g;
    };

    const stripSlipLike = (it: any) => {
      const { slip1, slip2, slip3, tx_sig, ...rest } = it ?? {};
      return rest;
    };
    const signature = (it: any) => JSON.stringify(stripSlipLike(it));

    const isSlipOnlyChange = (A: any[], B: any[]) => {
      const countMap = (arr: any[]) => {
        const m = new Map<string, number>();
        for (const it of arr) {
          const s = signature(it);
          m.set(s, (m.get(s) ?? 0) + 1);
        }
        return m;
      };
      const mA = countMap(A);
      const mB = countMap(B);
      const allKeys = new Set([...mA.keys(), ...mB.keys()]);
      for (const k of allKeys) {
        if ((mA.get(k) ?? 0) !== (mB.get(k) ?? 0)) return false;
      }
      return true;
    };

    const amt = (x: any): bigint => {
      const a = x?.slip2?.amount ?? 0;
      return BigInt(typeof a === 'string' ? a : Number(a));
    };

    const hasUserMergeIntent = (id: string) => {
      const ts = intents[id];
      const TTL = 2 * 60_000;
      return !!ts && Date.now() - ts <= TTL;
    };

    const clearMergeIntent = (id: string) => {
      if (id in intents) {
        delete intents[id];
        intentsMutated = true;
      }
    };

    const L = groupByKey(local);
    const C = groupByKey(nfts);
    const keys = new Set([...Object.keys(L), ...Object.keys(C)]);

    const updated: any[] = [];
    const rebroadcast: any[] = [];

    for (const k of keys) {
      const l = L[k] ?? [];
      const c = C[k] ?? [];

      if (l.length !== c.length) {
        if (l.length > 1 && c.length === 1) {
          const sumLocal = l.reduce((s, it) => s + amt(it), 0n);
          const curAmt = amt(c[0]);

          if (sumLocal === curAmt) {
            if (hasUserMergeIntent(k)) {
              updated.push(...c);
            } else {
              rebroadcast.push(...c);
            }
            clearMergeIntent(k);
            continue;
          }
        }

        updated.push(...c);
        continue;
      }

      if (c.length === 0) continue;

      if (isSlipOnlyChange(l, c)) {
        rebroadcast.push(...c);
      } else {
        updated.push(...c);
      }
    }

    const hasChanges = updated.length;
    let persisted = false;
    this.app.options.wallet.nfts = nfts;
    await this.app.wallet.saveNFTList(nfts);

    if (hasChanges > 0) {
      this.app.options.wallet.nftMergeIntents = intents;
      persisted = true;
    }

    return { updated, rebroadcast, persisted };
  }

  public async createMintNFTTransaction(
    num,
    deposit,
    tx_msg,
    fee,
    receipient_publicKey,
    nft_type
  ): Promise<Transaction> {
    return S.getInstance().createBoundTransaction(
      num,
      deposit,
      tx_msg,
      fee,
      receipient_publicKey,
      nft_type
    );
  }

  public async createSendNFTTransaction(nft, receipient_publicKey) {
    await nft.fetchTransaction();

    return S.getInstance().createSendBoundTransaction(
      BigInt(nft.amount),
      nft.slip1.utxo_key,
      nft.slip2.utxo_key,
      nft.slip3.utxo_key,
      receipient_publicKey,
      nft.txmsg
    );
  }

  public async createSplitNFTTransaction(nft, leftCount, rightCount): Promise<Transaction> {
    await nft.fetchTransaction();

    return S.getInstance().createSplitBoundTransaction(
      nft.slip1.utxo_key,
      nft.slip2.utxo_key,
      nft.slip3.utxo_key,
      leftCount,
      rightCount,
      nft.txmsg
    );
  }

  public async createMergeNFTTransaction(nft): Promise<Transaction> {
    await nft.fetchTransaction();

    return S.getInstance().createMergeBoundTransaction(nft.id, nft.txmsg);
  }

  public async createRemoveNFTTransaction(nft) {
    return S.getInstance().createRemoveBoundTransaction(
      nft.slip1.utxo_key,
      nft.slip2.utxo_key,
      nft.slip3.utxo_key,
      nft.txmsg
    );
  }

  public async loadNFTs() {
    console.log('LOAD NFTs');
    try {
      if (this.app.options.wallet.nfts) {
        for (let z = 0; z < this.app.options.wallet.nfts.length; z++) {
          let nft_sig = this.app.options?.wallet?.nfts[z]?.tx_sig;
          console.log('Extracting NFT type...');
          console.log(this.app.options.wallet.nfts[z].slip3?.utxo_key);
          let nft_type = this.extractNFTType(this.app.options?.wallet?.nfts[z]?.slip3.utxo_key);
          console.log(nft_type);

          if (this.app.options?.permissions?.nfts) {
            if (this.app.options.permissions.nfts.includes(nft_sig)) {
              this.app.storage.loadTransactions(
                { sig: nft_sig },
                async (txs) => {
                  for (let zz = 0; zz < txs.length; zz++) {
                    let txmsg = txs[zz].returnMessage();

                    if (txmsg.data?.js) {
                      try {
                        let fn = new Function(`return (async () => { ${txmsg.data.js} })()`);
                        await fn.call(this);
                      } catch (err) {
                        console.error(
                          `NFT module execution failed [${txmsg.sig || 'unknown'}]:`,
                          err
                        );
                      }
                    }
                    if (txmsg.data?.css) {
                      const style = document.createElement('style');
                      style.textContent = txmsg.data.css;
                      document.head.appendChild(style);
                    }
                  }
                },
                'localhost'
              );
            }
          }
        }
      }
    } catch (err) {
      console.log('Error: load nfts');
    }
  }

  public async onNewBoundTransaction(tx: Transaction, save = true) {
    try {
      console.log('saving new nft...');
      if (tx.isTo(this.app.wallet.publicKey)) {
        console.log('yeah, it is for me!');
        let nft_list = this.app.options.wallet.nfts || [];
        let nft_id = '';
        nft_list.forEach(function (nft) {
          if (nft.tx_sig == tx.signature) {
            nft_id = nft.id;
          }
        });
        tx.packData();
        console.log('saving nft transaction: ' + nft_id);
        this.app.storage.saveTransaction(tx, { field4: nft_id, preserve: 1 }, 'localhost');
      }
    } catch (err) {
      console.error('Error while saving NFT tx to archive in wallet.ts: ', err);
    }
  }

  public extractNFTType(hex = '') {
    if (!hex || hex.length < 66 || !/^[0-9a-fA-F]+$/.test(hex)) { return ''; }
    hex = hex.slice(0, 66);
    const bytes = new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
    if (bytes.length !== 33) { return ''; }
    const typeBytes = bytes.slice(17);
    const decoder = new TextDecoder();
    const text = decoder.decode(typeBytes).replace(/\x00+$/, '');
    return text;
  }
}
