import * as JSON from 'json-bigint';
import Identicon from 'identicon.js';
import {App} from './app';


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
      this.addKey({ publicKey: this.publicKey, watched: true });
    }

    let events = this.returnKeys({ type: 'scheduled_call' });
    for (let e of events) {
      this.removeKey(e.publicKey);
    }

    events = this.returnKeys({ type: 'event' });
    let now = Date.now();
    for (let e of events) {
      let scheduledTime = new Date(e.startTime).getTime();
      if (scheduledTime + 24 * 60 * 60 * 1000 < now) {
        console.log('Event Over:', e);
        this.removeKey(e.publicKey);
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

    let data = { publicKey: '' };

    if (typeof pa === 'string') {
      data.publicKey = pa;
      for (let key in da) {
        if (key !== 'publicKey') {
          data[key] = da[key];
        }
      }
    } else {
      data = pa;
    }

    if (!data?.publicKey) {
      console.warn('Keychain Error: cannot add key because unknown publicKey');
      console.log(data);
      return;
    }

    for (let i = 0; i < this.keys.length; i++) {
      if (this.keys[i].publicKey === data.publicKey) {
        for (let key in data) {
          if (key !== 'publicKey') {
            this.keys[i][key] = data[key];
          }
        }
        this.saveKeys();
        return;
      }
    }

    let newkey = { publicKey: '' };
    newkey.publicKey = data.publicKey;
    for (let key in data) {
      if (key !== 'publicKey') {
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
          console.warn('Failed decryption with aes_secret');
          return null;
        }

        try {
          const decrypted_msg = JSON.parse(tmpmsg);
          return decrypted_msg;
        } catch (err) {
          console.error('Failed to JSON.parse decrypted message', err);
          this.app.connection.emit('encrypt-decryption-failed', publicKey);
          return null;
        }
      }
    }

    if (this.app.BROWSER) {
      console.warn("I don't share a decryption key with encrypter, cannot decrypt");
      this.app.connection.emit('encrypt-decryption-failed', publicKey);
    }
    return null;
  }

  encryptMessage(publicKey: string, msg) {
    for (let x = 0; x < this.keys.length; x++) {
      if (this.keys[x].publicKey === publicKey) {
        if (this.keys[x].aes_secret) {
          const jsonmsg = JSON.stringify(msg);
          return this.app.crypto.aesEncrypt(jsonmsg, this.keys[x].aes_secret);
        }
      }
    }
    console.warn('Message not encrypted, missing key');
    return msg;
  }

  hasSharedSecret(publicKey: string) {
    for (let x = 0; x < this.keys.length; x++) {
      if (this.keys[x].publicKey === publicKey || this.keys[x].identifier === publicKey) {
        if (this.keys[x].aes_secret) {
          return true;
        }
      }
    }
    return false;
  }

  removeKey(publicKey = null) {
    if (publicKey == null) {
      return;
    }
    for (let x = this.keys.length - 1; x >= 0; x--) {
      if (this.keys[x].publicKey == publicKey) {
        this.keys.splice(x, 1);
        delete this.publickey_keys_hmap[publicKey];
        this.saveKeys();
        return;
      }
    }
  }

  returnKey(data = null, force_local_keychain = false) {
    if (typeof data === 'string') {
      let d = { publicKey: '' };
      d.publicKey = data;
      data = d;
    }

    let key_idx = -1;
    for (let x = 0; x < this.keys.length; x++) {
      let match = true;
      for (let key in data) {
        if (this.keys[x][key] !== data[key]) {
          match = false;
        }
      }
      if (match) {
        key_idx = x;
        break;
      }
    }

    let return_key = key_idx != -1 ? this.keys[key_idx] : null;

    if (force_local_keychain) {
      return return_key;
    }

    this.app.modManager.getRespondTos('saito-return-key').forEach((modResponse) => {
      let key = modResponse.returnKey(data);
      if (key) {
        if (return_key) {
          return_key = Object.assign(return_key, key);
        } else {
          return_key = key;
        }
      }
    });

    return return_key;
  }

  returnKeys(data = null, force_local_keychain = true) {
    const kx = [];

    if (data == null) {
      for (let x = 0; x < this.keys.length; x++) {
        if (this.keys[x].publicKey != this.publicKey) {
          kx.push(this.keys[x]);
        }
      }
    } else {
      for (let x = 0; x < this.keys.length; x++) {
        let match = true;
        for (let key in data) {
          if (this.keys[x][key] !== data[key]) {
            match = false;
          }
        }
        if (match == true) {
          kx.push(this.keys[x]);
        }
      }
    }

    if (!force_local_keychain) {
      this.app.modManager.getRespondTos('saito-return-key').forEach((modResponse) => {
        for (let key of modResponse.returnKeys()) {
          let can_add = true;

          if (key.publicKey == this.publicKey) {
            continue;
          }

          for (let added_keys of kx) {
            if (added_keys.publicKey == key.publicKey) {
              can_add = false;
              break;
            }
          }

          if (can_add) {
            kx.push(key);
          }
        }
      });
    }

    return kx;
  }

  saveKeys() {
    this.app.options.keys = [...this.keys];
    this.app.storage.saveOptions();
    let new_hash = this.returnHash();
    if (new_hash != this.hash) {
      this.hash = new_hash;
      this.app.connection.emit('keychain-updated');
    }
  }

  saveGroups() {
    this.app.options.groups = this.groups;
    this.app.storage.saveOptions();
    if (this.returnHash() != this.hash) {
      this.hash = this.returnHash();
      this.app.connection.emit('keychain-updated');
    }
  }

  returnIdenticon(publicKey: string, img_format = 'svg') {
    if (this.keys != undefined) {
      for (let x = 0; x < this.keys.length; x++) {
        if (this.keys[x].publicKey === publicKey) {
          if (this.keys[x].identicon != '' && typeof this.keys[x].identicon !== 'undefined') {
            return this.keys[x].identicon;
          }
        }
      }
    }

    const options = {
      saturation: 0.6,
      brightness: 0.4,
      margin: 0.0,
      size: 420,
      format: img_format
    };
    const data = new Identicon(this.app.crypto.hash(publicKey), options).toString();
    return 'data:image/' + img_format + '+xml;base64,' + data;
  }

  returnIdenticonColor(publicKey) {
    const hue = parseInt(this.app.crypto.hash(publicKey).substr(-7), 16) / 0xfffffff;
    const saturation = 0.6;
    const brightness = 0.4;
    const values = this.hsl2rgb(hue, saturation, brightness).map(Math.round);
    const toHex = (c) => ('0' + c.toString(16)).slice(-2);
    return '#' + toHex(values[0]) + toHex(values[1]) + toHex(values[2]);
  }

  hsl2rgb(h, s, b) {
    h *= 6;
    s = [
      (b += s *= b < 0.5 ? b : 1 - b),
      b - (h % 1) * s * 2,
      (b -= s *= 2),
      b,
      b + (h % 1) * s,
      b + s
    ];

    return [
      s[~~h % 6] * 255,
      s[(h | 16) % 6] * 255,
      s[(h | 8) % 6] * 255
    ];
  }

  returnIdentifierByPublicKey(publicKey: string, returnKey = false): string {
    let key = this.returnKey({ publicKey: publicKey });
    if (key) {
      if (key.identifier) {
        return key.identifier;
      }
    }

    if (returnKey) {
      return publicKey;
    } else {
      return '';
    }
  }

  returnUsername(publicKey: string = '', max = 12): string {
    const name = this.returnIdentifierByPublicKey(publicKey, true);
    if (name != publicKey && name != '') {
      return name;
    }
    if (name === publicKey) {
      if (name.length > max) {
        return 'Anon-' + name.substring(0, 6);
      }
    }
    return publicKey;
  }

  returnWatchedPublicKeys() {
    const x = [];
    for (let i = 0; i < this.keys.length; i++) {
      if (this.keys[i].watched) {
        x.push(this.keys[i].publicKey);
      }
    }
    return x;
  }
}

export default Keychain;