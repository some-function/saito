'use strict';

import Storage from './storage';
import fs from 'fs-extra';
import * as JSON from 'json-bigint';
import path from 'path';
import {open} from 'sqlite';
import sqlite3 from 'sqlite3';

import {AppFull} from './app';
import Block from './block';
import Slip from './slip';
import {SlipType} from 'saito-js/lib/slip';


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

  constructor(app, data?, dest = 'blocks') {
    super(app);

    this.data_dir = data || path.join(__dirname, '../../data');
    this.config_dir = path.join(__dirname, '../../config');
    this.dest = dest;
    this.db = [];
    this.dbname = [];
    this.loading_active = false;

    this.file_encoding_save = 'utf8';
    this.file_encoding_load = 'utf8';
  }

  deleteBlockFromDisk(filename) {
    try {
      return fs.unlinkSync(filename);
    } catch (error) {
      console.error(`failed deleting the block file ${filename} from disk`);
      console.error(error);
    }
  }

  returnPath() {
    return path;
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
        filename: this.data_dir + '/' + dbname + '.sq3',
        driver: sqlite3.Database
      });

      this.dbname.push(dbname);
      this.db.push(db);

      return this.db[this.db.length - 1];
    } catch (err) {
      console.error('Error creating database for db-name: ' + dbname);
      console.error(err);
      return null;
    }
  }

  generateBlockFilename(block): string {
    let filename = this.data_dir + '/' + this.dest + '/';
    filename += block.timestamp;
    filename += '-';
    filename += block.hash;
    filename += '.sai';
    return filename;
  }

  async loadBlockFromDisk(filename) {
    try {
      if (fs.existsSync(filename)) {
        const data = fs.readFileSync(filename);
        const block = new Block();
        block.deserialize(data);
        return block;
      }
    } catch (error) {
      console.log('Error reading block from disk');
      console.error(error);
    }
    return null;
  }

  async loadBlockByHash(blockHash: string) {
    let block = await this.app.blockchain.getBlock(blockHash);
    if (!block) {
      return null;
    }
    block = await this.loadBlockByFilename(this.data_dir + '/blocks/' + block.file_name);
    return block;
  }

  async loadBlockByFilename(filename: string) {
    try {
      const data = await fs.readFile(filename);
      const block = new Block();
      block.deserialize(data);

      return block;
    } catch (err) {
      console.error('Error reading block from disk');
      console.error(err);
    }

    console.log('Block not being returned... returning null');
    return null;
  }

  async loadOptions() {
    if (fs.existsSync(`${this.config_dir}/options`)) {
      let optionsfile = '';

      try {
        optionsfile = fs
          .readFileSync(`${this.config_dir}/options`, this.file_encoding_load)
          .toString();

        if (this.app.crypto.isAesEncrypted(optionsfile)) {
          if (typeof process.env.SAITO_PASS != 'undefined') {
            let secret =
              'BYTHEPRICKINGOFMYTHUMBSSOMETHINGWICKEDTHISWAYCOMES' + process.env.SAITO_PASS;
            secret = this.app.crypto.toBase58(this.app.crypto.stringToHex(secret));
            try {
              optionsfile = this.app.crypto.aesDecrypt(optionsfile, secret);
            } catch (err) {
              throw new Error('Invalid Password!');
            }
          } else {
            throw new Error('Password needed!');
          }
        }

        if (!optionsfile) {
          throw new Error('Options file empty!');
        }

        this.app.options = Object.assign(this.app.options, JSON.parse(optionsfile));

        this.app.options.browser_mode = false;
        this.app.options.spv_mode = false;
      } catch (err) {
        console.error(err);
        console.log('options = ', optionsfile);
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

  async loadRuntimeOptions() {
    if (fs.existsSync(`${this.config_dir}/runtime.config.js`)) {
      try {
        const configfile = fs.readFileSync(
          `${this.config_dir}/runtime.config.js`,
          this.file_encoding_load
        );
        this.app.options.runtime = JSON.parse(configfile.toString());
      } catch (err) {
        console.error(err);
        process.exit();
      }
    } else {
      this.app.options.runtime = {};
    }
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
      console.error('Problem hashing app.options: ', err);
    }

    try {
      if (typeof process.env.SAITO_PASS != 'undefined') {
        let secret = this.app.crypto.toBase58(
          this.app.crypto.stringToHex(
            'BYTHEPRICKINGOFMYTHUMBSSOMETHINGWICKEDTHISWAYCOMES' + process.env.SAITO_PASS
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

  returnTokenSupplySlipsFromDisk(): any {
    let v: any = [];
    let tokens_issued = 0;
    let filename;
    let contents;
    let slips;
    let s;

    filename = this.data_dir + '/issuance/issuance';
    contents = fs.readFileSync(filename);
    contents = contents.toString();
    slips = contents.split('\n');
    for (let i = 0; i < slips.length; i++) {
      if (slips[i] !== '') {
        s = this.convertIssuanceIntoSlip(slips[i]);
        if (s != null) {
          v.push(s);
        }
      }
    }

    filename = this.data_dir + '/issuance/default';
    contents = fs.readFileSync(filename);
    contents = contents.toString();
    slips = contents.split('\n');
    for (let i = 0; i < slips.length; i++) {
      if (slips[i] !== '') {
        s = this.convertIssuanceIntoSlip(slips[i]);
        if (s != null) {
          v.push(s);
        }
      }
    }

    filename = this.data_dir + '/issuance/earlybirds';
    contents = fs.readFileSync(filename);
    contents = contents.toString();
    slips = contents.split('\n');
    for (let i = 0; i < slips.length; i++) {
      if (slips[i] !== '') {
        s = this.convertIssuanceIntoSlip(slips[i]);
        if (s != null) {
          v.push(s);
        }
      }
    }

    return v;
  }

  convertIssuanceIntoSlip(line = '') {
    let entries = line.split('\t');
    let amount = BigInt(entries[0]);
    let publicKey = entries[1];
    let type = entries[2];
    let slip = new Slip();
    slip.publicKey = publicKey;
    slip.amount = amount;
    if (type === 'VipOutput') {
      slip.type = SlipType.VipOutput;
    }
    if (type === 'Normal') {
      slip.type = SlipType.Normal;
    }
    return slip;
  }

  // @ts-ignore
  resetOptions() {}

  async saveClientOptions() {
    if (this.app.BROWSER == 1) {
      return;
    }
    const client_peer = Object.assign({}, this.app.server.server.endpoint, {
      synctype: 'lite'
    });
    const t: any = {};
    t.keys = [];
    t.peers = [];
    t.services = this.app.options.services;
    t.dns = [];
    t.blockchain = this.app.options.blockchain;
    t.registry = this.app.options.registry;
    t.appstore = {};
    t.appstore.default = await this.app.wallet.getPublicKey();
    t.peers.push(client_peer);

    try {
      fs.writeFileSync(`${__dirname}/web/client.options`, JSON.stringify(t));
    } catch (err) {
      console.error(err);
    }
  }

  getClientOptions(): string {
    if (this.app.BROWSER == 1) {
      return '';
    }
    if (this.app.options) {
      if (this.app.options.client_options) {
        return JSON.stringify(this.app.options.client_options, null, 2);
      }
    }

    const client_peer = Object.assign({}, this.app.server.server.endpoint, {synctype: 'lite'});
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

  async returnBlockFilenameByHash(block_hash: string, mycallback) {
    const sql = 'SELECT id, timestamp, block_id FROM blocks WHERE hash = $block_hash';
    const params = {$block_hash: block_hash};

    try {
      const row = await this.db.get(sql, params);
      if (row == undefined) {
        mycallback(null, 'Block not found on this server');
        return;
      }
      const filename = `${row.timestamp}-${block_hash}.blk`;
      mycallback(filename, null);
    } catch (err) {
      console.log('ERROR getting block filename in storage: ' + err);
      mycallback(null, err);
    }
  }

  returnBlockFilenameByHashPromise(block_hash: string) {
    return new Promise((resolve, reject) => {
      this.returnBlockFilenameByHash(block_hash, (filename, err) => {
        if (err) {
          reject(err);
        }
        resolve(filename);
      }).then((r) => {
        return;
      });
    });
  }

  async runDatabase(sql, params, database, mycallback = null) {
    try {
      const db = await this.returnDatabaseByName(database);
      if (mycallback == null) {
        return await db.run(sql, params);
      } else {
        return await db.run(sql, params, mycallback);
      }
    } catch (err) {
      console.log('sql : ', sql);
      console.log(err);
    }
  }

  async executeDatabase(sql, database) {
    try {
      const db = await this.returnDatabaseByName(database);
      return await db.exec(sql);
    } catch (err) {
      console.log('sql : ', sql);
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
      console.log('failed executing sql : ', sql);
      console.error(err);
      return [];
    }
  }
}

export default StorageCore;