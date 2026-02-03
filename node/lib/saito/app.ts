const path = require("path");
import S, {LogLevel} from "saito-js/saito";
import build from "../../config/build.json";
import Blockchain from "./blockchain";
import Browser from "./browser";
import Connection from "./connection";
import Crypto from "./crypto";
import Keychain from "./keychain";
import ModManager from "./mod-manager";
import Network from "./network";
import Server from "./server";
import Storage from "./storage";
import Wallet from "./wallet";


function parseLogLevel(logLevel): LogLevel {
  if (logLevel) {
    switch (logLevel) {
      case "error":
        return LogLevel.Error;
      case "warn":
        return LogLevel.Warn;
      case "info":
        return LogLevel.Info;
      case "debug":
        return LogLevel.Debug;
      case "trace":
        return LogLevel.Trace;
      default:
        throw new Error("Invalid log level");
    }
  } else {
    return LogLevel.Info;
  }
}

export type ArgType = {
  loglevel?: string;
};

class App {
  BROWSER: number;
  SPVMODE: number;
  buildNumber: number;
  options: any = {};
  modManager: ModManager;
  crypto: Crypto;
  connection: Connection;
  browser: Browser;
  storage: Storage;
  wallet: Wallet;
  keychain: Keychain;
  network: Network;
  blockchain: Blockchain;
  hash: (data: Uint8Array) => string;

  constructor(config = {}) {
    this.BROWSER = 1;
    this.SPVMODE = 0;
    this.buildNumber = Number(build.buildNumber);
    this.options = config;
    this.newSaito();

    // @ts-ignore
    this.modManager = new ModManager(this, config.modPaths);

    return this;
  }

  newSaito() {
    this.crypto = new Crypto();
    this.connection = new Connection();
    this.browser = new Browser(this);
    this.storage = new Storage(this);
    this.keychain = new Keychain(this);
    this.network = new Network(this);
  }

  async init() {
    try {
      // @ts-ignore
      this.hash = S.hash;

      console.log("initializing wallet....");
      await this.wallet.initialize();
      console.log("initializing keychain....");
      await this.keychain.initialize();

      console.log("mapping modules...");
      this.modManager.mods = this.modManager.modsList.map((mod_path) => {
        console.log("Installing: ", mod_path);
        const x = new (require(`../../mods/${mod_path}`))(this);
        x.dirname = path.dirname(mod_path);
        return x;
      });

      console.log("setting current version : " + this.wallet.version);

      await S.getInstance().setWalletVersion(0, Math.floor(this.wallet.version), (this.wallet.version * 1000) % 1000);
      await this.browser.initialize(this);
      await this.modManager.initialize();
      await this.blockchain.initialize();
      this.network.initialize();
    } catch (error) {
      console.error(error);
    }
  }

  async reset(config) {
    console.log("resetting saito instance");
    this.options = config;
    this.newSaito();
    await this.init();
  }

  shutdown() {
    // @ts-ignore
    this.network.close();
  }
}

class AppFull extends App {
  server: Server;
}

export {parseLogLevel, App, AppFull};