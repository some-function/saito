import * as JSON from "json-bigint";
import Identicon from "identicon.js";
import {App} from "./app";


class Keychain {
  public app: App;
  public publickey_keys_hmap: any;
  public keys: Array<any>;
  public groups: any;
  public fetched_keys: Map<string, number>;
  public publicKey: string;
  public identifier: string;
  public bid: bigint;
  public bsh: string;
  public lc: boolean;
  public hash: string;
  public naming_func: any;

  constructor(app: App) {
    this.app = app;
    this.publickey_keys_hmap = {};
    this.keys = [];
    this.groups = [];
    this.naming_func = null;
    this.fetched_keys = new Map<string, number>();
  }

  async initialize() {
    if (this.app.options.keys == null) {
      this.app.options.keys = [];
    }

    this.publicKey = await this.app.wallet.getPublicKey();

    for (let i = 0; i < this.app.options.keys.length; i++) {
      if (this.app.options.keys[i].publickey && !this.app.options.keys[i].publicKey) {
        this.app.options.keys[i].publicKey = this.app.options.keys[i].publickey;
        delete this.app.options.keys[i].publickey;
      }
      this.keys.push(this.app.options.keys[i]);
      this.publickey_keys_hmap[this.app.options.keys[i].publicKey] = 1;
    }

    if (this.app.options.groups == null) {
      this.app.options.groups = [];
    } else {
      this.groups = this.app.options.groups;
    }

    if (this.app.options.keys.length == 0) {
      this.addKey({publicKey: this.publicKey, watched: true});
    }

    let events = this.returnKeys({type: "scheduled_call"});
    for (const event of events) {
      this.removeKey(event.publicKey);
    }

    events = this.returnKeys({type: "event"});
    const now = Date.now();
    for (const event of events) {
      const scheduledTime = new Date(event.startTime).getTime();
      if (scheduledTime + 24 * 60 * 60 * 1000 < now) {
        console.log("Event Over:", event);
        this.removeKey(event.publicKey);
      }
    }

    this.saveKeys();

    this.hash = this.returnHash();
  }

  returnHash() {
    return this.app.crypto.hash(JSON.stringify(this.keys) + JSON.stringify(this.groups));
  }

  addKey(pa = null, da = null) {
    if (pa === null) {
      return;
    }

    let data = {publicKey: ""};

    if (typeof pa === "string") {
      data.publicKey = pa;
      for (const key in da) {
        if (key !== "publicKey") {
          data[key] = da[key];
        }
      }
    } else {
      data = pa;
    }

    if (!data?.publicKey) {
      console.warn("Keychain Error: cannot add key because unknown publicKey");
      console.log(data);
      return;
    }

    for (let i = 0; i < this.keys.length; i++) {
      if (this.keys[i].publicKey === data.publicKey) {
        for (let key in data) {
          if (key !== "publicKey") {
            this.keys[i][key] = data[key];
          }
        }
        this.saveKeys();
        return;
      }
    }

    const newkey = {publicKey: data.publicKey};
    for (const key in data) {
      if (key !== "publicKey") {
        newkey[key] = data[key];
      }
    }
    this.keys.push(newkey);
    this.publickey_keys_hmap[newkey.publicKey] = 1;
    this.saveKeys();
  }

  decryptMessage(publicKey: string, encrypted_msg) {
    for (let x = 0; x < this.keys.length; x++) {
      if (this.keys[x].publicKey === publicKey && this.keys[x].aes_secret) {
        const tmpmsg = this.app.crypto.aesDecrypt(encrypted_msg, this.keys[x].aes_secret);

        if (tmpmsg == null) {
          console.warn("Failed decryption with aes_secret");
          return null;
        }

        try {
          return JSON.parse(tmpmsg);
        } catch (err) {
          console.error("Failed to JSON.parse decrypted message", err);
          this.app.connection.emit("encrypt-decryption-failed", publicKey);
          return null;
        }
      }
    }

    if (this.app.BROWSER) {
      console.warn("I don't share a decryption key with encrypter, cannot decrypt");
      this.app.connection.emit("encrypt-decryption-failed", publicKey);
    }
    return null;
  }

  removeKey(publicKey=null) {
    if (publicKey != null) {
      for (let x = this.keys.length - 1; x >= 0; x--) {
        if (this.keys[x].publicKey == publicKey) {
          this.keys.splice(x, 1);
          delete this.publickey_keys_hmap[publicKey];
          this.saveKeys();
          return;
        }
      }
    }
  }

  returnKey(data=null) {
    if (typeof data === "string") {
      data = {publicKey: data};
    }

    let keyIndex = -1;
    for (let x = 0; x < this.keys.length; x++) {
      let match = true;
      for (let key in data) {
        if (this.keys[x][key] !== data[key]) {
          match = false;
        }
      }
      if (match) {
        keyIndex = x;
        break;
      }
    }

    return keyIndex != -1 ? this.keys[keyIndex] : null;
  }

  returnKeys(data=null) {
    return this.keys.filter(
      (data == null) ? (key) => key.publicKey != this.publicKey
                     : (key) => Object.keys(data).every((dataKey) => key[dataKey] === data[dataKey])
    );
  }

  saveKeys() {
    this.app.options.keys = [...this.keys];
    this.app.storage.saveOptions();
    let new_hash = this.returnHash();
    if (new_hash != this.hash) {
      this.hash = new_hash;
      this.app.connection.emit("keychain-updated");
    }
  }

  returnWatchedPublicKeys() {
    return this.keys.filter((key) => key.watched).map((key) => key.publicKey);
  }
}

export default Keychain;