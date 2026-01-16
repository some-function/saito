import {Saito} from "../../../apps/core";
import express from "express";
import {Server as Ser} from "http";
import S from "saito-js/index.node";

import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import ws from "ws";
import process from "process";
import CustomSharedMethods from "saito-js/lib/custom/custom_shared_methods";
import {parse} from "url";
import Peer from "../peer";
import Transaction from "../transaction";
import PeerServiceList from "saito-js/lib/peer_service_list";
import Block from "../block";

import fetch from "node-fetch";
import HTMLParser from 'node-html-parser';
import prettify from 'html-prettify';

import {toBase58} from "saito-js/lib/util";
import {TransactionType} from "saito-js/lib/transaction";
import {BlockType} from "saito-js/lib/block";

const JSON = require("json-bigint");

const expressApp = express();
expressApp.use(require("cors")());

const webserver = new Ser(expressApp);

const sum = (array) => array.reduce((partialSum, x) => partialSum + x, 0);

export class NodeSharedMethods extends CustomSharedMethods {
  public app: Saito;

  constructor(app: Saito) {
    super();
    this.app = app;
  }

  sendMessage(peerIndex: bigint, buffer: Uint8Array): void {
    try {
      const socket = S.getInstance().getSocket(peerIndex);
      if (socket) {
        socket.send(buffer);
      }
    } catch (e) {
      console.error(e);
    }
  }

  sendMessageToAll(buffer: Uint8Array, exceptions: bigint[]): void {
    S.getInstance().sockets.forEach((socket, key) => {
      if (!exceptions.includes(key)) {
        try {
          socket.send(buffer);
        } catch (error) {
          console.error(error);
        }
      }
    });
  }

  connectToPeer(url: string, peer_index: bigint): void {
    try {
      console.log("connecting to " + url + "....");

      const socket = new ws.WebSocket(url);
      S.getInstance().addNewSocket(socket, peer_index);

      socket.on("message", (buffer: any) => {
        try { S.getLibInstance().process_msg_buffer_from_peer(buffer, peer_index); } catch (e) { console.error(e); }
      });
      socket.on("close", () => {
        try { S.getLibInstance().process_peer_disconnection(peer_index); } catch (e) { console.error(e); }
      });
      socket.on("error", (error) => {
        console.error(error);
        try { S.getLibInstance().process_peer_disconnection(peer_index); } catch (e) { console.error(e); }
      });
      socket.on("open", () => {
        S.getLibInstance()
          .process_new_peer(peer_index, url)
          .then(() => { console.log("connected to : " + url + " with peer index : " + peer_index); });
      });
    } catch (error) {
      console.error(error);
    }
  }

  writeValue(key: string, value: Uint8Array): void {
    try {
      fs.writeFileSync(key, value);
    } catch (error) {
      console.error(error);
    }
  }

  appendValue(key: string, value: Uint8Array): void {
    try {
      fs.appendFileSync(key, value);
    } catch (error) {
      console.error(error);
    }
  }

  flushData(key: string): void {}

  readValue(key: string): Uint8Array {
    try {
      return fs.readFileSync(key);
    } catch (error) {
      console.error(error);
      return new Uint8Array();
    }
  }

  loadBlockFileList(): string[] {
    try {
      let files = fs.readdirSync("data/blocks/");
      files = files.filter((file: string) => file.endsWith(".sai"));
      return files;
    } catch (e) {
      console.log("cwd : ", process.cwd());
      console.error(e);
      return [];
    }
  }

  isExistingFile(key: string): boolean {
    try {
      return !!fs.existsSync(key);
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  removeValue(key: string): void {
    try {
      fs.rmSync(key);
    } catch (e) {
      console.error(e);
    }
  }

  disconnectFromPeer(peerIndex: bigint): void {
    S.getInstance().removeSocket(peerIndex);
  }

  fetchBlockFromPeer(url: string): Promise<Uint8Array> {
    console.log("fetching block from peer: " + url);
    return fetch(url)
      .then((res: any) => {
        return res.arrayBuffer();
      })
      .then((buffer: ArrayBuffer) => {
        console.log("block data fetched for " + url + " with size : " + buffer.byteLength);
        return new Uint8Array(buffer);
      })
      .catch((err) => {
        console.error("Error fetching block: " + url, err);
        throw "failed fetching block";
      });
  }

  async processApiCall(buffer: Uint8Array, msgIndex: number, peerIndex: bigint): Promise<void> {
    const peer = await this.app.network.getPeer(peerIndex);
    const newtx = new Transaction();
    try {
      newtx.deserialize(buffer);
      newtx.unpackData();
    } catch (error) {
      console.error(error);
      newtx.msg = buffer;
    }
    await this.app.modules.handlePeerTransaction(newtx, peer, async (responseObject) => {
      await S.getInstance().sendApiSuccess(
        msgIndex, responseObject ? Buffer.from(JSON.stringify(responseObject), "utf-8") : Buffer.alloc(0), peerIndex
      );
    });
  }

  sendInterfaceEvent(event: string, peerIndex: bigint, public_key: string) {
    this.app.connection.emit(event, peerIndex, public_key);
  }

  sendBlockSuccess(hash: string, blockId: bigint) {
    this.app.connection.emit("add-block-success", {hash, blockId});
  }

  sendWalletUpdate() {
    this.app.connection.emit("wallet-updated");
  }

  sendBlockFetchStatus(count: bigint) {
    this.app.connection.emit("block-fetch-status", {count: count});
  }

  async saveWallet(): Promise<void> {
    if (this.app.options.wallet && this.app.wallet) {
      this.app.options.wallet.publicKey  = await this.app.wallet.getPublicKey();
      this.app.options.wallet.privateKey = await this.app.wallet.getPrivateKey();
      this.app.options.wallet.balance    = await this.app.wallet.getBalance();
    }
  }

  loadWallet():     void { throw new Error("Method not implemented."); }
  saveBlockchain(): void { throw new Error("Method not implemented."); }
  loadBlockchain(): void { throw new Error("Method not implemented."); }

  getMyServices() {
    const list = new PeerServiceList();
    for (const s of this.app.network.getServices()) {
      list.push(s)
    }
    return list;
  }

  sendNewVersionAlert(major: number, minor: number, patch: number, peerIndex: bigint): void {
    console.error("This is an older version", "current version: ", this.app.wallet.version, " expected version: ", major);
  }

  ensureDirExists(path: string): void {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }
  }
  
  sendNewChainDetectedEvent(): void {
    this.app.connection.emit("new-chain-detected");
  }
}

class Server {
  public app: Saito;
  public blocks_dir: string;
  public web_dir: string;
  public server: any = {
    host: "", port: 0, publicKey: "", protocol: "", name: "", url: "", block_fetch_url: "", endpoint: {host: "", port: 0, protocol: ""}
  };
  public webserver: any;
  public server_file_encoding: string;
  public host: string;
  public port: number;
  public protocol: string;

  constructor(app: Saito) {
    this.app = app;

    this.blocks_dir = path.join(__dirname, "../../../data/blocks/");
    this.web_dir = path.join(__dirname, "../../../web/");

    this.webserver = null;
    this.server_file_encoding = "utf8";
  }

  initializeWebSocketServer() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ws = require("ws");

    const wss = new ws.WebSocketServer({noServer: true, path: "/wsopen"});
    webserver.on("upgrade", (request: any, socket: any, head: any) => {
      console.debug("connection upgrade ----> " + request.url);
      const {pathname} = parse(request.url);
      if (pathname === "/wsopen") {
        wss.handleUpgrade(request, socket, head, (websocket: any) => {
          wss.emit("connection", websocket, request);
        });
      }
    });
    webserver.on("error", (error) => {
      console.error("error on express : ", error);
    });
    wss.on("connection", (socket: any, request: any) => {
      console.log("connection established : ", request.headers["x-forwarded-for"] + " || " + request.socket.remoteAddress);
      S.getLibInstance()
        .get_next_peer_index()
        .then((peer_index: bigint) => {
          console.log("adding new peer : " + (request.headers["x-forwarded-for"] + request.socket.remoteAddress) + " as " + peer_index);
          S.getInstance().addNewSocket(socket, peer_index);

          socket.on("message", (buffer: any) => {
            S.getLibInstance().process_msg_buffer_from_peer(new Uint8Array(buffer), peer_index);
          });
          socket.on("close", () => {
            S.getLibInstance().process_peer_disconnection(peer_index);
          });
          socket.on("error", (error) => {
            console.error("error on socket : " + peer_index, error);
            S.getLibInstance().process_peer_disconnection(peer_index);
          });

          return S.getLibInstance().process_new_peer(peer_index, request.headers["x-forwarded-for"] || request.socket.remoteAddress);
        });
    });

    this.app.modules.onWebSocketServer(webserver);
  }

  initialize() {
    if (this.app.BROWSER === 1) {
      return;
    }

    if (this.app.options.server != null) {
      this.server.host = this.app.options.server.host;
      this.server.port = this.app.options.server.port;
      this.server.protocol = this.app.options.server.protocol;
      this.server.name = this.app.options.server.name || "";

      this.server.sendblks    = typeof this.app.options.server.sendblks    == "undefined" ? 1 : this.app.options.server.sendblks;
      this.server.sendtxs     = typeof this.app.options.server.sendtxs     == "undefined" ? 1 : this.app.options.server.sendtxs;
      this.server.sendgts     = typeof this.app.options.server.sendgts     == "undefined" ? 1 : this.app.options.server.sendgts;
      this.server.receiveblks = typeof this.app.options.server.receiveblks == "undefined" ? 1 : this.app.options.server.receiveblks;
      this.server.receivetxs  = typeof this.app.options.server.receivetxs  == "undefined" ? 1 : this.app.options.server.receivetxs;
      this.server.receivegts  = typeof this.app.options.server.receivegts  == "undefined" ? 1 : this.app.options.server.receivegts;
    }

    if (this.server.host === "" || this.server.port === 0) {
      console.log("Not starting local server as no hostname / port in options file");
      return;
    }

    if (this.app.options.server.endpoint != null) {
      this.server.endpoint.port = this.app.options.server.endpoint.port;
      this.server.endpoint.host = this.app.options.server.endpoint.host;
      this.server.endpoint.protocol = this.app.options.server.endpoint.protocol;
      this.server.endpoint.publicKey = this.app.options.server.publicKey;
    } else {
      const {host, port, protocol, publicKey} = this.server;
      this.server.endpoint = {host, port, protocol, publicKey};
      this.app.options.server.endpoint = {host, port, protocol, publicKey};
      console.log("SAVE OPTIONS IN SERVER");
      this.app.storage.saveOptions();
    }

    const {protocol, host, port} = this.server.endpoint;
    const url = `${protocol}://${host}:${port}`;

    this.server.url = url;
    this.server.block_fetch_url = url;

    this.app.options.server = Object.assign(this.app.options.server, this.server);
    console.log("SAVE OPTIONS IN SERVER 2");
    this.app.storage.saveOptions();

    expressApp.use(bodyParser.urlencoded({extended: true}));
    expressApp.use(bodyParser.json());

    expressApp.get("/blocks/:bhash/:pkey", async (req, res) => {
      const bhash = req.params.bhash;
      if (bhash == null) {
        return;
      }

      try {
        const blk = await this.app.blockchain.getBlock(bhash);
        if (!blk) {
          console.info("Block block doesn't exist. cannot serve block. hash : " + bhash);
          return;
        }
        console.info("serving block : " + blk.file_name);
        const filename = "./data/blocks/" + blk.file_name;
        res.writeHead(200, {"Content-Type": "text/plain", "Content-Transfer-Encoding": "utf8"});
        const src = fs.createReadStream(filename, {encoding: "utf8"});
        src.pipe(res);
      } catch (error) {
        console.error("FETCH BLOCKS ERROR SINGLE BLOCK FETCH: ", error);
        console.info("### write from line server.ts:422");
        res.status(400);
        res.end({error: {message: `FAILED SERVER REQUEST: could not find block: ${bhash}`}});
      }
    });

    expressApp.get("/lite-block/:bhash/:pkey?", async (req, res) => {
      if (req.params.bhash == null) {
        return;
      }
      let pkey = await this.app.wallet.getPublicKey();
      if (req.params.pkey != null) {
        pkey = req.params.pkey;
        if (pkey.length == 66) {
          pkey = toBase58(pkey);
        }
      }

      const bsh = req.params.bhash;
      let keylist = [];
      let peer: Peer | null = null;
      let peers: Peer[] = await this.app.network.getPeers();
      for (let i = 0; i < peers.length; i++) {
        try {
          if (peers[i].publicKey === pkey) {
            peer = peers[i];
            break;
          }
        } catch (error) {
          console.error(error);
        }
      }
      if (peer == null) {
        keylist.push(pkey);
      } else {
        keylist = peer.keyList;
        if (!keylist.includes(pkey)) {
          keylist.push(pkey);
        }
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const block = await this.app.blockchain.getBlock(bsh);

      if (!block) {
        console.log(`block : ${bsh} doesn't exist...`);
        if (!res.finished) {
          res.sendStatus(404);
        }
        return;
      }

      if (block.block_type === BlockType.Full || !block.hasKeylistTxs(keylist)) {
        const liteblock = block.generateLiteBlock(keylist);
        const buffer = Buffer.from(liteblock.serialize());

        if (!res.finished) {
          res.writeHead(200, {"Content-Type": "text/plain", "Content-Transfer-Encoding": "utf8"});
          return res.end(buffer, "utf8");
        }

        return;
      }

      console.log("loading block from disk : " + bsh);

      let methods = new NodeSharedMethods(this.app);

      try {
        let buffer = new Uint8Array();
        for (const filename of methods.loadBlockFileList()) {
          if (filename.includes(bsh)) {
            buffer = methods.readValue("./data/blocks/" + filename);
            break;
          }
        }
        if (buffer.byteLength == 0) {
          if (!res.finished) {
            return res.sendStatus(404);
          }
          return;
        }
        const blk = new Block();
        blk.deserialize(buffer);
        const newblk = blk.generateLiteBlock(keylist);

        console.log(`lite block fetch : block  = ${req.params.bhash} key = ${pkey} with txs : ${newblk.transactions.length}`);
        console.log(`liteblock : ${bsh} from disk txs count = : ${newblk.transactions.length}`);
        console.log("valid txs : " + newblk.transactions.filter((tx) => tx.type !== TransactionType.SPV).length);
        const buffer2 = Buffer.from(newblk.serialize());

        if (!res.finished) {
          res.writeHead(200, {"Content-Type": "text/plain", "Content-Transfer-Encoding": "utf8"});
          return res.end(buffer2);
        }
        return;
      } catch (error) {
        console.log("failed serving lite block : " + bsh);
        console.error(error);
      }
      try {
        if (!res.finished) {
          res.sendStatus(400);
        }
        return;
      } catch (error) {
        console.error(error);
      }
    });

    expressApp.get("/block/:hash", async (req, res) => {
      try {
        const hash = req.params.hash;
        if (!hash) {
          console.warn("hash not provided");
          if (!res.finished) {
            return res.sendStatus(400);
          }
        }

        const block = await this.app.blockchain.loadBlockAsync(hash);
        const buffer = block.serialize();

        if (!block) {
          console.warn("block not found for : " + hash);
          if (!res.finished) {
            return res.sendStatus(404);
          }
          return;
        }
        console.info("serving block : " + block.id + "-" + block.hash);

        if (!res.finished) {
          res.status(200);
          res.end(buffer);
        }
      } catch (err) {
        console.log("ERROR: server cannot feed out block");
        if (!res.finished) {
          return res.sendStatus(404);
        }
      }
    });

    expressApp.get("/balance/:keys?", async (req, res) => {
      try {
        const keys = (req.params.keys) ? req.params.keys.split(";") : [];
        const snapshot = await S.getInstance().getBalanceSnapshot(keys.map((key) => (key.length === 66) ? toBase58(key) : key));
        res.setHeader("Content-Disposition", "attachment; filename=" + snapshot.file_name);
        res.end(snapshot.toString());
      } catch (error) {
        console.error(error);
        if (!res.finished) {
          return res.sendStatus(404);
        }
        return;
      }
    });

    expressApp.get("/lite-block-disk/:bhash/:pkey?", async (req, res) => {
      if (req.params.bhash == null) {
        return;
      }
      let pkey = await this.app.wallet.getPublicKey();
      if (req.params.pkey != null) {
        pkey = req.params.pkey;
        if (pkey.length == 66) {
          pkey = toBase58(pkey);
        }
      }

      const bsh = req.params.bhash;
      let keylist = [];
      let peer: Peer | null = null;
      let peers: Peer[] = await this.app.network.getPeers();
      for (let i = 0; i < peers.length; i++) {
        try {
          if (peers[i].publicKey === pkey) {
            peer = peers[i];
            break;
          }
        } catch (error) {
          console.error(error);
        }
      }
      if (peer == null) {
        keylist.push(pkey);
      } else {
        keylist = peer.keyList;
        if (!keylist.includes(pkey)) {
          keylist.push(pkey);
        }
      }

      if (!res.finished) {
        const methods = new NodeSharedMethods(this.app);

        try {
          const filename = methods.loadBlockFileList().find((name) => name.includes(bsh));
          const buffer = filename ? methods.readValue(`./data/blocks/${filename}`) : new Uint8Array();

          if (buffer.byteLength == 0) {
            return res.sendStatus(404);
          } else {
            res.writeHead(200, {"Content-Type": "application/json", "Content-Transfer-Encoding": "UTF-8"});

            const blk = new Block();
            blk.deserialize(buffer);
    
            const newblk = blk.generateLiteBlock(keylist);
            const block = JSON.parse(newblk.toJson());
    
            for (const [txIndex, tx] of block.transactions.entries()) {
              tx.id = txIndex;
            }
  
            const html = `
              <div class="block-table">
                <div>
                  <h4>id</h4>
                </div>
                <div>${block.id}</div>
  
                <div>
                  <h4>hash</h4>
                </div>
                <div>${bsh}</div>
  
                <div>
                  <h4>creator</h4>
                </div>
                <div>${block.creator}</div>
  
                <div>
                  <h4>source</h4>
                </div>
                <div>
                  <a href="/explorer/blocksource?hash=${bsh}">click to view source</a>
                </div>
              </div>
            ` + (() => {
              if (block.transactions.length === 0) {
                return "";
              } else {
                const nolanPerSaito = 100000000;
      
                const getTxFees = (tx) => {
                  const inputs = (tx.from == null) ? 0 : sum(tx.from.map((x) => x.amount));
                  const outputs = sum(tx.to.map((x) => (x.type == 1 || x.type == 2) ? x.amount : 0));
                  return (tx.from.length === 0 && tx.type === 6) ? 0 : (inputs - outputs);
                };
      
                return `
                    <h3>Bundled Transactions:</h3>
                  </div>
      
                  <div class="block-transactions-table">
                    <div class="table-header">id</div>
                    <div class="table-header">sender</div>
                    <div class="table-header">fee</div>
                    <div class="table-header">type</div>
                    <div class="table-header">module</div>
      
                    ${
                      block.transactions.entries().map((txIndex, tx) => `
                        <div>
                          <a onclick="showTransaction('tx-${tx.id}');">
                            ${txIndex}
                          </a>
                        </div>
      
                        <div>
                          <a onclick="showTransaction('tx-${tx.id}');">
                            ${
                              (tx.from.length > 0) ? tx.from[0].publicKey :
                              (tx.type === 6     ) ? "issuance tx"        :
                              (tx.type === 7     ) ? "block stake tx"     : "fee tx"
                            }
                          </a>
                        </div>
      
                        <div>${getTxFees(tx) * nolanPerSaito}</div>
                        <div>${tx.type}</div>
                        <div>${(tx.type == 0) ? (tx.msg?.module ? tx.msg?.module : "Money") : (tx.type == 1) ? tx.msg?.name : ""}</div>
                        <div class="hidden txbox tx-${tx.id}">${JSON.stringify(tx)}</div>
                      `).join("\n")
                    }
                  </div>
                `;
              }
            })();
            return res.end(JSON.stringify({html: html}));
          }
        } catch (error) {
          console.error("failed serving lite block : " + bsh);
          console.error(error);
        }
      }
    });

    expressApp.get("/options", (req, res) => {
      // @ts-ignore
      res.send(this.app.storage.getClientOptions());
    });

    expressApp.get("/r", (req, res) => {
      if (!res.finished) {
        return res.sendFile(this.web_dir + "refer.html");
      }
    });

    expressApp.get("/saito/saito.js", (req, res) => {
      if (!res.finished) {
        return res.sendFile(this.web_dir + "/saito/saito.js");
      }
    });

    expressApp.get("/stats",            async (req, res) => { res.send(await S.getLibInstance().get_stats()           ); });
    expressApp.get("/stats/peers",      async (req, res) => { res.send(await S.getLibInstance().get_peer_stats()      ); });
    expressApp.get("/stats/congestion", async (req, res) => { res.send(await S.getLibInstance().get_congestion_stats()); });

    expressApp.use(express.static(this.web_dir));

    this.app.modules.webServer(expressApp, express);

    expressApp.get("/", (req, res) => {
      if (!res.finished) {
        return res.sendFile(`${this.web_dir}index_default.html`);
      }
    });

    expressApp.get("*", (req, res) => {
      if (!res.finished) {
        return res.sendFile(`${this.web_dir}404.html`);
      }
    });

    this.initializeWebSocketServer();

    webserver.listen(this.server.port, () => { console.log("web server is listening"); });
    this.webserver = webserver;

    this.app.connection.emit("saito-server-listening");
  }

  close() {
    this.webserver.close();
  }

  async fetchOpenGraphProperties(link, callback=null) {
    return fetch(link, {redirect: "follow", follow: 50})
      .then((res) => res.text())
      .then((data) => {
        const no_tags = {title: "", description: ""};
        const og_tags = {
          "og:title": "", "og:description": "", "og:url": "", "og:image": "", "og:site_name": "", "saito:description": "", "saito:title": ""
        };
        const tw_tags = {
          "twitter:title": "", "twitter:description": "", "twitter:url": "", "twitter:image": "", "twitter:site": "", "twitter:card": ""
        };

        
        const dom = HTMLParser.parse(prettify(data));

        try {
          no_tags.title = dom.getElementsByTagName("title")[0].textContent;
        } catch (err) {}

        const metaTags = dom.getElementsByTagName("meta");

        let hasOG = false;
        let hasTwitter = false;
        for (let i = 0; i < metaTags.length; i++) {
          const property = metaTags[i].getAttribute("property");
          const content = metaTags[i].getAttribute("content");
          if (property in og_tags) {
            og_tags[property] = content;
            hasOG = true;
          }
          if (property in tw_tags) {
            tw_tags[property] = content;
            hasTwitter = true;
          }
          if (metaTags[i].getAttribute("name") === "description") {
            no_tags.description = content;
          }
        }

        if (hasTwitter && !hasOG) {
          og_tags["og:title"] = tw_tags["twitter:title"];
          og_tags["og:description"] = tw_tags["twitter:description"];
          og_tags["og:url"] = tw_tags["twitter:url"];
          og_tags["og:image"] = tw_tags["twitter:image"];
          og_tags["og:site_name"] = tw_tags["twitter:site"];
        }

        og_tags["og:title"] = og_tags["og:title"] || no_tags["title"];
        og_tags["og:description"] = og_tags["og:description"] || no_tags["description"];

        if (callback) {
          callback(og_tags);
        }

        return og_tags;
      })
      .catch(() => { return ""; });
  }
}

export default Server;