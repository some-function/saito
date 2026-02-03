const path = require("path");
const HomePage = require("./module-index");
const JSON = require("json-bigint");


class Module {
  constructor(app, mod) {
    this.app = app || {};
    this.description = "";
    this.dirname = "";
    this.appname = "";
    this.name = "";
    this.dbname = "";
    this.slug = "";
    this.link = "";
    this.img = "";
    this.events = [];
    this.renderIntos = {};
    this.alerts = 0;
    this.categories = "";
    this.sqlCache = {};
    this.services = [];
    this.dbTables = [];
    this.urlpath = [];

    this.version = 1.0;
    this.styles = [];

    this.includesAttached = false;

    this.eventListeners = [];

    this.themeOptions = {lite: "fa-solid fa-sun", raven: "fa-solid fa-crow", dark: "fa-solid fa-moon"};

    this.processedTxs = {};
    this.parameters = {};
    this.browserActive = 0;
    this.possibleHome = 0;
    this.publicKey = "";
  }

  returnName() { return this.appname || this.name || "Unknown Module"; }
  hasSettings() { return false; }
  loadSettings() {}
  attachEvents(app) {}
  async onConfirmation(blk, tx, confnum) {}
  onNewBlock(blk, lc) {}
  onChainReorganization(block_id, block_hash, lc) {}
  async onUpgrade(type="", privatekey="", walletfile=null) { this.publicKey = await this.app.wallet.getPublicKey(); }
  onPeerHandshakeComplete(app, peer = null) {}
  async onPeerServiceUp(app, peer, service) {}
  onConnectionStable(app, peer) {}
  onConnectionUnstable(app, publicKey) {}
  onStunPeerDisconnected(app, peer_index = null, public_key) {}
  getWebsocketPath() { return ""; }
  onWebSocketServer(wss) {}
  canRenderInto(querySelector = "") { return false; }
  async renderInto(querySelector = "") { return null; }
  respondTo(request_type = "", obj) { return null; }
  returnServices() { return this.services; }
  isSlug(slug) { return slug == this.returnSlug(); }

  async installModule(app) {
    if (this.app.BROWSER !== 1) {
      const sqldir = `${__dirname}/../../mods/${this.dirname}/sql`;
      const fs = app.storage.returnFileSystem();
      const dbname = this.dbname ? this.dbname : encodeURI(this.returnSlug());
  
      if (fs != null && fs.existsSync(path.normalize(sqldir))) {
        const sqlFiles = fs.readdirSync(sqldir).sort();

        for (let i = 0; i < sqlFiles.length; i++) {
          try {
            const filename = path.join(sqldir, sqlFiles[i]);
            const data = fs.readFileSync(filename, "utf8");
            await app.storage.executeDatabase(data, dbname);
          } catch (err) {
            console.error("installModule Error: ", err);
          }
        }
      }
    }
  }

  async initialize(app) {
    this.publicKey = await this.app.wallet.getPublicKey();

    if (app.BROWSER === 1) {
      if (this.browserActive && app.options.settings?.debug) {
        console.debug("Set debug flag true from options file " + this.name);
        this.debug = true;
      }

      const currentUrl = window.location.toString();
      this.urlpath = (new URL(currentUrl)).pathname.split("/");
    } else {
      const sqldir = `${__dirname}/../../mods/${this.dirname}/sql`;
      const fs = app?.storage?.returnFileSystem();
      if (fs != null && fs.existsSync(path.normalize(sqldir))) {
        const sqlFiles = fs.readdirSync(sqldir);
        for (const sqlFile of sqlFiles) {
          const tablename = sqlFile.slice(0, -4).replace(/\d+$/, "");
          this.dbTables.push(tablename);
        }
      }
  
      if (this.appname === "") {
        this.appname = this.name;
      }
    }
  }

  async render() {
    if (this.browserActive && this.possibleHome) {
      this.app.options.homeModule = this.returnName();
      this.app.storage.saveOptions();
    }

    if (!this.includesAttached) {
      if (this.styles?.length > 0) {
        this.attachStyleSheets();
      }

      this.includesAttached = true;
    }
  }

  webServer(app, expressapp, express) {
    const webdir = `${__dirname}/../../mods/${this.dirname}/web`;
    const fs = app?.storage?.returnFileSystem();

    if (fs?.existsSync(webdir)) {
      expressapp.use("/" + encodeURI(this.returnSlug()), express.static(webdir));
    } else {
      expressapp.get("/" + encodeURI(this.returnSlug()), (req, res) => {
        if (!res.finished) {
          res.setHeader("Content-type", "text/html");
          res.charset = "UTF-8";
          return res.send(HomePage(app, this, app.buildNumber));
        }
      });
    }
  }

  async handlePeerTransaction(app, tx=null, peer, mycallback=null) {
    if (tx == null) {
      return 0;
    }
    let txmsg;
    try {
      txmsg = tx.returnMessage();
    } catch (err) {
      console.log("!!@@!@#!#!@#!@#\n!!@@!@#!#!@#!@#\n!!@@!@#!#!@#!@#\n", JSON.parse(JSON.stringify(tx)));
      console.error("Module [HPT] ERROR: ", err);

      return 0;
    }

    for (let i = 0; i < this.dbTables.length; i++) {
      let expected_request = this.name.toLowerCase() + " load " + this.dbTables[i];
      if (txmsg?.request === expected_request) {
        console.trace("expected_request : " + expected_request);
        const select = txmsg.data?.select;
        const dbname = txmsg.data?.dbname;
        const tablename = txmsg.data?.tablename;
        const b = !/^[a-z"`'=_*()\.\n\t\r ,0-9A-Z]+$/.test(select)
               || !/^[a-z"`'=_()\. ,0-9A-Z]+$/.test(dbname)
               || !/^[a-z"`'=_()\. ,0-9A-Z]+$/.test(tablename);
        if (b) {
          return;
        } else if (mycallback) {
          const where = txmsg.data?.where;
          const sql = `SELECT ${select} FROM ${tablename}${(where !== "") ? ` WHERE ${where}` : ""}`
          const rows = await this.app.storage.queryDatabase(sql, {}, dbname);
          mycallback({err: "", rows: rows});
          return 1;
        } else {
          return 0;
        }
      }
    }

    if (txmsg.request === "rawSQL" && txmsg?.data?.module === this.name) {
      const sql = txmsg?.data?.sql;
      const rows = await this.app.storage.queryDatabase(sql, {}, txmsg?.data?.dbname);

      if (mycallback) {
        mycallback({err: "", rows: rows});
        return 1;
      } else {
        return 0;
      }
    }

    return 0;
  }

  activateModule() {
    if (!this.app.BROWSER) {
      console.error("Attempting to set browserActive on a non-browser node!");
      return;
    }
    this.browserActive = 1;
    this.alerts = 0;
  }

  returnSlug() {
    if (this.slug === "") {
      this.slug = (this.appname ? this.appname : this.name).toLowerCase().replace(/\t/g, "_").replace(/\ /g, "");
    }
    return this.slug;
  }

  attachStyleSheets() {
    if (this.stylesheetAdded === true) return;
    this.styles.forEach((stylesheet) => {
      let shouldAttachSheet = true;
      document.querySelectorAll("link").forEach((el) => {
        try {
          if (el?.rel === "stylesheet" && el.attributes.href.nodeValue.includes(stylesheet)) {
            shouldAttachSheet = false;
          }
        } catch (err) {}
      });

      if (shouldAttachSheet) {
        const s = document.createElement("link");
        s.rel = "stylesheet";
        s.type = "text/css";
        s.href = stylesheet + "?v=" + this.app.buildNumber;
        document.querySelector("head").appendChild(s);
      }
    });
    this.stylesheetAdded = true;
  }

  attachScript(script) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.src = script + "?v=" + this.app.buildNumber;

      s.addEventListener("load",  () => { console.info("Script loaded dynamically"); resolve(); });
      s.addEventListener("error", () => { console.error("Error loading script");     reject();  });
      document.querySelector("head").appendChild(s);
    });
  }
}

module.exports = Module;