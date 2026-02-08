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

  constructor(app:App, config) {
    this.app = app;
    this.mods = [];
    this.uimods = [];
    this.modsList = config;
    this.isInitialized = false;
  }

  isModuleActive(modname="") {
    for (let i = 0; i < this.mods.length; i++) {
      if (this.mods[i].browserActive == 1 && modname == this.mods[i].name) {
        return 1;
      }
    }
    return 0;
  }

  returnActiveModule() {
    for (let i = 0; i < this.mods.length; i++) {
      if (this.mods[i].browserActive == 1) {
        return this.mods[i];
      }
    }
    return null;
  }

  attachEvents() {
    for (const mod of this.mods) {
      if (mod.browserActive == 1) {
        mod.attachEvents(this.app);
      }
    }
    return null;
  }

  affixCallbacks(tx, txindex, message, callbackArray, callbackIndexArray) {
    if (tx.type == 5) {
      console.log("No callbacks for type 5");
      return;
    }

    for (let i = 0; i < this.mods.length; i++) {
      if ((message?.module || "") === this.mods[i].name) {
        callbackArray.push(this.mods[i].onConfirmation.bind(this.mods[i]));
        callbackIndexArray.push(txindex);
      }
    }

    if (this.app.BROWSER) {
      console.debug(`Affix callbacks for ${message?.module} : ${message?.request}`);
    }
  }

  async handlePeerTransaction(tx:Transaction, peer:Peer, mycallback:(any)=>Promise<void>=null) {
    let haveResponded = false;
    
    const txmsg = tx.returnMessage();

    try {
      if (txmsg?.request === "software-update") {
        this.app.browser.updateSoftwareVersion(JSON.parse(tx.msg.data).buildNumber);
      }
    } catch (err) {}

    for (const mod of this.mods) {
      try {
        if (await mod.handlePeerTransaction(this.app, tx, peer, mycallback)) {
          haveResponded = true;
        }
      } catch (err) {
        console.error(`handlePeerTransaction Unknown Error in ${mod.name}: `, err);
      }
    }
    if (haveResponded == false && mycallback) {
      mycallback({});
    }
  }

  async initialize() {
    try {
      if (this.app.BROWSER) {
        const dynMods = await this.app.storage.loadAllLocalModules();

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
              if (this.mods[z].name === m.name) {
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

    for (const mod of this.mods) {
      mod.returnSlug();

      let miIndex = -1;
      let installThisModule = 1;

      for (const modOptions of this.app.options.modules) {
        if (mod.name == modOptions.name && modOptions.installed) {
          installThisModule = 0;
        }
      }

      for (const [j, modOptions] of this.app.options.modules.entries()) {
        if (mod.name == modOptions.name) {
          miIndex = j;
        }
      }

      if (installThisModule == 1) {
        newModsInstalled++;

        await mod.installModule(this.app);

        if (miIndex != -1) {
          this.app.options.modules[miIndex].installed = 1;
          this.app.options.modules[miIndex].active = 1;

          if (!this.app.options.modules[miIndex]?.version)   { this.app.options.modules[miIndex].version   = "" };
          if (!this.app.options.modules[miIndex]?.publisher) { this.app.options.modules[miIndex].publisher = "" };
        } else {
          this.app.options.modules.push({name: mod.name, installed: 1, version: "", publisher: "", active: 1});
        }
      }
    }

    this.app.options.modules.sort((a, b) => {
      if (a.active && !b.active) { return -1; }
      if (b.active && !a.active) { return +1; }
      if (a.name.toLowerCase() < b.name.toLowerCase()) { return -1 };
      if (a.name.toLowerCase() > b.name.toLowerCase()) { return +1 };
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

    if (this.app.BROWSER) {
      for (const uimod of this.uimods) {
        console.log("Adding UI Mod: ", uimod.name);
        this.mods.push(uimod);
      }
    }

    for (const mod of this.mods) {
      try {
        await mod.initialize(this.app);
      } catch (err) {
        console.error("Failing module: " + mod.name);
        throw new Error(err);
      }
    }
  
    const onPeerHandshakeComplete = this.onPeerHandshakeComplete.bind(this);
    const onStunPeerDisconnected = this.onStunPeerDisconnected.bind(this);
    this.app.connection.on("handshake_complete", async (peerIndex: bigint) => {
      if (this.app.BROWSER) {
        await this.app.wallet.setKeyList(this.app.keychain.returnWatchedPublicKeys());
      }
      const peer = await this.app.network.getPeer(BigInt(peerIndex));
      if (!this.app.BROWSER) {
        const data = `{"buildNumber": "${this.app.buildNumber}"}`;
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

    this.app.connection.on("peer_disconnect", (peerIndex: bigint, publicKey: string) => {
      console.log("connection dropped -- triggering on connection unstable : " + peerIndex, " key : ", publicKey);
      this.onConnectionUnstable(publicKey);
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

  moderateCore(tx=null) {
    return 0;
  }

  async render() {
    for (const mod of this.mods) {
      if (mod.browserActive == 1) {
        console.log("mod-manager.ts -- render active module -- " + mod.returnName());
        await mod.render(this.app, mod);
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
    return this.mods.filter((mod) => mod.respondTo(request, obj) != null);
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

  onNewBlock(blk, iAmTheLongestChain) {
    const logLevel = this.app.BROWSER ? "debug" : "log";
    console[logLevel]("### New Block ### " + blk.id);
    for (const mod of this.mods) {
      mod.onNewBlock(blk, iAmTheLongestChain);
    }
    return;
  }

  onChainReorganization(blockId, blockHash, lc) {
    for (const mod of this.mods) {
      mod.onChainReorganization(blockId, blockHash, lc);
    }
    return null;
  }

  async onPeerHandshakeComplete(peer: Peer) {
    for (const mod of this.mods) {
      await mod.onPeerHandshakeComplete(this.app, peer);
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

  onConnectionUnstable(publicKey) {
    for (const mod of this.mods) {
      mod.onConnectionUnstable(this.app, publicKey);
    }
  }

  onStunPeerDisconnected(peerIndex, publicKey) {
    for (const mod of this.mods) {
      mod.onStunPeerDisconnected(this.app, peerIndex, publicKey);
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
      if (mod.returnSlug() == baseModule) {
        mod.webServer(this.app, expressapp, express, "/");
      }
    }
    return null;
  }

  async onWebSocketServer(webserver) {
    for (const mod of this.mods) {
      const path = mod.getWebsocketPath();
      if (!path) continue;
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