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
    this.callback_on_close = null;
    this.class = 'saito-overlay';
    this.zIndex = 100;
    this.visible = false;
    //flag to not add the backdrop
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
    let app = this.app;
    let mod = this.mod;

    if (this.ordinal == 0) {
      let max = 0;
      Array.from(document.querySelectorAll('.saito-overlay')).forEach((ov) => {
        let temp = parseInt(ov.id.replace('saito-overlay', ''));
        if (temp > max) {
          max = temp;
        }
      });

      this.ordinal = max + 1;
    }

    //
    //
    //
    this.zIndex = 100 + 2 * this.ordinal + 1;

    let qs = `saito-overlay-backdrop${this.ordinal}`;
    if (!document.getElementById(qs)) {
      this.app.browser.addElementToDom(SaitoOverlayTemplate(this));
    }

    this.visible = true;
  }

  attachEvents() {}

  show(html = '', mycallback = null) {
    let app = this.app;
    let mod = this.mod;

    this.render();

    let overlay_self = this;

    let overlay_el = document.getElementById(`saito-overlay${this.ordinal}`);
    let overlay_backdrop_el = document.getElementById(`saito-overlay-backdrop${this.ordinal}`);

    this.callback_on_close = mycallback;

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
          //Close by clicking on closebox
          let closebox_qs = `#saito-overlay-closebox${this.ordinal}`;
          let closebox_el = document.querySelector(closebox_qs);
          closebox_el.onclick = this.close.bind(this);

          //Adjust position of closebox for full screen overlay
          setTimeout(() => {
            overlay_el = document.getElementById(`saito-overlay${this.ordinal}`);
            if (overlay_el) {
              let box = overlay_el.getBoundingClientRect();
              if (
                box.width + 30 > window.innerWidth ||
                box.height + 30 > window.innerHeight ||
                this.nonBlocking
              ) {
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

    if (this.callback_on_close != null) {
      this.callback_on_close();
    }

    if (this.removeOnClose) {
      this.remove();
    }
  }

  hide() {
    this.visible = false;
    let elsq = `#saito-overlay${this.ordinal}`;
    let bdelsq = `#saito-overlay-backdrop${this.ordinal}`;

    let overlay_el = document.querySelector(elsq);
    let overlay_backdrop_el = document.querySelector(bdelsq);
    if (overlay_backdrop_el) {
      overlay_backdrop_el.style.display = 'none';
    }
    if (overlay_el) {
      overlay_el.style.display = 'none';
    }
  }

  remove() {
    this.visible = false;
    try {
      let overlay_el = document.querySelector(`#saito-overlay${this.ordinal}`);
      if (overlay_el != null) {
        overlay_el.remove();
      }

      let overlay_backdrop_el = document.querySelector(`#saito-overlay-backdrop${this.ordinal}`);
      if (overlay_backdrop_el != null) {
        overlay_backdrop_el.remove();
      }

      this.ordinal = 0;

      this.callback_on_close = null;
    } catch (err) {
      console.error(err);
    }
  }

  showOverlay(html, mycallback = null) {
    this.show(html, mycallback);
  }

  hideOverlay(mycallback = null) {
    this.hide();
  }

  blockClose(target_btn = null) {
    let qs = `#saito-overlay-backdrop${this.ordinal}`;
    let overlay_backdrop_el = document.querySelector(qs);
    if (overlay_backdrop_el) {
      overlay_backdrop_el.onclick = (e) => {
        if (target_btn) {
          let close_btn = document.querySelector(target_btn);
          if (close_btn) {
            let c1 = window.getComputedStyle(close_btn).color;
            let c2 = window.getComputedStyle(close_btn).backgroundColor;

            close_btn.style.color = c2;
            close_btn.style.backgroundColor = c1;
            setTimeout(() => {
              if (!close_btn) return;
              close_btn.style.color = c1;
              close_btn.style.backgroundColor = c2;
              setTimeout(() => {
                if (!close_btn) return;
                close_btn.style.color = c2;
                close_btn.style.backgroundColor = c1;
                setTimeout(() => {
                  if (!close_btn) return;
                  close_btn.style.color = c1;
                  close_btn.style.backgroundColor = c2;
                }, 300);
              }, 300);
            }, 300);
            return;
          }
        }
        let closebox_qs = `#saito-overlay-closebox${this.ordinal}`;
        let closebox_el = document.querySelector(closebox_qs);
        if (closebox_el) {
          closebox_el.style.transform = 'rotate(180deg)';
          setTimeout(() => {
            closebox_el.style.transform = '';
          }, 500);
        }
      };
    }
  }

  move(x, y) {
    let overlay_el = document.querySelector(`#saito-overlay${this.ordinal}`);
    if (overlay_el) {
      overlay_el.classList.remove('center-overlay');
      overlay_el.style.top = `${x}px`;
      overlay_el.style.left = `${y}px`;
    }
  }

  clear() {
    try {
      let qs = `#saito-overlay${this.ordinal}`;
      let overlay_el = document.querySelector(qs);
      if (overlay_el) {
        if (this.closebox) {
          overlay_el.innerHTML = `<div id="saito-overlay-closebox${this.ordinal}" class="saito-overlay-closebox"><i class="fas fa-times-circle saito-overlay-closebox-btn"></i></div>`;
        } else {
          overlay_el.innerHTML = '';
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  calculateElementHeight(elm) {
    if (document.all) {
      // IE
      elmHeight = elm.currentStyle.height;
      elmMargin =
        parseInt(elm.currentStyle.marginTop, 10) + parseInt(elm.currentStyle.marginBottom, 10);
    } else {
      // Mozilla
      elmHeight = document.defaultView.getComputedStyle(elm, '').getPropertyValue('height');
      elmMargin =
        parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('margin-top')) +
        parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('margin-bottom'));
    }
    return parseInt(elmHeight) + parseInt(elmMargin) + 'px';
  }

  setBackground(img_path = '', dark = true) {
    let qs = `#saito-overlay-backdrop${this.ordinal}`;
    let overlay_backdrop_el = document.querySelector(qs);
    if (overlay_backdrop_el) {
      if (dark == true) {
        overlay_backdrop_el.style.background =
          'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7)), url("' + img_path + '")';
        overlay_backdrop_el.style.backgroundSize = 'cover';
        overlay_backdrop_el.style.opacity = 1;
      } else {
        overlay_backdrop_el.style.backgroundImage = 'url("' + img_path + '")';
        overlay_backdrop_el.style.backgroundSize = 'cover';
        overlay_backdrop_el.style.opacity = 1;
      }
    }
  }

  setBackgroundColor(color = '#000') {
    let qs = `#saito-overlay-backdrop${this.ordinal}`;
    let overlay_backdrop_el = document.querySelector(qs);
    if (overlay_backdrop_el) {
      overlay_backdrop_el.style.backgroundColor = color;
      if (color.length < 4) {
        overlay_backdrop_el.style.opacity = 1;
      }
    }
  }
}

module.exports = SaitoOverlay;
