import Decimal from 'decimal.js';
import JSON from 'json-bigint';
import BalanceSnapshot from 'saito-js/lib/balance_snapshot';
import SaitoWallet, {WalletSlip} from 'saito-js/lib/wallet';
import S from 'saito-js/saito';
import {App} from './app';
import Transaction from './transaction';


interface PreferredTx {
  sig: string;
  ts: number;
}

export default class Wallet extends SaitoWallet {
  public app: App;

  publicKey;
  preferred_crypto = 'SAITO';
  preferred_txs: PreferredTx[] = [];
  default_fee = BigInt(0);
  version = 5.677;
  nolan_per_saito = 100000000;

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
  }

  constructor(wallet: any) {
    super(wallet);
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

        let pom = document.createElement('a');
        pom.setAttribute('type', 'hidden');
        pom.setAttribute('href', 'data:application/json;utf-8,' + encodeURIComponent(this.exportWallet()));
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
}