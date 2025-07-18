const RedSquareMainTemplate = require('./main.template');
const TweetManager = require('./manager');
const SaitoOverlay = require('./../../../lib/saito/ui/saito-overlay/saito-overlay');
const SaitoProgress = require('./../../../lib/saito/ui/saito-progress-bar/saito-progress-bar');

//
// RedSquare Main
//
// This component listens for the main events that control RedSquare and re-renders the
// subcomponents, particularly the main component. the mode in which it renders is
//
//
class RedSquareMain {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.name = 'RedSquareMain';
    this.mode = 'welcome';

    this.components = {};

    this.scroll_depth = 0;

    this.manager = new TweetManager(app, mod, '.saito-main');
    this.loader = new SaitoProgress(app, mod, '.redsquare-load-new-tweets-container');

    ///////////////////
    // RENDER EVENTS //
    ///////////////////
    //
    // lib/main.js:    this.app.connection.on("redsquare-home-render-request", () => {          // renders main tweets
    // lib/main.js:    this.app.connection.on("redsquare-home-postcache-render-request", () => {        // pushes new content into feed if possible
    // lib/main.js:    this.app.connection.on("redsquare-tweet-render-request", (tweet) => {      // renders tweet onto page, at bottom
    // lib/main.js:    this.app.connection.on("redsquare-profile-render-request", () => {         // renders profile
    // lib/main.js:    this.app.connection.on("redsquare-notifications-render-request", () => {     // renders notifications
    //
    this.app.connection.on('redsquare-home-render-request', (scroll_to_top = false) => {
      console.debug('redsquare-home-render-request', scroll_to_top);

      if (scroll_to_top) {
        this.scroll_depth = 0;
        window.history.replaceState({}, null, '/' + this.mod.slug);
        this.renderTweets('smooth');
      } else {
        window.history.pushState({}, null, '/' + this.mod.slug);
        this.renderTweets();
      }
    });

    //
    // render main (subsequent loads)
    //
    this.app.connection.on('redsquare-home-postcache-render-request', (num_tweets = 0) => {
      if (num_tweets > 0 && this.manager.mode === 'tweets') {
        let are_there_new_tweets_to_show = false;
        for (let i = 0; i < this.mod.tweets.length && i < 10; i++) {
          if (!this.mod.tweets[i].isRendered()) {
            if (!this.mod.curated || this.mod.tweets[i].curated) {
              are_there_new_tweets_to_show = true;
            }
          }
        }

        if (!are_there_new_tweets_to_show) {
          return;
        }

        if (this.mod.out_of_order) {
          setTimeout(() => {
            if (!document.getElementById('saito-load-new-tweets')) {
              this.app.browser.prependElementToSelector(
                `<div class="saito-button-secondary saito-load-new-tweets" id="saito-load-new-tweets">load new tweets</div>`,
                '.redsquare-load-new-tweets-container'
              );
            }
            document.getElementById('saito-load-new-tweets').onclick = (e) => {
              this.scrollFeed(0);
              e.currentTarget.remove();
              this.manager.clearFeed();
              this.manager.render('tweets');
              this.mod.out_of_order = false;
            };
          }, 500);
        } else {
          this.manager.render('tweets');
        }
      }
      this.mod.tweets_earliest_ts--;
    });

    //
    // tweet
    //
    this.app.connection.on('redsquare-tweet-render-request', (tweet) => {
      this.scrollFeed(0);
      window.history.pushState(
        {
          view: 'tweet',
          tweet: tweet.thread_id
        },
        null,
        '/' + this.mod.slug + `/?tweet_id=${tweet.tx.signature}`
      );

      this.app.connection.emit('saito-header-replace-logo', () => {
        window.history.back();
      });
      this.manager.render('tweet', tweet);
    });

    //
    // notifications
    //
    this.app.connection.on('redsquare-notifications-render-request', () => {
      this.scrollFeed(0);
      window.history.pushState(
        {
          view: 'notifications',
          last_view: this.notifications_last_viewed_ts,
          unviewed_ct: this.mod.notifications_number_unviewed
        },
        null,
        '/' + this.mod.slug + '#notifications'
      );
      this.app.connection.emit('saito-header-replace-logo', () => {
        window.history.back();
      });
      this.mod.resetNotifications();
      this.manager.render('notifications');
    });

    //
    // profile
    //
    this.app.connection.on('redsquare-profile-render-request', (publicKey = '') => {
      this.scrollFeed(0);

      if (!publicKey) {
        publicKey = this.mod.publicKey;
      }

      let target = publicKey == this.mod.publicKey ? '#profile' : `/?user_id=${publicKey}`;
      window.history.pushState({ view: 'profile', publicKey }, '', '/' + this.mod.slug + target);

      this.app.connection.emit('saito-header-replace-logo', () => {
        window.history.back();
      });

      this.manager.render('profile', publicKey);
    });

    //
    // blacklist
    //
    this.app.connection.on('saito-blacklist', (obj) => {
      let target_key = obj?.publicKey;
      if (!target_key) {
        return;
      }
      for (let tweet of this.mod.tweets) {
        if (tweet.tx.isFrom(target_key)) {
          tweet.hideTweet();
        }
      }
    });

    //
    // ???
    //
    window.onpopstate = (event) => {
      this.render(event.state);
    };
  }

  render() {
    if (!document.querySelector('.saito-container')) {
      this.app.browser.addElementToDom(RedSquareMainTemplate(this.mod));
    }
    this.renderTweets();
    this.attachEvents();
  }

  renderTweets(behavior = 'auto') {
    this.manager.render('tweets');
    this.scrollFeed(this.scroll_depth, behavior);
    this.app.connection.emit('saito-header-reset-logo');
    this.mod.out_of_order = false;
  }

  attachEvents() {
    //
    // Disable slide out header because the scroll element changed with revamp!
    //
    if (this.events_attached) {
      return;
    }

    /* Scroll the right side bar code (originally in ./sidebar.js) */
    var scrollableElement = document.querySelector('.saito-container');
    var sidebar = document.querySelector('.saito-sidebar.right');
    var scrollTop = 0;
    var stop = 0;

    scrollableElement.addEventListener('scroll', (e) => {
      let newScrollTop = scrollableElement.scrollTop;
      let maxScroll = sidebar.clientHeight - window.innerHeight + 70;

      if (maxScroll > 0) {
        if (scrollTop < newScrollTop) {
          if (newScrollTop - stop > maxScroll) {
            stop = window.innerHeight - 70 - sidebar.clientHeight + newScrollTop;
          }
        } else {
          if (stop > newScrollTop) {
            stop = newScrollTop;
          }
        }
      } else {
        //Keep top of side bar fixed relative to viewPort
        stop = newScrollTop;
      }

      sidebar.style.top = stop + 'px';
      scrollTop = newScrollTop;
    });

    /* Code for the slide-out header */
    /*
    var scrollableElement = document.querySelector('.saito-container');

    let lastScrollTop = 0;
    let triggered = false;
    let is_running = false;

    if (this.app.browser.isSupportedBrowser()) {
      let hh = getComputedStyle(document.body).getPropertyValue('--saito-header-height');

      scrollableElement.addEventListener('scroll', (e) => {
        var st = scrollableElement.scrollTop;

        if (is_running) {
          return;
        }

        is_running = true;

        if (st > lastScrollTop) {
          if (!triggered) {
            document.getElementById('saito-header').style.top = `-${hh}`;
            document.getElementById('saito-header').style.height = '0';
            document.getElementById('saito-header').style.padding = '0';
            document.querySelector('.saito-container').classList.add('scrolling');
            document.querySelector('.saito-sidebar.left').classList.add('scrolling');
            triggered = true;
          }

          is_running = 'down';
        } else if (st < lastScrollTop) {
          if (triggered) {
            document.getElementById('saito-header').removeAttribute('style');
            document.querySelector('.saito-container').classList.remove('scrolling');
            document.querySelector('.saito-sidebar.left').classList.remove('scrolling');
            triggered = false;
          }
        }

        lastScrollTop = st <= 0 ? 0 : st; // For Mobile or negative scrolling

        if (this.manager.mode == 'tweets') {
          this.scroll_depth = scrollableElement.scrollTop;
        }

        setTimeout(() => {
          is_running = false;
          if (scrollableElement.scrollTop < 50 && triggered) {
            document.getElementById('saito-header').removeAttribute('style');
            document.querySelector('.saito-container').classList.remove('scrolling');
            document.querySelector('.saito-sidebar.left').classList.remove('scrolling');
            triggered = false;
          }
        }, 75);
      });
    }*/

    this.events_attached = true;
  }

  scrollFeed(newDepth = this.scroll_depth, behavior = 'auto') {
    const elem = document.querySelector('.saito-main');
    if (this.manager.mode === 'tweets') {
      this.scroll_depth = elem.scrollTop;
    }
    elem.scroll({ top: newDepth, left: 0, behavior });
  }
}

module.exports = RedSquareMain;
