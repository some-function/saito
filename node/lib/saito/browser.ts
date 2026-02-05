// @ts-nocheck
import screenfull, {element} from "screenfull";
import React from "react";
import {createRoot} from "react-dom";
const marked = require("marked");
const sanitizeHtml = require("sanitize-html");
const sanitizer = require("sanitizer");
const linkifyHtml = require("markdown-linkify");
const debounce = require("lodash/debounce");

class Browser {
  public app: any;
  public browserActive: any;
  public multipleWindowsActive: any;
  public urlParams: any;
  public activeTab: boolean;
  public files: any;
  public returnIdentifier: any;
  public host: any;
  public port: any;
  public protocol: any;

  constructor(app) {
    this.app = app || {};

    this.components = {};

    this.browserActive = 0;
    this.multipleWindowsActive = 0;
    this.host = "";
    this.port = "";
    this.protocol = "";

    this.MAX_FILE_SIZE = 100 * 1024 * 1024;

    this.activeTab = false;

    this.hiddenTabProperty = "hidden";
    this.tabEventName = "visibilitychange";
  }

  async initialize(app) {
    if (!this.app.BROWSER) {
      return 0;
    }

    this.app.connection.on("new-version-detected", (version) => {
      console.info("New wallet version detected: " + version);
      localStorage.setItem("wallet_version", JSON.stringify(version));
      let shouldReload = false;
      const scripts = document.querySelectorAll("script");
      scripts.forEach((script) => {
        const url = new URL(script.src, window.location.origin);
        const params = new URLSearchParams(url.search);
        if (params.has("build")) {
          shouldReload = true;
        }
      });
      if (shouldReload) {
        reloadWindow(300);
      }
    });

    try {
      if (screenfull.isEnabled) {
        screenfull.on("change", () => {
          this.app.connection.emit("browser-fullscreen-toggle", screenfull.isFullscreen);
        });
      }

      if (typeof document.hidden === "undefined") {
        if (typeof document.msHidden !== "undefined") {
          this.hiddenTabProperty = "msHidden";
          this.tabEventName = "msvisibilitychange";
        } else if (typeof document.webkitHidden !== "undefined") {
          this.hiddenTabProperty = "webkitHidden";
          this.tabEventName = "webkitvisibilitychange";
        }
      }

      if (!document[this.hiddenTabProperty]) {
        await this.setActiveTab(true);
      }

      const publicKey = await this.app.wallet.getPublicKey();

      try {
        this.attachWindowFunctions();

        this.channel = new BroadcastChannel("saito");
        this.channel.onmessage = async (e) => {
          if (e.data.msg == "new_tab") {
            window.focus();
            setTimeout(() => { window.location = "/tabs/"; }, 300);
          }
        };

        document.addEventListener(
          this.tabEventName,
          () => {
            const bool = document[this.hiddenTabProperty];
            this.setActiveTab(bool);
            this.channel.postMessage({active: bool ? 0 : 1, publicKey: publicKey});
          },
          false
        );

        window.addEventListener("storage", async (e) => {
          if (!this.activeTab) {
            console.log("LOAD OPTIONS IN BROWSER");
            await this.app.storage.loadOptions();
          }
        });
      } catch (err) {
        console.error(err);
      }

      if (typeof window == "undefined") {
        return;
      }

      const currentUrl = window.location.toString();
      const myurl = new URL(currentUrl);
      this.host = myurl.host;
      this.port = myurl.port;
      this.protocol = myurl.protocol;

      const activeModule = this.determineActiveModule();

      console.log("Browser.ts -- active module is " + activeModule);
      for (const mod of this.app.modManager.mods) {
        if (mod.isSlug(activeModule)) {
          console.log("Activating " + mod.returnName());
          mod.activateModule();
          break;
        }
      }

      this.checkForMultipleWindows();

      this.browserActive = 1;

      const foo = this.app.options?.theme && this.app.options.theme[activeModule];
      const theme = foo ? this.app.options.theme[activeModule] : "lite";
      if (foo) {
        this.switchTheme(theme);
      }
      this.updateThemeInHeader(theme);

      const updateViewHeight = () => {
        document.documentElement.style.setProperty("--saito-vh", `${window.innerHeight / 100}px`);
      };

      window.addEventListener("resize", debounce(updateViewHeight, 200));
      setTimeout(() => { updateViewHeight(); }, 200);
    } catch (err) {
      if (err == "ReferenceError: document is not defined") {
        console.error("non-browser detected: ", err);
      } else {
        throw err;
      }
    }

    this.app.connection.on("peer_connect", (peerIndex: bigint) => {
      console.log(`Websocket connection established for peer index ${peerIndex}`);
    });
    this.app.connection.on("peer_disconnect", (peerIndex: bigint) => {
      console.log(`Websocket connection lost for peer index ${peerIndex}`);
    });

    marked.setOptions({breaks: true, gfm: true});
  }

  determineActiveModule() {
    const currentUrl = window.location.toString();
    const myurlpath = (new URL(currentUrl)).pathname.split("/");

    return myurlpath[1] ? myurlpath[1].toLowerCase() : (this.app.options.defaultModule || "website");
  }

  checkForMultipleWindows() {
    localStorage.openpages = Date.now();

    const onLocalStorageEvent = async (e) => {
      if (e.key == "openpages") {
        localStorage.page_available = Date.now();
      }
      if (e.key == "page_available") {
        this.multipleWindowsActive = 1;
        if (await sconfirm("Your wallet appears to be connected in another Saito tab.\n\nWould you like to connect it here and close the other tab?")) {
          this.multipleWindowsActive = 0;
          this.channel.postMessage({msg: "new_tab", location: window.location.href});
          await this.app.modManager.render();
          await this.app.modManager.attachEvents();
          return;
        } else {
          setTimeout(() => { window.location = "/tabs.html"; }, 300);
        }
      }
    };
    window.addEventListener("storage", onLocalStorageEvent, false);
  }

  async setActiveTab(active:boolean) {
    this.activeTab = active;

    const activeBit = active ? 1 : 0;
    this.app.blockchain.processBlocks = activeBit;
    this.app.storage.save_options = activeBit;
    for (const peer of await this.app.network.getPeers()) {
      peer.handlePeerRequests = activeBit;
    }
  }

  addElementToDom(html, elemWhere=null) {
    const el = document.createElement("div");
    if (elemWhere == null || elemWhere === "") {
      document.body.appendChild(el);
    } else {
      elemWhere.insertAdjacentElement("beforeend", el);
    }
    el.outerHTML = html;
  }

  addElementToId(html, id=null) {
    if (id == null) {
      console.warn(`no id provided to addElementToId, so adding to DOM`);
      this.app.browser.addElementToDom(html);
    } else {
      const obj = document.getElementById(id);
      if (obj) {
        this.app.browser.addElementToDom(html, obj);
      } else {
        console.error("[addElementToId] id not found");
      }
    }
  }

  addElementToSelector(html, selector="") {
    if (selector === "") {
      console.warn("no selector provided to addElementToSelector, so adding direct to DOM");
      console.debug(html);
      this.app.browser.addElementToDom(html);
    } else {
      const container = document.querySelector(selector);
      if (container) {
        this.app.browser.addElementToElement(html, container);
      } else {
        console.error("Container not found: " + selector);
      }
    }
  }

  addElementToElement(html, elem=document.body) {
    try {
      const el = document.createElement("div");
      elem.appendChild(el);
      el.outerHTML = html;
    } catch (err) {
      console.error("ERROR 582342: error in addElementToElement. Does " + elem + " exist?");
      console.debug(elem, html);
    }
  }

  showFileReadSpinner(dropArea: HTMLElement) {
    if (dropArea.querySelector(".saito-file-read-spinner")) {
      return;
    }
    
    const computedStyle = window.getComputedStyle(dropArea);
    if (computedStyle.position === "static") {
      dropArea.style.position = "relative";
      if (!dropArea.dataset.originalPosition) {
        dropArea.dataset.originalPosition = dropArea.style.position || "";
      }
    }
    
    const spinnerHtml = `
      <div class="saito-file-read-spinner" style="
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: rgba(0, 0, 0, 0.7); z-index: 1000; border-radius: inherit;
      ">
        <img src="/saito/img/spinner.svg" style="width: 4rem; height: 4rem;" />
        <div style="color: white; margin-top: 1rem; font-size: 1.4rem;">Reading file...</div>
      </div>
    `;
    dropArea.insertAdjacentHTML("beforeend", spinnerHtml);
  }

  hideFileReadSpinner(dropArea: HTMLElement) {
    const spinner = dropArea.querySelector(".saito-file-read-spinner");
    if (spinner) {
      spinner.remove();
    }
    
    if (dropArea.dataset.originalPosition !== undefined) {
      const originalPos = dropArea.dataset.originalPosition;
      if (originalPos === "") {
        dropArea.style.position = "";
      } else {
        dropArea.style.position = originalPos;
      }
      delete dropArea.dataset.originalPosition;
    }
  }

  sanitize(text) {
    if (!text) {
      return "";
    }
    try {
      text = sanitizeHtml(text, {
        allowedTags: [
          "a", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "p", "ul", "ol", "nl", "li", "b", "i", "strong", "em", "strike",
          "code", "hr", "br", "div", "table", "thead", "caption", "tbody", "tr", "th", "td", "marquee", "span", "img", "video", "audio"
        ],
        allowedAttributes: {
          div: ["class", "id"], span: ["class", "id", "data-id"], img: ["src", "class"],
          blockquote: ["href"], i: ["class"], a: ["href", "data-*"]
        },
        selfClosing: ["img", "br", "hr", "area", "base", "basefont", "input", "link", "meta"],
        allowedSchemes: ["http", "https", "ftp", "mailto"],
        allowedSchemesByTag: {},
        allowedSchemesAppliedToAttributes: ["href", "cite"],
        allowProtocolRelative: true
      });
      return text.replace(/^\s+|\s+$/g, "");
    } catch (err) {
      console.error("Browser [sanitize] error: ", err);
      return text;
    }
  }

  attachWindowFunctions() {
    if (typeof window !== "undefined") {
      let mutationThrottle = null;
      let mutatedNodes = [];
      let mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.addedNodes.length > 0) {
            for (const m of mutation.addedNodes) {
              mutatedNodes.push(m);
            }
            if (mutationThrottle) {
              clearTimeout(mutationThrottle);
            }
            mutationThrottle = setTimeout(() => {
              const treatElements = (nodeList) => {
                for (const node of nodeList) {
                  if (node.files && !node.classList.contains("treated")) {
                    const filelabel = document.createElement("label");
                    node.addEventListener("change", (e) => {
                      const files = e.target.files;
                      const fileName = (files && files.length > 1) ? (files.length + " files selected.") : e.target.value.split("\\").pop();
                      if (fileName) {
                        filelabel.style.border = "none";
                        filelabel.innerHTML = sanitize(fileName);
                      }
                    });
                    node.classList.add("treated");
                    filelabel.classList.add("treated");
                    filelabel.innerHTML = "Choose File";
                    filelabel.htmlFor = node.id;
                    filelabel.id = node.id + "-label";
                    node.parentNode.appendChild(filelabel);
                  }
                  if (node.childNodes.length >= 1) treatElements(node.childNodes);
                }
              }
              treatElements(mutatedNodes);

              this.treatIdentifiers(mutatedNodes);
              mutatedNodes = [];
              mutationThrottle = null;
            }, 120);
          }
        });
      });

      const obj = {attributes: true, characterData: true, childList: true, subtree: true, attributeOldValue: true};
      mutationObserver.observe(document.documentElement, obj);

      window.sanitize = (msg) => this.sanitize(msg);


      window.salert = (message) => {
        if (!document.getElementById("saito-alert")) {
          const wrapper = document.createElement("div");
          wrapper.id = "saito-alert";
          wrapper.innerHTML = `
            <div id="saito-alert-shim">
              <div id="saito-alert-box">
                <div class="saito-alert-message">${this.sanitize(message)}</div>
                <div class="saito-button-row">
                  <button id="alert-ok">OK</button>
                </div>
              </div>
            </div>
          `;
          document.body.appendChild(wrapper);
          document.querySelector("#alert-ok").focus();
          document.querySelector("#saito-alert-shim").addEventListener("keyup", (event) => {
            if (event.keyCode === 13) {
              event.preventDefault();
              document.querySelector("#alert-ok").click();
            }
          });
          document.querySelector("#alert-ok").addEventListener("click", () => { wrapper.remove(); }, false);
        }
      };




      window.sconfirm = (message) => {
        if (document.getElementById("saito-alert")) {
          return;
        }
        return new Promise((resolve, reject) => {
          const wrapper = document.createElement("div");
          wrapper.id = "saito-alert";
          wrapper.innerHTML = `
            <div id="saito-alert-shim">
              <div id="saito-alert-box">
                <div class="saito-alert-message">${this.sanitize(message)}</div>
                <div class="saito-button-row">
                  <button class="saito-button-secondary" id="alert-cancel">Cancel</button>
                  <button id="alert-ok">OK</button>
                </div>
              </div>
            </div>
          `;
          document.body.appendChild(wrapper);
          document.getElementById("alert-ok").focus();
          document.getElementById("saito-alert-shim").onclick = (event) => {
            if (event.keyCode === 13) {
              event.preventDefault();
              document.getElementById("alert-ok").click();
            }
          };
          document.getElementById("alert-ok"    ).onclick = () => { wrapper.remove(); resolve(true ); };
          document.getElementById("alert-cancel").onclick = () => { wrapper.remove(); resolve(false); };
        });
      };

      window.siteMessage = (message, killtime = 9999999, callback = null) => {
        if (document.getElementById("site-message-wrapper")) {
          document.getElementById("site-message-wrapper").remove();
        }
        const wrapper = document.createElement("div");
        wrapper.id = "site-message-wrapper";
        if (callback) {
          wrapper.classList.add("site-message-clickable");
        }
        wrapper.innerHTML = `<div class="site-message-message">${this.sanitize(message)}</div>`;

        document.body.appendChild(wrapper);

        const timeout = setTimeout(() => { wrapper.remove(); }, killtime);

        document.querySelector("#site-message-wrapper").addEventListener("click",
          () => {
            if (callback) callback();
            wrapper.remove();
            clearTimeout(timeout);
          },
          false
        );
      };

      window.reloadWindow = this.reloadWindow;
      window.navigateWindow = this.navigateWindow.bind(this);
    }
  }

  treatIdentifiers(nodeList) {
    const unknownKeys = [];

    const treat = (nodes) => {
      nodes.forEach((el) => {
        if (el.childNodes.length >= 1) {
          treat(el.childNodes);
        }
      });
    }

    treat(nodeList);
    if (unknownKeys.length > 0) {
      this.app.connection.emit("registry-fetch-identifiers-and-update-dom", unknownKeys);
    }
  }

  switchTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);

    if (this.app.BROWSER) {
      if (!this.app.options.theme) {
        this.app.options.theme = {};
      }

      const modObj = this.app.modManager.returnActiveModule();
      if (modObj != null && modObj.slug != null) {
        this.app.options.theme[modObj.slug] = theme;
        this.app.storage.saveOptions();
      }

      this.updateThemeInHeader(theme);
    }
  }

  updateThemeInHeader(theme) {
    setTimeout(() => {
      const themeIconObj = document.querySelector(".saito-theme-icon");
      const activeModule = this.app.modManager.returnActiveModule();

      if (themeIconObj && activeModule) {
        for (const c of themeIconObj.classList) {
          themeIconObj.classList.remove(c);
        }

        themeIconObj.classList.add("saito-theme-icon");
        try {
          for (const t of activeModule.themeOptions[theme].split(" ")) {
            themeIconObj.classList.add(t);
          }
        } catch (err) {
          console.error(err);
          console.debug(theme, activeModule.themeOptions);
        }
      }
    }, 500);
  }

  updateSoftwareVersion(receivedBuildNumber:number) {
    console.info(`Received build number: ${Number(receivedBuildNumber)}, Current build number: ${this.app.buildNumber}`);
    if (receivedBuildNumber > this.app.buildNumber && confirm(`Saito Upgrade: Upgrading to new version ${receivedBuildNumber}`)) {
      console.info(`New software update found: ${receivedBuildNumber}. Updating...`);
      siteMessage(`New software update found: ${receivedBuildNumber}. Updating...`);
      reloadWindow(1000);
    }
  }

  formatNumberToLocale(number) {
    try {
      const locale = this.app.BROWSER && window?.navigator?.language ? window.navigator.language : "en-US";
      const numberFormatter = new Intl.NumberFormat(locale, {minimumFractionDigits: 1, minimumSignificantDigits: 1});
      return numberFormatter.format(number);
    } catch (err) {
      console.error("Browser [formatNumber] Error: ", err);
      return number;
    }
  }

  reloadWindow(delay=0) {
    if (delay > 0) {
      setTimeout(() => {
        window.location.reload();
      }, delay);
    } else {
      window.location.reload();
    }
  }

  beforeUnloadHandler(event) {
    event.preventDefault();
    event.returnValue = true;
  }

  async navigateWindow(target, delay=0) {
    if (this.navigation_locked) {
      let c = await sconfirm("Are you sure you want to leave this page?");
      if (!c) {
        return;
      }
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
    }

    if (delay > 0) {
      setTimeout(() => {
        window.location.href = target;
      }, delay);
    } else {
      window.location.href = target;
    }
  }
}

export default Browser;