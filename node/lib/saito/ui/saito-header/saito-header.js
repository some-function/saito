const UIModTemplate = require('./../../../templates/uimodtemplate');
const SaitoHeaderTemplate = require('./saito-header.template');
const FloatingMenu = require('./saito-floating-menu.template');
const SaitoLoader = require('./../saito-loader/saito-loader');
const UserMenu = require('./../modals/user-menu/user-menu');
const SaitoBackup = require('./../modals/saito-backup/saito-backup');


class SaitoHeader extends UIModTemplate {
  constructor(app, mod) {
    super(app);

    this.name = 'SaitoHeader UIComponent';
    this.slug = 'SaitoHeader';

    this.app = app;
    this.mod = mod;

    this.header_class = '';

    this.notifications = {};

    this.header_location = '/' + mod.returnSlug();

    this.callbacks = {};

    this.balance_check_interval = null;
    this.deposit_check_interval = null;

    this.can_update_header_msg = true;
    this.show_msg = true;

    this.loader = new SaitoLoader(this.app, this.mod);
    this.saito_backup = new SaitoBackup(app, mod);

    console.log('Create Saito Header for ' + mod.name);
  }

  async initialize(app) {
    await super.initialize(app);

    this.userMenu = new UserMenu(app, this.publicKey);

    app.connection.on('registry-update-identifier', (publicKey) => {
      if (publicKey === this.publicKey) {
        this.renderUsername();
      }
    });

    app.connection.on('saito-header-update-message', (obj = {}) => {
      let msg = '';
      this.can_update_header_msg = true;

      if ('msg' in obj) {
        msg = obj.msg;
        this.can_update_header_msg = false;
      }

      let flash = false;
      let callback = null;
      let timeout = null;

      if (obj) {
        console.log('update header obj: ', obj);

        this.can_update_header_msg = true;
        if ('msg' in obj) {
          msg = obj.msg;
          this.can_update_header_msg = false;
        }

        if ('flash' in obj) {
          flash = obj.flash;
        }

        if ('callback' in obj) {
          callback = obj.callback;
        }

        if ('timeout' in obj) {
          timeout = obj.timeout;
        }
      }
      this.updateHeaderMessage(msg, flash, callback, timeout);
    });

    app.connection.on('block-fetch-status', (count) => {});

    app.connection.on('saito-header-replace-logo', (callback = null) => {
      if (!document.querySelector('.saito-back-button')) {
        this.app.browser.addElementToSelector(
          `<i class="saito-back-button fa-solid fa-arrow-left"></i>`,
          '.saito-header-logo-wrapper'
        );

        document.querySelector('.saito-header-logo-wrapper').onclick = (e) => {
          if (callback) {
            callback(e);
          }
        };
      }
    });

    app.connection.on('saito-header-change-location', (new_path) => {
      this.header_location = new_path;
    });

    app.connection.on('saito-header-render', () => {
      this.render();
    });

    app.connection.on('saito-header-reset-logo', () => {
      this.resetHeaderLogo();
    });

    app.connection.on('saito-header-notification', (source_mod, unread) => {
      this.notifications[source_mod] = unread;

      let total = 0;
      for (let m in this.notifications) {
        total += this.notifications[m];
      }

      this.app.browser.addNotificationToId(total, 'saito-header-menu-toggle');
    });

    this.app.connection.on('saito-header-logo-change-request', (obj) => {
      this.resetHeaderLogo();
    });
  }

  resetHeaderLogo() {
    let logo = document.querySelector('.saito-header-logo-wrapper');
    if (logo) {
      logo.innerHTML = this.app.browser.logoSVG();
      logo.onclick = (e) => {
        navigateWindow(this.header_location, 300);
      };
    }
  }

  async render() {
    if (this.mod == null || !document) {
      return;
    }

    if (!document.getElementById('saito-header')) {
      this.app.browser.prependElementToDom(
        SaitoHeaderTemplate(this.app, this.mod, this.header_class)
      );
    } else {
      this.app.browser.replaceElementById(
        SaitoHeaderTemplate(this.app, this.mod, this.header_class),
        'saito-header'
      );
    }

    this.resetHeaderLogo();

    if (this.mod?.use_floating_plus) {
      if (!document.getElementById('saito-floating-menu')) {
        this.app.browser.addElementToDom(FloatingMenu());
        this.addFloatingMenu();
      }
    }

    this.addHamburgerMenu();
    await this.app.modules.renderInto('.saito-header');
    this.renderUsername();
    this.attachEvents();
  }

  addFloatingMenu() {
    let this_header = this;

    let index = 0;
    let menu_entries = [];

    let mods = this.app.modules.respondTo('saito-floating-menu');
    for (const mod of mods) {
      let item = mod.respondTo('saito-floating-menu');

      if (item instanceof Array) {
        item.forEach((j) => {
          if (!j.rank) {
            j.rank = 100;
          }
          menu_entries.push(j);
        });
      }
    }

    let menu_sort = function (a, b) {
      if (a.rank < b.rank) {
        return 1;
      }
      if (a.rank > b.rank) {
        return -1;
      }
      return 0;
    };

    menu_entries = menu_entries.sort(menu_sort);

    for (let i = 0; i < menu_entries.length; i++) {
      let j = menu_entries[i];
      let show_me = true;
      let active_mod = this.app.modules.returnActiveModule();
      if (typeof j.disallowed_mods != 'undefined') {
        if (j.disallowed_mods.includes(active_mod.slug)) {
          show_me = false;
        }
      }
      if (typeof j.allowed_mods != 'undefined') {
        show_me = false;
        if (j.allowed_mods.includes(active_mod.slug)) {
          show_me = true;
        }
      }
      if (show_me) {
        let id = `saito_floating_menu_item_${index}`;
        this_header.callbacks[index] = j.callback;
        this_header.addFloatingMenuItem(j, id, index);
        index++;
      }
    }
  }

  addFloatingMenuItem(item, id, index) {
    let html = `
          <div id="${id}" data-id="${index}" class="saito-floating-menu-item">
            <i class="${item.icon}"></i>
          </div>
        `;

    if (item?.is_active) {
      this.app.browser.addElementToSelector(html, '.saito-floating-item-container.main');
    } else {
      this.app.browser.addElementToSelector(html, '.saito-floating-item-container.alt');
    }
  }

  addHamburgerMenu() {
    let mods = this.app.modules.respondTo('saito-header');

    let index = 0;
    let menu_entries = [];
    for (const mod1 of mods) {
      let item = mod1.respondTo('saito-header');
      if (item instanceof Array) {
        item.forEach((j) => {
          if (!j.rank) {
            j.rank = 100;
          }
          menu_entries.push(j);
        });
      }
    }

    let menu_sort = function (a, b) {
      if (a.rank < b.rank) {
        return -1;
      }
      if (a.rank > b.rank) {
        return 1;
      }
      return 0;
    };
    menu_entries = menu_entries.sort(menu_sort);

    for (let i = 0; i < menu_entries.length; i++) {
      let j = menu_entries[i];
      let show_me = true;
      let active_mod = this.app.modules.returnActiveModule();
      if (typeof j.disallowed_mods != 'undefined') {
        if (j.disallowed_mods.includes(active_mod.slug)) {
          show_me = false;
        }
      }
      if (typeof j.allowed_mods != 'undefined') {
        show_me = false;
        if (j.allowed_mods.includes(active_mod.slug)) {
          show_me = true;
        }
      }
      if (show_me) {
        let id = `saito_header_menu_item_${index}`;
        this.callbacks[id] = j.callback;
        this.addMenuItem(j, id);
        index++;

        if (j.event) {
          j.event(id);
        }
      }
    }

    Array.from(document.querySelectorAll('.saito-header-appspace-option.quicklaunch')).forEach(
      (elem) => {
        if (elem.dataset.navigation) {
          elem.oncontextmenu = (e) => {
            e.preventDefault();
            navigateWindow(elem.dataset.navigation);
          };
        }
      }
    );
  }

  addMenuItem(item, id) {
    let html = `     
      <li id="${id}" data-id="${item.text}" class="saito-header-appspace-option ${item.type}" ${item?.navigation ? `data-navigation="${item.navigation}"` : ''}>
        <i class="${item.icon}"></i>
        <span>${item.text}</span></li>`;

    let keyword = item.type;
    if (!keyword) {
      console.warn('Unclassified responder to saito-header!');
      keyword = 'module';
    }
    if (item.type == 'navigation' || item.type == 'quicklaunch') {
      keyword = 'module';
    }

    let menu = document.querySelector(`.saito-header-menu-section .${keyword}-menu > ul`);
    if (menu) {
      menu.innerHTML += html;
      menu.parentElement.classList.remove('empty-menu-section');
    }
  }

  attachEvents() {
    let app = this.app;
    let mod = this.mod;
    let this_header = this;

    if (document.querySelector('#saito-header-menu-toggle')) {
      document.querySelector('#saito-header-menu-toggle').addEventListener('click', () => {
        this.toggleMenu();
      });
    }

    if (document.querySelector('.saito-header-backdrop')) {
      document.querySelector('.saito-header-backdrop').onclick = () => {
        this.toggleMenu();
      };
    }

    if (document.getElementById('wallet-btn-withdraw')) {
      document.getElementById('wallet-btn-withdraw').onclick = (e) => {
        app.connection.emit('saito-crypto-withdraw-render-request');
        this.hideMenu();
      };
    }

    if (document.getElementById('wallet-btn-history')) {
      document.getElementById('wallet-btn-history').onclick = (e) => {
        app.connection.emit('saito-crypto-history-render-request');
        this.hideMenu();
      };
    }

    if (document.getElementById('wallet-btn-settings')) {
      document.getElementById('wallet-btn-settings').onclick = (e) => {
        app.connection.emit('settings-overlay-render-request');
        this.hideMenu();
      };
    }

    if (document.getElementById('wallet-btn-details')) {
      document.getElementById('wallet-btn-details').onclick = (e) => {
        document.querySelector('.saito-header-hamburger-contents').classList.toggle('show-wallet');
        Array.from(e.currentTarget.children).forEach((c) => {
          c.classList.toggle('hideme');
        });
      };
    }

    if (document.querySelector('.pubkey-mobile-wrapper')) {
      document.querySelector('.pubkey-mobile-wrapper').onclick = () => {};
    }

    document.querySelector('.pubkey-containter').onclick = async (e) => {
      let public_key = document.getElementById('profile-public-key').dataset.add;

      await navigator.clipboard.writeText(public_key);
      let icon_element = document.querySelector('.pubkey-containter i.fa-copy');
      icon_element.classList.toggle('fa-copy');
      icon_element.classList.toggle('fa-check');

      setTimeout(() => {
        icon_element.classList.toggle('fa-copy');
        icon_element.classList.toggle('fa-check');
      }, 800);
    };

    if (document.getElementById('wallet-select-crypto')) {
      document.getElementById('wallet-select-crypto').onchange = async (e) => {
        this.clearBalanceCheck();
        this.clearPendingDepositsCheck();

        if (
          !this.app.options.crypto[e.target.value] ||
          !this.app.options.crypto[e.target.value].address
        ) {
          this.app.connection.emit('saito-header-install-crypto', e.target.value);
        }

        await app.wallet.setPreferredCrypto(e.target.value);
        console.log(
          'Change preferred crypto, restart polls on crypto balance and pending deposits'
        );
        this.initiateBalanceCheck();
        this.initiatePendingDepositsCheck();
      };
    }

    document.querySelectorAll('.saito-header-appspace-option').forEach((menu) => {
      let id = menu.getAttribute('id');
      let data_id = menu.getAttribute('data-id');
      let callback = this_header.callbacks[id];

      menu.addEventListener('click', async (e) => {
        this.toggleMenu();
        e.preventDefault();
        callback(app, data_id);
      });
    });

    if (document.querySelector('#saito-floating-plus-btn')) {
      document.getElementById('saito-floating-plus-btn').onclick = (e) => {
        document.getElementById('saito-floating-menu').classList.toggle('activated');
      };
    }

    if (document.getElementById('saito-floating-menu-mask')) {
      document.getElementById('saito-floating-menu-mask').onclick = (e) => {
        let mask = e.currentTarget;

        document.getElementById('saito-floating-menu').classList.toggle('activated');
      };
    }

    document.querySelectorAll('.saito-floating-menu-item').forEach((menu) => {
      let id = menu.getAttribute('id');
      let data_id = menu.getAttribute('data-id');
      let callback = this_header.callbacks[data_id];

      menu.onclick = (e) => {
        e.preventDefault();
        callback(this_header.app, data_id);
        console.log('hi!');
        document.getElementById('saito-floating-menu').classList.toggle('activated');
      };
    });
  }

  toggleMenu() {
    if (
      document.querySelector('.saito-header-hamburger-contents').classList.contains('show-menu')
    ) {
      document.querySelector('.saito-header-hamburger-contents').classList.remove('show-menu');
      document.querySelector('.saito-header-backdrop').classList.remove('menu-visible');

      this.clearBalanceCheck();
      this.clearPendingDepositsCheck();
    } else {
      document.querySelector('.saito-header-hamburger-contents').classList.add('show-menu');
      document.querySelector('.saito-header-backdrop').classList.add('menu-visible');

      console.log('Menu open, start polls on crypto balance and pending deposits');
      this.initiateBalanceCheck();
      this.initiatePendingDepositsCheck();
    }
  }

  hideMenu() {
    if (
      document.querySelector('.saito-header-hamburger-contents').classList.contains('show-menu')
    ) {
      document.querySelector('.saito-header-hamburger-contents').classList.remove('show-menu');
      document.querySelector('.saito-header-backdrop').classList.remove('menu-visible');
    }

    this.clearBalanceCheck();
  }


  updateHeaderMessage(text = '', flash = false, callback = null, timeout = 0) {
    let this_self = this;
    let el = document.getElementById('header-msg');

    if (text == '') {
      this.renderUsername();
    } else {
      el.innerHTML = text;
    }

    if (flash) {
      el.classList.add('flash');
    } else {
      el.classList.remove('flash');
    }

    if (callback != null) {
      if (timeout) {
        console.log('timeout: //////////', timeout);
        setTimeout(function () {
          console.log('Clear flashing reminder from saito-header/updateHeaderMessage');
          this_self.updateHeaderMessage();
        }, timeout);
      }

      el.onclick = () => {
        delete this.app.options.wallet.backup_required;
        this.updateHeaderMessage();
        callback();
      };
    }
  }

  renderUsername() {
    let header_self = this;

    let key = this.app.keychain.returnKey(this.publicKey);
    let username = key?.identifier
      ? key.identifier
      : this.app.keychain.returnIdentifierByPublicKey(this.publicKey, true);

    if (username == '' || username == this.publicKey) {
      if (this.app.browser.isMobileBrowser()) {
        username = 'Anonymous';
      } else {
        username = 'Anonymous Account';
      }
      if (key?.has_registered_username) {
        username = 'registering...';
      }
    }

    let el = document.getElementById('header-msg');
    if (!el) {
      return;
    }

    el.innerHTML = sanitize(username);
    el.classList.remove('flash');

    if (username === 'Anonymous Account' || username === 'Anonymous') {
      el.onclick = (e) => {
        header_self.app.connection.emit('register-username-or-login', {
          success_callback: (desired_identifier) => {
            header_self.app.connection.emit('saito-backup-render-request', {
              msg: `'${desired_identifier}' succesfully registered, back up now to protect your account`
            });
          }
        });
      };
    } else if (username == 'registering...') {
      el.onclick = null;
    } else {
      if (key?.email) {
        el.onclick = (e) => {
          header_self.userMenu.render();
        };
      } else {
        el.onclick = (e) => {
          header_self.app.connection.emit('recovery-backup-overlay-render-request');
        };
      }
    }

    console.log(
      'Saito-header renderUsername backup_required? ',
      this.app.options.wallet?.backup_required
    );
    if (this.app.options.wallet?.backup_required) {
      setTimeout(() => {
        if (this.app.options.wallet?.backup_required) {
          if (this.app.options.wallet.backup_required == 1) {
            this.app.options.wallet.backup_required = `Have you backed up your wallet recently? Keep your keys and account safe by backing up`;
          }

          console.log('Restore flashing reminder from saito-header');
          this.updateHeaderMessage('wallet backup required', true, () => {
            this.app.connection.emit('saito-backup-render-request', {
              msg: this.app.options.wallet.backup_required,
              title: 'BACKUP YOUR WALLET'
            });
          });
        }
      }, 4500);
    }
  }

  clearBalanceCheck() {
    clearTimeout(this.balance_check_interval);
  }

  clearPendingDepositsCheck() {
    clearInterval(this.deposit_check_interval);
  }

  initiatePendingDepositsCheck() {
    let this_self = this;
    let intervalTime = 5000;
    let preferred_crypto = this_self.app.wallet.returnPreferredCrypto();
    let confirmations = preferred_crypto.confirmations;

    const checkDeposits = async () => {
      if (document.querySelector('.saito-header-backdrop.menu-visible') == null) {
        this.clearPendingDepositsCheck();
        console.log(`Stopped checking ${preferred_crypto.ticker} deposit`);
        return;
      }

      console.log('check pending deposits');

      await preferred_crypto.fetchPendingDeposits(function (res) {
        if (res.length > 0) {
          let pending_transfer = res[res.length - 1];

          console.log('pending_transfer: ', pending_transfer);

          let amount = Number(pending_transfer.amount);

          console.log(`${amount} ${preferred_crypto.ticker} deposit pending 
                    (${pending_transfer.confirmations}/${confirmations})`);

          if (amount > 0) {
            this_self.updateHeaderMessage(
              `${amount} ${preferred_crypto.ticker} deposit pending 
                        (${pending_transfer.confirmations}/${confirmations})`,
              true,
              function () {
                this_self.app.connection.emit('saito-crypto-history-render-request', {});
              }
            );

            this_self.deposit_pending = true;

            if (this_self.show_msg) {
              siteMessage(`New ${preferred_crypto.ticker} deposit`, 3000);
              this_self.show_msg = false;
            }
          } else {
            this_self.show_msg = true;
          }
        } else {
          if (this_self?.deposit_pending) {
            this_self.deposit_pending = false;
          }

          if (this_self.can_update_header_msg) {
            this_self.show_msg = true;
          }
        }
      });

      intervalTime *= 2;
      this.deposit_check_interval = setTimeout(checkDeposits, intervalTime);
    };

    console.log(`Started checking ${preferred_crypto.ticker} deposit`);
    checkDeposits();
  }
}

module.exports = SaitoHeader;
