const RedSquareMenuTemplate = require('./menu.template');
const jsonTree = require('json-tree-viewer');
const SaitoOverlay = require('./../../../lib/saito/ui/saito-overlay/saito-overlay');
const RedSquareSettings = require('./settings');


class RedSquareMenu {
  constructor(app, mod, container = '') {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(app, mod);
    this.container = container;
    this.settings = new RedSquareSettings(app, mod, '.module-settings-overlay');

    app.connection.on('redsquare-clear-menu-highlighting', (active_tab = '') => {
      document.querySelectorAll('.redsquare-page-active').forEach((el) => {
        el.classList.remove('redsquare-page-active');
      });

      if (active_tab == 'profile') {
        if (document.querySelector('.redsquare-menu-profile')) {
          document.querySelector('.redsquare-menu-profile').classList.add('redsquare-page-active');
        }
      }
    });
  }

  render() {
    if (document.querySelector('.redsquare-menu')) {
      this.app.browser.replaceElementBySelector(RedSquareMenuTemplate(this.app, this.mod), '.redsquare-menu');
    } else {
      this.app.browser.addElementToSelector(RedSquareMenuTemplate(this.app, this.mod), this.container);
    }

    this.app.modules.returnModulesRespondingTo('saito-chat-popup').forEach((mod) => {
      let id = `redsquare-menu-${mod.returnSlug()}`;
      const rs = mod.respondTo('saito-chat-popup')[0];
      this.app.browser.addElementToSelector(
        `<li class="redsquare-menu-mobile item" id="${id}">
            <i class="${rs.icon}"></i>
            <span>${mod.returnName()}</span>
          </li>`,
        '.redsquare-menu'
      );

      if (rs.event) {
        rs.event(id);
      }

      if (document.getElementById(id)) {
        document.getElementById(id).onclick = () => {
          if (rs.callback) {
            rs.callback(this.app, id);
          }
        };
      }
    });

    this.attachEvents();
  }

  attachEvents() {
    document.querySelector('.redsquare-menu-home').onclick = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      console.info('RS.NAV: clicked home ...');

      if (window.location.hash || window.location.search) {
        this.app.connection.emit('redsquare-home-render-request');
      } else {
        this.app.connection.emit('redsquare-home-render-request', true);
      }
    };

    document.querySelector('.redsquare-menu-profile').onclick = (e) => {
      this.openProfile(this.mod.publicKey);
    };

    if (document.querySelector('.redsquare-menu-settings')) {
      document.querySelector('.redsquare-menu-settings').onclick = (e) => {
        let overlay = new SaitoOverlay(this.app, this.mod);
        overlay.show(`<div class="module-settings-overlay"><h2>Redsquare Settings</h2></div>`);
        this.settings.render();
      };
    }

    if (document.querySelector('.redsquare-menu-help')) {
      document.querySelector('.redsquare-menu-help').onclick = (e) => {
        this.overlay.show(`<div class="debug_overlay"></div>`);

        let el = document.querySelector('.debug_overlay');

        if (!this.mod.styles.includes('/saito/lib/jsonTree/jsonTree.css')) {
          this.mod.styles.push('/saito/lib/jsonTree/jsonTree.css');
          this.mod.attachStyleSheets();
        }

        try {
          let optjson = JSON.parse(
            JSON.stringify(this.mod, (key, value) => {
              if (key == 'app') return 'app';
              if (key == 'mod') return 'mod';
              return typeof value === 'bigint' ? value.toString() : value;
            })
          );
          jsonTree.create(optjson, el);
        } catch (err) {
          console.error('error creating jsonTree: ' + err);
          console.debug(this.mod);
        }
      };
    }
  }

  openProfile(publicKey) {
    this.app.connection.emit('redsquare-profile-render-request', publicKey);
  }
}

module.exports = RedSquareMenu;