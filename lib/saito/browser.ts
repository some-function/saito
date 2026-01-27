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
  public browser_active: any;
  public multipleWindowsActive: any;
  public urlParams: any;
  public active_tab: any;
  public files: any;
  public returnIdentifier: any;
  public host: any;
  public port: any;
  public protocol: any;

  constructor(app) {
    this.app = app || {};

    this.components = {};

    this.browser_active = 0;
    this.multipleWindowsActive = 0;
    this.host = "";
    this.port = "";
    this.protocol = "";

    this.MAX_FILE_SIZE = 100 * 1024 * 1024;

    this.active_tab = 0;

    this.hiddenTabProperty = "hidden";
    this.tabEventName = "visibilitychange";
  }

  async initialize(app) {
    if (this.app.BROWSER != 1) {
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
        await this.setActiveTab(1);
      }

      let publicKey = await this.app.wallet.getPublicKey();

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
            const bit = document[this.hiddenTabProperty] ? 0 : 1;
            this.setActiveTab(bit);
            this.channel.postMessage({active: bit, publicKey: publicKey});
          },
          false
        );

        window.addEventListener("storage", async (e) => {
          if (this.active_tab == 0) {
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

      this.browser_active = 1;

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

  async setActiveTab(active) {
    this.active_tab = active;
    this.app.blockchain.process_blocks = active;
    this.app.storage.save_options = active;
    for (const peer of await this.app.network.getPeers()) {
      peer.handle_peer_requests = active;
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
      let obj = document.getElementById(id);
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
      let container = document.querySelector(selector);
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

  addDragAndDropFileUploadToElement(handleFileDrop=null) {
    const id = "saito-app-upload";
    const hiddenUploadForm = `
      <form id="uploader_${id}" class="saito-file-uploader" style="display:none">
        <p>Upload multiple files with the file dialog or by dragging and dropping images onto the dashed region</p>
        <input type="file" id="hidden_file_element_${id}" multiple accept="*" class="treated hidden_file_element_${id}">
        <label class="button" class="hidden_file_element_button" id="hidden_file_element_button_${id}" for="hidden_file_element_${id}">
          Select some files
        </label>
      </form>
    `;

    if (!document.getElementById(`uploader_${id}`)) {
      this.addElementToId(hiddenUploadForm, id);
      const dropArea = document.getElementById(id);
      if (!dropArea) {
        console.error("Undefined id in browser", id);
        return null;
      }
      ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
        dropArea.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
      });
      ["dragenter", "dragover"].forEach((eventName) => {
        dropArea.addEventListener(eventName, this.highlight, false);
      });
      ["dragleave", "drop"].forEach((eventName) => {
        dropArea.addEventListener(eventName, this.unhighlight, false);
      });
      dropArea.addEventListener(
        "drop",
        (e) => {
          const dt = e.dataTransfer;
          const files = dt.files;
          const self = this;
          [...files].forEach((file) => {
            self.showFileReadSpinner(dropArea);

            const reader = new FileReader();
            
            const cleanupAndCall = (result, file) => {
              self.hideFileReadSpinner(dropArea);
              if (handleFileDrop) {
                handleFileDrop(result, false, file);
              }
            };
            
            reader.addEventListener("error", (event) => {
              console.error("FileReader error for file:", file.name, file.size, "bytes");
              cleanupAndCall(null, file);
            });
            
            reader.addEventListener("abort", (event) => {
              console.warn("FileReader aborted for file:", file.name);
              cleanupAndCall(null, file);
            });
            
            reader.addEventListener("load", (event) => {
              cleanupAndCall(event.target.result, file);
            });
            
            reader.readAsText(file);
          });
        },
        false
      );
      if (!dropArea.classList.contains("paste_event")) {
        dropArea.addEventListener(
          "paste",
          (e) => {
            let dragAndDrop = false;
            const files = e.clipboardData.files;
            const self = this;
            [...files].forEach((file) => {
              dragAndDrop = true;
              
              const MAX_SAFE_SIZE = 100 * 1024 * 1024;

              self.showFileReadSpinner(dropArea);

              const reader = new FileReader();
              
              const cleanupAndCall = (result, file) => {
                self.hideFileReadSpinner(dropArea);
                if (handleFileDrop) handleFileDrop(result, true, file);
              };
              
              reader.addEventListener("error", (event) => {
                console.error("FileReader error for file:", file.name, file.size, "bytes");
                cleanupAndCall(null, file);
              });
              
              reader.addEventListener("abort", (event) => {
                console.warn("FileReader aborted for file:", file.name);
                cleanupAndCall(null, file);
              });
              
              reader.addEventListener("load", (event) => {
                cleanupAndCall(event.target.result, file);
              });
              reader.readAsText(file);
            });

            if (dragAndDrop) {
              e.preventDefault();
              e.stopPropagation();
            }
          },
          false
        );

        dropArea.classList.add("paste_event");
      }
      const input = document.getElementById(`hidden_file_element_${id}`);
      dropArea.addEventListener("click", () => { input.click(); });

      input.addEventListener(
        "change",
        (e) => {
          const fileName = "";
          if (input.files && input.files.length > 0) {
            const files = input.files;
            [...files].forEach((file) => {
              const MAX_SAFE_SIZE = 100 * 1024 * 1024;

              this.showFileReadSpinner(dropArea);

              const reader = new FileReader();
              
              const cleanupAndCall = (result, file) => {
                this.hideFileReadSpinner(dropArea);
                if (handleFileDrop) {
                  handleFileDrop(result, false, file);
                }
              };
              
              reader.addEventListener("error", (event) => {
                console.error("FileReader error for file:", file.name, file.size, "bytes");
                cleanupAndCall(null, file);
              });
              
              reader.addEventListener("abort", (event) => {
                console.warn("FileReader aborted for file:", file.name);
                cleanupAndCall(null, file);
              });
              
              reader.addEventListener("load", (event) => {
                cleanupAndCall(event.target.result, file);
              });
              reader.readAsText(file);
            });
          }
        },
        false
      );
      dropArea.focus();
    }
  }

  highlight(e) {
    document.getElementById(e.currentTarget.id).style.opacity = 0.8;
  }

  unhighlight(e) {
    document.getElementById(e.currentTarget.id).style.opacity = 1;
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
            for (let m of mutation.addedNodes) {
              mutatedNodes.push(m);
            }
            if (mutationThrottle) {
              clearTimeout(mutationThrottle);
            }
            mutationThrottle = setTimeout(() => {
              const treatElements = (nodeList) => {
                for (let node of nodeList) {
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
          let wrapper = document.createElement("div");
          wrapper.id = "saito-alert";
          let html = `<div id="saito-alert-shim">
                        <div id="saito-alert-box">
                          <div class="saito-alert-message">${this.sanitize(message)}</div>
                          <div class="saito-button-row">
                            <button class="saito-button-secondary" id="alert-cancel">Cancel</button>
                            <button id="alert-ok">OK</button>
                          </div>
                        </div>
                      </div>`;
          wrapper.innerHTML = html;
          document.body.appendChild(wrapper);
          document.getElementById("alert-ok").focus();
          document.getElementById("saito-alert-shim").onclick = (event) => {
            if (event.keyCode === 13) {
              event.preventDefault();
              document.getElementById("alert-ok").click();
            }
          };
          document.getElementById("alert-ok").onclick = () => {
            wrapper.remove();
            resolve(true);
          };
          document.getElementById("alert-cancel").onclick = () => {
            wrapper.remove();
            resolve(false);
          };
        });
      };

      window.sprompt = (message, suggestion = "") => {
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
                <div class="alert-prompt"><input type="text" id="promptval" class="promptval" placeholder="${suggestion}" /></div>
                <div class="saito-button-row">
                  <button class="saito-button-secondary" id="alert-cancel">Cancel</button>
                  <button id="alert-ok" class="saito-button-primary">OK</button>
                </div>
              </div>
            </div>
          `;
          document.body.appendChild(wrapper);
          document.querySelector("#promptval").focus();
          document.querySelector("#promptval").select();
          document.querySelector("#saito-alert-shim").addEventListener("keyup", (event) => {
            if (event.keyCode === 13) {
              event.preventDefault();
              document.querySelector("#alert-ok").click();
            }
          });
          document.querySelector("#alert-ok").addEventListener(
            "click",
            () => {
              const val = document.querySelector("#promptval").value || suggestion;
              wrapper.remove();
              resolve(val);
            },
            false
          );
          document.querySelector("#alert-cancel").addEventListener("click", () => { wrapper.remove(); resolve(false); }, false);
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

      window.ntfy = (to, content) => {
        content.topic = to;
        fetch("https://ntfy.hda0.net/", {method: "POST", body: JSON.stringify(content)});
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

    if (this.app.BROWSER == 1) {
      let mod_obj = this.app.modManager.returnActiveModule();

      if (!this.app.options.theme) {
        this.app.options.theme = {};
      }

      if (mod_obj != null) {
        if (mod_obj.slug != null) {
          this.app.options.theme[mod_obj.slug] = theme;
          this.app.storage.saveOptions();
        }
      }

      this.updateThemeInHeader(theme);
    }
  }

  updateThemeInHeader(theme) {
    setTimeout(() => {
      let themeIconObj = document.querySelector(".saito-theme-icon");
      let activeModule = this.app.modManager.returnActiveModule();

      if (themeIconObj && activeModule) {
        let classes = themeIconObj.classList;
        for (let c of classes) {
          themeIconObj.classList.remove(c);
        }

        themeIconObj.classList.add("saito-theme-icon");
        try {
          for (let t of activeModule.themeOptions[theme].split(" ")) {
            themeIconObj.classList.add(t);
          }
        } catch (err) {
          console.error(err);
          console.debug(theme, activeModule.themeOptions);
        }
      }
    }, 500);
  }

  updateSoftwareVersion(receivedBuildNumber: number) {
    console.info(
      `Received build number: ${Number(receivedBuildNumber)}, Current build number: ${
        this.app.build_number
      }`
    );
    if (receivedBuildNumber > this.app.build_number) {
      if (confirm(`Saito Upgrade: Upgrading to new version ${receivedBuildNumber}`)) {
        console.info(`New software update found: ${receivedBuildNumber}. Updating...`);
        siteMessage(`New software update found: ${receivedBuildNumber}. Updating...`);
        reloadWindow(1000);
      }
    }
  }

  formatNumberToLocale(number) {
    try {
      const locale =
        this.app.BROWSER && window?.navigator?.language ? window.navigator.language : "en-US";
      const numberFormatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        minimumSignificantDigits: 1
      });
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