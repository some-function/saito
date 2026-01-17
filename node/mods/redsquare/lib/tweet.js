const saito = require('./../../../lib/saito/saito');
const TweetTemplate = require('./tweet.template');
const SaitoUser = require('./../../../lib/saito/ui/saito-user/saito-user');
const Link = require('./../../../lib/saito/ui/saito-link/link');
const Image = require('./image');
const Post = require('./post');
const JSON = require('json-bigint');
const Transaction = require('../../../lib/saito/transaction').default;

class Tweet {
	constructor(app, mod, tx, container = '.tweet-container') {
		this.app = app;
		this.mod = mod;
		this.container = container;
		this.name = 'Tweet';
		this.tx = tx;

		if (!tx) {
			console.error('Creating tweet with invalid transaction', tx);
			return null;
		}

		let txmsg = tx.returnMessage();

		if (txmsg.module !== mod.name) {
			console.error('Creating tweet with invalid transaction : ', txmsg);
			return null;
		}

		if (!this.tx.optional) {
			this.tx.optional = {};
		}
		if (!this.tx.optional.num_replies) {
			this.tx.optional.num_replies = 0;
		}
		if (!this.tx.optional.num_retweets) {
			this.tx.optional.num_retweets = 0;
		}
		if (!this.tx.optional.num_likes) {
			this.tx.optional.num_likes = 0;
		}
		if (!this.tx.optional.link_properties) {
			this.tx.optional.link_properties = null;
		}
		if (!this.tx.optional.retweeters) {
			this.tx.optional.retweeters = [];
		}

		this.text = '';
		this.youtube_id = null;
		this.created_at = this.tx.timestamp;
		this.updated_at = this.tx?.updated_at || this.tx.timestamp;

		this.curated = tx.isFrom(mod.publicKey) ? 1 : 0;

		this.notice = '';

		this.user = new SaitoUser(
			app,
			mod,
			this.container + `> .tweet-${this.tx.signature} .tweet-body .tweet-header`,
			this.tx.from[0].publicKey
		);

		this.children = [];
		this.children_sigs_hmap = {};
		this.critical_child = null;
		this.force_long_tweet = false;
		this.is_long_tweet = false;
		this.link = null;
		this.parent_id = '';
		this.thread_id = this.tx.signature;
		this.render_after_selector = '';
		this.retweet = null;
		this.retweet_tx = null;
		this.show_controls = 1;
		this.unknown_children = [];
		this.unknown_children_sigs_hmap = {};
		this.user.notice = 'new post on ' + this.formatDate();
		this.tree_size = 1;

		this.reply_class = '';

		this.sources = [];

		try {
			this.setKeys(txmsg.data, true);
		} catch (err) {
			console.error('ERROR in Tweet.js (1):', err);
		}

		try {
			this.setKeys(tx.optional, true);
		} catch (err) {
			console.error('ERROR in Tweet.js (2):', err);
		}

		if (this.update_tx) {
			let newtx = new Transaction();
			newtx.deserialize_from_web(this.app, this.update_tx);
			let newtxmsg = newtx.returnMessage();
			this.text = newtxmsg.data.text;
		}

		if (this.tx.optional.num_replies > 0) {
			this.user.notice = 'originally posted on ' + this.formatDate();
		}

		this.analyseTweetLinks(0);

		if (this.retweet_tx != null) {
			let newtx = new Transaction();
			newtx.deserialize_from_web(this.app, this.retweet_tx);
			this.retweet = new Tweet(
				this.app,
				this.mod,
				newtx,
				this.container + `> .tweet-${this.tx.signature} .tweet-body .tweet-retweet`
			);
			this.retweet.show_controls = 0;
		}

		if (this.images?.length > 0) {
			this.img_preview = new Image(
				this.app,
				this.mod,
				this.container + `> .tweet-${this.tx.signature} .tweet-body .tweet-image`,
				this.images,
				this.tx.signature
			);
		}

		this.noerrors = true;
	}

	isPost() {
		let txmsg = this.tx.returnMessage();
		if (txmsg.request != 'create tweet') {
			return false;
		}
		if (this.parent_id == '') {
			return true;
		}
		return false;
	}

	isReply() {
		let txmsg = this.tx.returnMessage();
		if (txmsg.request != 'create tweet') {
			return false;
		}
		if (this.parent_id != '') {
			return true;
		}
		return false;
	}

	isRetweet() {
		let txmsg = this.tx.returnMessage();
		if (txmsg.request != 'create tweet') {
			return false;
		}
		if (!txmsg.data?.text && !txmsg.data?.images) {
			return true;
		}

		return false;
	}

	formatDate(ts = 0) {
		let submit_ts = ts || this.created_at;
		let dt = this.app.browser.formatDate(submit_ts);
		return `${dt.month} ${dt.day}, ${dt.year} at ${dt.hours}:${dt.minutes}`;
	}

	isRendered() {
		if (!this.app.BROWSER) {
			return false;
		}

		if (document.querySelector(`.tweet-container > .tweet-${this.tx.signature}`)) {
			return true;
		}
		return false;
	}

	isLoaded() {
		if (this.loaded) {
			return true;
		}

		if (this.num_replies > this.children.length) {
			return false;
		} else if (this.num_replies < this.children.length) {
			this.num_replies = this.children.length;
		}

		this.loaded = true;

		for (let i = 0; i < this.children.length; i++) {
			if (!this.children[i].isLoaded()) {
				this.loaded = false;
			}
		}

		return this.loaded;
	}

	hideTweet() {
		this.app.storage.deleteTransaction(this.tx, null, 'localhost');

		this.remove();

		this.mod.hidden_tweets.push(this.tx.signature);
		this.mod.saveOptions();

		this.curated = -1;
	}

	replace(target_tweet) {
		if (this.app.BROWSER) {
			let eqs = `.tweet-${target_tweet.tx.signature}`;
			if (document.querySelector(eqs)) {
				this.app.browser.replaceElementBySelector(
					TweetTemplate(this.app, this.mod, this, false),
					eqs
				);
				this.render();
			}
		}
	}

	remove() {
		if (!this.app.BROWSER) {
			return;
		}

		let eqs = `.tweet-${this.tx.signature}`;
		if (document.querySelector(eqs)) {
			document.querySelector(eqs).remove();
		}
		if (this.parent_id) {
			let parent = this.mod.returnTweet(this.parent_id);
			if (parent.isRendered()) {
				parent.removeReply();
			}
		}
	}

	removeReply() {
		let myqs = this.container + `> .tweet-${this.tx.signature}`;
		let obj = document.querySelector(myqs);
		if (obj) {
			obj.classList.remove(this.reply_class);
		}
		this.reply_class = '';
	}

	render(prepend = false) {
		for (let peer of this.mod.peers) {
			if (this.tx.isFrom(peer.publicKey)) {
				this.force_long_tweet = true;
			}
		}

		if (this.link_properties && !this.link_preview) {
			this.link_preview = new Link(
				this.app,
				this.mod,
				this.container + `> .tweet-${this.tx.signature} .tweet-body .tweet-link-preview`,
				this.link,
				this.link_properties
			);
		}

		let myqs = this.container + `> .tweet-${this.tx.signature}`;

		if (prepend) {
			let obj = document.querySelector(myqs);
			if (obj) {
				obj.remove();
			}
		}

		if (this.retweet_tx && !this.text && !this.img_preview) {
			this.reply_class = '';

			this.retweet.notice =
				'retweeted by ' +
				this.app.browser.returnAddressHTML(this.tx.from[0].publicKey) +
				' ' +
				this.formatDate(this.retweet_tx.timestamp);

			this.retweet.container = '.tweet-container';
			let t = this.mod.returnTweet(this.retweet.tx.signature);
			if (t) {
				t.notice = this.retweet.notice;
				t.user.notice = t.user.notice.replace('new', 'original');
				t.render(prepend);
				t.user.render();
				t.attachEvents();
			} else {
				this.retweet.user.container =
					this.container + `> .tweet-${this.retweet.tx.signature} .tweet-body .tweet-header`;
				this.retweet.user.notice = this.retweet.user.notice.replace('new', 'original');
				this.retweet.render(prepend);
				this.retweet.user.render();
				this.retweet.attachEvents();
			}
			return 0;
		}

		if (this.retweeters?.length > 0 && this.container == '.tweet-container') {
			this.notice = `retweeted by ${this.app.browser.returnAddressHTML(
				this.retweeters[0]
			)} ${this.formatDate(this.tx.optional?.retweeted_at)}`;
		}

		if (this.tx.isTo(this.mod.publicKey) && !this.tx.isFrom(this.mod.publicKey)) {
			if (this.mentions == 1 || this.mentions?.includes(this.mod.publicKey)) {
				this.notice = 'you were mentioned in this tweet';
			}
		}

		if (this.tx.optional?.update_tx) {
			this.notice =
				'this tweet was edited on ' + this.formatDate(this.tx.optional.update_tx.timestamp);
		}

		if (this.render_after_selector) {
			console.log('!!!!!!! ' + this.render_after_selector);
			if (!document.querySelector(this.render_after_selector)) {
				console.warn('!!!!!!!!! !document.querySelector(this.render_after_selector)');
				this.render_after_selector = '';
			}
			let preview_selector = '.tweet-preview ' + this.render_after_selector;
			if (document.querySelector(preview_selector)) {
				console.warn('!!!!!!!!! document.querySelector(preview_selector)');
				this.render_after_selector = '';
			}
		}

		if (document.querySelector(myqs)) {
			this.app.browser.replaceElementBySelector(TweetTemplate(this.app, this.mod, this), myqs);
		} else if (prepend) {
			this.app.browser.prependElementToSelector(
				TweetTemplate(this.app, this.mod, this),
				this.container
			);
		} else if (this.render_after_selector) {
			this.app.browser.addElementAfterSelector(
				TweetTemplate(this.app, this.mod, this),
				this.render_after_selector
			);
		} else {
			this.app.browser.addElementToSelector(
				TweetTemplate(this.app, this.mod, this),
				this.container
			);
		}

		if (this.youtube_id != null && this.youtube_id != 'null') {
			let tbqs = myqs + ' .tweet-body .tweet-text';
			let ytqs = myqs + ' .tweet-body .tweet-text .youtube-embed';
			if (document.querySelector(tbqs)) {
				let x = document.querySelector(tbqs).getBoundingClientRect();
				let y = document.querySelector(ytqs);
				if (x) {
					if (y) {
						y.style.width = Math.floor(x.width) + 'px';
						y.style.height = Math.floor((x.width / 16) * 9) + 'px';
					}
				}
			}
		}

		this.user.render();

		if (this.img_preview != null) {
			this.img_preview.render();
		}

		if (this.retweet) {
			this.retweet.render();
		}
		if (this.link_preview != null) {
			if (this.tx.optional.link_properties != null) {
				if (Object.keys(this.tx.optional.link_properties).length > 0) {
					this.link_preview.render();
				}
			}
		}

		this.attachEvents();

		return 1;
	}

	rerenderControls(complete_rerender = false) {
		if (!this.app.BROWSER || !this.mod.browser_active) {
			return;
		}
		if (!this.isRendered()) {
			return;
		}

		this.setKeys(this.tx.optional);

		if (complete_rerender) {
			this.render();
		} else {
			let rep = this.num_replies;

			if (this.rethread) {
				rep += this.tree_size - 1;
			}

			this.refreshStat('like', this.num_likes);
			this.refreshStat('retweet', this.num_retweets);
			this.refreshStat('comment', rep);
		}
	}

	forceRenderWithCriticalChild() {
		if (this.critical_child) {
			if (this.critical_child.parent_id == this.tx.signature) {
				this.reply_class = 'has-reply';
			} else {
				this.reply_class = 'has-reply-disconnected';
			}

			this.render();

			this.critical_child.render_after_selector = '.tweet-' + this.tx.signature;
			this.critical_child.reply_class = '';

			if (this.critical_child.render() == -1) {
				this.removeReply();
			}
		} else {
			this.render();
		}

		this.attachEvents();
	}

	renderWithCriticalChild() {
		if (this.isRendered()) {
			return;
		}

		if (this.critical_child && !this.critical_child.isRendered()) {
			if (this.critical_child.parent_id == this.tx.signature) {
				this.reply_class = 'has-reply';
			} else {
				this.reply_class = 'has-reply-disconnected';
			}

			this.render();

			this.critical_child.render_after_selector = '.tweet-' + this.tx.signature;
			this.critical_child.reply_class = '';

			if (this.critical_child.render() > 0) {
				if (this.tx.optional.num_replies == 0) {
					let obj = document.querySelector(
						`.tweet-${this.tx.signature} .tweet-controls .tweet-tool-comment .tweet-tool-comment-count`
					);
					try {
						if (obj) {
							obj.innerHTML = '1';
						}
					} catch (err) {
						console.error('RS.tweet ERROR: ', err);
					}
				}
			}
		} else {
			this.render();
		}

		this.attachEvents();
	}

	renderWithChildren(recurse = true) {
		console.debug('renderWithChildren');

		if (this.children.length == 1 && recurse) {
			this.reply_class = 'has-reply';
		}

		this.render();

		if (this.children.length > 0) {
			if (this.children.length > 1 || !recurse) {
				for (let i = 0; i < this.children.length; i++) {
					this.children[i].container = this.container;
					this.children[i].render_after_selector = `.tweet-${this.tx.signature}`;
					this.children[i].renderChild();
				}
			} else {
				this.children[0].container = this.container;
				this.children[0].render_after_selector = `.tweet-${this.tx.signature}`;
				this.children[0].renderWithChildren();
			}
		}

		this.attachEvents();
	}

	renderNullTweet() {
		let html = `<div class="tweet tweet-${this.tx.signature} is-reply null-tweet">
          <div class="tweet-body">
            <div class="tweet-text">filtered tweet not shown</div>
          </div>
        </div>`;

		this.app.browser.addElementAfterSelector(html, this.render_after_selector);
	}

	renderChild() {
		this.reply_class = 'is-reply';

		if (this.render() == -1) {
			this.renderNullTweet();
		}
	}

	renderWithChildrenWithTweet(tweet, sigs = []) {
		if (!tweet) {
			console.warn('no tweet!');
			return -1;
		}

		if (sigs.includes(this.tx.signature)) {
			this.force_long_tweet = true;

			if (this.tx.signature == tweet.tx.signature) {
				this.renderWithChildren();
			} else {
				if (this.children.length) {
					this.reply_class = 'has-reply';
				}

				this.render();

				if (this.children.length > 0) {
					for (let i = 0; i < this.children.length; i++) {
						this.children[i].container = this.container;
						this.children[i].render_after_selector = `.tweet-${this.tx.signature}`;

						if (sigs.includes(this.children[i].tx.signature)) {
							this.children[i].renderWithChildrenWithTweet(tweet, sigs);
						}
					}
				}
			}

			this.attachEvents();
		} else {
			console.warn('this tweet not in the thread sigs....');
			console.log(sigs);
		}
	}

	attachEvents() {
		let mod = this.mod;
		let app = this.app;

		if (this.show_controls == 0 && !this.rethread) {
			return;
		}

		try {
			let this_tweet = document.querySelector(`.tweet-${this.tx.signature}`);

			if (!this_tweet) {
				return;
			}

			let tweet_text = document.querySelector(
				`.tweet-${this.tx.signature} .tweet-body .tweet-text`
			);
			if (tweet_text) {
				if (this.force_long_tweet) {
					tweet_text.classList.add('expanded');
				} else {
					if (tweet_text.clientHeight < tweet_text.scrollHeight - 1) {
						tweet_text.classList.add('preview');
						this.is_long_tweet = true;
					}
				}
			}

			if (document.querySelector(`.tweet-${this.tx.signature} .tweet-curation-controls`)) {
				if (
					document.querySelector(`.tweet-${this.tx.signature} .tweet-curation-controls #hide-spam`)
				) {
					document.querySelector(
						`.tweet-${this.tx.signature} .tweet-curation-controls #hide-spam`
					).onclick = (e) => {
						e.stopPropagation();
						this.hideTweet();
						siteMessage('Thank you for your feedback!', 3000);
					};
				}

				if (
					document.querySelector(
						`.tweet-${this.tx.signature} .tweet-curation-controls #approve-tweet`
					)
				) {
					document.querySelector(
						`.tweet-${this.tx.signature} .tweet-curation-controls #approve-tweet`
					).onclick = (e) => {
						e.stopPropagation();
						this.curation_check = this.tx.optional.curation_check = false;
						this.tx.optional.curated = 1;
						this.mod.saveTweet(this);
						this.rerenderControls(true);
						siteMessage('Thank you for your feedback!', 3000);
					};
				}

				if (
					document.querySelector(
						`.tweet-${this.tx.signature} .tweet-curation-controls #approve-user`
					)
				) {
					document.querySelector(
						`.tweet-${this.tx.signature} .tweet-curation-controls #approve-user`
					).onclick = (e) => {
						e.stopPropagation();
						this.curation_check = this.tx.optional.curation_check = false;
						this.tx.optional.curated = 1;
						this.mod.saveTweet(this);
						this.rerenderControls(true);
						siteMessage('Thank you for your feedback!', 3000);
					};
				}
			}

			if (!this_tweet.dataset.hasClickEvent) {
				this_tweet.dataset.hasClickEvent = true;

				this_tweet.onclick = (e) => {
					let highlightedText = '';
					if (window.getSelection) {
						highlightedText = window.getSelection().toString();
					} else if (document.selection && document.selection.type != 'Control') {
						highlightedText = document.selection.createRange().text;
					}
					if (highlightedText != '') {
						console.log("highlighting text, don't open thread");
						return;
					}

					if (this.is_long_tweet && tweet_text?.classList.contains('preview')) {
						tweet_text.classList.remove('preview');
						tweet_text.classList.add('expanded');
						this.force_long_tweet = true;
						console.log('expanding long tweet');
						return;
					}

					if (this.curation_check) {
						console.log('curation check tweet');
						return;
					}

					if (e.target.tagName != 'IMG') {
						if (!this.thread_sigs) {
							this.thread_sigs = this.mod.returnThreadSigs(this.tx.signature);
						}

						if (
							this.thread_sigs.includes(this.tx.signature) &&
							this.thread_sigs.includes(this.thread_id)
						) {
							app.connection.emit('redsquare-tweet-render-request', this);
						} else {
							navigateWindow(`/redsquare?tweet_id=${this.thread_id}`, 300);
						}
					}
				};
			}

			document.querySelectorAll(`.tweet-${this.tx.signature} .tweet`).forEach((item) => {
				item.addEventListener('click', (e) => {
					e.stopImmediatePropagation();
					let sig = item.getAttribute('data-id');
					if (e.target.tagName != 'IMG' && sig) {
						let t = this.mod.returnTweet(sig);
						if (t) {
							app.connection.emit('redsquare-tweet-render-request', t);
						} else {
							console.warn('RS.tweet -- This is going to screw up the feed');
							app.connection.emit('redsquare-tweet-render-request', this.retweet);
						}
					}
				});
			});

			let reply = document.querySelector(
				`.tweet-${this.tx.signature} .tweet-body .tweet-controls .tweet-tool-comment`
			);
			if (reply) {
				reply.onclick = (e) => {
					e.preventDefault();
					e.stopImmediatePropagation();

					let post = new Post(this.app, this.mod, this);
					post.type = 'Reply';
					post.render();
					this.app.browser.prependElementToSelector(
						`<div id="post-tweet-preview-${this.tx.signature}" class="post-tweet-preview" data-id="${this.tx.signature}"></div>`,
						'.saito-overlay .tweet-overlay'
					);

					let newtx = new Transaction(undefined, this.tx.toJson());
					newtx.signature =
						this.app.crypto.hash(this.tx.signature) + this.app.crypto.hash(this.tx.signature);

					let new_tweet = new Tweet(this.app, this.mod, newtx, `#post-tweet-preview-${this.tx.signature}`);
					new_tweet.show_controls = 0;
					new_tweet.render();
					document.querySelector('#post-tweet-textarea').focus();
				};
			}

			let retweet = document.querySelector(`.tweet-${this.tx.signature} .tweet-body .tweet-controls .tweet-tool-retweet`);

			if (retweet) {
				retweet.onclick = (e) => {
					e.preventDefault();
					e.stopImmediatePropagation();

					let post = new Post(this.app, this.mod, this);
					post.type = 'Retweet';
					post.render();

					this.app.browser.prependElementToSelector(
						`<div id="post-tweet-preview-${this.tx.signature}" class="post-tweet-preview" data-id="${this.tx.signature}"></div>`,
						'.saito-overlay .tweet-overlay'
					);

					let newtx = new Transaction(undefined, this.tx.toJson());
					newtx.signature =
						this.app.crypto.hash(this.tx.signature) + this.app.crypto.hash(this.tx.signature);

					let new_tweet = new Tweet(this.app, this.mod, newtx, `#post-tweet-preview-${this.tx.signature}`);
					new_tweet.show_controls = 0;
					new_tweet.render();
				};
			}

			const heartIcon = document.querySelector(`.tweet-${this.tx.signature} .heart-icon`);
			if (heartIcon) {
				heartIcon.onclick = async (e) => {
					if (!heartIcon.classList.contains('liked')) {
						heartIcon.classList.add('likes');
						this.mod.likeTweet(this);
					}

					e.preventDefault();
					e.stopImmediatePropagation();

					await this.mod.sendLikeTransaction(this.app, this.mod, {signature: this.tx.signature}, this.tx);

					let obj = document.querySelector(
						`.tweet-${this.tx.signature} .tweet-body .tweet-controls .tweet-tool-like .tweet-tool-like-count`
					);
					if (obj) {
						obj.innerHTML = parseInt(obj.innerHTML) + 1;
						if (!obj.classList.contains('liked')) {
							obj.classList.add('liked');
						}
					}
				};
			}

			let share = document.querySelector(
				`.tweet-${this.tx.signature} .tweet-body .tweet-controls .tweet-tool-share`
			);
			if (share) {
				share.onclick = (e) => {
					e.preventDefault();
					e.stopImmediatePropagation();

					let tweetUrl =
						window.location.origin + window.location.pathname + '?tweet_id=' + this.tx.signature;
					navigator.clipboard.writeText(tweetUrl).then(() => {
						siteMessage('Link copied to clipboard.', 2000);
					});
				};
			}

			let more = document.querySelector(
				`.tweet-${this.tx.signature} .tweet-body .tweet-controls .tweet-tool-more`
			);
			if (more) {
				more.onclick = (e) => {
					e.preventDefault();
					e.stopImmediatePropagation();
					e.currentTarget.classList.add('activated-dot-menu');
					this.app.connection.emit('redsquare-show-tweet-options', this, more);
				};
			}

			if (document.querySelector(`.tweet-${this.tx.signature} .tweet-body .tweet-controls`)) {
				document.querySelector(`.tweet-${this.tx.signature} .tweet-body .tweet-controls`).onclick =
					(e) => {
						e.stopPropagation();
						e.preventDefault();
					};
			}
		} catch (err) {
			console.error('RS.Tweet -- ERROR attaching events to tweet: ', err);
		}
	}

	setKeys(obj, force = false) {
		for (let key in obj) {
			if (typeof obj[key] !== 'undefined') {
				if (typeof this[key] === 'number') {
					this[key] = Math.max(this[key], obj[key]);
				} else if (!this[key] || force) {
					this[key] = obj[key];
				}
			}
		}
	}

	addTweet(tweet) {
		this.tree_size++;

		this.updated_at = Math.max(this.updated_at, tweet.updated_at);

		for (let i = 0; i < this.unknown_children.length; i++) {
			if (this.unknown_children[i].parent_id === tweet.tx.signature) {
				tweet.addTweet(this.unknown_children[i]);
				this.removeUnknownChild(this.unknown_children[i]);
			}
		}

		if (tweet.parent_id == this.tx.signature) {
			if (this.children_sigs_hmap[tweet.tx.signature]) {
				return 0;
			}

			this.children_sigs_hmap[tweet.tx.signature] == 1;
			this.removeUnknownChild(tweet);

			if (this.isCriticalChild(tweet)) {
				this.critical_child = tweet;
			}

			if (!tweet.rethread) {
				tweet.user.notice = 'new reply on ' + this.formatDate(tweet.created_at);
			}

			if (tweet.tx.from[0].publicKey === this.tx.from[0].publicKey) {
				this.children.unshift(tweet);
			} else {
				this.children.push(tweet);
			}

			return 1;
		} else {
			for (let i = 0; i < this.children.length; i++) {
				if (this.children[i].hasChildTweet(tweet.parent_id)) {
					this.children[i].addTweet(tweet);
					this.children_sigs_hmap[tweet.tx.signature] = 1;
					this.removeUnknownChild(tweet);

					return 1;
				}
			}

			this.addUnknownChild(tweet);
		}

		return 1;
	}

	hasChildTweet(tweet_sig) {
		if (this.tx.signature == tweet_sig) {
			return 1;
		}
		for (let i = 0; i < this.children.length; i++) {
			if (this.children[i].hasChildTweet(tweet_sig)) {
				return 1;
			}
		}
		return this.unknown_children_sigs_hmap[tweet_sig];
	}

	returnChildTweet(tweet_sig) {
		if (this.tx.signature == tweet_sig) {
			return this;
		}
		for (let i = 0; i < this.children.length; i++) {
			if (this.children[i].hasChildTweet(tweet_sig)) {
				return this.children[i].returnChildTweet(tweet_sig);
			}
		}

		if (this.unknown_children_sigs_hmap[tweet_sig]) {
			for (let i = 0; i < this.unknown_children.length; i++) {
				if (this.unknown_children[i].tx.signature == tweet_sig) {
					return this.unknown_children[i];
				}
			}
		}

		return null;
	}

	removeChildTweet(tweet_sig) {
		for (let i = 0; i < this.children.length; i++) {
			if (this.children[i].tx.signature === tweet_sig) {
				this.children[i].remove();
				this.children.splice(i, 1);
				this.children_sigs_hmap[tweet_sig] = 0;
				return;
			}
		}

		if (this.unknown_children_sigs_hmap[tweet_sig]) {
			for (let i = 0; i < this.unknown_children.length; i++) {
				if (this.unknown_children[i].tx.signature == tweet_sig) {
					this.unknown_children[i].remove();
					this.unknown_children.splice(i, 1);
					this.unknown_children_sigs_hmap[tweet_sig] = 0;
					return;
				}
			}
		}

		for (let i = 0; i < this.children.length; i++) {
			if (this.children[i].hasChildTweet(tweet_sig)) {
				this.children[i].removeChildTweet(tweet_sig);
			}
		}
	}

	addUnknownChild(tweet) {
		if (!this.unknown_children_sigs_hmap[tweet.tx.signature]) {
			this.unknown_children.push(tweet);
			this.unknown_children_sigs_hmap[tweet.tx.signature] = 1;
		}
	}

	removeUnknownChild(tweet) {
		if (this.unknown_children_sigs_hmap[tweet.tx.signature]) {
			for (let i = 0; i < this.unknown_children.length; i++) {
				if (this.unknown_children[i].tx.signature === tweet.tx.signature) {
					this.unknown_children.splice(i, 0);
					delete this.unknown_children_sigs_hmap[tweet.tx.signature];
				}
			}
		}
	}

	isCriticalChild(tweet) {
		if (tweet.rethread) {
			return false;
		}
		for (let peer of this.mod.peers) {
			if (tweet.tx.isFrom(peer.publicKey)) {
				if (peer.publicKey == this.mod.publicKey) {
					return true;
				} else {
					return false;
				}
			}
		}

		if (tweet.thread_id !== this.thread_id) {
			return false;
		}
		if (this.critical_child == null) {
			return true;
		}
		if (tweet.tx.isFrom(this.mod.publicKey)) {
			return true;
		}
		if (
			tweet.tx.timestamp > this.critical_child.tx.timestamp &&
			!this.critical_child.tx.isFrom(this.mod.publicKey)
		) {
			return true;
		}
		return false;
	}

	async analyseTweetLinks(fetch_open_graph = 0) {
		if (!this.text) {
			return this;
		}

		this.link = this.app.browser.extractFirstValidURL(this.text);

		if (this.link) {
			if (this.link.indexOf('youtube.com') != -1 || this.link.indexOf('youtu.be') != -1) {
				let videoId = '';

				if (this.link.indexOf('youtu.be') != -1) {
					videoId = this.link.split('/');
					videoId = videoId[videoId.length - 1];
				} else {
					let url = new URL(this.link);
					let urlParams = new URLSearchParams(url.search);

					if (urlParams) {
						videoId = urlParams.get('v');
					}
				}

				let split = this.link.split('/shorts/');
				if (typeof split[1] != 'undefined') {
					videoId = split[1];
				}

				split = this.link.split('/live/');
				if (typeof split[1] != 'undefined') {
					videoId = split[1];
				}

				if (videoId != null && videoId != 'null') {
					this.youtube_id = videoId;
				}
				return this;
			}

			if (!this.app.BROWSER) {
				if (fetch_open_graph == 1 || !this.tx.optional?.link_properties) {
					let res = await this.app.server.fetchOpenGraphProperties(this.link);
					if (res !== '') {
						this.tx.optional.link_properties = res;
						this.mod.updateSavedTweet(this.tx.signature);
					}
				}
			}
		}

		return this;
	}

	refreshStat(stat, newCount) {
		try {
			let qs = `.tweet-${this.tx.signature} .tweet-body .tweet-controls .tweet-tool-${stat} .tweet-tool-${stat}-count`;
			Array.from(document.querySelectorAll(qs)).forEach((obj) => {
				obj.innerHTML = newCount;
			});
		} catch (err) {
			console.error(`RS.Tweet -- Stat ERROR: ` + err);
		}
	}

	editTweet() {
		let post = new Post(this.app, this.mod, this);
		post.type = 'Edit';
		post.render();
	}

	deleteTweet() {
		let post = new Post(this.app, this.mod, this);
		post.deleteTweet();
	}
}

module.exports = Tweet;