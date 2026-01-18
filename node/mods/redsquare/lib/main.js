const SaitoLoader = require('./../../../lib/saito/ui/saito-loader/saito-loader');


class RedSquareMain {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.name = 'RedSquareMain';
    this.mode = 'welcome';

    this.components = {};

    this.scroll_depth = 0;

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