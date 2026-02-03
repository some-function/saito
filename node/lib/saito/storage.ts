import * as JSON from "json-bigint";
import {App} from "./app";
import Block from "./block";
const localforage = require("localforage");
import fs from "fs";
import path from "path";
const JsStore = require("jsstore");


class Storage {
  public app: App;
  public activeTab: any;
  public timeout: any;
  currentBuildNumber: bigint = BigInt(0);
  public localDB: any = null;
  public walletOptionsHash: any = "";

  constructor(app) {
    this.app = app || {};
    this.activeTab = 1;
    this.timeout = null;
    this.localDB = null;
    this.walletOptionsHash = "";
  }

  async initialize() {
    await this.loadOptions();

    if (this.app.BROWSER === 0) {
      this.watchBuildFile();
    }

    if (this.app.BROWSER == 1) {
      try {
        this.localDB = null;
        await this.initializeApplicationDB();
        await this.loadLocalApplications();
      } catch (err) {
        console.log("Error initializeApplicationDB:", err);
      }
    }

    return;
  }

  async loadOptions() {
    if (this.app.BROWSER == 1 && this.activeTab == 0) {
      return;
    }
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
    if (this.app.BROWSER == 1) {
      if (this.activeTab == 0) {
        return;
      }
    }

    let newWalletJson = JSON.stringify(this.app.options);
    let newWalletHash = this.app.crypto.hash(newWalletJson);

    if (newWalletHash == this?.walletOptionsHash) {
      return;
    }

    try {
      localStorage.setItem("options", newWalletJson);

      this.walletOptionsHash = newWalletHash;

      this.saveOptionsToForage();
    } catch (err) {
      console.trace(err);

      for (const [key, item] of Object.entries(localStorage)) {
        let parsedItem = "";
        try {
          parsedItem = JSON.parse(item);
        } catch {}
        console.log(key, item.length, item, parsedItem);
      }
    }
  }

  async saveLocalApplication(mod, base64) {
    if (this.app.BROWSER) {
      const values = [{mod: mod, base64: base64, created_at: new Date().getTime(), updated_at: new Date().getTime()}];
      await this.localDB.insert({into: "dyn-mods", values: values});
      await this.loadLocalApplications();
    }
  }

  async loadLocalApplications(modSlug=null) {
    try {
      if (!this.app.BROWSER) {
        return;
      }

      const obj = {from: "dyn-mods", order: {by: "id", type: "desc"}};

      if (modSlug != null) {
        obj["where"] = {mod: modSlug};
      }
      return await this.localDB.select(obj);
    } catch (err) {
      console.log("Error loadLocalApplications: ", err);
    }
  }

  async removeLocalApplication(modSlug=null) {
    try {
      if (!this.app.BROWSER) {
        return;
      }

      const deletedRows = await this.localDB.remove({from: "dyn-mods", where: {mod: modSlug}});
      return deletedRows;
    } catch (err) {
      console.log("Error removeLocalApplication: ", err);
    }
  }

  async removeAllLocalApplications() {
    try {
      if (!this.app.BROWSER) {
        return;
      }

      const deletedRows = await this.localDB.remove({from: "dyn-mods"});
      return deletedRows;
    } catch (err) {
      console.log("Error removeLocalApplication: ", err);
    }
  }

  async initializeApplicationDB() {
    if (this.app.BROWSER) {
      this.localDB = new JsStore.Connection(new Worker("/saito/lib/jsstore/jsstore.worker.js"));

      const dynMod = {
        name: "dyn-mods",
        columns: {
          id: {primaryKey: true, autoIncrement: true}, mod: {dataType: "string", default: ""}, binary: {dataType: "string", default: ""},
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