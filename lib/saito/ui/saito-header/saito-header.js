const ModTemplate = require('./../../../templates/modtemplate');
const SaitoHeaderTemplate = require('./saito-header.template');
const FloatingMenu = require('./saito-floating-menu.template');
const SaitoLoader = require('./../saito-loader/saito-loader');
const UserMenu = require('./../modals/user-menu/user-menu');
const SaitoBackup = require('./../modals/saito-backup/saito-backup');


class SaitoHeader extends ModTemplate {
  constructor(app, mod) {
    super(app);

    this.browser_active = 1;

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
    if (!app.modules.uimods.includes(this)) {
      app.modules.uimods.push(this);
    }
    await super.initialize(app);

    this.userMenu = new UserMenu(app, this.publicKey);

    app.connection.on('registry-update-identifier', (publicKey) => {
      if (publicKey === this.publicKey) {
        this.renderUsername();
      }
    });

    app.connection.on('block-fetch-status', (count) => {});

    app.connection.on('saito-header-change-location', (new_path) => {
      this.header_location = new_path;
    });

    app.connection.on('saito-header-render', () => {
      this.render();
    });

    app.connection.on('saito-header-notification', (source_mod, unread) => {
      this.notifications[source_mod] = unread;

      let total = 0;
      for (let m in this.notifications) {
        total += this.notifications[m];
      }

      this.app.browser.addNotificationToId(total, 'saito-header-menu-toggle');
    });
  }

  async render() {
    if (this.mod == null || !document) {
      return;
    }

    if (!document.getElementById('saito-header')) {
      this.app.browser.prependElementToDom(SaitoHeaderTemplate(this.header_class));
    } else {
      this.app.browser.replaceElementById(SaitoHeaderTemplate(this.header_class), 'saito-header');
    }

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

    let menu_sort = (a, b) => {
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
  }

  attachEvents() {
    let app = this.app;
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

    if (document.getElementById('wallet-btn-settings')) {
      document.getElementById('wallet-btn-settings').onclick = (e) => {
        app.connection.emit('settings-overlay-render-request');
        this.hideMenu();
      };
    }

    if (document.querySelector('.pubkey-mobile-wrapper')) {
      document.querySelector('.pubkey-mobile-wrapper').onclick = () => {};
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
    if (document.querySelector('.saito-header-hamburger-contents').classList.contains('show-menu')) {
      document.querySelector('.saito-header-hamburger-contents').classList.remove('show-menu');
      document.querySelector('.saito-header-backdrop').classList.remove('menu-visible');
    } else {
      document.querySelector('.saito-header-hamburger-contents').classList.add('show-menu');
      document.querySelector('.saito-header-backdrop').classList.add('menu-visible');
    }
  }

  hideMenu() {
    if (document.querySelector('.saito-header-hamburger-contents').classList.contains('show-menu')) {
      document.querySelector('.saito-header-hamburger-contents').classList.remove('show-menu');
      document.querySelector('.saito-header-backdrop').classList.remove('menu-visible');
    }
  }

  renderUsername() {
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


    if (this.app.options.wallet?.backup_required) {
      setTimeout(() => {
        if (this.app.options.wallet?.backup_required) {
          if (this.app.options.wallet.backup_required == 1) {
            this.app.options.wallet.backup_required = "Have you backed up your wallet recently? Keep your keys and account safe by backing up";
          }
          this.updateHeaderMessage('wallet backup required', true, () => {
            this.app.connection.emit('saito-backup-render-request', {msg: this.app.options.wallet.backup_required, title: 'BACKUP YOUR WALLET'});
          });
        }
      }, 4500);
    }
  }
}

module.exports = SaitoHeader;