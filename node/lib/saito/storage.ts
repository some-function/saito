const localforage = require("localforage");
const JsStore = require("jsstore");
import * as JSON from "json-bigint";
import fs from "fs";

import {RuntimeTypeGuard} from "../runtime-type-guard";
import {App} from "./app";
import Block from "./block";


class Storage {
  public app: App;
  public activeTab: boolean;
  public timeout: any;
  currentBuildNumber: bigint = BigInt(0);
  public localDB: any = null;
  public walletOptionsHash: any = "";

  constructor(app) {
    this.app = app || {};
    this.activeTab = true;
    this.timeout = null;
    this.localDB = null;
    this.walletOptionsHash = "";
  }

  async initialize() {
    await this.loadOptions();

    if (this.app.BROWSER) {
      try {
        this.localDB = null;
        await this.initializeLocalModulesDB();
      } catch (err) {
        console.log("Error initializeLocalModulesDB:", err);
      }
    } else {
      this.watchBuildFile();
    }
  }

  async loadOptions() {
    if (!this.app.BROWSER || this.activeTab) {
      const response = await fetch(`/options`);
      const receivedOptions = await response.json();
      if (typeof Storage !== "undefined") {
        const data = localStorage.getItem("options");
        if (data != "null" && data != null) {
          this.app.options = JSON.parse(data);
          this.app.options.consensus = receivedOptions.consensus;
          return;
        }
      }
      this.app.options = receivedOptions;
    }
  }

  async resetOptions() {
    try {
      localStorage.clear();

      const response = await fetch(`/options`);
      this.app.options = await response.json();
      this.saveOptions();
    } catch (err) {
      console.error(err);
    }
  }

  async resetOptionsFromKey(publicKey) {
    if (this.app.BROWSER) {
      const wallet = await localforage.getItem(publicKey);
      if (wallet) {
        console.log(`Found wallet for ${publicKey} in IndexedDB`);
        this.app.options = wallet;
        this.app.storage.saveOptions();
      } else {
        console.log(`Creating fresh wallet for ${publicKey}`);
        await this.resetOptions();
      }
    }
  }

  async saveOptionsToForage() {
    if (this.app.BROWSER) {
      const key = await this.app.wallet.getPublicKey();
      if (key) {
        localforage.setItem(key, this.app.options);
      }
    }
  }

  async clearLocalForage() {
    if (this.app.BROWSER) {
      try {
        await localforage.clear();
        console.log("Cleared LocalForage!");
      } catch (err) {
        console.error(err);
      }
    }
  }

  saveOptions() {
    if (!this.app.BROWSER || this.activeTab) {
      const newWalletJson = JSON.stringify(this.app.options);
      const newWalletHash = this.app.crypto.hash(newWalletJson);

      if (newWalletHash != this?.walletOptionsHash) {
        try {
          localStorage.setItem("options", newWalletJson);
          this.walletOptionsHash = newWalletHash;
          this.saveOptionsToForage();
        } catch (err) {
          console.trace(err);

          for (const [key, item] of Object.entries(localStorage)) {
            const parsedItem = (() => { try { return JSON.parse(item); } catch { return ""; } })();
            console.log(key, item.length, item, parsedItem);
          }
        }
      }
    }
  }

  @RuntimeTypeGuard(String, String)
  async saveLocalModule(slug:string, base64:string) {
    const values = [{slug: slug, base64: base64, created_at: new Date().getTime(), updated_at: new Date().getTime()}];
    await this.localDB.insert({into: "dyn-mods", values: values});
  }

  @RuntimeTypeGuard(String)
  async loadLocalModule(slug:string) {
    return await this.localDB.select({from: "dyn-mods", order: {by: "id", type: "desc"}, where: {slug: slug}});
  }

  @RuntimeTypeGuard()
  async loadAllLocalModules() {
    return await this.localDB.select({from: "dyn-mods", order: {by: "id", type: "desc"}});
  }

  @RuntimeTypeGuard(String)
  async removeLocalModule(slug:string) {
    await this.localDB.remove({from: "dyn-mods", where: {slug: slug}});
  }

  @RuntimeTypeGuard()
  async removeAllLocalModules() {
    await this.localDB.remove({from: "dyn-mods"});
  }

  async initializeLocalModulesDB() {
    if (this.app.BROWSER) {
      this.localDB = new JsStore.Connection(new Worker("/saito/lib/jsstore/jsstore.worker.js"));

      const dynMod = {
        name: "dyn-mods",
        columns: {
          id: {primaryKey: true, autoIncrement: true}, slug: {dataType: "string", default: ""}, binary: {dataType: "string", default: ""},
          created_at: {dataType: "number", default: 0}, updated_at: {dataType: "number", default: 0}
        }
      };

      const isDbCreated = await this.localDB.initDb({name: "dyn-mods-db", tables: [dynMod]});
      if (isDbCreated) {
        console.log("STORAGE: db created and connection opened");
      } else {
        console.log("STORAGE: connection opened");
      }
    }

    return;
  }

  async loadBlockByHash(bsh): Promise<Block> { return null; }
  async loadBlockByFilename(filename): Promise<Block> { return null; }
  async loadBlocksFromDisk(maxblocks = 0): Promise<Block> { return null; }
  returnFileSystem() { return null; }
  async returnDatabaseByName(dbname) { return null; }
  async queryDatabase(sql, params, database) {}
  async executeDatabase(sql, database) {}

  watchBuildFile(): void {
    const checkBuildNumber = async () => {
      fs.readFile("config/build.json", "utf8", async (err, data) => {
        if (err) {
          console.error("Error reading options file:", err);
          return;
        }
        try {
          const jsonData = JSON.parse(data);
          const buildNumber = BigInt(jsonData.buildNumber);
          if (typeof this.currentBuildNumber == "undefined") {
            console.info("Build number undefined");
            return false;
          }
          if (typeof buildNumber == "undefined") {
            console.info("Error reading build number from file");
            return false;
          }
          if (Number(this.currentBuildNumber) < Number(buildNumber)) {
            const jsonString = JSON.stringify({buildNumber});
            const uint8Array = new Uint8Array(jsonString.length);
            for (let i = 0; i < jsonString.length; i++) {
              uint8Array[i] = jsonString.charCodeAt(i);
            }
            this.app.buildNumber = Number(buildNumber);
            const peers = await this.app.network.getPeers();
            console.log("peers", peers);
            for (const peer of peers) {
              this.app.network.sendRequest("software-update", data, null, peer);
            }

            this.currentBuildNumber = buildNumber;

            console.log("Updated build number to:", this.currentBuildNumber);
          }
        } catch (e) {
          console.error("Error parsing JSON from options file:", e);
        }
      });
    };

    fs.watchFile("web/saito/saito.js", {interval: 1000}, (curr, prev) => { checkBuildNumber(); });
  }
}

export default Storage;