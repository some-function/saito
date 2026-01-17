import Saito from 'saito-js/saito';
import node_cryptojs from 'node-cryptojs-aes';
import crypto from 'crypto-browserify';
import * as Base58 from 'base-58';
import secp256k1 from 'secp256k1';
const bip39 = require('bip39');

const CryptoJS = node_cryptojs.CryptoJS;
const JsonFormatter = node_cryptojs.JsonFormatter;

export default class Crypto {
  public hash(buffer: Uint8Array | string): string {
    // buffer = buffer || "";
    if (typeof buffer === 'string') {
      return Saito.getInstance().hash(Buffer.from(buffer));
    }
    // 64-bit hash
    return Saito.getInstance().hash(buffer);
  }

  public signBuffer(buffer: Uint8Array, privateKey: string): string {
    return Saito.getInstance().signBuffer(buffer, privateKey);
  }

  public verifySignature(buffer: Uint8Array, sig: string, publicKey: string): boolean {
    return Saito.getInstance().verifySignature(buffer, sig, publicKey);
  }

  public signMessage(msg: string, privateKey: string): string {
    return this.signBuffer(Buffer.from(msg, 'utf-8'), privateKey);
  }

  public verifyMessage(msg: string, sig: string, publicKey: string): boolean {
    return this.verifySignature(Buffer.from(msg, 'utf-8'), sig, publicKey);
  }

  verifyRoutingPath(path: any[], publickey: string, binding_hash: string | null = ''): boolean {
    if (!Array.isArray(path) || path.length === 0) {
      return false;
    }

    if (!publickey || typeof publickey !== 'string') {
      return false;
    }

    let expected_signer = publickey;

    for (let i = 0; i < path.length; i++) {
      const hop = path[i];

      if (
        !hop ||
        typeof hop.to !== 'string' ||
        typeof hop.value !== 'string' ||
        typeof hop.sig !== 'string'
      ) {
        return false;
      }

      const to = hop.to || '';
      const value = hop.value || '';
      const sig = hop.sig || '';
      const canonical_string = `${to}|${value}|${binding_hash}`;
      const digest = this.hash(canonical_string);

      console.log('verifying hop ' + i + ' against digest ' + digest);
      console.log('expected signer: ' + expected_signer);
      console.log('sig: ' + sig);

      const valid = this.verifyMessage(digest, sig, expected_signer);

      if (!valid) {
        console.log('this sig is invalid...');
        return false;
      }
      console.log('this sig is valid...');

      expected_signer = to;
    }

    return true;
  }

  aesEncrypt(msg, secret) {
    const rp = secret.toString('hex');
    const en = CryptoJS.AES.encrypt(msg, rp, { format: JsonFormatter });
    return en.toString();
  }

  aesDecrypt(msg, secret) {
    const rp = secret.toString('hex');
    const de = CryptoJS.AES.decrypt(msg, rp, { format: JsonFormatter });
    return CryptoJS.enc.Utf8.stringify(de);
  }

  createDiffieHellman(pubkey = '', privkey = '') {
    const ecdh = crypto.createECDH('secp256k1');
    ecdh.generateKeys();
    if (pubkey != '') {
      ecdh.setPublicKey(pubkey);
    }
    if (privkey != '') {
      ecdh.setPrivateKey(privkey);
    }
    return ecdh;
  }

  generateKeys(): string {
    return Saito.getInstance().generatePrivateKey();
  }

  generatePublicKey(privateKey: string): string {
    return Saito.getInstance().generatePublicKey(privateKey);
  }

  generateRandomNumber() {
    const randomNumber = crypto.randomBytes(32);
    return randomNumber.toString('hex');
  }

  compressPublicKey(pubkey) {
    // @ts-ignore
    return this.toBase58(secp256k1.publicKeyConvert(Buffer.from(pubkey, "hex"), true).toString("hex"));
  }

  fromBase58(t: string): string {
    return Buffer.from(Base58.decode(t)).toString('hex');
  }

  toBase58(t: string): string {
    return Base58.encode(Buffer.from(t, 'hex'));
  }

  stringToBase64(str: string): string {
    return Buffer.from(str, 'utf-8').toString('base64');
  }

  base64ToString(str: string): string {
    return Buffer.from(str, 'base64').toString('utf-8');
  }

  stringToHex(str) {
    return Buffer.from(str, 'utf-8').toString('hex');
  }

  hexToString(hex) {
    return Buffer.from(hex, 'hex').toString('utf-8');
  }

  xor(a, b) {
    let i;
    if (!Buffer.isBuffer(a)) a = new Buffer(a);
    if (!Buffer.isBuffer(b)) b = new Buffer(b);
    const res = [];
    if (a.length > b.length) {
      for (i = 0; i < b.length; i++) {
        res.push(a[i] ^ b[i]);
      }
    } else {
      for (i = 0; i < a.length; i++) {
        res.push(a[i] ^ b[i]);
      }
    }
    return new Buffer(res);
  }

  encodeXOR(plaintext, key) {
    while (plaintext.length > key.length) {
      key = key + key;
    }
    return this.xor(Buffer.from(plaintext, 'hex'), Buffer.from(key, 'hex')).toString('hex');
  }

  decodeXOR(str, key) {
    while (str.length > key.length) {
      key = key + key;
    }
    return this.xor(Buffer.from(str, 'hex'), Buffer.from(key, 'hex')).toString('hex');
  }

  isAesEncrypted(msg) {
    try {
      let msg2 = JSON.parse(msg);
      if (msg2.ct) {
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  }

  fastSerialize(jsobj) {
    return JSON.stringify(jsobj);
  }

  convertStringToDecimalPrecision(stringx, p = 8) {
    stringx = parseFloat(stringx);
    return stringx.toFixed(p).replace(/0+$/, '').replace(/\.$/, '.0').replace(/\.0$/, '');
  }

  convertFloatToSmartPrecision(num, max_precision = 8, min_precision = 0) {
    let stringx = Number(num)
      .toFixed(max_precision)
      .replace(/0+$/, '')
      .replace(/\.$/, '.0')
      .replace(/\.0$/, '');
    if (min_precision) {
      let split_string = stringx.split('.');
      let fraction = split_string[1] || '';
      if (fraction.length < min_precision) {
        fraction = fraction.padEnd(min_precision, '0');
      }
      stringx = split_string[0] + '.' + fraction;
    }

    return stringx;
  }

  isValidPublicKey(key) {
    if (typeof key !== 'string') {
      return false;
    }

    if (key.length !== 44) {
      return false;
    }

    const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
    return base58Regex.test(key);
  }

  isPublicKey(publicKey: string) {
    if (publicKey) {
      if (publicKey.indexOf('@') <= 0) {
        if (this.isBase58(publicKey)) {
          return 1;
        }
      }
    }
    return 0;
  }

  isBase58(t: string) {
    return /^[A-HJ-NP-Za-km-z1-9]*$/.test(t);
  }

  //Restoring these functions ...

  generateSeedFromPrivateKey(existingPrivateKey: String) {
    // Create a seed that will deterministically generate your key first
    let seed = Buffer.from(existingPrivateKey, 'hex');

    // Generate mnemonic from this seed
    const mnemonic = bip39.entropyToMnemonic(seed);

    return mnemonic;
  }

  getPrivateKeyFromSeed(mnemonic: string) {
    try {
      // Validate the mnemonic
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic');
      }

      // Convert mnemonic back to entropy
      const privateKey = bip39.mnemonicToEntropy(mnemonic);

      // Verify if this is a valid secp256k1 private key
      if (!secp256k1.privateKeyVerify(Buffer.from(privateKey, 'hex'))) {
        throw new Error('Generated private key is not valid for secp256k1');
      }

      return privateKey;
    } catch (error) {
      console.error('Error getting private key from seed:', error);
      return null;
    }
  }

  encryptWithPublicKey(data: Buffer, recipientPublicKey: string): Buffer {
    try {
      const publicKeyHex = this.fromBase58(recipientPublicKey);
      const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');

      let ephemeralPrivateKey: Buffer;
      let ephemeralPublicKey: Buffer;

      do {
        ephemeralPrivateKey = crypto.randomBytes(32);
      } while (!secp256k1.privateKeyVerify(ephemeralPrivateKey));

      ephemeralPublicKey = Buffer.from(secp256k1.publicKeyCreate(ephemeralPrivateKey, false));

      const sharedPoint = Buffer.from(
        secp256k1.publicKeyTweakMul(publicKeyBuffer, ephemeralPrivateKey)
      );

      const sharedSecret = sharedPoint.slice(1, 33);

      const encryptedData = this.aesEncrypt(data.toString('base64'), sharedSecret);

      const ephemeralPublicKeyCompressed = Buffer.from(secp256k1.publicKeyConvert(ephemeralPublicKey, true));
      const encryptedBuffer = Buffer.from(encryptedData, 'utf8');

      const result = Buffer.concat([ephemeralPublicKeyCompressed, encryptedBuffer]);

      return result;
    } catch (error) {
      console.error('Error encrypting with public key:', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  decryptWithPrivateKey(encryptedData: Buffer, privateKeyHex: string): Buffer {
    try {
      if (encryptedData.length < 33) {
        throw new Error('Invalid encrypted data format: too short');
      }

      const ephemeralPublicKey = encryptedData.slice(0, 33);
      const encryptedPayload = encryptedData.slice(33);

      const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');

      if (!secp256k1.publicKeyVerify(ephemeralPublicKey)) {
        throw new Error('Invalid ephemeral public key in encrypted data');
      }

      const ephemeralPublicKeyUncompressed = Buffer.from(
        secp256k1.publicKeyConvert(ephemeralPublicKey, false)
      );

      const sharedPoint = Buffer.from(
        secp256k1.publicKeyTweakMul(ephemeralPublicKeyUncompressed, privateKeyBuffer)
      );

      const sharedSecret = sharedPoint.slice(1, 33);

      const encryptedString = encryptedPayload.toString('utf8');
      const decryptedBase64 = this.aesDecrypt(encryptedString, sharedSecret);

      if (!decryptedBase64) {
        throw new Error('Failed to decrypt data - invalid shared secret or corrupted data');
      }

      const decryptedData = Buffer.from(decryptedBase64, 'base64');

      return decryptedData;
    } catch (error) {
      console.error('Error decrypting with private key:', error);
    }
  }
}