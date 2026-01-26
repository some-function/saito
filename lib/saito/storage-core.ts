"use strict";

import Storage from "./storage";
import fs from "fs-extra";
import * as JSON from "json-bigint";
import path from "path";
import {open} from "sqlite";
import sqlite3 from "sqlite3";

import {AppFull} from "./app";
import Block from "./block";


class StorageCore extends Storage {
  public data_dir: any;
  public config_dir: any;
  public dest: any;
  public db: any;
  public dbname: any;
  public loading_active: any;
  public file_encoding_save: any;
  public file_encoding_load: any;
  public app: AppFull;

  constructor(app, data?, dest = "blocks") {
    super(app);

    this.data_dir = data || path.join(__dirname, "../../data");
    this.config_dir = path.join(__dirname, "../../config");
    this.dest = dest;
    this.db = [];
    this.dbname = [];
    this.loading_active = false;

    this.file_encoding_save = "utf8";
    this.file_encoding_load = "utf8";
  }

  returnFileSystem() {
    return fs;
  }

  async returnDatabaseByName(dbname) {
    for (let i = 0; i < this.dbname.length; i++) {
      if (dbname == this.dbname[i]) {
        return this.db[i];
      }
    }
    try {
      const db = await open({
        filename: this.data_dir + "/" + dbname + ".sq3",
        driver: sqlite3.Database
      });

      this.dbname.push(dbname);
      this.db.push(db);

      return this.db[this.db.length - 1];
    } catch (err) {
      console.error("Error creating database for db-name: " + dbname);
      console.error(err);
      return null;
    }
  }

  async loadBlockByHash(blockHash: string) {
    let block = await this.app.blockchain.getBlock(blockHash);
    if (!block) {
      return null;
    }
    block = await this.loadBlockByFilename(this.data_dir + "/blocks/" + block.file_name);
    return block;
  }

  async loadBlockByFilename(filename: string) {
    try {
      const data = await fs.readFile(filename);
      const block = new Block();
      block.deserialize(data);

      return block;
    } catch (err) {
      console.error("Error reading block from disk");
      console.error(err);
    }

    console.log("Block not being returned... returning null");
    return null;
  }

  async loadOptions() {
    if (fs.existsSync(`${this.config_dir}/options`)) {
      let optionsfile = "";

      try {
        optionsfile = fs
          .readFileSync(`${this.config_dir}/options`, this.file_encoding_load)
          .toString();

        if (this.app.crypto.isAesEncrypted(optionsfile)) {
          if (typeof process.env.SAITO_PASS != "undefined") {
            let secret =
              "BYTHEPRICKINGOFMYTHUMBSSOMETHINGWICKEDTHISWAYCOMES" + process.env.SAITO_PASS;
            secret = this.app.crypto.toBase58(this.app.crypto.stringToHex(secret));
            try {
              optionsfile = this.app.crypto.aesDecrypt(optionsfile, secret);
            } catch (err) {
              throw new Error("Invalid Password!");
            }
          } else {
            throw new Error("Password needed!");
          }
        }

        if (!optionsfile) {
          throw new Error("Options file empty!");
        }

        this.app.options = Object.assign(this.app.options, JSON.parse(optionsfile));

        this.app.options.browser_mode = false;
        this.app.options.spv_mode = false;
      } catch (err) {
        console.error(err);
        console.log("options = ", optionsfile);
        process.exit();
      }
    } else {
      const defaultOptions = `
        {
          "server": {
            "host": "127.0.0.1",
            "port": 12101,
            "protocol": "http",
            "endpoint": {
              "host": "127.0.0.1",
              "port": 12101,
              "protocol": "http"
            },
            "verification_threads": 4,
            "channel_size": 10000,
            "stat_timer_in_ms": 5000,
            "reconnection_wait_time": 10000,
            "thread_sleep_time_in_ms": 10,
            "block_fetch_batch_size": 10
          },
          "peers": [],
          "spv_mode": false,
          "browser_mode": false,
          "blockchain":{
            "last_block_hash":"0000000000000000000000000000000000000000000000000000000000000000",
            "last_block_id":0,
            "last_timestamp":0,
            "genesis_block_id":0,
            "genesis_timestamp":0,
            "lowest_acceptable_timestamp":0,
            "lowest_acceptable_block_hash":"0000000000000000000000000000000000000000000000000000000000000000",
            "lowest_acceptable_block_id":0,
            "fork_id":"0000000000000000000000000000000000000000000000000000000000000000"
          },
          "wallet": {
          }
        }
      `;
      this.app.options = JSON.parse(defaultOptions);
    }
    return this.app.options;
  }

  saveOptions() {
    let new_wallet_json, new_wallet_hash;

    try {
      new_wallet_json = JSON.stringify(this.app.options);
      new_wallet_hash = this.app.crypto.hash(new_wallet_json);
      if (new_wallet_hash == this?.wallet_options_hash) {
        return;
      }
    } catch (err) {
      console.error("Problem hashing app.options: ", err);
    }

    try {
      if (typeof process.env.SAITO_PASS != "undefined") {
        let secret = this.app.crypto.toBase58(
          this.app.crypto.stringToHex(
            "BYTHEPRICKINGOFMYTHUMBSSOMETHINGWICKEDTHISWAYCOMES" + process.env.SAITO_PASS
          )
        );
        new_wallet_json = this.app.crypto.aesEncrypt(new_wallet_json, secret);
      } else {
        new_wallet_json = JSON.stringify(JSON.parse(new_wallet_json), null, 4);
      }

      fs.writeFileSync(`${this.config_dir}/options`, new_wallet_json, null);

      this.wallet_options_hash = new_wallet_hash;
    } catch (err) {
      this.wallet_options_hash = null;
      console.error(err);
      return;
    }
  }

  // @ts-ignore
  resetOptions() {}

  getClientOptions(): string {
    if (this.app.BROWSER == 1) {
      return "";
    }
    if (this.app.options) {
      if (this.app.options.client_options) {
        return JSON.stringify(this.app.options.client_options, null, 2);
      }
    }

    const client_peer = Object.assign({}, this.app.server.server.endpoint, {synctype: "lite"});
    const t: any = {};
    t.keys = [];
    t.peers = [];
    t.services = this.app.options.services;
    t.dns = [];
    t.runtime = this.app.options.runtime;
    t.blockchain = this.app.options.blockchain;
    t.wallet = {};
    t.consensus = this.app.options.consensus;
    t.registry = this.app.options.registry;
    t.peers.push(client_peer);
    t.defaultModule = this.app.options.defaultClientModule;

    return JSON.stringify(t, null, 2);
  }

  async executeDatabase(sql, database) {
    try {
      const db = await this.returnDatabaseByName(database);
      return await db.exec(sql);
    } catch (err) {
      console.log("sql : ", sql);
      console.log(err);
    }
  }

  async queryDatabase(sql, params, database) {
    try {
      const db = await this.returnDatabaseByName(database);
      const rows = await db.all(sql, params);
      if (rows == undefined) {
        return [];
      }
      return rows;
    } catch (err) {
      console.log("failed executing sql : ", sql);
      console.error(err);
      return [];
    }
  }
}

export default StorageCore;