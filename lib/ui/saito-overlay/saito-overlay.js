const SaitoOverlayTemplate = require('./saito-overlay.template');

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
    this.class = 'saito-overlay';
    this.zIndex = 100;
    this.visible = false;
    this.nonBlocking = false;
  }

  pullOverlayToFront() {
    let max_z_index_bg = 0;
    let max_z_index = 0;
    let max = 0;

    Array.from(document.querySelectorAll('.saito-overlay')).forEach((ov) => {
      let temp = parseInt(ov.style.zIndex);
      if (temp > max) {
        max = temp;
      }
    });

    max_z_index_bg = 100 + max + 2;
    max_z_index = 100 + max + 3;

    let qs = `saito-overlay${this.ordinal}`;
    let obj = document.getElementById(qs);
    if (obj) {
      obj.style.zIndex = max_z_index;
      obj.style.display = 'block';
    }

    let qs2 = `saito-overlay-backdrop${this.ordinal}`;
    let obj2 = document.getElementById(qs2);
    if (obj2) {
      obj2.style.zIndex = max_z_index_bg;
      obj2.style.display = 'block';
    }

    setTimeout(() => {
      let elsq = `#saito-overlay${this.ordinal}`;
      let bdelsq = `#saito-overlay-backdrop${this.ordinal}`;

      let overlay_el = document.querySelector(elsq);
      let overlay_backdrop_el = document.querySelector(bdelsq);

      if (overlay_backdrop_el) {
        overlay_backdrop_el.style.display = 'block';
      }
      if (overlay_el) {
        overlay_el.style.display = 'block';
      }
    }, 50);
  }

  render() {
    if (this.ordinal == 0) {
      let max = 0;
      Array.from(document.querySelectorAll('.saito-overlay')).forEach((ov) => {
        const temp = parseInt(ov.id.replace('saito-overlay', ''));
        if (temp > max) {
          max = temp;
        }
      });

      this.ordinal = max + 1;
    }

    this.zIndex = 100 + 2 * this.ordinal + 1;

    if (!document.getElementById(`saito-overlay-backdrop${this.ordinal}`)) {
      this.app.browser.addElementToDom(SaitoOverlayTemplate(this));
    }

    this.visible = true;
  }

  show(html = '', mycallback = null) {
    this.render();

    let overlay_el = document.getElementById(`saito-overlay${this.ordinal}`);
    let overlay_backdrop_el = document.getElementById(`saito-overlay-backdrop${this.ordinal}`);

    this.callbackOnClose = mycallback;

    try {
      overlay_el.style.display = 'block';
      if (overlay_backdrop_el && !this.nonBlocking) {
        overlay_backdrop_el.style.display = 'block';
      }

      if (html) {
        if (this.closebox) {
          overlay_el.innerHTML =
            `<div id="saito-overlay-closebox${this.ordinal}" class="saito-overlay-closebox"><i class="fas fa-times-circle saito-overlay-closebox-btn"></i></div>` +
            html;
          let closebox_qs = `#saito-overlay-closebox${this.ordinal}`;
          let closebox_el = document.querySelector(closebox_qs);
          closebox_el.onclick = this.close.bind(this);

          setTimeout(() => {
            overlay_el = document.getElementById(`saito-overlay${this.ordinal}`);
            if (overlay_el) {
              let box = overlay_el.getBoundingClientRect();
              if (box.width + 30 > window.innerWidth || box.height + 30 > window.innerHeight || this.nonBlocking) {
                overlay_el.classList.add('maximized-overlay');
              }

              closebox_el.style.display = 'block';
            }
          }, 10);
        } else {
          overlay_el.innerHTML = html;
        }
      }

      if (overlay_backdrop_el) {
        if (this.clickBackdropToClose) {
          overlay_backdrop_el.onclick = this.close.bind(this);
        } else {
          overlay_backdrop_el.onclick = () => {};
        }
      }

      if (this.clickToClose) {
        overlay_el.onclick = this.close.bind(this);
      } else {
        overlay_el.onclick = () => {};
      }
    } catch (err) {
      console.error('OVERLAY ERROR:', err);
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
    
    const overlay_backdrop_el = document.querySelector(`#saito-overlay-backdrop${this.ordinal}`);
    if (overlay_backdrop_el) {
      overlay_backdrop_el.style.display = 'none';
    }

    const overlay_el = document.querySelector(`#saito-overlay${this.ordinal}`);
    if (overlay_el) {
      overlay_el.style.display = 'none';
    }
  }

  remove() {
    this.visible = false;
    try {
      const overlay_el = document.querySelector(`#saito-overlay${this.ordinal}`);
      if (overlay_el != null) {
        overlay_el.remove();
      }

      const overlay_backdrop_el = document.querySelector(`#saito-overlay-backdrop${this.ordinal}`);
      if (overlay_backdrop_el != null) {
        overlay_backdrop_el.remove();
      }

      this.ordinal = 0;

      this.callbackOnClose = null;
    } catch (err) {
      console.error(err);
    }
  }
}

module.exports = SaitoOverlay;