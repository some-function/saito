const SaitoInputTemplate = require('./saito-input.template');
const SaitoInputLargeTemplate = require('./saito-input-large.template');
const SaitoInputSelectionBox = require('./saito-input-selection-box.template');
const SaitoLoader = require('./../saito-loader/saito-loader');

class SaitoInput {
  constructor(app, mod, container = '', photo_handle) {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this.loader = new SaitoLoader(app, mod, '.photo-window');
    this.callbackOnReturn = null;
    this.callbackOnUpload = null;
    this.display = 'small';
    this.placeholder = 'say something';
    this.open_tab = '';
    this.mentions = [];
    this.quote = '';
    this.quote_src = '';
    this.photo_handle = 'hidden_file_element_' + photo_handle;
    this.enable_mentions = true;
  }

  render(autofocus = true) {
    if (this.display == 'large') {
      if (!document.querySelector(this.container + ' .saito-input')) {
        this.app.browser.prependElementToSelector(
          SaitoInputLargeTemplate(this, this.placeholder),
          this.container
        );
      }
      this.attachLargeEvents();
    } else {
      if (!document.querySelector(this.container + ' .saito-input')) {
        this.app.browser.prependElementToSelector(
          SaitoInputTemplate(this.placeholder),
          this.container
        );
      }
      this.attachEvents();
    }

    if (autofocus) {
      this.focus();
    }
  }

  attachEvents() {
    let input_icon = document.querySelector(`${this.container} .saito-input .saito-emoji`);

    if (input_icon) {
      input_icon.onclick = (e) => {
        e.stopPropagation();
        if (document.querySelector('.saito-input-selection-box')) {
          this.removeSelectionBox();
        } else {
          if (!document.querySelector('.saito-input-selection-box')) {
            this.app.browser.addElementToDom(SaitoInputSelectionBox(this));

            Array.from(document.querySelectorAll('.saito-box-tab')).forEach((tab) => {
              tab.onclick = (e) => {
                Array.from(document.querySelectorAll('.active-tab')).forEach((tab2) => {
                  tab2.classList.remove('active-tab');
                });

                let selected_tab = e.currentTarget.getAttribute('id').replace('tab', 'window');

                if (document.getElementById(selected_tab)) {
                  document.getElementById(selected_tab).classList.add('active-tab');
                }

                if (selected_tab === 'gif-window') {
                  this.addGiphyEvent();
                } else if (selected_tab === 'photo-window') {
                  this.addPhotoEvent();
                }
              };
            });

            document.onclick = (e) => {
              if (!document.querySelector('.saito-input-selection-box').contains(e.target)) {
                this.removeSelectionBox();
              }
            };

            this.addEmojiEvent();
          }
        }
      };
    }

    let msg_input = document.querySelector(`${this.container} .saito-input .text-input`);
    if (msg_input) {
      msg_input.onkeydown = (e) => {
        if ((e.which == 13 || e.keyCode == 13) && !e.shiftKey) {
          if (document.querySelector(`${this.container} #saito-mentions-list`)) {
            let status = document
              .querySelector(`${this.container} #saito-mentions-list`)
              .getAttribute('status');

            if (status == 'show') {
              return;
            }
          }
          e.preventDefault();
          if (this.callbackOnReturn) {
            this.callbackOnReturn(this.getInput(false));
            msg_input.value = '';
          }
        }
      };

      this.app.browser.addSaitoMentions(
        document.querySelector(`${this.container} .saito-input .text-input`),
        document.querySelector(`${this.container} #saito-mentions-list`),
        'div'
      );
    }
  }

  attachLargeEvents() {
    this.open_tab = '';

    Array.from(document.querySelectorAll(`${this.container} .saito-box-tab`)).forEach((tab) => {
      tab.onclick = (e) => {
        e.stopPropagation();
        let selected_tab = e.currentTarget.getAttribute('id').replace('tab', 'window');

        if (selected_tab == this.open_tab) {
          this.removeSelectionBox();
          return;
        }

        this.removeSelectionBox();
        this.open_tab = selected_tab;

        this.app.browser.addElementToDom(SaitoInputSelectionBox(this));

        document.onclick = (event) => {
          if (!document.querySelector('.saito-input-selection-box').contains(event.target)) {
            this.removeSelectionBox();
          }
        };

        setTimeout(() => {
          switch (this.open_tab) {
            case 'emoji-window':
              this.addEmojiEvent();
              break;
            case 'gif-window':
              this.addGiphyEvent();
              break;
            case 'photo-window':
              this.addPhotoEvent();
              break;
            default:
          }
        }, 5);
      };
    });

    let msg_input = document.querySelector(`${this.container} .saito-input .text-input`);

    if (msg_input) {
      msg_input.addEventListener('keydown', (e) => {
        if (e.keyCode === 13 && e.ctrlKey) {
          e.preventDefault();
          if (this.callbackOnReturn) {
            this.callbackOnReturn();
          }
        }

        if ((e.keyCode == 50 || e.charCode == 64) && e.key == '@') {
        }
      });

      this.app.browser.addSaitoMentions(
        document.querySelector(`${this.container} .saito-input .text-input`),
        document.querySelector(this.container + ' #saito-mentions-list'),
        'input'
      );
    }
  }

  getInput(as_html = false) {
    let inputBox = document.querySelector(`${this.container} .saito-input .text-input`);
    let input = '';

    if (this.quote_src) {
      this.mentions.push(this.quote_src);
    }

    if (this.quote) {
      input = `${this.quote}`;
    }

    let lastTag = inputBox.lastElementChild;
    if (lastTag && lastTag.tagName == 'BR') {
      lastTag.remove();
    }

    if (as_html) {
      input += inputBox?.innerHTML || '';
    } else {
      input += inputBox?.innerText || inputBox?.value || '';
    }

    this.app.browser.extractMentions(input).forEach((mention) => {
      if (!this.mentions.includes(mention)) {
        this.mentions.push(mention);
      }
    });

    return input;
  }

  getMentions() {
    return this.mentions.slice();
  }

  setInput(text) {
    let inputBox = document.querySelector(`${this.container} .saito-input .text-input`);
    if (inputBox) {
      inputBox.innerHTML = sanitize(text);
    }
    this.focus();
  }

  clear() {
    this.clearQuote();
    this.setInput('');
    this.mentions = [];
    this.focus();
  }

  clearQuote() {
    this.quote = '';
    this.quote_src = '';
    if (document.querySelector('.saito-input-quote')) {
      document.querySelector('.saito-input-quote').remove();
    }
  }

  insertQuote(quote, src_key) {
    this.clearQuote();

    this.quote_src = src_key;
    this.quote = sanitize(quote);

    this.app.browser.prependElementToSelector(
      `<div class="saito-input-quote"><i class="fas fa-reply"></i>${this.quote}<i class="fa-solid fa-xmark cancel-quote"></i></div>`,
      `${this.container} .saito-input`
    );

    this.focus();

    if (document.querySelector('.cancel-quote')) {
      document.querySelector('.cancel-quote').onclick = (e) => {
        this.quote = '';
        if (document.querySelector('.saito-input-quote')) {
          document.querySelector('.saito-input-quote').remove();
        }
      };
    }
  }

  insertRange(text) {
    let inputBox = document.querySelector(`${this.container} .saito-input .text-input`);
    if (inputBox) {
      inputBox.innerHTML = sanitize(text);

      const range = document.createRange();
      var sel = document.getSelection();
      range.setStart(inputBox, 2);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    this.focus();
  }

  focus(force = false) {
    let inputBox = document.querySelector(`${this.container} .saito-input .text-input`);
    if (inputBox) {
      if (force || !this.isOtherInputActive()) {
        const range = document.createRange();
        const selection = window.getSelection();

        range.setStart(inputBox, inputBox.childNodes.length);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

        setTimeout(() => {
          inputBox.focus();
        }, 0);
      } else {
        this.isOtherInputActive(true);
      }
    }
  }

  removeSelectionBox() {
    if (document.querySelector('emoji-picker')) {
      document.body.append(document.querySelector('emoji-picker'));
    }
    if (document.querySelector('.saito-input-selection-box')) {
      document.querySelector('.saito-input-selection-box').remove();
    }
    document.onclick = null;
    this.open_tab = '';
    this.giphy_rendered = false;
    this.focus();
  }

  addPhotoEvent() {
    if (document.getElementById(this.photo_handle)) {
      document.getElementById(this.photo_handle).click();
      this.removeSelectionBox();
      return;
    } else {
      this.photo_handle = 'hidden_file_element_photo-window';
      this.app.browser.addDragAndDropFileUploadToElement(`photo-window`, async (filesrc) => {
        document.querySelector('.photo-window').innerHTML = '';
        this.loader.render();
        filesrc = await this.app.browser.resizeImg(filesrc);
        this.loader.remove();

        if (this.callbackOnUpload) {
          this.callbackOnUpload(filesrc);
        } else if (this.callbackOnReturn) {
          this.callbackOnReturn(filesrc);
        }
        this.removeSelectionBox();
      });
    }
  }

  addEmojiEvent() {
    window['emoji-output'] = `${this.container} .saito-input .text-input`;

    if (!document.querySelector('emoji-picker')) {
      this.app.browser.addElementToDom('<emoji-picker></emoji-picker>');
      document.querySelector('emoji-picker').addEventListener('emoji-click', (event) => {
        let emoji = event.detail;
        var input = document.querySelector(window['emoji-output']);
        if (!input) {
          return;
        }
        if (input.value) {
          input.value += emoji.unicode;
        } else {
          input.innerHTML += emoji.unicode;
        }

        if (this.display == 'large') {
        } else {
          this.focus(true);
        }
      });
    }

    let picker = document.querySelector('emoji-picker');

    if (picker) {
      let container = document.getElementById('emoji-window');
      if (container) {
        container.append(picker);
      }

      let search_bar = picker.shadowRoot.querySelector('input.search');
      if (search_bar) {
        if (!this.app.browser.isMobileBrowser()) {
          search_bar.focus({ focusVisible: true });
        }
      }
    }
  }

  async addGiphyEvent() {
    if (this.giphy_rendered) {
      return;
    }

    let gif_mod = this.app.modules.respondTo('giphy');
    let gif_function = gif_mod?.length > 0 ? gif_mod[0].respondTo('giphy') : null;
    if (gif_function) {
      gif_function.renderInto('#gif-window', (gif_source) => {
        if (this.callbackOnUpload) {
          this.callbackOnUpload(gif_source);
        } else if (this.callbackOnReturn) {
          this.callbackOnReturn(gif_source);
        }
        this.removeSelectionBox();
      });
      this.giphy_rendered = true;
    }
  }

  isOtherInputActive(debug = false) {
    if (document.querySelector('.saito-input-selection-box')) {
      if (debug) console.log('.saito-input-selection-box');
      return 1;
    }

    let ep = document.querySelector('emoji-picker');
    if (ep && window.getComputedStyle(ep).display !== 'none') {
      if (debug) console.log('emoji-picker: ' + window.getComputedStyle(ep).display);
      return 1;
    }

    let ae = document.activeElement;
    let this_input = document.querySelector(this.container + ' .saito-input');

    if (!ae) {
      return 0;
    }

    let parent = ae.parentNode;
    while (parent) {
      if (parent === this_input) {
        return 0;
      }
      parent = parent.parentNode;
    }

    if (ae.tagName.toLowerCase() == 'input' || ae.tagName.toLowerCase() == 'textarea') {
      return 1;
    }

    if (ae.classList.contains('text-input')) {
      return 1;
    }

    return 0;
  }
}

module.exports = SaitoInput;
