const SaitoProfile = require('./../../../lib/saito/ui/saito-profile/saito-profile');
const SaitoLoader = require('./../../../lib/saito/ui/saito-loader/saito-loader');


class RedSquareMain {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.name = 'RedSquareMain';
    this.mode = 'welcome';

    this.components = {};

    this.scroll_depth = 0;

    this.profile = new SaitoProfile(app, mod, '.saito-main');
    this.profile.reset(this.mod.publicKey, 'posts', this.profile_tabs);

    this.loader = new SaitoLoader(app, mod, '#redsquare-intersection');

    app.connection.on('redsquare-home-render-request', (scroll_to_top = false) => {
      console.debug('RS.redsquare-home-render-request', scroll_to_top);

      if (scroll_to_top) {
        this.scroll_depth = 0;
        window.history.replaceState({}, null, '/' + this.mod.slug);
      } else {
        window.history.pushState({}, null, '/' + this.mod.slug);
      }

      this.render();
    });

    app.connection.on('redsquare-profile-render-request', (publicKey = '') => {
      if (!publicKey) {
        publicKey = this.mod.publicKey;
      }

      let target = publicKey == this.mod.publicKey ? '#profile' : `/?user_id=${publicKey}`;
      window.history.pushState({ view: 'profile', publicKey }, '', '/' + this.mod.slug + target);

      this.render();
    });

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            document.getElementById('intersection-observer-trigger').classList.add('deactivated');
            this.intersectionObserver.disconnect();
            this.handleIntersection();
          }
        });
      },
      {root: null, threshold: 1}
    );

    window.onpopstate = (event) => {
      if (this.mod.debug) {
        console.info('===================', 'RS.NAV[onpopstate]: ', event?.state, window.location, '========================');
      }
    };
  }

  render() {}

  async loadProfile() {
    const profile_id = this.profile.publicKey;

    let np = this.mod.peers.length;
    if (np > 1) {} else {
      this.showLoader();
    }

    for (let peer of this.mod.peers) {
      this.app.storage.loadTransactions(
        {field1: 'RedSquare', field2: profile_id, limit: 100, created_earlier_than: peer.profile_ts},
        (txs) => {
          this.hideLoader();

          for (let z = 0; z < txs.length; z++) {
            txs[z].decryptMessage(this.app);
            peer.profile_ts = txs[z]?.timestamp;
          }

          if (this.mode !== 'profile' || profile_id !== this.profile.publicKey) {
            console.warn(
              `Navigated away from profile before peer (${peer?.publicKey}) returned results...`
            );
            return;
          }

          console.debug(
            `RS.Profile -- rendering profile with results (${txs.length}) from peer (${peer.publicKey.substring(0, 10)})`
          );
          this.profile.render();

          if (txs.length == 100) {
            this.enableObserver();
          }

          if (peer.peer !== 'localhost') {
            siteMessage(
              `Processing response from ${this.app.keychain.returnUsername(peer.publicKey)}`,
              1000
            );
          }
          np--;
          setTimeout(() => {
            if (np > 0) {
              siteMessage(`Loading from ${np} peers...`, 1000);
            }
          }, 1500);
        },
        peer.peer
      );
    }
  }

  attachEvents() {
    this.events_attached = true;
  }

  enableObserver() {
    this.hideLoader();

    let ob = document.getElementById('intersection-observer-trigger');

    if (ob) {
      if (ob.classList.contains('deactivated')) {
        ob.classList.remove('deactivated');

        if (ob.getBoundingClientRect().top <= 0) {
          this.handleIntersection();
        } else {
          this.intersectionObserver.observe(ob);
        }
      }
    }
  }

  handleIntersection() {
    if (this.mode == 'loading') {
      return;
    }

    console.debug('RS.IntersectionObserver triggered! ', this.mode);

    this.showLoader();

    if (this.mode === 'profile') {
      this.loadProfile();
    }
  }
  showLoader(msg = '') {
    this.loader.show(msg);
  }

  hideLoader() {
    this.loader.remove(0);
  }
}

module.exports = RedSquareMain;