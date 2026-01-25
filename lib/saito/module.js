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
    this.meta = [];
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

  static importFunctions() {
    let cls = this.prototype;
    let mixin;
    for (let arg = 0; arg < arguments.length; arg++) {
      mixin = arguments[arg].prototype;
      if (typeof mixin != 'undefined') {
        Object.getOwnPropertyNames(mixin).forEach((prop) => {
          if (prop == 'constructor') return;
          if (Object.getOwnPropertyNames(cls).includes(prop)) {
            console.warn('Module already includes ' + prop);
            return;
          }
          cls[prop] = mixin[prop];
        });
      }
    }
  }

  async initialize(app) {
    this.publicKey = await this.app.wallet.getPublicKey();

    for (let i = 0; i < this.events.length; i++) {
      app.connection.on(this.events[i], (data) => {
        this.receiveEvent(this.events[i], data);
      });
    }

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
      if (this.meta) {
        this.attachMeta();
      }
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

  returnName() {
    if (this.appname) {
      return this.appname;
    }
    if (this.name) {
      return this.name;
    }
    return 'Unknown Module';
  }

  returnTitle() { return this.title ? this.title : this.returnName(); }
  returnImage() { return (this.img != '') ? this.img : `/saito/img/dreamscape.png`; }
  returnBanner() { return `/saito/img/dreamscape.png`; }
  hasSettings() { return false; }
  loadSettings() {}
  async initializeHTML(app) {}
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
  shouldAffixCallbackToModule(modname, tx = null) { return (modname === this.name) ? 1 : 0; }


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

  updateBlockchainSync(app, current, target) {}

  addScript(s) {
    for (let i = 0; i < this.scripts.length; i++) {
      if (this.scripts[i] === s) {
        return;
      }
    }
    this.scripts.push(s);
  }

  addStyle(s) {
    for (let i = 0; i < this.styles.length; i++) {
      if (this.styles[i] === s) {
        return;
      }
    }
    this.styles.push(s);
  }

  addComponent(obj) {
    for (let i = 0; i < this.components.length; i++) {
      if (this.components[i] === obj) {
        return;
      }
    }
    this.components.push(obj);
  }

  removeComponent(obj) {
    for (let i = this.components.length; i >= 0; i--) {
      if (this.components[i] === obj) {
        this.components.splice(i, 1);
      }
    }
  }

  canRenderInto(querySelector = '') {
    return false;
  }

  async renderInto(querySelector = '') {
    return null;
  }

  respondTo(request_type = '', obj) {
    return null;
  }

  receiveEvent(eventname, data) {}

  sendEvent(eventname, data) {
    this.app.connection.emit(eventname, data);
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

  returnServices() {
    return this.services;
  }

  async sendPeerDatabaseRequest(
    dbname,
    tablename,
    select = '',
    where = '',
    peer = null,
    mycallback = null
  ) {
    const message = {};
    message.request = dbname + ' load ' + tablename;
    message.data = {};
    message.data.dbname = dbname;
    message.data.tablename = tablename;
    message.data.select = select;
    message.data.where = where;

    if (peer == null) {
      return this.app.network.sendRequestAsTransaction(
        message.request,
        message.data,
        function (res) {
          return mycallback(res);
        }
      );
    } else {
      return this.app.network.sendRequestAsTransaction(
        message.request,
        message.data,
        function (res) {
          return mycallback(res);
        },
        peer.peerIndex
      );
    }
  }

  async sendPeerDatabaseRequestWithFilter(
    modname = '',
    sql = '',
    success_callback = null,
    peerfilter = null
  ) {
    if (sql === '') {
      return;
    }
    if (modname === '') {
      return;
    }
    if (!this.app.modManager.returnModule(modname)) {
      console.error(modname + ' not found!');
      return;
    }
    let msg = {};

    msg.request = 'rawSQL';
    msg.data = {};
    msg.data.sql = sql;
    msg.data.module = modname;
    msg.data.dbname = this.app.modManager.returnModule(modname).returnSlug();

    this.sendPeerRequestWithFilter(
      () => {
        return msg;
      },
      success_callback,
      peerfilter
    );
  }

  async sendPeerRequestWithServiceFilter(servicename, msg, success_callback = (res) => {}) {
    this.sendPeerRequestWithFilter(
      () => {
        return msg;
      },
      success_callback,
      (peer) => {
        if (peer.services) {
          for (let z = 0; z < peer.services.length; z++) {
            if (peer.services[z].service === servicename) {
              return 1;
            }
          }
        }
      }
    );
  }

  async sendPeerRequestWithFilter(msg_callback = null, success_callback = null, peerfilter = null) {
    let message = msg_callback();

    if (message === null) {
      return;
    }

    let p = await this.app.network.getPeers();
    let peers = [];

    for (let i = 0; i < p.length; i++) {
      if (!peerfilter || peerfilter(p[i])) {
        peers.push(p[i]);
      }
    }

    if (peers.length === 0) {
      console.warn('sendPeerRequestWithFilter found no peers');
      return;
    }

    for (const peer of peers) {
      this.app.network.sendRequestAsTransaction(
        message.request,
        message.data,
        function (res) {
          if (success_callback != null) {
            success_callback(res);
          }
        },
        peer.peerIndex
      );
    }
  }

  async sendPeerDatabaseRequestRaw(db, sql, mycallback = null) {
    const message = {};

    message.request = 'rawSQL';
    message.data = {};
    message.data.sql = sql;
    message.data.dbname = db;
    message.data.module = this.name;

    return this.app.network.sendRequestAsTransaction(message.request, message.data, function (res) {
      return mycallback(res);
    });
  }

  activateModule() {
    if (!this.app.BROWSER) {
      console.error('Attempting to set browser_active on a non-browser node!');
      return;
    }
    this.browser_active = 1;
    this.alerts = 0;
  }

  isSlug(slug) {
    return slug == this.returnSlug();
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

  returnLink() {
    if (this.link !== '') {
      return this.link;
    } else {
      this.link = '/' + this.returnSlug();
      return this.link;
    }
  }

  showAlert() {
    this.alerts++;
    try {
      let qs = '#' + this.returnSlug() + ' > .redicon';
      document.querySelector(qs).style.display = 'block';
    } catch (err) {}
  }

  attachMeta() {}

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

  removeScripts() {
    this.scripts.forEach((script) => {
      console.info('removing script', script);
    });
    this.scriptsAdded = false;
  }

  attachMeta(app) {}

  removeStyleSheets(app) {
    this.stylesheets.forEach((stylesheet) => {
      console.info('removing stylesheet ', stylesheet);
    });

    this.stylesheetAdded = false;
  }

  removeMeta() {}

  removeEvents() {
    this.eventListeners.forEach((eventListener) => {
      document.removeEventListener(eventListener.type, eventListener.listener);
    });
  }

  destroy(app) {
    console.trace('destroying');
  }

  displayModal(modalHeaderText, modalBodyText = '') {
    salert(`${modalHeaderText}${modalBodyText ? ': <br>' : ''}${modalBodyText}`);
  }

  displayWarning(warningTitle, warningText = '', time = 4000) {
    let html = `<div class="game_warning_overlay">
                  <div class="game_warning_header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div class="game_warning_timer" >Auto close in <span id="clock_number">${Math.ceil(
                      time / 1000
                    )}</span>s</div> 
                  </div>
                  <h2>${warningTitle}</h2>
                  <p ${
                    warningText.length == 0 ? "style='flex:1;'" : "style='flex:2;'"
                  }>${warningText}</p>
                </div>`;

    let overlay_self = this.overlay;
    let timeouthash = null,
      intervalHash = null;
    if (time > 0) {
      timeouthash = setTimeout(() => {
        overlay_self.hide();
        clearInterval(intervalHash);
      }, time);
      intervalHash = setInterval(() => {
        time -= 250;
        try {
          document.getElementById('clock_number').innerHTML = Math.ceil(time / 1000);
        } catch (err) {}
      }, 250);
    }

    this.overlay.show(html, () => {
      if (timeouthash) {
        clearTimeout(timeouthash);
      }
      if (intervalHash) {
        clearInterval(intervalHash);
      }
    });
  }

  hasSeenTransaction(tx, blk_id = 0) {
    let hashed_data = this.name + tx.signature;
    if (this.processedTxs[hashed_data] !== undefined) {
      if (this.processedTxs[hashed_data]) {
        console.log(
          'prevent processing duplicated on chain transaction : ',
          tx.from[0]?.publicKey,
          tx.returnMessage(),
          this.processedTxs[hashed_data],
          blk_id
        );
      }

      this.processedTxs[hashed_data] = blk_id;
      return true;
    }
    this.processedTxs[hashed_data] = blk_id;

    return false;
  }

  getWebsocketPath() {
    return '';
  }

  onWebSocketServer(wss) {}
}

module.exports = Module;