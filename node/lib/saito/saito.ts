import binary0 from './binary';
import blockchain0 from './blockchain';
import block0 from './block';
import browser0 from './browser';
import connection0 from './connection';
import crypto0 from './crypto';
import keychain0 from './keychain';
import modules0 from './modules';
import network0 from './network';
import peer0 from './peer';
import storage0 from './storage';
import server0 from './server';
import slip0 from './slip';
import transaction0 from './transaction';
import wallet0 from './wallet';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export default class SaitoCommon {
  static binary = binary0;
  static block = block0;
  static blockchain = blockchain0;
  static browser = browser0;
  static connection = connection0;
  static crypto = crypto0;
  static keychain = keychain0;
  static modules = modules0;
  static network = network0;
  static peer = peer0;
  static storage = storage0;
  static server = server0;
  static slip = slip0;
  static transaction = transaction0;
  static wallet = wallet0;
}