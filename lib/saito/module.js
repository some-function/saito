const path = require('path');
const HomePage = require('./module-index');
const JSON = require('json-bigint');


class Module {
  constructor(app, mod) {
    this.app = app || {};
    this.description = '';
    this.dirname = '';
    this.appname = '';
    this.name = '';
    this.dbname = '';
    this.slug = '';
    this.link = '';
    this.img = '';
    this.teaser = false;
    this.events = [];
    this.renderIntos = {};
    this.alerts = 0;
    this.categories = '';
    this.sqlcache = {};
    this.sqlcache_enabled = 0;
    this.services = [];
    this.components = [];
    this.request_no_interrupts = false;
    this.db_tables = [];
    this.urlpath = [];

    this.version = 1.0;
    this.styles = [];
    this.scripts = [];

    this.includes_attached = 0;

    this.eventListeners = [];

    this.theme_options = {
      lite: 'fa-solid fa-sun',
      raven: 'fa-solid fa-crow',
      dark: 'fa-solid fa-moon'
    };

    this.processedTxs = {};
    this.parameters = {};
    this.default_html = 1;
    this.browser_active = 0;
    this.possibleHome = 0;
    this.publicKey = '';
  }

  returnName() { return this.appname || this.name || 'Unknown Module'; }
  hasSettings() { return false; }
  loadSettings() {}
  attachEvents(app) {}
  async onConfirmation(blk, tx, confnum) {}
  onNewBlock(blk, lc) {}
  onChainReorganization(block_id, block_hash, lc) {}
  async onUpgrade(type='', privatekey='', walletfile=null) { this.publicKey = await this.app.wallet.getPublicKey(); }
  onPeerHandshakeComplete(app, peer = null) {}
  async onPeerServiceUp(app, peer, service) {}
  onConnectionStable(app, peer) {}
  onConnectionUnstable(app, publicKey) {}
  onStunPeerDisconnected(app, peer_index = null, public_key) {}
  getWebsocketPath() { return ''; }
  onWebSocketServer(wss) {}
  updateBlockchainSync(app, current, target) {}
  canRenderInto(querySelector = '') { return false; }
  async renderInto(querySelector = '') { return null; }
  respondTo(request_type = '', obj) { return null; }
  returnServices() { return this.services; }
  isSlug(slug) { return slug == this.returnSlug(); }

  async installModule(app) {
    if (this.app.BROWSER === 1) {
      return;
    }

    let sqldir = `${__dirname}/../../mods/${this.dirname}/sql`;

    let fs = app.storage.returnFileSystem();
    let dbname = encodeURI(this.returnSlug());
    if (this.dbname) {
      dbname = this.dbname;
    }

    if (fs != null) {
      if (fs.existsSync(path.normalize(sqldir))) {
        let sql_files = fs.readdirSync(sqldir).sort();

        for (let i = 0; i < sql_files.length; i++) {
          try {
            let filename = path.join(sqldir, sql_files[i]);
            let data = fs.readFileSync(filename, 'utf8');
            await app.storage.executeDatabase(data, dbname);
          } catch (err) {
            console.error('installModule Error: ', err);
          }
        }
      }
    }
  }

  async initialize(app) {
    this.publicKey = await this.app.wallet.getPublicKey();

    if (app.BROWSER === 1) {
      if (this.browser_active) {
        if (app.options.settings?.debug) {
          console.debug('Set debug flag true from options file ' + this.name);
          this.debug = true;
        }
      }

      const current_url = window.location.toString();
      const myurl = new URL(current_url);
      const myurlpath = myurl.pathname.split('/');
      this.urlpath = myurlpath;

      return;
    }

    let sqldir = `${__dirname}/../../mods/${this.dirname}/sql`;
    let fs = app?.storage?.returnFileSystem();
    if (fs != null) {
      if (fs.existsSync(path.normalize(sqldir))) {
        let sql_files = fs.readdirSync(sqldir);

        for (let i = 0; i < sql_files.length; i++) {
          let tablename = sql_files[i].slice(0, -4);
          tablename = tablename.replace(/\d+$/, '');
          this.db_tables.push(tablename);
        }
      }
    }

    if (this.appname === '') {
      this.appname = this.name;
    }
  }

  async render() {
    if (this.browser_active && this.possibleHome) {
      this.app.options.homeModule = this.returnName();
      this.app.storage.saveOptions();
    }

    if (this.includes_attached === 0) {
      if (this.styles?.length > 0) {
        this.attachStyleSheets();
      }
      if (this.scripts?.length > 0) {
        console.debug('attachScripts in ' + this.name, this.scripts);
        this.attachScripts();
      }
      if (this.postScripts?.length > 0) {
        this.attachPostScripts();
      }

      this.includes_attached = 1;
    }

    for (let i = 0; i < this.components.length; i++) {
      await this.components[i].render();
    }
  }

  webServer(app, expressapp, express) {
    let webdir = `${__dirname}/../../mods/${this.dirname}/web`;
    let fs = app?.storage?.returnFileSystem();

    if (fs?.existsSync(webdir)) {
      expressapp.use('/' + encodeURI(this.returnSlug()), express.static(webdir));
    } else if (this.default_html) {
      const mod_self = this;

      expressapp.get('/' + encodeURI(this.returnSlug()), async function (req, res) {
        let reqBaseURL = req.protocol + '://' + req.headers.host + '/';

        let html = HomePage(app, mod_self, app.build_number);

        if (!res.finished) {
          res.setHeader('Content-type', 'text/html');
          res.charset = 'UTF-8';
          return res.send(html);
        }
        return;
      });
    }
  }

  async handlePeerTransaction(app, tx = null, peer, mycallback = null) {
    if (tx == null) {
      return 0;
    }
    let txmsg;
    try {
      txmsg = tx.returnMessage();
    } catch (err) {
      console.log(
        '!!@@!@#!#!@#!@#\n!!@@!@#!#!@#!@#\n!!@@!@#!#!@#!@#\n',
        JSON.parse(JSON.stringify(tx))
      );
      console.error('Module [HPT] ERROR: ', err);

      return 0;
    }

    for (let i = 0; i < this.db_tables.length; i++) {
      let expected_request = this.name.toLowerCase() + ' load ' + this.db_tables[i];
      if (txmsg?.request === expected_request) {
        console.trace('expected_request : ' + expected_request);
        let select = txmsg.data?.select;
        let dbname = txmsg.data?.dbname;
        let tablename = txmsg.data?.tablename;
        let where = txmsg.data?.where;

        if (!/^[a-z"`'=_*()\.\n\t\r ,0-9A-Z]+$/.test(select)) {
          return;
        }
        if (!/^[a-z"`'=_()\. ,0-9A-Z]+$/.test(dbname)) {
          return;
        }
        if (!/^[a-z"`'=_()\. ,0-9A-Z]+$/.test(tablename)) {
          return;
        }

        let sql = `SELECT ${select}
                   FROM ${tablename}`;
        if (where !== '') {
          sql += ` WHERE ${where}`;
        }
        let params = {};
        let rows = await this.app.storage.queryDatabase(sql, params, dbname);

        let res = {};
        res.err = '';
        res.rows = rows;

        if (mycallback) {
          mycallback(res);
          return 1;
        }

        return 0;
      }
    }

    let txreq = txmsg.request;
    if (txreq === 'rawSQL') {
      if (txmsg?.data?.module === this.name) {
        let sql = txmsg?.data?.sql;
        let dbname = txmsg?.data?.dbname;
        let params = {};
        let rows;

        if (this.sqlcache[sql] && this.sqlcache_enabled === 1) {
          rows = this.sqlcache[sql];
        } else {
          rows = await this.app.storage.queryDatabase(sql, params, dbname);
          if (this.sqlcache_enabled) {
            this.sqlcache[sql] = rows;
          }
        }

        let res = {};
        res.err = '';
        res.rows = rows;

        if (mycallback) {
          mycallback(res);
          return 1;
        }

        return 0;
      }
    }

    return 0;
  }

  activateModule() {
    if (!this.app.BROWSER) {
      console.error('Attempting to set browser_active on a non-browser node!');
      return;
    }
    this.browser_active = 1;
    this.alerts = 0;
  }

  returnSlug() {
    if (this.slug !== '') {
      return this.slug;
    } else {
      if (this.appname) {
        this.slug = this.appname.toLowerCase();
      } else {
        this.slug = this.name.toLowerCase();
      }
      this.slug = this.slug.replace(/\t/g, '_').replace(/\ /g, '');
      return this.slug;
    }
  }

  attachStyleSheets() {
    if (this.stylesheetAdded === true) return;
    this.styles.forEach((stylesheet) => {
      let should_attach_sheet = true;
      document.querySelectorAll('link').forEach((el) => {
        try {
          if (el?.rel === 'stylesheet' && el.attributes.href.nodeValue.includes(stylesheet)) {
            should_attach_sheet = false;
          }
        } catch (err) {}
      });

      if (should_attach_sheet) {
        const s = document.createElement('link');
        s.rel = 'stylesheet';
        s.type = 'text/css';
        s.href = stylesheet + '?v=' + this.app.build_number;
        document.querySelector('head').appendChild(s);
      }
    });
    this.stylesheetAdded = true;
  }

  attachScripts() {
    if (this.scriptsAdded === true) {
      return;
    }
    this.scriptsAdded = true;

    let scriptCount = 0;
    for (let script of this.scripts) {
      let script_attached = false;

      document.querySelectorAll('script').forEach((el) => {
        try {
          if (el.attributes.src.nodeValue === script) {
            script_attached = true;
          }
        } catch (err) {}
      });
      scriptCount++;
      if (!script_attached) {
        this.attachScript(script);
      }
    }
  }

  attachScript(script) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.type = 'text/javascript';
      s.src = script + '?v=' + this.app.build_number;

      s.addEventListener('load', () => {
        console.info('Script loaded dynamically');
        resolve();
      });
      s.addEventListener('error', () => {
        console.error('Error loading script');
        reject();
      });
      document.querySelector('head').appendChild(s);
    });
  }

  attachPostScripts() {
    if (this.postScriptsAdded === true) {
      return;
    }
    this.postScripts.forEach((script) => {
      let script_attached = false;
      document.querySelectorAll('script').forEach((el) => {
        try {
          if (el.attributes.src.nodeValue === script) {
            script_attached = true;
          }
        } catch (err) {}
      });
      if (!script_attached) {
        const s = document.createElement('script');
        s.type = 'text/javascript';
        s.src = script;
        s.type = 'module';
        document.querySelector('body').appendChild(s);
      }
    });
    this.postScriptsAdded = true;
  }
}

module.exports = Module;