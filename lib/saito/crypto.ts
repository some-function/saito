import Saito from "saito-js/saito";
import node_cryptojs from "node-cryptojs-aes";
import crypto from "crypto-browserify";
import * as Base58 from "base-58";
import secp256k1 from "secp256k1";
const bip39 = require("bip39");

const CryptoJS = node_cryptojs.CryptoJS;
const JsonFormatter = node_cryptojs.JsonFormatter;

export default class Crypto {
  public hash(buffer: Uint8Array | string): string {
    if (typeof buffer === "string") {
      return Saito.getInstance().hash(Buffer.from(buffer));
    }
    return Saito.getInstance().hash(buffer);
  }

  aesEncrypt(msg, secret) {
    const rp = secret.toString("hex");
    const en = CryptoJS.AES.encrypt(msg, rp, {format: JsonFormatter});
    return en.toString();
  }

  aesDecrypt(msg, secret) {
    const rp = secret.toString("hex");
    const de = CryptoJS.AES.decrypt(msg, rp, {format: JsonFormatter});
    return CryptoJS.enc.Utf8.stringify(de);
  }

  generatePublicKey(privateKey: string): string {
    return Saito.getInstance().generatePublicKey(privateKey);
  }

  toBase58(t: string): string {
    return Base58.encode(Buffer.from(t, "hex"));
  }

  stringToBase64(str: string): string {
    return Buffer.from(str, "utf-8").toString("base64");
  }

  base64ToString(str: string): string {
    return Buffer.from(str, "base64").toString("utf-8");
  }

  stringToHex(str) {
    return Buffer.from(str, "utf-8").toString("hex");
  }

  isAesEncrypted(msg) {
    try {
      if (JSON.parse(msg).ct) {
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  }

  isBase58(t: string) {
    return /^[A-HJ-NP-Za-km-z1-9]*$/.test(t);
  }

  generateSeedFromPrivateKey(existingPrivateKey: String) {
    let seed = Buffer.from(existingPrivateKey, "hex");
    const mnemonic = bip39.entropyToMnemonic(seed);
    return mnemonic;
  }
}