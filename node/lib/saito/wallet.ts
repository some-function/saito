import Decimal from "decimal.js";
import JSON from "json-bigint";
import BalanceSnapshot from "saito-js/lib/balance_snapshot";
import SaitoWallet, {WalletSlip} from "saito-js/lib/wallet";
import S from "saito-js/saito";
import {App} from "./app";
import Transaction from "./transaction";


interface PreferredTx {
  sig: string;
  ts: number;
}

export default class Wallet extends SaitoWallet {
  public app: App;

  publicKey;
  preferredTxs: PreferredTx[] = [];
  defaultFee = BigInt(0);
  version = 5.677;
  nolanPerSaito = 100000000;

  public async createUnsignedTransaction(publicKey="", amount=BigInt(0), fee=BigInt(0), force_merge=false): Promise<Transaction> {
    if (publicKey == "") {
      publicKey = await this.getPublicKey();
    }
    return S.getInstance().createTransaction(publicKey, amount, fee, force_merge);
  }

  public async getBalance(ticker = "SAITO"): Promise<bigint> {
    if (ticker === "SAITO") {
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
    console.log("Initialize Wallet -- ", publicKey);

    const storedFee = this.app.options.wallet.defaultFee;
    this.defaultFee = storedFee ? BigInt(storedFee) : BigInt(0);

    if (this.app.options.wallet != null) {
      if (this.app.options.wallet.version < this.version) {
        if (this.app.BROWSER == 1) {
          console.log("upgrading wallet version to : " + this.version);
          
          const tmpprivkey = (this.app.options.wallet.privatekey) ? this.app.options.wallet.privatekey : this.app.options.wallet.privateKey;
          const tmppubkey  = (this.app.options.waller.publickey ) ? this.app.options.wallet.publickey  : this.app.options.wallet.publicKey;

          const keys = this.app.options.keys;
          const chats = this.app.options.chat;

          const theme = this.app.options.theme;

          const modtools = this.app.options.modtools;

          await this.setPrivateKey(tmpprivkey);
          await this.setPublicKey(tmppubkey);

          await this.onUpgrade("upgrade");

          await this.setPrivateKey(tmpprivkey);
          await this.setPublicKey(tmppubkey);

          this.app.options.wallet.version = this.version;
          this.app.options.wallet.defaultFee = this.defaultFee.toString();
          this.app.options.wallet.slips = [];

          this.app.options.keys = keys;
          this.app.options.chat = chats;

          this.app.options.theme = theme;

          this.app.options.modtools = modtools;

          await this.reset(true);
          await this.saveWallet();

          // @ts-ignore
          alert("Saito Upgrade: Wallet Version: " + this.version);
        } else {
          this.app.options.wallet.version = this.version;
          this.app.options.wallet.slips = [];

          this.app.storage.saveOptions();
        }
      } else {
        if (this.app.options.wallet.slips) {
          const slips = this.app.options.wallet.slips.map((json: any) => {
            const slip = new WalletSlip();
            slip.copyFrom(json);
            return slip;
          });
          console.log("preserving slips without a wallet reset..... : " + slips.length);
          await this.addSlips(slips);
        }
      }

      if (!this.app.options.pendingTxs) {
        this.app.options.pendingTxs = [];
      }
      const pendingTxs = this.app.options.pendingTxs;
      this.app.options.pendingTxs = [];
      for (let i = pendingTxs.length - 1, k = 0; i >= 0; i--, k++) {
        try {
          if (pendingTxs[i].instance) {
            delete pendingTxs[i].instance;
          }
          if (!pendingTxs[i].from) {} else {
            let newtx = new Transaction();
            newtx.deserialize_from_web(this.app, JSON.stringify(pendingTxs[i]));
            if (newtx.timestamp > new Date().getTime() - 85000000) {
              await this.app.wallet.addTransactionToPending(newtx, false);
            }
          }
        } catch (err) {
          console.log("caught error: " + JSON.stringify(err));
        }
      }

      this.app.connection.on("wallet-updated", async () => { await this.saveWallet(); });
    }
  }

  constructor(wallet: any) {
    super(wallet);
  }

  async resetWallet() {
    await this.reset(false);
    if (this.app.options.blockchain) await this.app.blockchain.resetBlockchain();
    await this.app.storage.clearLocalForage();
    await this.app.storage.resetOptions();
    if (this.app.options.keys) this.app.options.keys = [];
    this.app.options.invites = [];
    if (!this.app.options.wallet) this.app.options.wallet = {};
    this.app.options.wallet.backup_required = false;
    await this.saveWallet();
  }

  async saveWallet() {
    if (!this.app.options.wallet) {
      this.app.options.wallet = {};
    }
    this.app.options.wallet.preferredTxs = this.preferredTxs;
    this.app.options.wallet.version = this.version;
    this.app.options.wallet.defaultFee = this.defaultFee.toString();

    try {
      this.app.options.pendingTxs = await this.getPendingTransactions();
      if (!this.app.options.pendingTxs) {
        this.app.options.pendingTxs = [];
      }
    } catch (err) {
      this.app.options.pendingTxs = [];
    }

    const slips = await this.getSlips();
    this.app.options.wallet.slips = slips.map((slip) => slip.toJson());

    await this.save();
    this.app.storage.saveOptions();
  }

  async getPendingTransactions() {
    return this.getPendingTxs();
  }

  exportWallet() {
    this.app.options.wallet.ts = Date.now();
    return JSON.stringify(JSON.parse(JSON.stringify(this.app.options)), null, 2);
  }

  async backupWallet() {
    try {
      if (this.app.BROWSER == 1) {
        delete this.app.options.wallet.backup_required;

        const pom = document.createElement("a");
        pom.setAttribute("type", "hidden");
        pom.setAttribute("href", "data:application/json;utf-8," + encodeURIComponent(this.exportWallet()));
        pom.setAttribute("download", `saito-wallet-${await this.getPublicKey()}.json`);
        document.body.appendChild(pom);
        pom.click();
        pom.remove();

        await this.saveWallet();
      }
    } catch (err) {
      console.log("Error backing-up wallet: " + err);
    }
  }

  public async fetchBalanceSnapshot(key: string) {
    try {
      console.log("fetching balance snapshot for key : " + key);
      const response = await fetch("/balance/" + key);
      const snapshot = BalanceSnapshot.fromString(await response.text());
      if (snapshot) {
        await S.getInstance().updateBalanceFrom(snapshot);
      }
    } catch (error) {
      console.error(error);
    }
  }

  public isValidPublicKey(key:string): boolean {
    return this.app.crypto.isBase58(key) && S.getInstance().isValidPublicKey(key);
  }

  public async addTransactionToPending(tx:Transaction, save=true) {
    if (!this.app.options.pendingTxs) this.app.options.pendingTxs = [];
    if (save) {
      if (!this.app.options.pendingTxs) this.app.options.pendingTxs = [];
      this.app.options.pendingTxs.push(tx.serialize_to_web(this.app));
    }
    return S.getInstance().addPendingTx(tx);
  }

  public async onUpgrade(type="", privatekey="", decryptedWallet=null) {
    let publicKey = await this.getPublicKey();

    if (type == "nuke") {
      await this.resetWallet();
      publicKey = await this.getPublicKey();
    } else if (type == "import") {
      if (decryptedWallet != null) {
        try {
          const wobj = JSON.parse(decryptedWallet);

          await this.reset(false);

          await this.setPublicKey(wobj.wallet.publicKey);
          await this.setPrivateKey(wobj.wallet.privateKey);
          wobj.wallet.version = this.version;
          wobj.wallet.inputs = [];
          wobj.wallet.outputs = [];
          wobj.wallet.spends = [];
          this.app.options = wobj;
        } catch (err) {
          console.error(err);
          return err;
        }

        publicKey = await this.getPublicKey();
      } else if (privatekey != "") {
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
        console.error("Cannot import a wallet without a private key or json file!");
      }
    } else if (type == "upgrade") {
      this.app.options.wallet.slips = [];
    }

    await this.app.modManager.onUpgrade(type, privatekey, decryptedWallet);
    await this.app.blockchain.resetBlockchain();
    await this.fetchBalanceSnapshot(publicKey);

    console.log(JSON.parse(JSON.stringify(this.app.options.wallet)));
    await this.saveWallet();
    return true;
  }

  public convertSaitoToNolan(amount="0.0") {
    return BigInt((Number(amount) > 0) ? Number(Decimal(amount).times(this.nolanPerSaito).toFixed(0)) : 0);
  }

  public convertNolanToSaito(amount=BigInt(0)) {
    if (typeof amount === "bigint") {
      return (Number(amount) / 100000000).toString();
    } else {
      console.error(`convertNolanToSaito: Type ${typeof amount} provided. BigInt required`);
      return "0.00";
    }
  }

  public async setKeyList(keylist:string[]): Promise<void> {
    return await this.instance.set_key_list(keylist);
  }
}