const Tweet = require('./tweet');
const Post = require('./post');
const Notification = require('./notification');
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

    this.profile_tweets = {};
    this.profile = new SaitoProfile(app, mod, '.saito-main');
    this.profile.tab_container = '.tweet-container';
    this.profile_tabs = ['posts', 'replies', 'likes'];
    this.profile.reset(this.mod.publicKey, 'posts', this.profile_tabs);

    this.loader = new SaitoLoader(app, mod, '#redsquare-intersection');

    app.connection.on('redsquare-render-new-post', (tweettx, rparent = null) => {
      if (!this.mode.includes('tweet')) {
        return;
      }

      let posted_tweet = new Tweet(this.app, this.mod, tweettx, '.tweet-container');

      if (rparent) {
        if (posted_tweet.retweet_tx) {
          rparent.render();
          this.mod.addTweet(tweettx, { type: 'retweet', node: 'user post' });
          posted_tweet.render(true);
        } else {
          this.mod.addTweet(tweettx, { type: 'reply', node: 'user post' });
          if (rparent.parent_id != '') {
            let t = this.mod.returnTweet(rparent.parent_id);
            if (t) {
              t.critical_child = posted_tweet;
            }
          }

          rparent.critical_child = posted_tweet;
          rparent.forceRenderWithCriticalChild();
        }
      } else {
        this.mod.addTweet(tweettx, { type: 'new tweet', node: 'user post' });
        posted_tweet.render(true);
      }
    });

    app.connection.on('redsquare-home-render-request', (scroll_to_top = false) => {
      console.debug('RS.redsquare-home-render-request', scroll_to_top);

      let behavior = scroll_to_top ? 'smooth' : 'auto';

      if (scroll_to_top) {
        this.scroll_depth = 0;
        window.history.replaceState({}, null, '/' + this.mod.slug);
      } else {
        window.history.pushState({}, null, '/' + this.mod.slug);
      }

      if (this.mod.out_of_order) {
        console.info('RS.home-render-request have new tweets the fold into feed, rerender!');
        this.clearFeed();
      }
      this.render();
    });

    app.connection.on('redsquare-home-postcache-render-request', (num_tweets = 0) => {
      if (num_tweets > 0 && this.mode === 'tweets') {
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
          this.hideLoader();

          if (!document.getElementById('saito-load-new-tweets')) {
            this.app.browser.prependElementToSelector(
              `<div class="saito-button-secondary saito-load-new-tweets" id="saito-load-new-tweets">load new tweets</div>`,
              '.redsquare-load-new-tweets-container'
            );
          }
          document.getElementById('saito-load-new-tweets').onclick = (e) => {
            this.scrollFeed(0, 'smooth');
            e.currentTarget.remove();
            this.clearFeed();
            this.render();
            this.mod.out_of_order = false;
          };
        } else {
          this.render();
        }
        this.mod.tweets_earliest_ts--;
      }
    });

    app.connection.on('redsquare-tweet-render-request', (tweet) => {
      if (this.mode == 'tweet') {
        window.history.replaceState(
          {
            view: 'tweet',
            tweet: tweet.thread_id
          },
          null,
          '/' + this.mod.slug + `/?tweet_id=${tweet.tx.signature}`
        );
      } else {
        window.history.pushState(
          {
            view: 'tweet',
            tweet: tweet.thread_id
          },
          null,
          '/' + this.mod.slug + `/?tweet_id=${tweet.tx.signature}`
        );
      }

      this.render();
    });

    app.connection.on('redsquare-notifications-render-request', () => {
      window.history.pushState(
        {
          view: 'notifications',
          last_view: this.notifications_last_viewed_ts,
          unviewed_ct: this.mod.notifications_number_unviewed
        },
        null,
        '/' + this.mod.slug + '#notifications'
      );

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

    app.connection.on('saito-blacklist', (obj) => {
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
      {
        root: null,
        threshold: 1
      }
    );

    window.onpopstate = (event) => {
      if (this.mod.debug) {
        console.info(
          '===================',
          'RS.NAV[onpopstate]: ',
          event?.state,
          window.location,
          '========================'
        );
      }

      this.render(event.state);
    };
  }

  clearFeed() {
    document.getElementById('intersection-observer-trigger').classList.add('deactivated');
    this.intersectionObserver.disconnect();
    let holder = document.getElementById('tweet-thread-holder');
    let managerElem = document.querySelector('.tweet-container');
    if (holder) {
      while (holder.hasChildNodes()) {
        holder.firstChild.remove();
      }
    }
    if (managerElem) {
      while (managerElem.hasChildNodes()) {
        managerElem.firstChild.remove();
      }
    }
  }

  render() {}

  moreNotifications() {
    this.showLoader();

    this.mod.loadNotifications((new_txs) => {
      if (this.mode !== 'notifications') {
        return;
      }

      for (let i = 0; i < new_txs.length; i++) {
        let notification = new Notification(this.app, this.mod, new_txs[i]);
        notification.render('.tweet-container');
      }

      if (new_txs.length == 0) {
        if (this.mod.notifications.length == 0) {
          let notification = new Notification(this.app, this.mod, null);
          notification.render('.tweet-container');
        }

        setTimeout(() => {
          this.hideLoader();
        }, 50);
      } else {
        this.enableObserver();
      }
    });
  }

  insertOlderTweets(tx_count, peer = null) {
    console.debug(
      'Infinite Scroll callback: ',
      peer.publicKey.substring(0, 10),
      tx_count,
      this.numActivePeers,
      this.mod.tweets_earliest_ts
    );

    if (this.mode !== 'tweets') {
      return;
    }

    for (let tweet of this.mod.tweets) {
      if (!tweet.isRendered()) {
        tweet.renderWithCriticalChild();
      }
    }

    this.numActivePeers--;
    if (this.numActivePeers <= 0) {
      console.debug('RS.insertOlderTweets -- all active peers returned: ', tx_count);
      this.enableObserver();
    } else {
      console.debug('RS.insertOlderTweets -- still waiting on a peer to return');
    }
  }

  async loadProfile() {
    const profile_id = this.profile.publicKey;

    if (this.mod.publicKey == profile_id) {
      console.debug('RS.Profile -- use list of liked tweets');
      this.loadProfileLikes(this.mod.liked_tweets, 'localhost');
    }

    let np = this.mod.peers.length;
    if (np > 1) {
      siteMessage(`Checking with ${np} peers for profile tweets...`, 1000);
    } else {
      this.showLoader();
    }

    for (let peer of this.mod.peers) {
      if (this.mod.publicKey !== profile_id && peer.peer !== 'localhost') {
        console.debug('RS.Profile -- query peer for likes ', peer.publicKey.substring(0, 10));
        this.app.storage.loadTransactions(
          { field1: 'RedSquareLike', field2: profile_id, limit: 100 },
          (txs) => {
            let liked_tweets = [];
            for (tx of txs) {
              let txmsg = tx.returnMessage();

              let sig = txmsg?.data?.signature;
              if (sig && !liked_tweets.includes(sig)) {
                liked_tweets.push(sig);
              }
            }

            this.loadProfileLikes(liked_tweets, peer);
          },
          peer
        );
      }

      console.debug('RS.Profile -- query peer for tweets: ', peer.publicKey.substring(0, 10));
      this.app.storage.loadTransactions(
        {
          field1: 'RedSquare',
          field2: profile_id,
          limit: 100,
          created_earlier_than: peer.profile_ts
        },
        (txs) => {
          this.hideLoader();

          this.filterProfileTweets(txs, profile_id);

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

  loadProfileLikes(list_of_liked_tweet_sigs, peer) {
    if (this.mode !== 'profile') {
      return;
    }

    for (let sig of list_of_liked_tweet_sigs) {
      let old_tweet = this.mod.returnTweet(sig);
      if (old_tweet) {
        this.insertTweetIntoList(old_tweet, this.profile.menu.likes);
        this.app.connection.emit('update-profile-stats', 'likes', list_of_liked_tweet_sigs.length);
      } else {
        console.log('RS.Profile -- pull liked tweet from archive...');
        this.app.storage.loadTransactions(
          { field1: 'RedSquare', sig },
          (txs) => {
            for (let z = 0; z < txs.length; z++) {
              let tweet = new Tweet(this.app, this.mod, txs[z]);
              this.insertTweetIntoList(tweet, this.profile.menu.likes);
            }
            this.app.connection.emit(
              'update-profile-stats',
              'likes',
              list_of_liked_tweet_sigs.length
            );
          },
          peer
        );
      }
    }
  }

  insertTweetIntoList(tweet, list) {
    let insertion_index = 0;

    for (let i = 0; i < list.length; i++) {
      if (list[i].tx.signature === tweet.tx.signature) {
        return;
      }

      if (tweet.created_at > list[i].created_at) {
        break;
      } else {
        insertion_index++;
      }
    }
    list.splice(insertion_index, 0, tweet);
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
    if (this.mode === 'tweet' || this.mode == 'loading') {
      return;
    }

    console.debug('RS.IntersectionObserver triggered! ', this.mode);

    if (this.mode === 'tweets') {
      this.showLoader(`${this.mod.tweets.length} tweets in the feed, loading more...`);

      this.numActivePeers = this.mod.loadTweets('earlier', this.insertOlderTweets.bind(this));
      if (!this.numActivePeers) {
        console.log('RS.handleIntersection -- smack box on the side');
        this.mod.tweets_earliest_ts--;
        this.numActivePeers = this.mod.loadTweets('earlier', this.insertOlderTweets.bind(this));
        if (!this.numActivePeers) {
          console.debug(
            'RS.insertOlderTweets: END of REDSQUARE !!!!',
            this.mod.tweets_earliest_ts,
            this.mod.peers
          );
          this.hideLoader();
          if (!document.querySelector('.saito-end-of-redsquare')) {
            this.app.browser.addElementAfterSelector(
              `<div class="saito-end-of-redsquare">no more tweets</div>`,
              '.tweet-container'
            );
          }
        }
      }

      return;
    }

    this.showLoader();

    if (this.mode === 'notifications') {
      this.moreNotifications();
    }

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