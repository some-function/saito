const SaitoOverlayTemplate = require("./saito-overlay.template");

class SaitoOverlay {
  constructor(app, mod, withCloseBox = true, removeOnClose = true, clickToClose = false) {
    this.app = app;
    this.mod = mod;
    this.ordinal = 0;
    this.closebox = withCloseBox;
    this.clickToClose = clickToClose;
    this.clickBackdropToClose = true;
    this.removeOnClose = removeOnClose;
    this.callbackOnClose = null;
    this.class = "saito-overlay";
    this.zIndex = 100;
    this.visible = false;
    this.nonBlocking = false;
  }

  pullOverlayToFront() {
    const max = Math.max(0, ...Array.from(document.querySelectorAll(".saito-overlay")).map((ov) => ov.style.zIndex));

    const max_z_index_bg = 100 + max + 2;
    const max_z_index    = 100 + max + 3;

    const obj = document.getElementById(`saito-overlay${this.ordinal}`);
    if (obj) {
      obj.style.zIndex = max_z_index;
      obj.style.display = "block";
    }

    const obj2 = document.getElementById(`saito-overlay-backdrop${this.ordinal}`);
    if (obj2) {
      obj2.style.zIndex = max_z_index_bg;
      obj2.style.display = "block";
    }

    setTimeout(() => {
      const overlayBackdropElement = document.querySelector(`#saito-overlay-backdrop${this.ordinal}`);
      if (overlayBackdropElement) {
        overlayBackdropElement.style.display = "block";
      }

      const overlayElement = document.querySelector(`#saito-overlay${this.ordinal}`);
      if (overlayElement) {
        overlayElement.style.display = "block";
      }
    }, 50);
  }

  render() {
    if (this.ordinal == 0) {
      const elements = Array.from(document.querySelectorAll(".saito-overlay"));
      this.ordinal = Math.max(0, ...elements.map((ov) => parseInt(ov.id.replace("saito-overlay", "")))) + 1;
    }

    this.zIndex = 100 + 2 * this.ordinal + 1;

    if (!document.getElementById(`saito-overlay-backdrop${this.ordinal}`)) {
      this.app.browser.addElementToDom(SaitoOverlayTemplate(this));
    }

    this.visible = true;
  }

  show(html="", mycallback=null) {
    this.render();

    let overlayElement = document.getElementById(`saito-overlay${this.ordinal}`);
    const overlayBackdropElement = document.getElementById(`saito-overlay-backdrop${this.ordinal}`);

    this.callbackOnClose = mycallback;

    try {
      overlayElement.style.display = "block";
      if (overlayBackdropElement && !this.nonBlocking) {
        overlayBackdropElement.style.display = "block";
      }

      if (html) {
        if (this.closebox) {
          overlayElement.innerHTML = `
            <div id="saito-overlay-closebox${this.ordinal}" class="saito-overlay-closebox">
              <i class="fas fa-times-circle saito-overlay-closebox-btn"></i>
            </div>
          ` + html;
          const closeboxElement = document.querySelector(`#saito-overlay-closebox${this.ordinal}`);
          closeboxElement.onclick = this.close.bind(this);

          setTimeout(() => {
            overlayElement = document.getElementById(`saito-overlay${this.ordinal}`);
            if (overlayElement) {
              const box = overlayElement.getBoundingClientRect();
              if (box.width + 30 > window.innerWidth || box.height + 30 > window.innerHeight || this.nonBlocking) {
                overlayElement.classList.add("maximized-overlay");
              }

              closeboxElement.style.display = "block";
            }
          }, 10);
        } else {
          overlayElement.innerHTML = html;
        }
      }

      if (overlayBackdropElement) {
        if (this.clickBackdropToClose) {
          overlayBackdropElement.onclick = this.close.bind(this);
        } else {
          overlayBackdropElement.onclick = () => {};
        }
      }

      if (this.clickToClose) {
        overlayElement.onclick = this.close.bind(this);
      } else {
        overlayElement.onclick = () => {};
      }
    } catch (err) {
      console.error("OVERLAY ERROR:", err);
    }
  }

  close() {
    this.hide();

    if (this.callbackOnClose != null) {
      this.callbackOnClose();
    }

    if (this.removeOnClose) {
      this.remove();
    }
  }

  hide() {
    this.visible = false;
    
    const overlayBackdropElement = document.querySelector(`#saito-overlay-backdrop${this.ordinal}`);
    if (overlayBackdropElement) {
      overlayBackdropElement.style.display = "none";
    }

    const overlayElement = document.querySelector(`#saito-overlay${this.ordinal}`);
    if (overlayElement) {
      overlayElement.style.display = "none";
    }
  }

  remove() {
    this.visible = false;
    try {
      const overlayElement = document.querySelector(`#saito-overlay${this.ordinal}`);
      if (overlayElement != null) {
        overlayElement.remove();
      }

      const overlayBackdropElement = document.querySelector(`#saito-overlay-backdrop${this.ordinal}`);
      if (overlayBackdropElement != null) {
        overlayBackdropElement.remove();
      }

      this.ordinal = 0;

      this.callbackOnClose = null;
    } catch (err) {
      console.error(err);
    }
  }
}

module.exports = SaitoOverlay;