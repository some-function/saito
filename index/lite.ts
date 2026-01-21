import {App} from "../lib/saito/app";
// @ts-ignore
import {initialize as initSaito} from "saito-js/index.web";
import WebSharedMethods from "saito-js/lib/custom/shared_methods.web";
import PeerServiceList from "saito-js/lib/peer_service_list";
import S, {LogLevel} from "saito-js/saito";
import build from "../config/build.json";
import modsConfig from "../config/modules.config";
import Blockchain from "../lib/saito/blockchain";
import Factory from "../lib/saito/factory";
import Transaction from "../lib/saito/transaction";
import Wallet from "../lib/saito/wallet";


class WebMethods extends WebSharedMethods {
  app: App;

  constructor(app: App) { super();  this.app = app; }
  sendInterfaceEvent(event: string, peerIndex: bigint, public_key: string) { this.app.connection.emit(event, peerIndex, public_key); }
  sendBlockSuccess(hash: string, blockId: bigint) { this.app.connection.emit("add-block-success", {hash, blockId}); }
  sendWalletUpdate() { this.app.connection.emit("wallet-updated"); }
  sendBlockFetchStatus(count) { this.app.connection.emit("block-fetch-status", {count: count}); }
  sendNewChainDetectedEvent(): void { this.app.connection.emit("new-chain-detected"); }
  async loadWallet()     { throw new Error("Method not implemented."); }
  async saveBlockchain() { throw new Error("Method not implemented."); }
  async loadBlockchain() { throw new Error("Method not implemented."); }
  ensureDirExists(path: string): void {}


  sendNewVersionAlert(major: number, minor: number, patch: number, peerIndex: bigint): void {
    console.log(`emit : new-version-detected ${major}:${minor}:${patch}`);
    this.app.connection.emit("new-version-detected", {version: `${major}.${minor}.${patch}`, peerIndex: peerIndex});
  }

  async saveWallet() {
    this.app.options.wallet.publicKey  = await this.app.wallet.getPublicKey();
    this.app.options.wallet.privateKey = await this.app.wallet.getPrivateKey();
    this.app.options.wallet.balance    = await this.app.wallet.getBalance();
  }

  getMyServices() {
    const list = new PeerServiceList();
    this.app.network.getServices().forEach((s) => list.push(s));
    return list;
  }

  async processApiCall(buffer: Uint8Array, msgIndex: number, peerIndex: bigint): Promise<void> {
    const mycallback = async (responseObject) => {
      try {
        await S.getInstance().sendApiSuccess(msgIndex, Buffer.from(JSON.stringify(responseObject), "utf-8"), peerIndex);
      } catch (error) {
        console.error(error);
      }
    };
    const newtx = new Transaction();
    try {
      newtx.deserialize(buffer);
      newtx.unpackData();
    } catch (error) {
      console.error(error);
      newtx.msg = buffer;
    }
    await this.app.modules.handlePeerTransaction(newtx, await this.app.network.getPeer(peerIndex), mycallback);
  }
}

async function init() {
  console.log("lite init...");

  const app = new App({modPaths: modsConfig.lite});
  await app.storage.initialize();

  app.options.browser_mode = true;
  app.options.spv_mode = true;
  app.build_number = parseInt(build.build_number);
  console.info("Build Number: " + app.build_number);

  let logLevel: LogLevel = LogLevel.Info;
  if (app.options.loglevel !== undefined && app.options.loglevel !== null) {
    const logLevelValue = app.options.loglevel;
    if (typeof logLevelValue === "string") {
      const normalized = logLevelValue.toLowerCase();
      switch (normalized) {
        case "error": logLevel = LogLevel.Error; break;
        case "warn":  logLevel = LogLevel.Warn;  break;
        case "info":  logLevel = LogLevel.Info;  break;
        case "debug": logLevel = LogLevel.Debug; break;
        case "trace": logLevel = LogLevel.Trace; break;
        default:      logLevel = LogLevel.Info;  console.warn(`Invalid log level "${logLevelValue}", defaulting to Info`); 
      }
    } else if (typeof logLevelValue === "number") {
      const validLevels = [LogLevel.Error, LogLevel.Warn, LogLevel.Info, LogLevel.Debug, LogLevel.Trace];
      if (validLevels.includes(logLevelValue)) {
        logLevel = logLevelValue;
      } else {
        console.warn(`Invalid log level value ${logLevelValue}, defaulting to Info`);
        logLevel = LogLevel.Info;
      }
    } else {
      console.warn(`Invalid log level type, defaulting to Info`);
      logLevel = LogLevel.Info;
    }
  }
  
  try {
    await initSaito(app.options, new WebMethods(app), new Factory(), app.options.wallet?.privateKey || "", logLevel, BigInt(1), true);
  } catch (e) {
    console.error(e);
  }

  app.wallet = (await S.getInstance().getWallet()) as Wallet;
  app.wallet.app = app;
  app.blockchain = (await S.getInstance().getBlockchain()) as Blockchain;
  app.blockchain.app = app;
  app.BROWSER = 1;
  app.SPVMODE = 1;

  if (app.options?.blockchain?.fork_id) {
    await app.blockchain.setForkId(app.options.blockchain.fork_id);
  }

  try {
    await app.init();
  } catch (e) {
    console.error(e);
  }

  S.getInstance().start();
}

window.onload = async function () {
  try {
    await init();
  } catch (error) {
    console.error(error);
  }
};