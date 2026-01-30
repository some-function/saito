import {App} from "./app";
import Peer from "./peer";
import Transaction from "./transaction";
import ws from "ws";
import {parse} from "url";
import * as SaitoNodeLib from "../index";


class ModManager {
  public app: App;
  public mods: any;
  public uimods: any;
  public modsList: any;
  public isInitialized: any;
  public lowest_sync_bid: any;
  public appFilterFunc: any;
  public coreFilterFunc: any;

  constructor(app: App, config) {
    this.app = app;
    this.mods = [];
    this.appFilterFunc = [];
    this.coreFilterFunc = [];
    this.uimods = [];
    this.modsList = config;
    this.isInitialized = false;
    this.lowest_sync_bid = -1;
  }

  isModuleActive(modname = "") {
    for (let i = 0; i < this.mods.length; i++) {
      if (this.mods[i].browser_active == 1) {
        if (modname == this.mods[i].name) {
          return 1;
        }
      }
    }
    return 0;
  }

  returnActiveModule() {
    for (let i = 0; i < this.mods.length; i++) {
      if (this.mods[i].browser_active == 1) {
        return this.mods[i];
      }
    }
    return null;
  }

  attachEvents() {
    for (const mod of this.mods) {
      if (mod.browser_active == 1) mod.attachEvents(this.app);
    }
    return null;
  }

  affixCallbacks(tx, txindex, message, callbackArray, callbackIndexArray) {
    if (tx.type == 5) {
      console.log("No callbacks for type 5");
      return;
    }

    const coreAccepts = this.moderateCore(tx);

    for (let i = 0; i < this.mods.length; i++) {
      if ((message?.module || "") === this.mods[i].name) {
        const modAccepts = this.moderateModule(tx, this.mods[i]);
        if (modAccepts == 1 || (modAccepts == 0 && coreAccepts != -1)) {
          callbackArray.push(this.mods[i].onConfirmation.bind(this.mods[i]));
          callbackIndexArray.push(txindex);
        } else {
          console.warn(`Not affixing callback in ${this.mods[i].name} because of moderation`);
        }
      }
    }

    if (this.app.BROWSER) {
      console.debug(`Affix callbacks for ${message?.module} : ${message?.request}`);
    }
  }

  async handlePeerTransaction(tx: Transaction, peer: Peer, mycallback: (any) => Promise<void> = null) {
    let haveResponded = false;
    
    const txmsg = tx.returnMessage();

    let coreAccepts = 0;
    try {
      coreAccepts = this.moderateCore(tx);
      if (txmsg?.request === "software-update") this.app.browser.updateSoftwareVersion(JSON.parse(tx.msg.data).build_number);
    } catch (err) {}

    for (const mod of this.mods) {
      try {
        const modAccepts = this.moderateModule(tx, mod);
        if ((modAccepts == 1 || (modAccepts == 0 && coreAccepts != -1)) && await mod.handlePeerTransaction(this.app, tx, peer, mycallback)) {
          haveResponded = true;
        }
      } catch (err) {
        console.error(`handlePeerTransaction Unknown Error in ${mod.name}: `, err);
      }
    }
    if (haveResponded == false) {
      if (mycallback) {
        mycallback({});
      }
    }
  }

  async initialize() {
    try {
      if (this.app.BROWSER === 1) {
        const dynMods = await this.app.storage.loadLocalApplications();

        if (dynMods.length > 0) {

          self["saito-js"] = require("saito-js").default;
          self["saito-js/lib/slip"] = require("saito-js/lib/slip").default;
          self["saito-js/lib/block"] = require("saito-js/lib/block").default;
          self["saito-js/lib/transaction"] = require("saito-js/lib/transaction").default;
          self["saito-node-lib"] = SaitoNodeLib;

          const activeModule = this.app.browser.determineActiveModule();

          for (let i = 0; i < dynMods.length; i++) {
            const moduleCode = this.app.crypto.base64ToString(dynMods[i]["base64"]);

            console.log("moduleCode:", moduleCode);

            const mod = eval(moduleCode);
            console.log("mod : ", typeof mod);
            // @ts-ignore
            const m = new window.Dyn(this.app);

            if (m.isSlug(activeModule)) {
              m.activateModule();
            }

            for (let z = this.mods.length - 1; z >= 0; z--) {
              if (this.mods[z].name === m.name && !m.teaser) {
                this.mods.splice(z, 1);
              }
            }
            this.mods.push(m);
          }
        }
      }
    } catch (error) {
      console.error("failed loading dynamic mod");
      console.error(error);
    }

    let moduleRemoved = 0;

    if (this.app.options) {
      if (this.app.options.modules) {
        for (let i = this.app.options.modules.length - 1; i >= 0; i--) {
          let found = 0;
          for (const [z, mod] of this.mods.entries()) {
            if (mod.name === this.app.options.modules[i].name) {
              found = 1;

              if (this.app.options.modules[i].active == 0) {
                console.log("Splice inactive module");
                this.mods.splice(z, 1);
              }

              break;
            }
          }

          if (!found) {
            moduleRemoved = 1;
            console.log("Splice missing module");
            this.app.options.modules.splice(i, 1);
          }
        }
      }
    }

    let newModsInstalled = 0;

    if (!this.app.options.modules) {
      this.app.options.modules = [];
    }

    for (let i = 0; i < this.mods.length; i++) {
      this.mods[i].returnSlug();

      let mi_idx = -1;
      let install_this_module = 1;

      for (let j = 0; j < this.app.options.modules.length; j++) {
        if (this.mods[i].name == this.app.options.modules[j].name) {
          if (this.app.options.modules[j].installed) {
            install_this_module = 0;
          }
          mi_idx = j;
        }
      }

      if (install_this_module == 1) {
        newModsInstalled++;

        await this.mods[i].installModule(this.app);

        if (mi_idx != -1) {
          this.app.options.modules[mi_idx].installed = 1;
          this.app.options.modules[mi_idx].active = 1;

          if (!this.app.options.modules[mi_idx]?.version) {
            this.app.options.modules[mi_idx].version = "";
          }
          if (!this.app.options.modules[mi_idx]?.publisher) {
            this.app.options.modules[mi_idx].publisher = "";
          }
        } else {
          this.app.options.modules.push({name: this.mods[i].name, installed: 1, version: "", publisher: "", active: 1});
        }
      }
    }

    this.app.options.modules.sort((a, b) => {
      if (a.active && !b.active) {
        return -1;
      }
      if (b.active && !a.active) {
        return 1;
      }

      if (a.name.toLowerCase() < b.name.toLowerCase()) {
        return -1;
      }
      if (a.name.toLowerCase() > b.name.toLowerCase()) {
        return 1;
      }
      return 0;
    });

    if (newModsInstalled > 0 || moduleRemoved) {
      this.app.storage.saveOptions();
    }

    const modNames = {};
    this.mods.forEach((mod, i) => {
      if (modNames[mod.name]) {
        console.warn(`*****************************************************************`);
        console.warn(`***** WARNING: mod ${mod.name} is installed more than once! *****`);
        console.warn(`*****************************************************************`);
      }
      modNames[mod.name] = true;
    });

    if (this.app.BROWSER == 1) {
      for (let i = 0; i < this.uimods.length; i++) {
        console.log("Adding UI Mod: ", this.uimods[i].name);
        this.mods.push(this.uimods[i]);
      }
    }

    for (const xmod of this.app.modManager.respondTo("saito-moderation-app")) {
      this.appFilterFunc.push(xmod.respondTo("saito-moderation-app").filterFunc);
    }
    for (const xmod of this.app.modManager.respondTo("saito-moderation-core")) {
      this.coreFilterFunc.push(xmod.respondTo("saito-moderation-core").filterFunc);
    }

    let moduleName = "";

    try {
      for (let i = 0; i < this.mods.length; i++) {
        moduleName = this.mods[i].name;
        await this.mods[i].initialize(this.app);
      }
    } catch (err) {
      console.error("Failing module: " + moduleName);
      throw new Error(err);
    }

    const onPeerHandshakeComplete = this.onPeerHandshakeComplete.bind(this);
    const onStunPeerDisconnected = this.onStunPeerDisconnected.bind(this);
    this.app.connection.on("handshake_complete", async (peerIndex: bigint) => {
      if (this.app.BROWSER) {
        await this.app.wallet.setKeyList(this.app.keychain.returnWatchedPublicKeys());
      }
      const peer = await this.app.network.getPeer(BigInt(peerIndex));
      if (this.app.BROWSER == 0) {
        const data = `{"build_number": "${this.app.build_number}"}`;
        console.info(data);
        this.app.network.sendRequest("software-update", data, null, peer);
      }
      console.log("handshake complete");
      await onPeerHandshakeComplete(peer);
    });

    this.app.connection.on("stun peer connect", async (peerIndex) => {
      const peer = await this.app.network.getPeer(BigInt(peerIndex));
      await onPeerHandshakeComplete(peer);
    });

    this.app.connection.on("stun peer disconnect", async(peerIndex, publicKey) => {
      await onStunPeerDisconnected(peerIndex, publicKey);
      console.log("peer handshake completed for peer", peerIndex);
    });

    this.app.connection.on("peer_disconnect", (peerIndex: bigint, public_key: string) => {
      console.log("connection dropped -- triggering on connection unstable : " + peerIndex, " key : ", public_key);
      this.onConnectionUnstable(public_key);
    });

    this.app.connection.on("peer_connect", async (peerIndex: bigint) => {
      console.log("peer_connect received for : " + peerIndex);
      this.onConnectionStable(await this.app.network.getPeer(peerIndex));
    });

    this.isInitialized = true;

    if (this.app.BROWSER && this.app.browser.multipleWindowsActive == 0) {
      await this.app.modManager.render();
      await this.app.modManager.attachEvents();
    }
  }

  moderateModule(tx = null, mod=null) {
    if (mod == null || tx == null) {
      return 0;
    }

    for (let z = 0; z < this.appFilterFunc.length; z++) {
      const permitThrough = this.appFilterFunc[z](mod, tx);
      if (permitThrough == 1) {
        return 1;
      }
      if (permitThrough == -1) {
        return -1;
      }
    }

    return 0;
  }

  moderateCore(tx=null) {
    if (tx == null) {
      return 0;
    }

    for (let z = 0; z < this.coreFilterFunc.length; z++) {
      const permitThrough = this.coreFilterFunc[z](tx);
      if (permitThrough == 1) {
        return 1;
      }
      if (permitThrough == -1) {
        return -1;
      }
    }
    return 0;
  }

  async render() {
    for (let icb = 0; icb < this.mods.length; icb++) {
      if (this.mods[icb].browser_active == 1) {
        console.log("mod-manager.ts -- render active module -- " + this.mods[icb].returnName());
        await this.mods[icb].render(this.app, this.mods[icb]);
      }
    }
    this.app.connection.emit("saito-render-complete");
    return null;
  }

  async renderInto(qs) {
    for (const mod of this.mods) {
      await mod.renderInto(qs);
    }
  }

  respondTo(request, obj=null) {
    const m = [];
    for (const mod of this.mods) {
      if (mod.respondTo(request, obj) != null) {
        m.push(mod);
      }
    }
    return m;
  }

  getRespondTos(request, obj=null) {
    const compliantInterfaces = [];
    for (const mod of this.mods) {
      const itnerface = mod.respondTo(request, obj);
      if (itnerface != null && Object.keys(itnerface)) {
        compliantInterfaces.push({...itnerface, modname: mod.returnName()});
      }
    }
    return compliantInterfaces;
  }

  onNewBlock(blk, i_am_the_longest_chain) {
    console.log("### New Block ### " + blk.id);
    for (let iii = 0; iii < this.mods.length; iii++) {
      this.mods[iii].onNewBlock(blk, i_am_the_longest_chain);
    }
    return;
  }

  onChainReorganization(block_id, block_hash, lc) {
    for (let imp = 0; imp < this.mods.length; imp++) {
      this.mods[imp].onChainReorganization(block_id, block_hash, lc);
    }
    return null;
  }

  async onPeerHandshakeComplete(peer: Peer) {
    for (let i = 0; i < this.mods.length; i++) {
      await this.mods[i].onPeerHandshakeComplete(this.app, peer);
    }
    if (peer.services) {
      for (let i = 0; i < peer.services.length; i++) {
        await this.onPeerServiceUp(peer, peer.services[i]);
      }
    }
  }

  async onPeerServiceUp(peer, service) {
    for (let i = 0; i < this.mods.length; i++) {
      await this.mods[i].onPeerServiceUp(this.app, peer, service);
    }
  }

  onConnectionStable(peer) {
    for (let i = 0; i < this.mods.length; i++) {
      this.mods[i].onConnectionStable(this.app, peer);
    }
  }

  onConnectionUnstable(public_key) {
    for (let i = 0; i < this.mods.length; i++) {
      this.mods[i].onConnectionUnstable(this.app, public_key);
    }
  }

  onStunPeerDisconnected(peer_index, public_key) {
    for (let i = 0; i < this.mods.length; i++) {
      this.mods[i].onStunPeerDisconnected(this.app, peer_index, public_key);
    }
  }

  async onUpgrade(type, privatekey, walletfile) {
    for (let i = 0; i < this.mods.length; i++) {
      await this.mods[i].onUpgrade(type, privatekey, walletfile);
    }
  }

  returnModule(modname) {
    for (const mod of this.mods) {
      if (modname === mod.name) {
        return mod;
      }
    }
    return null;
  }

  webServer(expressapp=null, express=null) {
    const baseModule = this.app.options.defaultClientModule || "website";
    for (const mod of this.mods) {
      mod.webServer(this.app, expressapp, express);
      if (mod.returnSlug() == baseModule) mod.webServer(this.app, expressapp, express, "/");
    }
    return null;
  }

  async onWebSocketServer(webserver) {
    for (const mod of this.mods) {
      const path = mod.getWebsocketPath();
      if (!path) {
        continue;
      }
      console.log("creating websocket server for module :" + mod.name + " on path : " + path);
      const wss = new ws.WebSocketServer({noServer: true, path: "/" + path});
      webserver.on("upgrade", (request: any, socket: any, head: any) => {
        const parsedUrl = parse(request.url);
        const pathname = parsedUrl.pathname;
        const pathParts = pathname.split("/").filter(Boolean);
        const subdirectory = pathParts.length > 0 ? pathParts[0] : null;
        if (subdirectory === path) {
          console.debug("connection on module : " + mod.name + " upgrade ----> " + request.url);
          wss.handleUpgrade(request, socket, head, (websocket: any) => {
            console.log("handling upgrade ///");
            wss.emit("connection", websocket, request);
          });
        }
      });

      mod.onWebSocketServer(wss);
    }
  }
}

export default ModManager;