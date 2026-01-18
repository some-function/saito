const SaitoUser = require('./../../../lib/saito/ui/saito-user/saito-user');
const PostTemplate = require('./post.template');
const SaitoOverlay = require('./../../../lib/saito/ui/saito-overlay/saito-overlay');
const SaitoLoader = require('./../../../lib/saito/ui/saito-loader/saito-loader');


class Post {
	constructor(app, mod, tweet = null) {
		this.app = app;
		this.mod = mod;
		this.overlay = new SaitoOverlay(this.app, this.mod, true, true, false);
		this.images = [];
		this.tweet = tweet;
		this.loader = new SaitoLoader(app, mod);
		this.render_after_submit = 0;
		this.file_event_added = false;
		this.type = 'Post';
	}

	render(container = '') {
		this.container = container ? '.tweet-container ' : '.saito-overlay ';
		this.id = container ? 'tweet-overlay-embedded' : 'tweet-overlay';

		if (container) {
			if (document.getElementById(this.id)) {
				this.app.browser.replaceElementById(PostTemplate(this.app, this.mod, this), this.id);
			} else {
				this.app.browser.addElementAfterSelector(PostTemplate(this.app, this.mod, this), container);
			}
		} else {
			this.overlay.show(PostTemplate(this.app, this.mod, this));
		}

		if (!this.user) {
			this.user = new SaitoUser(
				this.app,
				this.mod,
				this.container + `.tweet-overlay-header`,
				this.mod.publicKey,
				`create a text-tweet${
					this.app.browser.isMobileBrowser() ? '' : ' or drag-and-drop images'
				}...`
			);
		}

		this.user.render();

		if (this.type == 'Edit') {
			document.querySelector(this.container + '.post-tweet-textarea').innerHTML = this.tweet.text;
		}

		this.attachEvents();
	}

	triggerClick(querySelector) {
		if (document.querySelector(querySelector)) {
			document.querySelector(querySelector).click();
		}
	}

	attachEvents() {
		let post_self = this;
		post_self.images = [];

		if (post_self.file_event_added == false) {
			post_self.app.browser.addDragAndDropFileUploadToElement(
				this.id,
				post_self.input.callbackOnUpload,
				false
			);
			post_self.file_event_added = true;
		}

		if (document.querySelector(this.container + '.saito-file-uploader')) {
			document.querySelector(this.container + '.saito-file-uploader').style.display = 'none';
		}

		try {
			document
				.querySelector(this.container + '#post-tweet-button')
				.addEventListener('click', (e) => {
					this.postTweet();
				});
		} catch (err) {}
	}

	async deleteTweet() {
		let keys = [];
		if (this?.tweet?.tx) {
			for (let i = 0; i < this.tweet.tx.to.length; i++) {
				if (!keys.includes(this.tweet.tx.to[i].publicKey)) {
					keys.push(this.tweet.tx.to[i].publicKey);
				}
			}
		}

		this.overlay.remove();

		data = { tweet_id: this.tweet.tx.signature };
		this.tweet.remove();
		let newtx = await this.mod.sendDeleteTransaction(this.app, this.mod, data, keys);
	}

	async postTweet(check_length = true) {
		let post_self = this;
		let text = this.input.getInput(false);

		let keys = [];
		let identifiers = [];

		if (this.images.length == 0 && text.trim().length == 0 && this.type != 'Retweet') {
			siteMessage('Post Empty', 1000);
			return;
		}

		if (check_length && text.length > 500) {
			let wallet_balance = await this.app.wallet.getBalance('SAITO');

			if (Number(wallet_balance) == 0) {
				siteMessage('Insufficient SAITO to Enable Oversized Posts...', 3000);
				return;
			}

			if (text.length > 1500) {
				let alternates = this.app.modules.returnModulesRespondingTo('post-content');
				if (alternates.length > 1) {
					let image = this.images.length ? this.images[0] : null;
					this.app.connection.emit('choose-post-location', text, image, alternates);
					this.app.connection.on('continue-with-redsquare', () => {
						this.app.connection.removeAllListeners('continue-with-redsquare');
						this.postTweet(false);
					});
					this.overlay.hide();
					return;
				}
			}
		}

		let data = { text: text };

		keys = this.input.getMentions();

		if (keys.length > 0) {
			data['mentions'] = keys;
		}

		if (post_self?.tweet?.tx) {
			for (let i = 0; i < post_self.tweet.tx.to.length; i++) {
				if (!keys.includes(post_self.tweet.tx.to[i].publicKey)) {
					keys.push(post_self.tweet.tx.to[i].publicKey);
				}
			}
		}

		post_self.overlay.remove();
		if (document.querySelector(this.container + '#' + this.id)) {
			document.querySelector(this.container + '#' + this.id).remove();
		}

		if (this.type === 'Edit') {
			data = { text: text, tweet_id: this.tweet.tx.signature };

			let qs = `.tweet-container > .tweet-${this.tweet.tx.signature} .tweet-body .tweet-text`;
			let obj = document.querySelector(qs);

			if (obj) {
				obj.innerHTML = text;
			}

			let newtx = await post_self.mod.sendEditTransaction(post_self.app, post_self.mod, data, keys);

			return;
		}

		post_self.overlay.closebox = false;

		post_self.loader.show();

		if (post_self.images.length > 0) {
			data['images'] = post_self.images;
		}

		if (this.type == 'Reply') {
			this.tweet.num_replies++;

			this.mod.replyTweet(this.tweet);

			data = Object.assign(data, {
				parent_id: this.tweet.tx.signature,
				thread_id: this.tweet.thread_id
			});
		}

		setTimeout(() => {
			post_self.loader.hide();

			if (!this.mod.browser_active) {
				siteMessage('Tweet sent', 1000);
			}
		}, 600);

		if (this.type == 'Retweet') {
			data.signature = post_self.tweet.tx.signature;
			this.mod.retweetTweet(this.tweet);

			this.tweet.num_retweets++;

			if (data?.text || data?.images) {
				data.retweet_tx = post_self.tweet.tx.serialize_to_web(this.app);
			} else {
				post_self.mod.sendRetweetTransaction(post_self.app, post_self.mod, data, this.tweet.tx);

				if (!this.tweet.retweeters.includes(post_self.mod.publicKey)) {
					this.tweet.retweeters.unshift(post_self.mod.publicKey);
				}

				if (this.mod?.main?.mode?.includes('tweet')) {
					this.tweet.render();
				}

				return;
			}
		}

		let newtx = await post_self.mod.sendTweetTransaction(post_self.app, post_self.mod, data, keys);

		this.app.connection.emit('redsquare-render-new-post', newtx, this.tweet);
	}

	addImg(img) {
		let post_self = this;
		let html = `<div class="post-tweet-img-preview">
        				<img src="${img}"/>
        				<i class="fa fa-times"></i>
       				</div>`;

		this.app.browser.addElementToSelector(
			html,
			this.container + '#post-tweet-img-preview-container'
		);
		this.images.push(img);

		let sel = this.container + '.post-tweet-img-preview';
		document.querySelectorAll(sel).forEach((elem) => {
			elem.addEventListener('click', function (e) {
				e.preventDefault();
				e.stopImmediatePropagation();

				let array_position = e.target.getAttribute('data-id');
				e.target.parentNode.remove();
				post_self.images.splice(array_position, 1);
				document.querySelectorAll(this.container + '.post-tweet-img-preview').forEach((el2) => {
					let array_position2 = el2.getAttribute('data-id');
					if (array_position2 > array_position) {
						el2.setAttribute('data-id', array_position2 - 1);
					}
				});
			});
		});
	}
}

module.exports = Post;
