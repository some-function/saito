import * as JSON from "json-bigint";
import Slip from "./slip";
import {App} from "./app";
import {TransactionType} from "saito-js/lib/transaction";
import {SlipType} from "saito-js/lib/slip";
import SaitoTransaction from "saito-js/lib/transaction";


export const TRANSACTION_SIZE = 93;
export const SLIP_SIZE = 67;
export const HOP_SIZE = 130;

export default class Transaction extends SaitoTransaction {
  public optional: any;

  constructor(data?:any, jsonobj=null) {
    super(data);

    this.optional = {};
    if (this.timestamp === 0) {
      this.timestamp = new Date().getTime();
    }
    try {
      if (jsonobj != null) {
        for (let i = 0; i < jsonobj.from.length; i++) {
          const fslip = jsonobj.from[i];

          const slip = new Slip();
          slip.publicKey = fslip.publicKey;
          slip.amount = BigInt(fslip.amount);
          slip.type = fslip.type as SlipType;
          slip.index = fslip.index;
          slip.blockId = BigInt(fslip.blockId);
          slip.txOrdinal = BigInt(fslip.txOrdinal);

          this.addFromSlip(slip);
        }

        for (let i = 0; i < jsonobj.to.length; i++) {
          const fslip = jsonobj.to[i];
          const slip = new Slip();
          slip.publicKey = fslip.publicKey;
          slip.amount = BigInt(fslip.amount);
          slip.type = fslip.type as SlipType;
          slip.index = fslip.index;
          slip.blockId = BigInt(fslip.blockId);
          slip.txOrdinal = BigInt(fslip.txOrdinal);
          this.addToSlip(slip);
        }

        if (jsonobj.timestamp)        this.timestamp = jsonobj.timestamp;
        if (jsonobj.signature)        this.signature = jsonobj.signature;
        if (jsonobj.txs_replacements) this.txs_replacements = jsonobj.txs_replacements;
        if (jsonobj.type)             this.type = jsonobj.type;
        if (jsonobj.buffer)           this.data = new Uint8Array(Buffer.from(jsonobj.buffer, "base64"));
      }
    } catch (error) {
      console.error(error);
    }

    this.unpackData();

    return this;
  }

  async decryptMessage(app: App) {
    if (!app) {
      return;
    }

    const myPublicKey = await app.wallet.getPublicKey();
    const parsedMessage = this.returnMessage();

    if (!app.crypto.isAesEncrypted(parsedMessage)) {
      return;
    }

    if (!parsedMessage) {
      return;
    }

    const addresses = [];
    for (let i = 0; i < this.from.length; i++) {
      if (!addresses.includes(this.from[i].publicKey)) {
        addresses.push(this.from[i].publicKey);
      }
    }
    for (let i = 0; i < this.to.length; i++) {
      if (!addresses.includes(this.to[i].publicKey)) {
        addresses.push(this.to[i].publicKey);
      }
    }

    if (!addresses.includes(myPublicKey)) {
      return;
    }

    if (addresses.length !== 2) {
      console.warn("Attempting to decrypt multiparty message: ", addresses);
    }
  }

  returnMessage() {
    if (!!this.msg && Object.keys(this.msg).length > 0) {
      return this.msg;
    }

    try {
      if (this.data && this.data.byteLength > 0) {
        const reconstruct = Buffer.from(this.data).toString("utf-8");
        this.msg = JSON.parse(reconstruct);
      } else {
        this.msg = {};
      }
    } catch (err) {
      try {
        const reconstruct = Buffer.from(this.data).toString("utf-8");
        this.msg = JSON.parse(reconstruct);
      } catch (err) {}
    }

    return this.msg;
  }

  addFrom(publicKey: string) {
    console.assert(!!this.from, "from field not found : ", this);
    for (const s of this.from) {
      if (s.publicKey === publicKey) {
        return;
      }
    }

    const slip = new Slip();
    slip.publicKey = publicKey;
    this.addFromSlip(slip);
  }

  serialize_to_web(app) {
    const newtx = new Transaction(undefined, this.toJson());
    newtx.data = Buffer.alloc(0);
    const opt = app.crypto.stringToBase64(JSON.stringify(this.optional));
    return JSON.stringify({t: newtx.serialize_to_base64(), m: Buffer.from(newtx.data).toString("base64"), opt: opt});
  }

  deserialize_from_web(app: App, webstring: string) {
    try {
      let web_obj: {t: string; m: string; opt: string} = JSON.parse(webstring);
      this.deserialize_from_base64(web_obj.t);
      this.data = Buffer.from(web_obj.m, "base64");
      this.unpackData();
      this.optional = JSON.parse(app.crypto.base64ToString(web_obj.opt));
    } catch (err) {
      console.error("failed deserializing from buffer : ", webstring);
      console.error(err);
    }
  }

  serialize_to_base64(): string {
    return Buffer.from(this.serialize()).toString("base64");
  }

  deserialize_from_base64(base64string: string) {
    this.deserialize(Buffer.from(base64string, "base64"));
  }
}