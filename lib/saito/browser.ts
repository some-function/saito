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
  public multiple_windows_active: any;
  public drag_callback: any;
  public urlParams: any;
  public active_tab: any;
  public files: any;
  public returnIdentifier: any;
  public host: any;
  public port: any;
  public protocol: any;
  public identifiers_added_to_dom: any;

  constructor(app) {
    this.app = app || {};

    this.components = {};

    this.browser_active = 0;
    this.multiple_windows_active = 0;
    this.drag_callback = null;
    this.host = "";
    this.port = "";
    this.protocol = "";

    this.MAX_FILE_SIZE = 100 * 1024 * 1024;

    this.identifiers_added_to_dom = false;

    this.active_tab = 0;

    this.hidden_tab_property = "hidden";
    this.tab_event_name = "visibilitychange";
    this.title_interval = null;
    this.terminationEvent = "unload";
    this.back_fn_queue = [];
    this.modal_queue = [];
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
          this.hidden_tab_property = "msHidden";
          this.tab_event_name = "msvisibilitychange";
        } else if (typeof document.webkitHidden !== "undefined") {
          this.hidden_tab_property = "webkitHidden";
          this.tab_event_name = "webkitvisibilitychange";
        }
      }

      if ("onpagehide" in self) {
        this.terminationEvent = "pagehide";
      }

      if (!document[this.hidden_tab_property]) {
        await this.setActiveTab(1);
      }

      let publicKey = await this.app.wallet.getPublicKey();

      try {
        this.attachWindowFunctions();

        this.channel = new BroadcastChannel("saito");
        this.channel.onmessage = async (e) => {
          if (e.data.msg) {
            if (e.data.msg == "new_tab") {
              window.focus();
              setTimeout(() => {
                window.location = "/tabs/";
              }, 300);
            }
          }
        };

        document.addEventListener(
          this.tab_event_name,
          () => {
            if (document[this.hidden_tab_property]) {
              this.setActiveTab(0);
              this.channel.postMessage({
                active: 0,
                publicKey: publicKey
              });
            } else {
              this.setActiveTab(1);
              this.channel.postMessage({
                active: 1,
                publicKey: publicKey
              });

              if (this.title_interval) {
                clearInterval(this.title_interval);
                this.title_interval = null;
                if (this.original_title) {
                  document.title = this.original_title;
                }
              }
            }
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

      const current_url = window.location.toString();
      const myurl = new URL(current_url);
      this.host = myurl.host;
      this.port = myurl.port;
      this.protocol = myurl.protocol;

      const active_module = this.determineActiveModule();

      console.log("Browser.ts -- active module is " + active_module);
      for (let i = 0; i < this.app.modManager.mods.length; i++) {
        if (this.app.modManager.mods[i].isSlug(active_module)) {
          console.log("Activating " + this.app.modManager.mods[i].returnName());
          this.app.modManager.mods[i].activateModule();
          break;
        }
      }

      this.checkForMultipleWindows();

      this.browser_active = 1;

      let theme = "lite";

      if (this.app.options?.theme) {
        if (this.app.options.theme[active_module]) {
          theme = this.app.options.theme[active_module];
          this.switchTheme(theme);
        }
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
    this.app.connection.on("peer_disconnect", function (peerIndex: bigint) {
      console.log(`Websocket connection lost for peer index ${peerIndex}`);
    });

    document.querySelector("body").addEventListener(
      "click",
      (e) => {
        if (e.target?.classList?.contains("saito-identicon") || e.target?.classList?.contains("saito-address")) {
          let disable_click = e.target.getAttribute("data-disable");
          let publicKey = e.target.getAttribute("data-id");
          if (publicKey && app.wallet.isValidPublicKey(publicKey) && disable_click !== "true" && disable_click != true) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }
      },
      {capture: true}
    );

    marked.setOptions({breaks: true, gfm: true});
  }

  determineActiveModule() {
    const current_url = window.location.toString();
    const myurl = new URL(current_url);
    const myurlpath = myurl.pathname.split("/");

    if (myurlpath[1]) {
      return myurlpath[1].toLowerCase();
    }

    return this.app.options.defaultModule || "website";
  }

  isMobileBrowser(user_agent = navigator.userAgent) {
    let check = false;
    (function (user_agent) {
      if (
        /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(
          user_agent
        ) ||
        /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
          user_agent.substr(0, 4)
        )
      ) {
        check = true;
      }
    })(user_agent);
    return check;
  }

  async sendNotification(title, message, event) {
    if (this.app.BROWSER == 0) {
      return;
    }

    if (!this.isMobileBrowser(navigator.userAgent)) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((result) => {
          if (result === "granted") {
            this.sendNotification(title, message, event);
            return;
          }
        });
      }
      if (Notification.permission === "granted") {
        const notify = new Notification(title, {
          body: message,
          iconURL: "/saito/img/touch/pwa-192x192.png",
          icon: "/saito/img/touch/pwa-192x192.png",
          tag: event
        });
      }
    } else {
      Notification.requestPermission().then(function (result) {
        if (result === "granted" || result === "default") {
          navigator.serviceWorker.ready.then(function (registration) {
            registration.showNotification(title, {
              body: message,
              icon: "/saito/img/touch/pwa-192x192.png",
              vibrate: [200, 100, 200, 100, 200, 100, 200],
              tag: event
            });
          });
        }
      });
    }
  }

  checkForMultipleWindows() {
    localStorage.openpages = Date.now();

    const onLocalStorageEvent = async (e) => {
      if (e.key == "openpages") {
        localStorage.page_available = Date.now();
      }
      if (e.key == "page_available" && !this.isMobileBrowser(navigator.userAgent)) {
        this.multiple_windows_active = 1;
        if (await sconfirm("Your wallet appears to be connected in another Saito tab.\n\nWould you like to connect it here and close the other tab?")) {
          this.multiple_windows_active = 0;
          this.channel.postMessage({msg: "new_tab", location: window.location.href});
          await this.app.modManager.render();
          await this.app.modManager.attachEvents();
          return;
        } else {
          setTimeout(() => {
            window.location = "/tabs.html";
          }, 300);
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

  addElementToDom(html, elemWhere = null) {
    const el = document.createElement("div");
    if (elemWhere == null || elemWhere === "") {
      document.body.appendChild(el);
      el.outerHTML = html;
    } else {
      elemWhere.insertAdjacentElement("beforeend", el);
      el.outerHTML = html;
    }
  }

  addElementToId(html, id = null) {
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

  addElementToSelector(html, selector = "") {
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

  addElementToElement(html, elem = document.body) {
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

  addDragAndDropFileUploadToElement(id, handleFileDrop=null, clickToUpload=true, readAsArrayBuffer=false, readAsText=false) {
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
        dropArea.addEventListener(eventName, this.preventDefaults, false);
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
            if (!readAsArrayBuffer && !readAsText && file.size > self.MAX_FILE_SIZE) {
              console.warn(`File ${file.name} (${file.size} bytes) exceeds safe size limit for readAsDataURL`);
              if (handleFileDrop) {
                handleFileDrop(null, false, file);
              }
              return;
            }

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
            if (readAsArrayBuffer) {
              reader.readAsArrayBuffer(file);
            } else if (readAsText) {
              reader.readAsText(file);
            } else {
              reader.readAsDataURL(file);
            }
          });
        },
        false
      );
      if (!dropArea.classList.contains("paste_event")) {
        dropArea.addEventListener(
          "paste",
          (e) => {
            let drag_and_drop = false;
            const files = e.clipboardData.files;
            const self = this;
            [...files].forEach(function (file) {
              drag_and_drop = true;
              
              const MAX_SAFE_SIZE = 100 * 1024 * 1024;
              if (!readAsArrayBuffer && !readAsText && file.size > MAX_SAFE_SIZE) {
                console.warn(`File ${file.name} (${file.size} bytes) exceeds safe size limit for readAsDataURL`);
                if (handleFileDrop) {
                  handleFileDrop(null, true, file);
                }
                return;
              }

              self.showFileReadSpinner(dropArea);

              const reader = new FileReader();
              
              const cleanupAndCall = (result, file) => {
                self.hideFileReadSpinner(dropArea);
                if (handleFileDrop) {
                  handleFileDrop(result, true, file);
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
              if (readAsArrayBuffer) {
                reader.readAsArrayBuffer(file);
              } else {
                if (readAsText) {
                  reader.readAsText(file);
                } else {
                  reader.readAsDataURL(file);
                }
              }
            });

            if (drag_and_drop) {
              this.preventDefaults(e);
            }
          },
          false
        );

        dropArea.classList.add("paste_event");
      }
      const input = document.getElementById(`hidden_file_element_${id}`);
      if (clickToUpload) {
        dropArea.addEventListener("click", function (e) {
          input.click();
        });
      }

      input.addEventListener(
        "change",
        (e) => {
          const fileName = "";
          if (input.files && input.files.length > 0) {
            const files = input.files;
            const self = this;
            [...files].forEach(function (file) {
              const MAX_SAFE_SIZE = 100 * 1024 * 1024;
              if (!readAsArrayBuffer && !readAsText && file.size > MAX_SAFE_SIZE) {
                console.warn(`File ${file.name} (${file.size} bytes) exceeds safe size limit for readAsDataURL`);
                if (handleFileDrop) {
                  handleFileDrop(null, false, file);
                }
                return;
              }

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
              if (readAsArrayBuffer) {
                reader.readAsArrayBuffer(file);
              } else {
                if (readAsText) {
                  reader.readAsText(file);
                } else {
                  reader.readAsDataURL(file);
                }
              }
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

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  urlRegexp() {
    let urlIndentifierRegexp = /\b(?:https?:\/\/)?([\w-]+[\.:])+[\w-]{2,}(\/[\w\/.-]*)?(\?[^<\s]*)?(?![^<]*>)/gi;
    return urlIndentifierRegexp;
  }

  numberFilter(potential_link) {
    let regex = /^\d+[\.:]?\d*$/;
    return regex.test(potential_link);
  }

  sanitize(text, createLinks = false) {
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

      if (createLinks) {
        text = text.replace(this.urlRegexp(), (url) => {
          if (this.numberFilter(url)) {
            return url;
          }

          let url1 = url.trim();
          let url2 = url1;
          if (url2.length > 42) {
            if (url2.indexOf("http") == 0 && url2.includes("://")) {
              let temp = url2.split("://");
              url2 = temp[1];
            }
            if (url2.indexOf("www.") == 0) {
              url2 = url2.substr(4);
            }
            if (url2.length > 40) {
              url2 = url2.substr(0, 37) + "...";
            }
          }

          const foo = url.includes(window.location.host) ? `data-link="local_link"` : `target="_blank" rel="noopener noreferrer"`;
          return `<a ${foo} class="saito-link" href="${!url.includes("http") ? `http://${url1}` : url1}">${url2}</a>`;
        });

        text = marked.parse(text);

        if (text.includes("<a ") && text.includes("href") && !text.includes("saito-link")) {
          let io = text.indexOf("<a ");
          let href = text.match(/href=".*"/)[0];

          let extra_stuff = href.includes(window.location.host) ? "data-link=\"local_link\"" : "target=\"_blank\" rel=\"noopener noreferrer\"";

          text = text.slice(0, io + 3) + extra_stuff + ` class="saito-link" ` + text.slice(io + 3);
        }
      }

      return text.replace(/^\s+|\s+$/g, "");
    } catch (err) {
      console.error("Browser [sanitize] error: ", err);
      return text;
    }
  }

  attachWindowFunctions() {
    if (typeof window !== "undefined") {
      let browser_self = this;

      let mutationThrottle = null;
      let mutatedNodes = [];
      let mutationObserver = new MutationObserver(function (mutations) {
        mutations.forEach((mutation) => {
          if (mutation.addedNodes.length > 0) {
            for (let m of mutation.addedNodes) {
              mutatedNodes.push(m);
            }
            if (mutationThrottle) {
              clearTimeout(mutationThrottle);
            }
            mutationThrottle = setTimeout(() => {
              browser_self.treatElements(mutatedNodes);
              browser_self.treatIdentifiers(mutatedNodes);
              mutatedNodes = [];
              mutationThrottle = null;
            }, 120);
          }
        });
      });

      mutationObserver.observe(document.documentElement, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
        attributeOldValue: true
      });

      window.sanitize = (msg) => browser_self.sanitize(msg);


      window.salert = function (message) {
        if (document.getElementById("saito-alert")) {
          return;
        }
        let wrapper = document.createElement("div");
        wrapper.id = "saito-alert";
        let html = `
          <div id="saito-alert-shim">
            <div id="saito-alert-box">
              <div class="saito-alert-message">${browser_self.sanitize(message)}</div>
              <div class="saito-button-row">
                <button id="alert-ok">OK</button>
              </div>
            </div>
          </div>
        `;
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
        document.querySelector("#alert-ok").focus();
        document.querySelector("#saito-alert-shim").addEventListener("keyup", function (event) {
          if (event.keyCode === 13) {
            event.preventDefault();
            document.querySelector("#alert-ok").click();
          }
        });
        document.querySelector("#alert-ok").addEventListener("click", () => { wrapper.remove(); }, false);
      };




      window.sconfirm = function (message) {
        if (document.getElementById("saito-alert")) {
          return;
        }
        return new Promise((resolve, reject) => {
          let wrapper = document.createElement("div");
          wrapper.id = "saito-alert";
          let html = `<div id="saito-alert-shim">
                        <div id="saito-alert-box">
                          <div class="saito-alert-message">${browser_self.sanitize(message)}</div>
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

      window.sprompt = function (message, suggestion = "") {
        if (document.getElementById("saito-alert")) {
          return;
        }
        return new Promise((resolve, reject) => {
          let wrapper = document.createElement("div");
          wrapper.id = "saito-alert";
          let html = `
            <div id="saito-alert-shim">
              <div id="saito-alert-box">
                <div class="saito-alert-message">${browser_self.sanitize(message)}</div>
                <div class="alert-prompt"><input type="text" id="promptval" class="promptval" placeholder="${suggestion}" /></div>
                <div class="saito-button-row">
                  <button class="saito-button-secondary" id="alert-cancel">Cancel</button>
                  <button id="alert-ok" class="saito-button-primary">OK</button>
                </div>
              </div>
            </div>
          `;
          wrapper.innerHTML = html;
          document.body.appendChild(wrapper);
          document.querySelector("#promptval").focus();
          document.querySelector("#promptval").select();
          document.querySelector("#saito-alert-shim").addEventListener("keyup", function (event) {
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

      window.siteMessage = function (message, killtime = 9999999, callback = null) {
        if (document.getElementById("site-message-wrapper")) {
          document.getElementById("site-message-wrapper").remove();
        }
        const wrapper = document.createElement("div");
        wrapper.id = "site-message-wrapper";
        if (callback) {
          wrapper.classList.add("site-message-clickable");
        }
        wrapper.innerHTML = `<div class="site-message-message">${browser_self.sanitize(message)}</div>`;

        document.body.appendChild(wrapper);

        const timeout = setTimeout(() => { wrapper.remove(); }, killtime);

        document.querySelector("#site-message-wrapper").addEventListener("click",
          () => {
            if (callback) {
              callback();
            }
            wrapper.remove();
            clearTimeout(timeout);
          },
          false
        );
      };

      window.ntfy = function (to, content) {
        content.topic = to;
        fetch("https://ntfy.hda0.net/", {method: "POST", body: JSON.stringify(content)});
      };




      HTMLElement.prototype.destroy = function destroy() {
        try {
          this.parentNode.removeChild(this);
        } catch (err) {
          console.err("Browser [destroy] Error:", err);
        }
      };

      window.reloadWindow = this.reloadWindow;
      window.navigateWindow = this.navigateWindow.bind(this);
    }
  }

  treatElements(nodeList) {
    for (let node of nodeList) {
      if (node.files) {
        this.treatFiles(node);
      }

      if (node.classList && node.classList.contains("saito-link")) {
        node.classList.add("saito-treated-link");
        node.classList.remove("saito-link");

        if (node.dataset.link) {
          node.addEventListener("click", (e) => {
            this.processLocalLink(e);
            e.stopPropagation();
          });
        }
      }

      if (node.childNodes.length >= 1) {
        this.treatElements(node.childNodes);
      }
    }
  }

  treatIdentifiers(nodeList) {
    let unknown_keys = [];
    let saito_app = this.app;

    function treat(nodes) {
      nodes.forEach((el) => {
        if (el.classList) {
          if (el.classList.contains("saito-address") && !el.classList.contains("treated")) {
            el.classList.add("treated");
            let key = el.dataset?.id;
            if (key && saito_app.wallet.isValidPublicKey(key)) {
              let identifier = saito_app.keychain.returnIdentifierByPublicKey(key);

              if (identifier) {
                el.innerText = identifier;
              } else {
                el.innerHTML = saito_app.keychain.returnUsername(key);

                if (!unknown_keys.includes(key)) {
                  unknown_keys.push(key);
                }
              }
            }
          }
        }
        if (el.childNodes.length >= 1) {
          treat(el.childNodes);
        }
      });
    }

    treat(nodeList);
    if (unknown_keys.length > 0) {
      this.app.connection.emit("registry-fetch-identifiers-and-update-dom", unknown_keys);
    }
  }

  treatFiles(input) {
    if (input.classList.contains("treated")) {
      return;
    } else {
      input.addEventListener("change", function (e) {
        let fileName = "";
        if (this.files && this.files.length > 1) {
          fileName = this.files.length + " files selected.";
        } else {
          fileName = e.target.value.split("\\").pop();
        }
        if (fileName) {
          filelabel.style.border = "none";
          filelabel.innerHTML = sanitize(fileName);
        }
      });
      input.classList.add("treated");
      const filelabel = document.createElement("label");
      filelabel.classList.add("treated");
      filelabel.innerHTML = "Choose File";
      filelabel.htmlFor = input.id;
      filelabel.id = input.id + "-label";
      const parent = input.parentNode;
      parent.appendChild(filelabel);
    }
  }

  processLocalLink(event) {
    event.preventDefault();

    const link = event.currentTarget.getAttribute("href");
    let processed = false;

    this.app.modManager.getRespondTos("saito-link", {link}).forEach((modResponse) => {
      processed = true;
      modResponse.processLink(link);
    });

    if (!processed) {
      navigateWindow(link);
    }

    return false;
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
      let theme_icon_obj = document.querySelector(".saito-theme-icon");
      let am = this.app.modManager.returnActiveModule();

      if (theme_icon_obj && am) {
        let classes = theme_icon_obj.classList;
        for (let c of classes) {
          theme_icon_obj.classList.remove(c);
        }

        theme_icon_obj.classList.add("saito-theme-icon");
        try {
          let theme_classes = am.theme_options[theme].split(" ");
          for (let t of theme_classes) {
            theme_icon_obj.classList.add(t);
          }
        } catch (err) {
          console.error(err);
          console.debug(theme, am.theme_options);
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