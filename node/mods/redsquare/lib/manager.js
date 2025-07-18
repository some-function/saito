const Tweet = require('./tweet');
const Post = require('./post');
const Notification = require('./notification');
const SaitoProfile = require('./../../../lib/saito/ui/saito-profile/saito-profile');
const SaitoLoader = require('./../../../lib/saito/ui/saito-loader/saito-loader');

class TweetManager {
	constructor(app, mod, container = '.saito-main') {
		this.app = app;
		this.mod = mod;
		this.container = container;

		this.mode = 'tweets';
		this.just_fetched_tweets = false;

		this.profile_tweets = {};
		this.profile = new SaitoProfile(app, mod, '.saito-main');
		this.profile.tab_container = '.tweet-container';
		this.profile_tabs = ['posts', 'replies', /*'retweets',*/ 'likes'];
		this.profile.reset(this.mod.publicKey, 'posts', this.profile_tabs);

		//This is an in-place loader... not super useful when content is overflowing off the bottom of the screen
		this.loader = new SaitoLoader(app, mod, '#redsquare-intersection');

		this.app.connection.on('redsquare-render-new-post', (tweettx, rparent = null) => {
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

		//////////////////////////////
		// load more on scroll-down //
		//////////////////////////////
		this.intersectionObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						document.getElementById('intersection-observer-trigger').classList.add('deactivated');
						this.intersectionObserver.disconnect();

						if (this.mode === 'tweet' || this.mode == 'loading') {
							return;
						}

						this.showLoader();

						//
						// load more tweets -- from local and remote sources
						//
						if (this.mode === 'tweets') {
							this.moreTweets();
						}

						//
						// load more notifications
						//
						if (this.mode === 'notifications') {
							this.moreNotifications();
						}

						/////////////////////////////////////////////////
						//
						// So right now, we are fetching earlier stuff from the intersection observer
						// We will fetch the 100 most recent tweets/likes, so we'll see if people start complaining
						// about not having enough history available
						//
						//////////////////////////////////////////////////

						if (this.mode === 'profile') {
							this.loadProfile((txs) => {
								if (this.mode !== 'profile') {
									return;
								}

								this.hideLoader();

								// Sort txs into posts/replies/retweets...
								this.filterAndRenderProfile(txs);

								this.profile.render();
							});
						}
					}
				});
			},
			{
				root: null,
				threshold: 1
			}
		);
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

	render(mode = this.mode, data = null) {
		let mainElem = document.querySelector('.tweet-container');
		let holderElem = document.querySelector('.tweet-thread-holder');

		let publickey = '';
		let tweet = '';

		if (mode === 'profile' && data != null) {
			publickey = data;
		}
		if (mode === 'tweet' && data != null) {
			tweet = data;
		}

		//
		// Keep sidebar highlight in sync with the current view
		//
		this.app.connection.emit('redsquare-clear-menu-highlighting', mode);

		if (document.querySelector('.highlight-tweet')) {
			document.querySelector('.highlight-tweet').classList.remove('highlight-tweet');
		}

		//
		// turn off infinite scroll
		//
		document.getElementById('intersection-observer-trigger').classList.add('deactivated');
		this.intersectionObserver.disconnect();

		//
		// no longer new!
		//
		this.just_fetched_tweets = false;

		//
		// remove profile (if preesnt)
		//
		this.profile.remove();

		//
		// view tweets
		//
		if (mode === 'tweets') {
			if (this.mode !== 'tweets') {
				mainElem.replaceChildren(...holderElem.children);
			} else {
				//
				// render list of tweets with critical child
				//
				for (let tweet of this.mod.tweets) {
					if (!tweet.isRendered()) {
						tweet.renderWithCriticalChild();
					}
				}
			}
			this.attachEvents();
			this.mode = mode;
			return;
		}

		//
		// backup tweets into hidden div before nevigating away
		// (this is to speed up navigation by keeping downloaded images in the browser)
		//
		holderElem.replaceChildren(...mainElem.children);

		//
		// render tweet (thread)
		//
		if (mode === 'tweet') {
			if (tweet != null) {
				this.renderTweet(tweet);
			}
		}

		//
		// render notification
		//
		if (mode === 'notifications') {
			if (this.mod.notifications.length > 0) {
				for (let i = 0; i < this.mod.notifications.length; i++) {
					let notification = new Notification(this.app, this.mod, this.mod.notifications[i]);
					notification.render('.tweet-container');
				}
			}
		}

		//
		// render profile
		//
		if (mode === 'profile') {
			if (publickey != this.profile.publicKey) {
				this.profile_tweets[this.profile.publicKey] = this.profile.menu;
				this.profile.reset(publickey, 'posts', this.profile_tabs);
			}

			this.loader.show();

			if (this.profile_tweets[publickey]) {
				this.profile.menu = this.profile_tweets[publickey];
			}

			this.profile.render();

			for (let peer of this.mod.peers) {
				peer.profile_ts = new Date().getTime();
			}

			this.loadProfile((txs) => {
				this.filterAndRenderProfile(txs);
				this.profile.render();
				this.hideLoader();
			});
		}

		this.attachEvents();
		this.mode = mode;
	}

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
				if (document.querySelector('#intersection-observer-trigger')) {
					document.getElementById('intersection-observer-trigger').classList.add('deactivated');
					this.intersectionObserver.disconnect();
				}

				if (this.mod.notifications.length == 0) {
					//Dummy "Notification" for end of history sign
					let notification = new Notification(this.app, this.mod, null);
					notification.render('.tweet-container');
				}

				setTimeout(() => {
					this.hideLoader();
				}, 50);
			} else {
				this.attachEvents();
			}
		});
	}

	moreTweets() {
		if (this.just_fetched_tweets == true) {
			return;
		}

		this.just_fetched_tweets = true;

		this.numActivePeers = this.mod.loadTweets('earlier', this.insertOlderTweets.bind(this));

		if (!this.numActivePeers) {
			this.mod.tweets_earliest_ts--;
			numActivePeers = this.mod.loadTweets('earlier', this.insertOlderTweets.bind(this));
			if (numActivePeers == 0 || this.mod.tweets_earliest_ts <= 0) {
				this.insertOlderTweets(-1);
			}
		}
	}

	insertOlderTweets(tx_count, peer = null) {
		this.numActivePeers--;

		if (this.mode !== 'tweets') {
			return;
		}

		for (let tweet of this.mod.tweets) {
			if (!tweet.isRendered()) {
				tweet.renderWithCriticalChild();
			}
		}

		if (tx_count == -1) {
			this.hideLoader();
			document.getElementById('intersection-observer-trigger').classList.add('deactivated');
			this.intersectionObserver.disconnect();
		} else {
			this.just_fetched_tweets = false;
			document.getElementById('intersection-observer-trigger').classList.remove('deactivated');
			this.intersectionObserver.observe(document.getElementById('intersection-observer-trigger'));
		}

		if (this.numActivePeers == 0 && tx_count > 0) {
			this.hideLoader();
		}
	}

	//
	// fetch profile tweets as needed
	//
	async loadProfile(mycallback) {
		if (this.mod.publicKey == this.profile.publicKey) {
			// Find likes...
			// I already have a list of tweets I liked available
			this.loadProfileLikes(this.mod.liked_tweets, 'localhost');
		} else {
			await this.app.storage.loadTransactions(
				{ field1: 'RedSquareLike', field2: this.profile.publicKey },
				(txs) => {
					let liked_tweets = [];
					for (tx of txs) {
						let txmsg = tx.returnMessage();

						let sig = txmsg?.data?.signature;
						if (sig && !liked_tweets.includes(sig)) {
							liked_tweets.push(sig);
						}
					}

					this.loadProfileLikes(liked_tweets, null);
				},
				null
			);
		}

		let np = this.mod.peers.length;
		if (np > 1) {
			siteMessage(`Checking with ${np} peers for profile tweets...`, 1000);
		} else {
			this.showLoader();
		}

		for (let peer of this.mod.peers) {
			await this.app.storage.loadTransactions(
				{
					field1: 'RedSquare',
					field2: this.profile.publicKey,
					limit: 100,
					created_earlier_than: peer.profile_ts
				},
				(txs) => {
					if (mycallback) {
						mycallback(txs);
					}

					//
					// Don't use processTweetsFromPeer(peer, txs)
					// because it updates the global timestamps and caches tweets in our local storage
					//
					for (let z = 0; z < txs.length; z++) {
						txs[z].decryptMessage(this.app);
						//this.mod.addTweet(txs[z], {type: "profile", node: peer.publicKey});
						peer.profile_ts = txs[z]?.timestamp;
					}

					if (txs.length == 100) {
						document
							.getElementById('intersection-observer-trigger')
							.classList.remove('deactivated');
						this.intersectionObserver.observe(
							document.getElementById('intersection-observer-trigger')
						);
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

		let likes_to_load = list_of_liked_tweet_sigs.length;

		for (let sig of list_of_liked_tweet_sigs) {
			//
			// We may already have the liked tweet in memory
			//
			let old_tweet = this.mod.returnTweet(sig);
			if (old_tweet) {
				likes_to_load--;
				this.insertTweetIntoList(old_tweet, this.profile.menu.likes);
				if (likes_to_load == 0) {
					this.app.connection.emit(
						'update-profile-stats',
						'likes',
						list_of_liked_tweet_sigs.length
					);
				}
			} else {
				//
				// Otherwise, we gotta hit up the archive
				//
				this.app.storage.loadTransactions(
					{ field1: 'RedSquare', sig },
					(txs) => {
						likes_to_load--;
						for (let z = 0; z < txs.length; z++) {
							let tweet = new Tweet(this.app, this.mod, txs[z]);
							this.insertTweetIntoList(tweet, this.profile.menu.likes);
						}
						if (likes_to_load == 0) {
							this.app.connection.emit(
								'update-profile-stats',
								'likes',
								list_of_liked_tweet_sigs.length
							);
						}
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

	filterAndRenderProfile(txs) {
		for (let z = 0; z < txs.length; z++) {
			let tweet = new Tweet(this.app, this.mod, txs[z]);
			if (tweet?.noerrors) {
				if (tweet.isRetweet()) {
					this.insertTweetIntoList(tweet, this.profile.menu.retweets);
					return;
				}
				if (tweet.isPost()) {
					this.insertTweetIntoList(tweet, this.profile.menu.posts);
				}
				if (tweet.isReply()) {
					this.insertTweetIntoList(tweet, this.profile.menu.replies);
				}
			}
		}
	}

	//
	// this renders a tweet, loads all of its available children and adds them to the page
	// as they appear...
	//
	renderTweet(tweet) {
		//
		// make sure visible
		//
		tweet.curated = 1;

		//
		// get thread id
		//
		let thread_id = tweet.thread_id || tweet.parent_id || tweet.tx.signature;

		//
		// remove tweets - TODO holder
		//
		document.querySelector('.tweet-container').innerHTML = '';

		//
		// show our tweet
		//
		if (!tweet.parent_id) {
			tweet.renderWithChildren(true, true);
		} else {
			let root_tweet = this.mod.returnTweet(thread_id);
			if (root_tweet) {
				root_tweet.renderWithChildrenWithTweet(tweet, [], true);
			}
		}

		if (document.querySelector(`.tweet-${tweet.tx.signature}`)) {
			document.querySelector(`.tweet-${tweet.tx.signature}`).classList.add('highlight-tweet');
		}

		if (thread_id !== this?.thread_id) {
			this.thread_id = thread_id;
			this.showLoader();

			this.mod.loadTweetThread(thread_id, () => {
				//
				// This will catch you navigating back to the main feed before the callback completes
				//
				if (this.mode === 'tweet' && this.thread_id === thread_id) {
					let root_tweet = this.mod.returnTweet(thread_id);

					if (root_tweet) {
						root_tweet.renderWithChildrenWithTweet(tweet, [], true);
					}

					if (document.querySelector(`.tweet-${tweet.tx.signature}`)) {
						document.querySelector(`.tweet-${tweet.tx.signature}`).classList.add('highlight-tweet');

						if (!this.app.browser.isMobileBrowser()) {
							let post = new Post(this.app, this.mod, tweet);
							post.parent_id = tweet.tx.signature;
							post.thread_id = tweet.thread_id;

							post.type = 'Reply';

							post.render(`.tweet-${tweet.tx.signature}`);
						}
					}
				}

				this.hideLoader();
			});
		} else {
			if (document.querySelector(`.tweet-${tweet.tx.signature}`)) {
				document.querySelector(`.tweet-${tweet.tx.signature}`).classList.add('highlight-tweet');

				if (!this.app.browser.isMobileBrowser()) {
					let post = new Post(this.app, this.mod, tweet);
					post.parent_id = tweet.tx.signature;
					post.thread_id = tweet.thread_id;

					post.type = 'Reply';

					post.render(`.tweet-${tweet.tx.signature}`);
				}
			}
		}
	}

	attachEvents() {
		//
		// dynamic content loading
		//
		setTimeout(() => {
			this.hideLoader();
		}, 500);

		let ob = document.getElementById('intersection-observer-trigger');

		if (ob) {
			ob.classList.remove('deactivated');
			this.intersectionObserver.observe(ob);
		}

		if (document.getElementById('curated')) {
			// for you
			document.getElementById('curated').onclick = (e) => {
				e.currentTarget.classList.add('active');
				document.getElementById('everything').classList.remove('active');
				document.querySelector('.tweet-container').classList.add('active-curation');
				this.mod.curated = true;
				this.mod.saveOptions();
			};
		}
		if (document.getElementById('everything')) {
			// everything
			document.getElementById('everything').onclick = (e) => {
				e.currentTarget.classList.add('active');
				document.getElementById('curated').classList.remove('active');
				document.querySelector('.tweet-container').classList.remove('active-curation');
				this.mod.curated = false;
				this.mod.saveOptions();
			};
		}
	}

	showLoader() {
		this.loader.show();
	}

	hideLoader() {
		this.loader.hide();
	}
}

module.exports = TweetManager;
