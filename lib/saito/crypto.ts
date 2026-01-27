import Saito from "saito-js/saito";
import node_cryptojs from "node-cryptojs-aes";
import * as Base58 from "base-58";
const bip39 = require("bip39");

const CryptoJS = node_cryptojs.CryptoJS;
const JsonFormatter = node_cryptojs.JsonFormatter;

export default class Crypto {
  public hash(buffer: Uint8Array | string): string {
    return Saito.getInstance().hash((typeof buffer === "string") ? Buffer.from(buffer) : buffer);
  }

  aesEncrypt(msg, secret) {
    return CryptoJS.AES.encrypt(msg, secret.toString("hex"), {format: JsonFormatter}).toString();
  }

  aesDecrypt(msg, secret) {
    return CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(msg, secret.toString("hex"), {format: JsonFormatter}));
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
    try         { return !!JSON.parse(msg).ct; }
    catch (err) { return false;                }
  }

  isBase58(t: string) {
    return /^[A-HJ-NP-Za-km-z1-9]*$/.test(t);
  }

  generateSeedFromPrivateKey(existingPrivateKey: String) {
    return bip39.entropyToMnemonic(Buffer.from(existingPrivateKey, "hex"));
  }
}