const ModTemplate = require('../../lib/templates/modtemplate');
const SaitoHeader = require('../../lib/saito/ui/saito-header/saito-header');
const SaitoMain = require('./lib/main');
const TweetMenu = require('./lib/tweet-menu');
const Tweet = require('./lib/tweet');
const redsquareHome = require('./index');
const Post = require('./lib/post');
const Transaction = require('../../lib/saito/transaction').default;
const SaitoOverlay = require('./../../lib/saito/ui/saito-overlay/saito-overlay');
const SaitoPost = require('./../../lib/saito/ui/saito-post/saito-post');
const AppSettings = require('./lib/settings');


class RedSquare extends ModTemplate {
  constructor(app) {
    super(app);

    this.appname = 'Red Square';
    this.name = 'RedSquare';
    this.slug = 'redsquare';
    this.description = 'Open Source Twitter-clone for the Saito Network';
    this.categories = 'Social Entertainment';
    this.icon_fa = 'fas fa-square-full';

    this.debug = false;

    this.tweets = [];
    this.cached_tweets = [];
    this.last_cache = 0;

    this.tweets_sigs_hmap = {};
    this.special_threads_hmap = {};
    this.unknown_children = [];
    this.orphan_edits = [];

    this.blogs = [];

    this.peers = [];
    this.keylist = {};

    this.tweet_count = 0;
    this.liked_tweets = [];
    this.retweeted_tweets = [];
    this.replied_tweets = [];
    this.hidden_tweets = [];

    this.notifications = [];
    this.notifications_sigs_hmap = {};

    this.jedi_council = new Map();

    this.curated = !this.debug;

    this.possibleHome = 1;

    this.use_floating_plus = 1;

    this.notifications_earliest_tweet_ts = new Date().getTime();
    this.notifications_earliest_like_ts = new Date().getTime();
    this.notifications_last_viewed_ts = 0;
    this.notifications_number_unviewed = 0;

    this.tweets_earliest_ts = new Date().getTime();

    this.allowed_upload_types = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];

    this.styles = ['/redsquare/style.css'];
    this.postScripts = [];

    this.enable_profile_edits = true;

    this.social = {
      twitter: '@SaitoOfficial',
      title: '🟥 Saito RedSquare - Web3 Social Media',
      url: 'https://saito.io/redsquare/',
      description: 'Peer to peer Web3 social media platform',
      image: 'https://saito.tech/wp-content/uploads/2022/04/saito_card.png'
    };

    this.app.connection.on('saito-render-complete', () => {
      this.app.connection.emit(
        'redsquare-update-notifications',
        this.notifications_number_unviewed
      );
    });

    this.app.connection.on('redsquare-new-post', (msg) => {
      let post = new Post(this.app, this);
      post.render();
    });

    this.app.connection.on('redsquare-post-tweet', (data, keys) => {
      this.sendTweetTransaction(this.app, this, data, keys);
    });

    this.app.connection.on('redsquare-home-render-request', () => {
      if (this.browser_active && this.orphan_edits.length > 0) {
        let orphans = this.orphan_edits;
        this.orphan_edits = [];
        for (let i = 0; i < orphans.length; i++) {
          this.editTweet(orphans[i].tweet_id, orphans[i].tx, orphans[i].source);
        }
        console.debug(
          `RS.home-render-request ${orphans.length - this.orphan_edits.length} orphaned edits processed!`
        );
      }
    });

    return this;
  }

  returnServices() {
    let services = [];
    if (!this.app.BROWSER || this.offerService) {
      services.push(
        this.app.network.createPeerService(null, 'redsquare', 'RedSquare Tweet Archive')
      );
    }
    return services;
  }

  respondTo(type = '', obj) {
    let this_mod = this;

    if (type === 'user-menu') {
      return {
        text: `${
          obj?.publicKey && obj.publicKey === this.publicKey ? 'My' : 'View'
        } RedSquare Profile`,
        icon: 'fa fa-user',
        callback: function (app, publicKey) {
          navigateWindow(`/redsquare/?user_id=${publicKey}`);
        }
      };
    }

    if (type === 'saito-header') {
      let x = [];
      if (!this.browser_active) {
        x.push({
          text: 'RedSquare',
          icon: 'fa-solid fa-square',
          rank: 20,
          type: 'navigation',
          callback: function (app, id) {
            navigateWindow('/redsquare');
          },
          event: function (id) {
            this_mod.app.connection.on('redsquare-update-notifications', (unread) => {
              this_mod.app.browser.addNotificationToId(unread, id);
              this_mod.app.connection.emit('saito-header-notification', 'redsquare', unread);
            });
          }
        });
      } else {
        if (this.app.browser.isMobileBrowser() || window.innerWidth < 600) {
          x.push({
            text: 'RedSquare Home',
            icon: 'fa-solid fa-house',
            rank: 21,
            type: 'appspace',
            callback: function (app, id) {
              document.querySelector('.redsquare-menu-home').click();
            }
          });
          x.push({
            text: 'Notifications',
            icon: 'fas fa-bell',
            rank: 23,
            type: 'appspace',
            callback: function (app, id) {
              document.querySelector('.redsquare-menu-notifications').click();
            },
            event: function (id) {
              this_mod.app.connection.on('redsquare-update-notifications', (unread) => {
                this_mod.app.browser.addNotificationToId(unread, id);
                this_mod.app.connection.emit('saito-header-notification', 'redsquare', unread);
              });
            }
          });
          x.push({
            text: 'Profile',
            icon: 'fas fa-user',
            rank: 26,
            type: 'appspace',
            callback: function (app, id) {
              document.querySelector('.redsquare-menu-profile').click();
            }
          });
        }
      }

      return x;
    }

    if (type === 'saito-floating-menu') {
      let x = [];
      x.push({
        text: 'Tweet',
        icon: 'fa-solid fa-pen',
        is_active: this.browser_active,
        disallowed_mods: ['arcade'],
        rank: 10,
        callback: function (app, id) {
          let post = new Post(app, this_mod);
          post.render();
        }
      });

      x.push({
        text: 'Tweet Image',
        icon: 'fas fa-image',
        is_active: this.browser_active,
        disallowed_mods: ['arcade'],
        rank: 20,
        callback: function (app, id) {
          let post = new Post(app, this_mod);
          post.render();
          post.triggerClick('#hidden_file_element_tweet-overlay');
        }
      });
      return x;
    }

    if (type === 'post-content') {
      return {
        icon: this_mod.icon_fa,
        text: 'Continue with post to RedSquare',
        callback: async (content, image) => {
          this_mod.app.connection.emit('continue-with-redsquare');
        }
      };
    }

    if (type === 'saito-moderation-app') {
      return {
        filter_func: (mod = null, tx = null) => {
          if (tx == null || mod == null || !tx?.from) {
            return 0;
          }

          if (mod.name !== this.name) {
            return 0;
          }

          if (this.hidden_tweets.includes(tx.signature)) {
            console.log('HIDDEN TWEET!!!!!');
            return -1;
          }

          return 0;
        }
      };
    }

    return null;
  }

  async initialize(app) {
    await super.initialize(app);

    if (this.app.BROWSER && !this.browser_active) {
      this.debug = false;
    }

    this.publicKey = await app.wallet.getPublicKey();

    this.loadOptions();

    if (!app.BROWSER) {
      let pr = this.addPeer('localhost', 100);

      this.loadTweets(
        'later',
        (tx_count) => {
          for (let tweet of this.tweets) {
            if (tweet.curated == 1) {
              this.addToCouncil(tweet.tx.from[0].publicKey);
            }
          }

          this.cacheRecentTweets();
          console.debug(`RS -- Preloaded ${tx_count} transactions ~~ ${this.tweets.length} tweets`);
        },
        pr
      );

      let archive_mod = this.app.modules.returnModule('Archive');
      if (archive_mod) {
        archive_mod.loadTransactionsWithCallback({ field1: 'Blog', limit: 50 }, (res) => {
          for (let i = 0; i < res.length; i++) {
            this.blogs.push({
              ts: res[i].updated_at,
              publicKey: res[i].field2,
              tx_id: res[i].sig
            });
          }

          this.addBlogPseudoTweets();
        });
      }

      return;
    }

    this.addPeer('localhost');

    try {
      let user_id = this.app.browser.returnURLParameter('user_id');
      let tweet_id = this.app.browser.returnURLParameter('tweet_id');
      if (!tweet_id || !user_id) {
        let pending = await app.wallet.getPendingTransactions();
        for (let i = 0; i < pending.length; i++) {
          let tx = pending[i];
          let txmsg = tx.returnMessage();
          if (txmsg && txmsg.module == this.name) {
            if (txmsg.request === 'create tweet') {
              this.addTweet(tx, { type: 'pending_tx', node: 'wallet' });
            }
          }
        }
      }
    } catch (err) {
      console.error('RS.initialize: Error while checking pending txs: ', err);
    }
  }

  async render() {
    if (!this.app.BROWSER || !this.browser_active) {
      return;
    }

    this.sPost = new SaitoPost(this.app, this);

    if (window?.tweets?.length) {
      for (let z = 0; z < window.tweets.length; z++) {
        let newtx = new Transaction();
        newtx.deserialize_from_web(this.app, window.tweets[z]);
        this.addTweet(newtx, { type: 'server-cache', node: 'server' });
      }
    }

    if (this.main == null) {
      this.main = new SaitoMain(this.app, this);
      this.header = new SaitoHeader(this.app, this);
      await this.header.initialize(this.app);
      this.tweetMenu = new TweetMenu(this.app, this);

      this.addComponent(this.header);
      this.addComponent(this.main);
    }

    await super.render();

    this.app.modules.renderInto('.redsquare-sidebar');

    if (!this.app.modules.returnModule('Archive')) {
      salert('RedSquare will not work without Archive installed!');
    }
  }

  addPeer(peer, tweet_limit = 10) {
    let publicKey = peer?.publicKey || this.publicKey;

    let peer_idx = -1;

    for (let i = 0; i < this.peers.length; i++) {
      if (this.peers[i].publicKey === publicKey) {
        peer_idx = i;
      }
    }

    let peer_obj;

    if (peer_idx == -1) {
      peer_obj = {
        peer: peer,
        publicKey: publicKey,
        tweets_earliest_ts: new Date().getTime(),
        tweets_latest_ts: 0,
        tweets_limit: tweet_limit,
        busy: {}
      };
      this.peers.push(peer_obj);
    } else {
      this.peers[peer_idx].peer = peer;
      peer_obj = this.peers[peer_idx];
      console.log('RS.addPeer: peer refreshed -- ', peer_obj);
      return peer_obj;
    }

    if (this.browser_active) {
      this.loadTweets(
        'earlier',
        (tx_count) => {
          this.app.connection.emit('redsquare-home-postcache-render-request', tx_count);
        },
        peer_obj
      );

      if (peer.publicKey !== this.publicKey) {
        setInterval(() => {
          this.loadTweets(
            'later',
            (tx_count) => {
              this.app.connection.emit('redsquare-home-postcache-render-request', tx_count);
            },
            peer_obj
          );
        }, 300000);
      }
    }

    return peer_obj;
  }

  async onPeerServiceUp(app, peer, service = {}) {
    if (!this.browser_active) {
      return;
    }

    if (service.service === 'redsquare') {
      this.addPeer(peer);

      this.archive_connected = true;

      if (this.browser_active) {
        siteMessage('Syncing Redsquare...', 2000);
        this.main.render();
      }
    }
  }

  async handlePeerTransaction(app, tx = null, peer, mycallback) {
    if (tx == null) {
      return 0;
    }

    let txmsg = tx.returnMessage();

    if (!txmsg.request || !mycallback) {
      return 0;
    }

    let txs = [];

    if (txmsg.request === 'load thread') {
      let thread_id = txmsg.data.sig;
      let by_thread = false;
      console.log('========> LOAD THREAD REQUEST ===========');
      let tweet = this.returnTweet(thread_id);

      if (tweet) {
        if (tweet.thread_id == thread_id) {
          if (tweet.isLoaded()) {
            return mycallback(this.packTweetThread(tweet));
          }
          by_thread = true;
        } else {
          console.log('========> Provided sig not the THREAD ROOT =============');
          thread_id = tweet.thread_id;
          let root_tweet = this.returnTweet(tweet.thread_id);
          if (root_tweet) {
            if (root_tweet.isLoaded()) {
              return mycallback(this.packTweetThread(root_tweet));
            }
            by_thread = true;
          }
        }
      }

      console.log('========> HITTING ARCHIVES! ===========');
      if (by_thread) {
        this.app.storage.loadTransactions(
          {
            field1: 'RedSquare',
            field5: thread_id,
            flagged: 0,
            limit: 100
          },
          (txs) => {
            if (txs.length > 0) {
              console.log('========> ARCHIVES FOUND THREAD =====');
              mycallback(txs);
            }
          },
          'localhost',
          0
        );
      } else {
        this.app.storage.loadTransactions(
          { sig: thread_id, field1: 'RedSquare' },
          (txs) => {
            if (txs.length > 0) {
              txs[0].decryptMessage(this.app);
              let archive_returned_tweet = new Tweet(this.app, this, txs[0]);
              this.app.storage.loadTransactions(
                {
                  field1: 'RedSquare',
                  field5: archive_returned_tweet.thread_id,
                  flagged: 0,
                  limit: 100
                },
                (txs) => {
                  if (txs.length > 0) {
                    console.log('========> ARCHIVES FOUND THREAD AFTER TWEET LOOKUP =====');
                    mycallback(txs);
                  }
                },
                'localhost',
                0
              );
            }
          },
          'localhost'
        );
      }
      return 1;
    }

    if (txmsg.request === 'load tweets') {
      console.log('Peer Request to load tweets....');
      if (txmsg.data.created_earlier_than != undefined) {
        let need_to_check_archive = true;

        for (let i = 0; i < this.tweets.length; i++) {
          if (this.tweets[i].created_at < txmsg.data.created_earlier_than) {
            txs.push(this.tweets[i].tx.serialize_to_web(app));
            if (txs.length == 10) {
              need_to_check_archive = false;
              break;
            }
          }
        }

        if (need_to_check_archive) {
          console.log('Pulling earlier tweets from archive to give to peer');
          let last_index = this.tweets.length;

          need_to_check_archive = this.loadTweets(
            'earlier',
            (count, peer) => {

              for (let i = last_index; i < this.tweets.length; i++) {
                txs.push(this.tweets[i].tx.serialize_to_web(app));
                if (txs.length == 10) {
                  break;
                }
              }

              mycallback(txs);

              this.addBlogPseudoTweets();
            },
            this.peers[0]
          );
        }

        if (!need_to_check_archive) {
          return mycallback(txs);
        }
      }

      return 1;
    }

    return super.handlePeerTransaction(app, tx, peer, mycallback);
  }

  async onConfirmation(blk, tx, conf) {
    let txmsg = tx.returnMessage();

    if (conf == 0) {
      if (txmsg.request === 'delete tweet') {
        await this.receiveDeleteTransaction(blk, tx, conf, this.app);
        return;
      }
      if (txmsg.request === 'edit tweet') {
        await this.receiveEditTransaction(blk, tx, conf, this.app);
        return;
      }

      if (this.app.BROWSER) {
        this.addNotification(tx);
      }

      if (txmsg.request === 'create tweet') {
        await this.receiveTweetTransaction(blk, tx, conf, this.app);
        this.addTweet(tx, { type: 'on chain', node: blk.id });
      }
      if (txmsg.request === 'like tweet') {
        await this.receiveLikeTransaction(blk, tx, conf, this.app);
      }
      if (txmsg.request === 'flag tweet') {
        await this.receiveFlagTransaction(blk, tx, conf, this.app);
      }
      if (txmsg.request === 'retweet') {
        await this.receiveRetweetTransaction(blk, tx, conf, this.app);
      }
    }
  }

  loadTweets(created_at = 'earlier', mycallback, peer = null) {
    let peer_count = 0;

    console.log(peer);

    for (let i = 0; i < this.peers.length; i++) {
      if (!peer || peer.publicKey == this.peers[i].publicKey) {
        if (
          (created_at == 'earlier' &&
            this.peers[i].tweets_earliest_ts >= this.tweets_earliest_ts &&
            this.peers[i].tweets_earliest_ts > 0) ||
          (created_at == 'later' && (this.peers[i].publicKey !== this.publicKey || peer))
        ) {
          peer_count++;

          if (this.peers[i].busy[created_at]) {
            this.peers[i].busy[created_at].push(mycallback);
            console.warn('RS.loadTweets already waiting on a response from this peer!');
            continue;
          }

          this.peers[i].busy[created_at] = [mycallback];

          if (created_at == 'earlier' && this.peers[i].publicKey !== this.publicKey) {
            let obj = {created_earlier_than: this.peers[i].tweets_earliest_ts};

            this.app.network.sendRequestAsTransaction(
              'load tweets',
              obj,
              (txs) => {
                for (let t = 0; t < txs.length; t++) {
                  let tx = new Transaction();
                  tx.deserialize_from_web(this.app, txs[t]);
                  txs[t] = tx;
                }

                let count = this.processTweetsFromPeer(this.peers[i], txs);

                if (txs.length == 0) {
                  console.debug('RS: Mark remote peer as tapped out...');
                  this.peers[i].tweets_earliest_ts = 0;
                }

                console.debug(
                  `RS.loadTweets remote [${created_at}] returned ${count}. New feed length: ${this.tweets.length}`
                );

                for (let cb of this.peers[i].busy[created_at]) {
                  if (typeof cb === 'function') {
                    cb(count, this.peers[i]);
                  }
                }
                this.peers[i].busy[created_at] = null;
              },
              this.peers[i].peer.peerIndex
            );
          } else {
            console.debug(`RS.loadTweets requesting ${created_at} tweets from archive...`);

            let obj = {field1: 'RedSquare', flagged: 0, limit: this.peers[i].tweets_limit};

            if (created_at == 'earlier') {
              obj.created_earlier_than = this.peers[i].tweets_earliest_ts;
            } else if (created_at == 'later') {
              obj.updated_later_than = this.peers[i].tweets_latest_ts;
            }

            this.app.storage.loadTransactions(
              obj,
              (txs) => {
                let count = this.processTweetsFromPeer(this.peers[i], txs);

                if (txs.length < this.peers[i].tweets_limit) {
                  if (created_at === 'earlier') {
                    console.debug('RS: Mark peer as tapped out: ' + created_at);
                    this.peers[i].tweets_earliest_ts = 0;
                    this.tweets_earliest_ts = 0;
                  }
                }

                console.debug(
                  `RS.loadTweets ${this.peers[i].publicKey == this.publicKey ? 'localhost' : this.peers[i].publicKey.substring(0, 6)} [${created_at}] returned ${count}/${txs.length}. New feed length: ${this.tweets.length}`
                );

                for (let cb of this.peers[i].busy[created_at]) {
                  if (typeof cb === 'function') {
                    cb(count, this.peers[i]);
                  }
                }
                this.peers[i].busy[created_at] = null;
              },
              this.peers[i].peer
            );
          }
        }
      }
    }

    if (!peer_count) {
      console.debug(
        'Ignore load tweets because no peers available: ',
        JSON.parse(JSON.stringify(this.peers)),
        created_at,
        this.tweets_earliest_ts
      );
    }

    return peer_count;
  }

  processTweetsFromPeer(peer, txs) {
    let count = 0;

    if (this.debug) {
      console.debug(
        `RS.processTweetsFromPeer: checking ${txs.length} tweet transaction against my current ${this.tweets.length}`
      );
    }

    for (let z = 0; z < txs.length; z++) {
      txs[z].decryptMessage(this.app);

      let created_at = txs[z].timestamp;
      let updated_at = txs[z].optional?.updated_at || created_at;

      if (created_at < peer.tweets_earliest_ts) {
        peer.tweets_earliest_ts = created_at;

        this.tweets_earliest_ts = Math.min(this.tweets_earliest_ts, peer.tweets_earliest_ts);
      }
      if (updated_at > peer.tweets_latest_ts) {
        peer.tweets_latest_ts = updated_at;
      }

      let source = {
        type: 'archive',
        node: peer.publicKey || peer
      };

      if (peer.publicKey == this.publicKey) {
        source.node = 'localhost';
      }

      let added = this.addTweet(txs[z], source);
      let tweet = this.returnTweet(txs[z].signature);

      if (tweet && added > 0) {
        if (peer.publicKey != this.publicKey) {
          this.saveTweet(tweet, 0);
        }

        count += added;
      }
    }

    return count;
  }

  loadNotifications(mycallback = null) {
    let notifications = [];
    let return_count = 0;

    const middle_callback = () => {
      let new_notifications = [];

      console.info(
        `RS.loadNotifications: process ${notifications.length} combined tweet and like notifications`
      );

      if (notifications.length > 0) {
        for (let z = 0; z < notifications.length; z++) {
          notifications[z].decryptMessage(this.app);

          if (this.addNotification(notifications[z])) {
            new_notifications.push(notifications[z]);
          }
        }
      } else {
        console.info('RS.loadNotifications: last notification fetch returned nothing');
        this.notifications_earliest_ts = 0;
      }

      console.info(
        `RS.loadNotifications: Appending ${new_notifications.length} new notification notices to the page`
      );

      if (mycallback) {
        mycallback(new_notifications);
      }
    };

    if (this.notifications_earliest_tweet_ts) {
      return_count++;

      console.debug(`RS.loadNotifications: query tweet notifications`);

      this.app.storage.loadTransactions(
        {
          field1: 'RedSquare',
          field3: this.publicKey,
          created_earlier_than: this.notifications_earliest_tweet_ts
        },
        (txs) => {
          for (let tx of txs) {
            if (tx.timestamp < this.notifications_earliest_tweet_ts) {
              this.notifications_earliest_tweet_ts = tx.timestamp;
            }
            notifications.push(tx);
          }

          console.debug(`RS.loadNotifications: Found ${txs.length} tweets`);

          return_count--;
          if (return_count == 0) {
            middle_callback();
          } else {
            console.debug('Process tweets first!');
          }
        },
        'localhost'
      );
    }

    if (this.notifications_earliest_like_ts) {
      return_count++;

      console.debug(`RS.loadNotifications: query like notifications`);

      this.app.storage.loadTransactions(
        {
          field1: 'RedSquareLike',
          field3: this.publicKey,
          created_earlier_than: this.notifications_earliest_like_ts
        },
        (txs) => {
          for (let tx of txs) {
            if (tx.timestamp < this.notifications_earliest_like_ts) {
              this.notifications_earliest_like_ts = tx.timestamp;
            }
            notifications.push(tx);
          }

          console.debug(`RS.loadNotifications: Found ${txs.length} likes`);

          return_count--;
          if (return_count == 0) {
            middle_callback();
          }
        },
        'localhost'
      );
    }

    if (!this.notifications_earliest_like_ts && !this.notifications_earliest_tweet_ts) {
      if (mycallback) {
        mycallback([]);
      }
    }
  }

  loadTweetThread(thread_id, mycallback = null) {
    if (!mycallback) {
      return;
    }

    siteMessage(`Checking peers for more replies...`, 1000);

    let peer_count = this.peers.length;

    for (let j = 0; j < this.peers.length; j++) {
      if (this.peers[j].peer !== 'localhost') {
        this.app.network.sendRequestAsTransaction(
          'load thread',
          { sig: thread_id },
          (txs) => {
            console.log('Thread tweets loaded: ', txs.length);
            for (let i = 0; i < txs.length; i++) {
              let tx = new Transaction();
              tx.deserialize_from_web(this.app, txs[i]);
              tx.decryptMessage(this.app);

              this.addTweet(tx, { type: 'tweet_thread', node: this.peers[j].publicKey });
            }

            peer_count--;
            if (peer_count == 0) {
              this.validateThread(thread_id);

              mycallback(txs);
            }
          },
          this.peers[j].peer.peerIndex
        );
      } else {
        peer_count--;
      }
    }
  }

  loadTweetWithSig(sig, mycallback = null) {
    let redsquare_self = this;

    if (mycallback == null) {
      return;
    }

    let t = this.returnTweet(sig);

    if (t != null) {
      mycallback([t.tx]);
      return;
    }

    this.app.storage.loadTransactions(
      { sig, field1: 'RedSquare' },
      (txs) => {
        if (txs.length > 0) {
          for (let z = 0; z < txs.length; z++) {
            txs[z].decryptMessage(this.app);
            this.addTweet(txs[z], { type: 'loadTweetWithSig', node: 'localhost' });
          }
          mycallback(txs);
        } else {
          for (let i = 0; i < this.peers.length; i++) {
            if (this.peers[i].publicKey !== this.publicKey) {
              this.app.storage.loadTransactions(
                { sig, field1: 'RedSquare' },
                (txs) => {
                  if (txs.length > 0) {
                    for (let z = 0; z < txs.length; z++) {
                      txs[z].decryptMessage(this.app);
                      this.addTweet(txs[z], {
                        type: 'loadTweetWithSig',
                        node: this.peers[i].publicKey
                      });
                    }
                    mycallback(txs);
                  } else {
                    console.error(
                      "Couldn't find tweet with sig: " + sig + ' on local or remote archives'
                    );
                  }
                },
                this.peers[i].peer
              );
            }
          }
        }
      },
      'localhost'
    );
  }

  addTweet(tx, source = null, override_curation = 0) {
    let txmsg = tx.returnMessage();

    if (source) {
      source.ts = new Date().getTime();
      if (tx.optional) {
        source.optional = Object.assign({}, tx.optional);
      }
    }

    if (
      txmsg.request === 'like tweet' ||
      txmsg.request === 'flag tweet' ||
      txmsg.request === 'retweet'
    ) {
      if (this.debug) {
        console.debug("RS.addTweet -- Don't process " + txmsg.request);
      }
      return 0;
    }

    if (txmsg.request === 'delete tweet' && this.app.BROWSER) {
      if (this.debug) {
        console.debug('RS.addTweet -- process ' + txmsg.request);
      }
      this.receiveDeleteTransaction(0, tx, 0, this.app);
      return 0;
    }

    if (txmsg.request === 'edit tweet') {
      if (this.debug) {
        console.debug('RS.addTweet -- process ' + txmsg.request);
      }

      this.editTweet(txmsg.data.tweet_id, tx, source);
      return 0;
    }

    if (this.tweets_sigs_hmap[tx.signature]) {
      let t = this.returnTweet(tx.signature);

      if (!t) {
        console.warn('RS.addTweet: tweet in hmap by not returned...');
        return 0;
      }

      if (this.debug) {
        console.debug(`RS.addTweet: Duplicate! Feed length: (${this.tweets.length}) -- `, t?.text, source);
      }

      t.sources.push(source);

      if (tx.optional) {
        let should_rerender = false;

        if (tx.optional.num_replies > t.tx.optional.num_replies) {
          t.tx.optional.num_replies = tx.optional.num_replies;
        }
        if (tx.optional.num_retweets > t.tx.optional.num_retweets) {
          t.tx.optional.num_retweets = tx.optional.num_retweets;
          t.tx.optional.retweeters = tx.optional.retweeters;
          should_rerender = true;
        }
        if (tx.optional.num_likes > t.tx.optional.num_likes) {
          t.tx.optional.num_likes = tx.optional.num_likes;
        }
        if (tx.optional.update_tx) {
          t.tx.optional.update_tx = tx.optional.update_tx;
          should_rerender = true;
        }
        let tx_updated_at = tx.optional.updated_at || tx.timestamp;
        if (tx_updated_at > t.updated_at) {
          t.updated_at = Math.max(t.updated_at, tx_updated_at);
          should_rerender = true;
          if (tx.optional.link_properties) {
            t.tx.optional.link_properties = tx.optional.link_properties;
          }
        }

        t.tx.optional.updated_at = tx.optional.updated_at;

        if (tx.optional.curated && !t.curated) {
          t.tx.optional.curated = tx.optional.curated;
          t.curated = tx.optional.curated;

          delete t.curation_check;

          if (tx.optional.curation_check !== 'undefined') {
            t.tx.optional.curation_check = tx.optional.curation_check;
          }
          should_rerender = true;
        }

        t.rerenderControls(should_rerender);
      }

      return 0;
    }

    let tweet = new Tweet(this.app, this, tx);

    if (!tweet?.tx) {
      console.warn('RS.addTweet -- Created a tweet with a null tx');
      return 0;
    }

    if (source.type == 'tweet_thread') {
      console.log('Add thread tweet', tweet.tx.signature, tweet.text);
    }

    tweet.sources.push(source);

    tweet.curated = override_curation || this.curate(tx);
    tweet.tx.optional.curated = tweet.curated;

    if (tweet.curation_check) {
      if (tweet.curated == 1) {
        console.log('We already accept the tweet to test!');
        delete tweet.curation_check;
        delete tweet.tx.optional.curation_check;
      }
    }

    for (let xmod of this.app.modules.respondTo('redsquare-add-tweet')) {
      tweet = xmod.respondTo('redsquare-add-tweet').processTweet(tweet);
    }

    if (tweet.rethread) {
      if (!tweet.thread_id) {
        if (this.debug) {
          console.debug('RS.addTweet -- ignore marked tweet');
        }
        this.tweets_sigs_hmap[tweet.tx.signature] = 2;
        return 0;
      }

      if (this.special_threads_hmap[tweet.thread_id]) {
        if (this.debug) {
          console.debug(
            'RS.addTweet -- inserting marked tweet into existing thread',
            tweet?.thread_id
          );
        }
        for (let i = 0; i < this.tweets.length; i++) {
          if (this.tweets[i].thread_id == tweet.thread_id) {
            this.tweets_sigs_hmap[tweet.tx.signature] = 1;

            if (tweet.created_at > this.tweets[i].created_at) {
              this.tweets[i].parent_id = tweet.tx.signature;
              let should_render = this.tweets[i].isRendered();
              this.tweets[i].remove();
              tweet.addTweet(this.tweets[i]);
              if (should_render) {
                tweet.render(true);
              }

              this.tweets.splice(i, 1);

              let insertion_index = 0;
              for (let j = 0; i < this.tweets.length; i++) {
                if (this.tweets[j].created_at > tweet.created_at) {
                  insertion_index++;
                } else {
                  this.out_of_order = true;
                  break;
                }
              }
              this.tweets.splice(insertion_index, 0, tweet);
            } else {
              tweet.parent_id = this.tweets[i].tx.signature;
              this.tweets[i].addTweet(tweet);
              this.tweets[i].rerenderControls(true);
            }
            return -1;
          }
        }

        console.warn('RS.addTweet -- Thread not found! Not adding special tweet to feed');
        return 0;
      }
      if (this.debug) {
        console.debug('RS.addTweet -- new special tweet thread', tweet?.thread_id);
      }
      this.special_threads_hmap[tweet.thread_id] = 1;
    }

    if (!tweet.parent_id) {
      let insertion_index = 0;
      for (let i = 0; i < this.tweets.length; i++) {
        if (this.tweets[i].created_at > tweet.created_at) {
          insertion_index++;
        } else {
          this.out_of_order = true;
          break;
        }
      }

      this.tweets.splice(insertion_index, 0, tweet);
      this.tweets_sigs_hmap[tweet.tx.signature] = 1;

      for (let i = 0; i < this.unknown_children.length; i++) {
        if (this.unknown_children[i].thread_id === tweet.tx.signature) {
          tweet.addTweet(this.unknown_children[i]);
          this.unknown_children.splice(i, 1);
          i--;
        }
      }

      if (this.debug) {
        console.debug(
          `\n===\nRS.addTweet Success! Feed has (${this.tweets.length}) -- `,
          tweet.text.substring(0, 50),
          source.node,
          `Curated: ${tweet.curated}`
        );
      }

      return 1;

    } else {
      for (let i = 0; i < this.tweets.length; i++) {
        if (this.tweets[i].tx.signature === tweet.thread_id) {
          this.tweets[i].addTweet(tweet);
          this.tweets_sigs_hmap[tweet.tx.signature] = 1;

          if (this.debug) {
            console.debug(
              `RS.addTweet: child tweet success! Feed length: (${this.tweets.length}) -- `,
              tweet.text,
              source
            );
          }

          return -1;
        }
      }

      this.unknown_children.push(tweet);
      this.tweets_sigs_hmap[tweet.tx.signature] = 1;

      if (this.debug) {
        console.debug(
          `RS.addTweet: unknown child! Feed length: (${this.tweets.length}) -- `,
          tweet.text,
          source
        );
      }

      return -1;
    }
  }

  addNotification(tx) {
    if (tx.isTo(this.publicKey)) {
      if (!tx.isFrom(this.publicKey)) {
        if (this.notifications_sigs_hmap[tx.signature] != 1) {
          if (this.debug) {
            console.debug('RS.addNotification', tx.msg, tx.timestamp);
          }

          let insertion_index = 0;

          for (let i = 0; i < this.notifications.length; i++) {
            if (tx.timestamp > this.notifications[i].timestamp) {
              break;
            } else {
              insertion_index++;
            }
          }

          this.notifications.splice(insertion_index, 0, tx);
          this.notifications_sigs_hmap[tx.signature] = 1;

          if (tx.timestamp > this.notifications_last_viewed_ts) {
            this.notifications_number_unviewed = this.notifications_number_unviewed + 1;
            this.app.connection.emit(
              'redsquare-update-notifications',
              this.notifications_number_unviewed
            );
          }

          this.saveOptions();

          return 1;
        } else {
          console.debug('RS.addNotification duplicate notification');
        }
      }
    }

    return 0;
  }

  resetNotifications() {
    this.notifications_last_viewed_ts = new Date().getTime();
    this.notifications_number_unviewed = 0;
    this.saveOptions();

    this.app.connection.emit('redsquare-update-notifications', this.notifications_number_unviewed);
  }

  returnTweet(tweet_sig = null) {
    if (tweet_sig == null) {
      return null;
    }

    if (!this.tweets_sigs_hmap[tweet_sig] && !this.special_threads_hmap[tweet_sig]) {
      return null;
    }

    for (let i = 0; i < this.tweets.length; i++) {
      if (this.tweets[i].tx.signature === tweet_sig) {
        return this.tweets[i];
      }
      if (this.tweets[i].hasChildTweet(tweet_sig)) {
        return this.tweets[i].returnChildTweet(tweet_sig);
      }

      if (this.tweets[i].thread_id === tweet_sig) {
        return this.tweets[i];
      }
    }

    for (let j = 0; j < this.unknown_children.length; j++) {
      if (this.unknown_children[j].tx.signature === tweet_sig) {
        return this.unknown_children[j];
      }
    }

    return null;
  }

  removeTweet(tweet_sig = null) {
    if (!tweet_sig || !this.tweets_sigs_hmap[tweet_sig]) {
      return;
    }

    this.tweets_sigs_hmap[tweet_sig] = 0;

    for (let i = 0; i < this.tweets.length; i++) {
      if (this.tweets[i].tx.signature === tweet_sig) {
        this.tweets[i].remove();
        this.tweets.splice(i, 1);
        return;
      }

      if (this.tweets[i].hasChildTweet(tweet_sig)) {
        this.tweets[i].removeChildTweet(tweet_sig);
        return;
      }
    }

    for (let j = 0; j < this.unknown_children.length; j++) {
      if (this.unknown_children[j].tx.signature === tweet_sig) {
        this.unknown_children.splice(j, 1);
        return;
      }
    }
  }

  pruneTweets() {
    this.unknown_children = [];
    let pruned = [];
    let count = 0;
    if (this.tweets.length > 100) {
      for (let i = 0; count < 90 && i < this.tweets.length; i++) {
        if (this.tweets[i].curated == 1) {
          pruned.push(this.tweets[i]);
          count++;
        }
      }
    }
    this.tweets = pruned;
  }

  returnNotification(tweet_sig = null) {
    if (tweet_sig == null) {
      return null;
    }

    if (!this.notifications_sigs_hmap[tweet_sig]) {
      return null;
    }

    for (let i = 0; i < this.notifications.length; i++) {
      if (this.notifications[i].signature === tweet_sig) {
        return this.notifications[i];
      }
    }

    return null;
  }

  returnThreadSigs(tweet_id) {
    let sigs = [];

    while (tweet_id) {
      let tweet = this.returnTweet(tweet_id);
      if (!tweet) {
        console.warn('Incomplete tweet thread!');
        return sigs;
      }

      sigs.push(tweet_id);

      tweet_id = tweet.parent_id;
    }

    return sigs;
  }

  validateThread(tweet_id) {
    let tweet = this.returnTweet(tweet_id);

    if (tweet) {
      if (tweet.num_replies !== tweet.children.length) {
        console.debug(
          `manually correct reply count: ${tweet.num_replies} -> ${tweet.children.length}`
        );
        tweet.tx.optional.num_replies = tweet.children.length;
        tweet.num_replies = tweet.children.length;

        tweet.refreshStat('comment', tweet.num_replies);
      }

      for (let child of tweet.children) {
        this.validateThread(child.tx.signature);
      }
    }
  }

  async sendLikeTransaction(app, mod, data, tx) {
    let redsquare_self = this;

    let obj = {
      module: redsquare_self.name,
      request: 'like tweet',
      data: {}
    };
    for (let key in data) {
      obj.data[key] = data[key];
    }

    let newtx = await redsquare_self.app.wallet.createUnsignedTransaction(tx.from[0]?.publicKey);

    for (let i = 0; i < tx.to.length; i++) {
      if (tx.to[i].publicKey !== this.publicKey) {
        newtx.addTo(tx.to[i].publicKey);
      }
    }

    newtx.msg = obj;
    await newtx.sign();
    await redsquare_self.app.network.propagateTransaction(newtx);

    return newtx;
  }

  addToCouncil(key) {
    let trust_rating = this.jedi_council.has(key) ? this.jedi_council.get(key) : 0;
    trust_rating++;
    this.jedi_council.set(key, trust_rating);
    if (trust_rating > 12) {
      this.app.connection.emit('saito-whitelist', { publicKey: key });
    }
  }

  updateTweetCuration(tweet, interaction_tx) {
    let new_curation = Math.max(0, this.curate(interaction_tx));

    if (new_curation == 1) {
      this.addToCouncil(tweet.tx.from[0].publicKey);
    }

    tweet.curated = new_curation || tweet.curated;
  }

  async updateTweetStat(tweet_tx, ts, stat, tweet = null) {
    if (!tweet_tx.optional) {
      tweet_tx.optional = {};
    }

    if (!tweet_tx.optional[stat]) {
      tweet_tx.optional[stat] = 0;
    }

    let tweet_ts = tweet?.updated_at || tweet_tx.optional.updated_at || tweet_tx.timestamp;

    if (ts > tweet_ts) {
      tweet_tx.optional[stat]++;

      if (tweet) {
        tweet.potential_new_ts = Math.max(ts, tweet_ts, tweet.potential_new_ts || 0);
        if (tweet.timeout) {
          clearTimeout(tweet.timeout);
        }
        tweet.timeout = setTimeout(() => {
          this.app.storage.updateTransaction(
            tweet_tx,
            { updated_at: tweet.potential_new_ts },
            'localhost'
          );
          tweet.updated_at = tweet.potential_new_ts;
          delete tweet.timeout;
          delete tweet.potential_new_ts;
        }, 2000);
      } else {
        let obj = { updated_at: ts };
        await this.app.storage.updateTransaction(tweet_tx, obj, 'localhost');
      }
    }
  }

  async receiveLikeTransaction(blk, tx, conf, app) {
    let txmsg = tx.returnMessage();

    let liked_tweet = this.returnTweet(txmsg.data.signature);

    if (liked_tweet?.tx) {
      this.updateTweetCuration(liked_tweet, tx);
      await this.updateTweetStat(liked_tweet.tx, tx.timestamp, 'num_likes', liked_tweet);

      liked_tweet.rerenderControls();
    } else if (!this.app.BROWSER) {
      await this.app.storage.loadTransactions(
        { sig: txmsg.data.signature, field1: 'RedSquare' },
        async (txs) => {
          if (txs?.length > 0) {
            this.addTweet(
              txs[0],
              { type: 'on_chain_like', node: 'localhost' },
              Math.max(0, this.curate(tx))
            );

            let tweet = this.returnTweet(txs[0].signature);
            if (tweet) {
              await this.updateTweetStat(tweet.tx, tx.timestamp, 'num_likes', tweet);
            }
          }
        },
        'localhost'
      );
    }

    await this.app.storage.saveTransaction(tx, { field1: 'RedSquareLike' }, 'localhost', blk);

    return;
  }

  async sendRetweetTransaction(app, mod, data, tx) {
    let redsquare_self = this;

    let obj = {module: redsquare_self.name, request: 'retweet', data: {}};
    for (let key in data) {
      obj.data[key] = data[key];
    }

    let newtx = await redsquare_self.app.wallet.createUnsignedTransaction(tx.from[0]?.publicKey);

    for (let i = 0; i < tx.to.length; i++) {
      if (tx.to[i].publicKey !== this.publicKey) {
        newtx.addTo(tx.to[i].publicKey);
      }
    }
    newtx.addTo(this.publicKey);

    newtx.msg = obj;
    await newtx.sign();
    await redsquare_self.app.network.propagateTransaction(newtx);

    return newtx;
  }

  async incrementRetweets(localTx, receivedTx) {
    if (!localTx.optional) {
      localTx.optional = {};
    }

    if (!localTx.optional.num_retweets) {
      localTx.optional.num_retweets = 0;
    }
    if (!localTx.optional.retweeters) {
      localTx.optional.retweeters = [];
    }

    let localTx_updated_at = localTx.updated_at || localTx.timestamp;

    if (receivedTx.timestamp > localTx_updated_at) {
      localTx.optional.num_retweets++;

      if (!localTx.optional.retweeters.includes(receivedTx.from[0].publicKey)) {
        localTx.optional.retweeters.unshift(receivedTx.from[0].publicKey);
      }

      localTx.optional.retweeted_at = receivedTx.timestamp;

      await this.app.storage.updateTransaction(localTx, {updated_at: receivedTx.timestamp}, 'localhost');
    } else {
      console.warn('RS.incrementRetweets: transaction received after archive load', localTx, receivedTx);
    }
  }

  async receiveRetweetTransaction(blk, tx, conf, app) {
    let txmsg = tx.returnMessage();

    let retweeted_tweet = this.returnTweet(txmsg.data.signature);

    if (retweeted_tweet?.tx) {
      await this.incrementRetweets(retweeted_tweet.tx, tx);

      this.updateTweetCuration(retweeted_tweet, tx);

      retweeted_tweet.rerenderControls(true);

      for (let i = 0; i < this.tweets.length; i++) {
        if (this.tweets[i].tx.signature == retweeted_tweet.tx.signature) {
          this.tweets.splice(i, 1);
          break;
        }
      }
      this.tweets.unshift(retweeted_tweet);
    } else {
      await this.app.storage.loadTransactions(
        { sig: txmsg.data.signature, field1: 'RedSquare' },
        async (txs) => {
          if (txs?.length > 0) {
            this.incrementRetweets(txs[0], tx);
          } else {
            console.warn('RS.receiveRetweet: Original tweet not found');
          }
        },
        'localhost'
      );
    }

    return;
  }

  async sendEditTransaction(app, mod, data, keys = []) {
    let redsquare_self = this;

    let obj = {
      module: redsquare_self.name,
      request: 'edit tweet',
      data: {}
    };
    for (let key in data) {
      obj.data[key] = data[key];
    }

    let newtx = await redsquare_self.app.wallet.createUnsignedTransaction();
    newtx.msg = obj;

    for (let i = 0; i < keys.length; i++) {
      newtx.addTo(keys[i]);
    }

    await newtx.sign();
    await redsquare_self.app.network.propagateTransaction(newtx);

    return newtx;
  }

  async sendDeleteTransaction(app, mod, data, keys = []) {
    let redsquare_self = this;

    let obj = {
      module: redsquare_self.name,
      request: 'delete tweet',
      data: {}
    };
    for (let key in data) {
      obj.data[key] = data[key];
    }

    let newtx = await redsquare_self.app.wallet.createUnsignedTransaction();
    newtx.msg = obj;

    for (let i = 0; i < keys.length; i++) {
      newtx.addTo(keys[i]);
    }

    await newtx.sign();
    await redsquare_self.app.network.propagateTransaction(newtx);

    return newtx;
  }

  async sendTweetTransaction(app, mod, data, keys = []) {
    let redsquare_self = this;

    let obj = {
      module: redsquare_self.name,
      request: 'create tweet',
      data: {}
    };
    for (let key in data) {
      obj.data[key] = data[key];
    }

    let newtx = await redsquare_self.app.wallet.createUnsignedTransaction();

    newtx.msg = obj;

    for (let i = 0; i < keys.length; i++) {
      if (keys[i] !== this.publicKey) {
        newtx.addTo(keys[i]);
      }
    }

    await newtx.sign();
    await redsquare_self.app.network.propagateTransaction(newtx);

    return newtx;
  }

  editTweet(tweet_id, tx, source) {
    let edited_tweet = this.returnTweet(tweet_id);

    if (edited_tweet) {
      let orig_tx = edited_tweet.tx;
      if (!orig_tx.optional) {
        orig_tx.optional = {};
      }

      if (tx.timestamp > (orig_tx.optional?.edit_ts || 0)) {
        orig_tx.optional.update_tx = tx.serialize_to_web(this.app);
        orig_tx.optional.edit_ts = tx.timestamp;

        let new_tweet = new Tweet(this.app, this, orig_tx, edited_tweet.container);

        new_tweet.sources.push(source);

        new_tweet.rerenderControls(true);
      }
    } else {
      this.orphan_edits.push({ tweet_id, tx, source });
    }
  }

  async receiveEditTransaction(blk, tx, conf, app) {
    try {
      let txmsg = tx.returnMessage();

      if (!txmsg.data?.tweet_id) {
        console.warn('RS.receiveEdit: no tweet id to edit');
        return;
      }

      console.info('RS.receiveEdit: transaction received');

      this.editTweet(txmsg.data.tweet_id, tx, `onchain-edit-${tx.from[0].publicKey}`);

      await this.app.storage.loadTransactions(
        { sig: txmsg.data.tweet_id, field1: 'RedSquare' },
        async (txs) => {
          if (txs?.length) {
            let oldtx = txs[0];

            if (oldtx.from[0].publicKey === tx.from[0].publicKey) {
              if (!oldtx.optional) {
                oldtx.optional = {};
              }

              if (tx.timestamp > (oldtx.optional?.edit_ts || 0)) {
                oldtx.optional.update_tx = tx.serialize_to_web(this.app);
                oldtx.optional.edit_ts = tx.timestamp;
              }

              await this.app.storage.updateTransaction(
                oldtx,
                { updated_at: tx.timestamp },
                'localhost'
              );
            }
          }
        },
        'localhost'
      );
    } catch (err) {
      console.error('RedSquare: error editing tweet', err);
      console.log(tx);
    }
  }

  async receiveDeleteTransaction(blk, tx, conf, app) {
    console.info('RS.receiveDelete: transaction received');

    let txmsg = tx.returnMessage();

    if (!txmsg.data) {
      return;
    }
    if (!txmsg.data.tweet_id) {
      return;
    }

    this.removeTweet(txmsg.data.tweet_id);

    await this.app.storage.loadTransactions(
      { sig: txmsg.data.tweet_id },
      async (txs) => {
        if (txs?.length) {
          let oldtx = txs[0];

          if (oldtx.from[0].publicKey === tx.from[0].publicKey) {
            await this.app.storage.deleteTransaction(oldtx, {}, 'localhost');

            let tweet = new Tweet(this.app, this, oldtx, '');

            if (tweet.tx.optional.parent_id) {
              await this.app.storage.loadTransactions(
                { sig: tweet.tx.optional.parent_id, field1: 'RedSquare' },
                async (txs) => {
                  if (txs?.length) {
                    if (txs[0]?.optional?.num_replies) {
                      txs[0].optional.num_replies--;
                      await this.app.storage.updateTransaction(
                        txs[0],
                        { updated_at: tx.timestamp },
                        'localhost'
                      );
                    }
                  }
                },
                'localhost'
              );
            }

            if (tweet.retweet_tx) {
              await this.app.storage.loadTransactions(
                { sig: tweet.retweet.tx.signature, field1: 'RedSquare' },
                async (txs) => {
                  if (txs?.length) {
                    if (txs[0].optional?.num_retweets) {
                      txs[0].optional.num_retweets--;
                      await this.app.storage.updateTransaction(
                        txs[0],
                        { updated_at: tx.timestamp },
                        'localhost'
                      );
                    }
                  }
                },
                'localhost'
              );
            }
          }
        }
      },
      'localhost'
    );

    if (!app.BROWSER) {
      await this.app.storage.saveTransaction(tx, { field1: 'RedSquare' }, 'localhost', blk);
    }
  }

  async receiveTweetTransaction(blk, tx, conf, app) {
    console.info('##################\n#################\nRS.receiveTweet: transaction received');

    try {
      let tweet = new Tweet(app, this, tx);
      let other_tweet = null;
      let txmsg = tx.returnMessage();

      tweet = await tweet.analyseTweetLinks(1);

      this.saveTweet(tweet, 1, blk);

      if (tweet.retweet_tx != null) {
        other_tweet = this.returnTweet(tweet.signature);

        if (other_tweet) {
          await this.incrementRetweets(other_tweet.tx, tx);
          this.updateTweetCuration(other_tweet, tx);
          other_tweet.rerenderControls();
        } else {
          await this.app.storage.loadTransactions(
            { sig: tweet.signature, field1: 'RedSquare' },
            async (txs) => {
              if (txs?.length) {
                this.incrementRetweets(txs[0], tx);
              }
            },
            'localhost'
          );
        }
      }

      if (tweet.parent_id && tweet.parent_id !== tweet.tx.signature) {
        other_tweet = this.returnTweet(tweet.parent_id);

        if (other_tweet) {
          await this.updateTweetStat(other_tweet.tx, tx.timestamp, 'num_replies', other_tweet);
          other_tweet.rerenderControls();
        } else {
          await this.app.storage.loadTransactions(
            { sig: tweet.parent_id, field1: 'RedSquare' },
            async (txs) => {
              if (txs?.length) {
                await this.updateTweetStat(txs[0], tx.timestamp, 'num_replies');
              }
            },
            'localhost'
          );
        }
      }
    } catch (err) {
      console.error('RS.receiveTweetsTransaction ERROR: ', err);
    }
  }

  async sendFlagTransaction(app, mod, data, tx) {
    let redsquare_self = this;

    let obj = {
      module: redsquare_self.name,
      request: 'flag tweet',
      data: {}
    };

    for (let key in data) {
      obj.data[key] = data[key];
    }

    let newtx = await redsquare_self.app.wallet.createUnsignedTransaction();

    newtx.msg = obj;
    await newtx.sign();
    await redsquare_self.app.network.propagateTransaction(newtx);

    return newtx;
  }

  async receiveFlagTransaction(blk, tx, conf, app) {
    let txmsg = tx.returnMessage();

    let flagged_tweet = this.returnTweet(txmsg.data.signature);

    let process_action = tx.isFrom(this.publicKey);

    let modScore = this.app.modules.moderate(tx);

    if (modScore == -1) {
      return;
    } else if (modScore == 1) {
      process_action = true;
    }

    if (flagged_tweet) {
      if (flagged_tweet.flagged) {
        process_action = true;
      } else {
        flagged_tweet.flagged = true;
      }

      flagged_tweet.curated = -1;
      flagged_tweet.optional.curated = -1;
      this.cacheRecentTweets(true);
    }

    if (process_action) {
      if (flagged_tweet?.tx) {
        await this.app.storage.updateTransaction(
          flagged_tweet.tx,
          { updated_at: tx.timestamp, flagged: 1 },
          'localhost'
        );
      } else {
        await this.app.storage.loadTransactions(
          { sig: txmsg.data.signature, field1: 'RedSquare' },
          async (txs) => {
            if (txs?.length > 0) {
              let archived_tx = txs[0];

              archived_tx.optional.curated = -1;

              await this.app.storage.updateTransaction(
                archived_tx,
                { updated_at: tx.timestamp, flagged: 1 },
                'localhost'
              );
            }
          },
          'localhost'
        );
      }
    }

    if (app.BROWSER == 1) {
      if (tx.isTo(this.publicKey)) {
        if (tx.isFrom(this.publicKey)) {
          siteMessage('Tweet successfully flagged for review', 3000);
        } else {
          siteMessage('One of your tweets was flagged for review', 10000);
        }
      } else {
        console.info(
          `RS.receiveFlagTransaction: Your friend [${this.app.keychain.returnUsername(tx.from[0].publicKey)}] flagged a tweet -- `,
          flagged_tweet.text
        );
      }
    }

    return;
  }

  saveTweet(tweet, preserve = 1, blk = null) {
    if (!tweet) {
      console.warn('RS.saveTweet: no tweet!');
      return;
    }

    if (!tweet.thread_id) {
      return;
    }

    if (preserve) {
      tweet.tx.optional.curated = 1;
    }

    let opt = {
      field1: 'RedSquare',
      preserve,
      field4: tweet.parent_id || '',
      field5: tweet.thread_id
    };

    if (tweet.tx.isTo(this.publicKey)) {
      opt['field3'] = this.publicKey;
    }

    this.app.storage.loadTransactions(
      { field1: 'RedSquare', sig: tweet.tx.signature },
      (txs) => {
        if (txs?.length > 0) {
          this.app.storage.updateTransaction(tweet.tx, opt, 'localhost', 1);
        } else {
          this.app.storage.saveTransaction(tweet.tx, opt, 'localhost', blk);
        }
      },
      'localhost'
    );
  }

  updateSavedTweet(sig) {
    let tweet = this.returnTweet(sig);

    if (!tweet) {
      console.warn('RS.updateTweet: tweet not found!', sig);
      return;
    }

    this.app.storage.updateTransaction(tweet.tx, {}, 'localhost');
  }

  loadOptions() {
    if (!this.app.BROWSER) {
      return;
    }

    if (this.app.options.redsquare) {
      const rso = this.app.options.redsquare;

      this.notifications_last_viewed_ts = rso?.notifications_last_viewed_ts || 0;
      this.notifications_number_unviewed = rso?.notifications_number_unviewed || 0;
      this.tweet_count = rso?.tweet_count || 0;

      this.liked_tweets = rso?.liked_tweets || [];
      this.retweeted_tweets = rso?.retweeted_tweets || [];
      this.replied_tweets = rso?.replied_tweets || [];
      this.hidden_tweets = rso?.hidden_tweets || [];

      if (rso?.curated == 0) {
        this.curated = false;
      }
    }

    this.saveOptions();
  }

  saveOptions() {
    if (!this.app.BROWSER) {
      return;
    }

    let rso = {};

    rso.notifications_last_viewed_ts = this.notifications_last_viewed_ts;
    rso.notifications_number_unviewed = this.notifications_number_unviewed;
    rso.tweet_count = this.tweet_count;

    rso.liked_tweets = this.liked_tweets.slice(-100);
    rso.retweeted_tweets = this.retweeted_tweets.slice(-100);
    rso.replied_tweets = this.replied_tweets.slice(-100);
    rso.hidden_tweets = this.hidden_tweets;

    rso.curated = this.curated;

    this.app.options.redsquare = rso;

    this.app.storage.saveOptions();
  }

  likeTweet(tweet) {
    if (!tweet?.tx?.signature) {
      return;
    }
    if (!this.liked_tweets.includes(tweet.tx.signature)) {
      this.liked_tweets.push(tweet.tx.signature);
      this.saveTweet(tweet);
    }
    this.saveOptions();
  }

  retweetTweet(tweet) {
    if (!tweet?.tx?.signature) {
      return;
    }
    if (!this.retweeted_tweets.includes(tweet.tx.signature)) {
      this.retweeted_tweets.push(tweet.tx.signature);
      this.saveTweet(tweet);
    }
    this.saveOptions();
  }

  replyTweet(tweet) {
    if (!tweet?.tx?.signature) {
      return;
    }
    if (!this.replied_tweets.includes(tweet.tx.signature)) {
      this.replied_tweets.push(tweet.tx.signature);
      this.saveTweet(tweet);
    }
    this.saveOptions();
  }

  addBlogPseudoTweets() {}

  cacheRecentTweets(force_caching = false) {
    if (this.app.BROWSER) {
      return;
    }

    let ts = new Date().getTime();
    if (!force_caching && this.last_cache + 300000 > ts) {
      return;
    }

    this.last_cache = ts;

    this.cached_tweets = [];

    for (let tweet of this.tweets) {
      tweet.curated = this.curate(tweet.tx);

      if (tweet.curated == 1) {
        tweet.tx.optional.curated = 1;
        this.cached_tweets.push(tweet.tx.serialize_to_web(this.app));
      }
    }

    if (this.debug) {
      console.debug(`###\n### RS.cacheRecentTweets -- Tweets: ${this.tweets.length} Cached: ${this.cached_tweets.length} \n###`);
    }

    this.cached_tweets = this.cached_tweets.slice(0, 9);

    let test_tweet = true;

    if (this.cached_tweets.length < 10) {
      for (let z = 0; z < this.tweets.length && this.cached_tweets.length < 10; z++) {
        if (this.tweets[z].curated == 0) {
          if (test_tweet) {
            test_tweet = false;
            this.tweets[z].tx.optional.curated = 0;
            this.tweets[z].tx.optional.curation_check = true;
            this.cached_tweets.push(this.tweets[z].tx.serialize_to_web(this.app));
          } else {
            let score = Math.log(this.tweets[z].num_likes + 1);
            score += this.tweets[z].num_retweets;
            score += Math.log(this.tweets[z].num_replies + 1) / Math.log(2);
            if (this.tweets[z].images?.length) {
              score += 3 * this.tweets[z].images.length;
            }
            if (score > 10) {
              this.tweets[z].tx.optional.curated = 0;
              this.cached_tweets.push(this.tweets[z].tx.serialize_to_web(this.app));
            }
          }
        }
      }
    }
  }

  fetchMissingUsernames(mycallback = null) {
    let keylist = [];

    for (let i = 0; i < this.tweets.length; i++) {
      if (!keylist.includes(this.tweets[i].tx.from[0].publicKey)) {
        keylist.push(this.tweets[i].tx.from[0].publicKey);
      }
    }

    let rMod = this.app.modules.returnModule('Registry');
    if (rMod) {
      rMod.fetchManyIdentifiers(keylist, (answer) => {
        if (mycallback != null) {
          mycallback(answer);
        }
      });
    } else {
      console.warn('No Registry');
    }
  }

  hasSettings() {
    return true;
  }

  loadSettings(container = null) {
    if (!container) {
      let overlay = new SaitoOverlay(this.app, this.mod);
      overlay.show(`<div class="module-settings-overlay"><h2>Redsquare Settings</h2></div>`);
      container = '.module-settings-overlay';
    }
    let as = new AppSettings(this.app, this, container);
    as.render();
  }

  webServer(app, expressapp, express, alternative_slug = null) {
    const webdir = `${__dirname}/../../mods/${this.dirname}/web`;
    const uri = alternative_slug || '/' + encodeURI(this.returnSlug());
    const redsquare_self = this;

    expressapp.use(uri, express.static(webdir));

    expressapp.get(uri, async function (req, res) {
      let reqBaseURL = req.protocol + '://' + req.headers.host + '/';

      try {
        if (Object.keys(req.query).length > 0) {
          let query_params = req.query;

          let sig = query_params?.tweet_id || query_params?.thread_id;

          if (sig) {
            app.storage.loadTransactions(
              { sig, field1: 'RedSquare' },
              (txs) => {
                if (txs.length > 0) {
                  let tx = txs.shift();

                  tx.decryptMessage(app);

                  const returned_tweet = new Tweet(app, redsquare_self, tx);

                  let updated_social = redsquare_self.social;

                  let text = returned_tweet.text;
                  let user = app.keychain.returnUsername(tx.from[0].publicKey);

                  let url = reqBaseURL + encodeURI(redsquare_self.returnSlug());
                  let image = url + '?og_img_sig=' + sig;

                  updated_social = {
                    twitter: '@SaitoOfficial',
                    title: user + ' posted on Saito 🟥',
                    url: url,
                    description: app.browser.escapeHTML(text),
                    image: image
                  };

                  app.storage.loadTransactions(
                    {
                      field1: 'RedSquare',
                      field5: returned_tweet.thread_id,
                      flagged: 0,
                      limit: 100
                    },
                    (raw_txs) => {
                      let html = redsquareHome(
                        app,
                        redsquare_self,
                        app.build_number,
                        updated_social,
                        raw_txs
                      );
                      if (!res.finished) {
                        res.setHeader('Content-type', 'text/html');
                        res.charset = 'UTF-8';
                        return res.send(html);
                      }
                    },
                    'localhost',
                    0
                  );
                }
              },
              'localhost'
            );

            return;
          }

          if (typeof query_params.og_img_sig != 'undefined') {
            let sig = query_params.og_img_sig;

            redsquare_self.loadTweetWithSig(sig, (txs) => {
              for (let i = 0; i < txs.length; i++) {
                let tx = txs[i];
                let txmsg = tx.returnMessage();
                let img = '';
                let img_type;

                if (txmsg.data?.images?.length > 0) {
                  let img_uri = txmsg.data.images[0];
                  img_type = img_uri.substring(img_uri.indexOf(':') + 1, img_uri.indexOf(';'));
                  let base64Data = img_uri.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
                  img = Buffer.from(base64Data, 'base64');
                } else {
                  let publicKey = tx.from[0].publicKey;
                  let img_uri = app.keychain.returnIdenticon(publicKey, 'png');
                  let base64Data = img_uri.replace(/^data:image\/png;base64,/, '');
                  img = Buffer.from(base64Data, 'base64');
                  img_type = img_uri.substring(img_uri.indexOf(':') + 1, img_uri.indexOf(';'));
                }

                if (img_type == 'image/svg+xml') {
                  img_type = 'image/svg';
                }

                if (!res.finished) {
                  res.writeHead(200, {
                    'Content-Type': img_type,
                    'Content-Length': img.length
                  });
                  return res.end(img);
                }
              }
            });

            return;
          }
        }
      } catch (err) {
        console.error('RS.webServer: Loading OG data failed with error: ', err);
      }

      redsquare_self.cacheRecentTweets();

      if (!res.finished) {
        let html = redsquareHome(
          app,
          redsquare_self,
          app.build_number,
          redsquare_self.social,
          redsquare_self.cached_tweets
        );
        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        return res.send(html);
      }
      return;
    });
  }

  curate(tx) {
    let moderation_score = this.app.modules.moderate(tx, this.name);

    if (moderation_score == 1) {
      return 1;
    }
    if (moderation_score == -1) {
      return -1;
    }

    if (this.app.keychain.hasPublicKey(tx.from[0].publicKey)) {
      return 1;
    }

    if (tx.to[0].amount) {
      return 1;
    }

    if (tx.optional.curated !== undefined) {
      return tx.optional.curated;
    }

    return 0;
  }

  packTweetThread(tweet) {
    let txs = [];

    const processTX = (tweet) => {
      tweet.tx.optional.updated_at = tweet.updated_at;
      let r = tweet.tx.serialize_to_web(tweet.app);
      return r;
    };

    txs.push(processTX(tweet));

    for (let i = 0; i < tweet.children.length; i++) {
      txs = txs.concat(this.packTweetThread(tweet.children[i]));
    }

    return txs;
  }

  async dbCleanUp(earlier_than = Date.now()) {
    this.app.storage.loadTransactions(
      {
        field1: 'RedSquare',
        field5: '',
        created_earlier_than: earlier_than,
        limit: 100
      },
      async (txs) => {
        let counts = {
          total: 0,
          game: 0,
          reply: 0,
          feed: 0
        };
        for (let tx of txs) {
          let txmsg = tx.returnMessage();
          if (txmsg.request === 'create tweet') {
            let tweet = new Tweet(this.app, this, tx);

            for (let xmod of this.app.modules.respondTo('redsquare-add-tweet')) {
              tweet = xmod.respondTo('redsquare-add-tweet').processTweet(tweet);
            }

            counts.total++;
            if (tweet.game) {
              counts.game++;
            }
            if (tweet.parent_id) {
              counts.reply++;
            } else {
              counts.feed++;
            }

            this.saveTweet(tweet);
          }

          if (tx.timestamp < earlier_than) {
            earlier_than = tx.timestamp;
          }
        }

        if (txs.length) {
          console.log(
            `Batch processed: ${counts.total} transactions... ${counts.game} games, ${counts.reply} replies`
          );
          setTimeout(() => {
            this.dbCleanUp(earlier_than);
          }, 15000);
        } else {
          console.log(
            '######################## \n \n Finished !!!!!!!!!!! \n \n ###########################'
          );
        }
      },
      'localhost'
    );
  }
}

module.exports = RedSquare;
