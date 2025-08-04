const RedSquareLinkTemplate = require('./link.template');

class RedSquareLink {
	constructor(app, mod, container = '', tweet) {
		this.app = app;
		this.mod = mod;
		this.container = container;
		this.tweet = tweet;
		this.name = 'RedSquareLink';

		this.show_photo = false;
		this.src = '';
		this.url = '';
		this.title = '';
		this.description = '';

		if (this.tweet.link_properties) {
			if (this.tweet.link_properties['og:image']) {
				this.src = this.tweet.link_properties['og:image'];
				this.show_photo = true;
			}
			if (
				this.tweet.link_properties['og:url'] &&
				this.tweet.link_properties['og:url'] != 'undefined'
			) {
				this.url = this.tweet.link_properties['og:url'];
			}
			if (this.tweet.link_properties['og:title']) {
				this.title = this.tweet.link_properties['og:title'];
			}
			if (this.tweet.link_properties['og:description']) {
				this.description = this.tweet.link_properties['og:description'];
			}
		}

		if (this.url == '') {
			this.url = tweet.link;
		}
	}

	render() {
		//
		// replace element or insert into page
		//
		if (typeof this.tweet.link != 'undefined') {
			let qs = this.container + ' > .link-preview';

			if (document.querySelector(qs)) {
				this.app.browser.replaceElementBySelector(RedSquareLinkTemplate(this), qs);
			} else {
				this.app.browser.addElementToSelector(RedSquareLinkTemplate(this), this.container);
			}

			this.attachEvents();
		}
	}

	attachEvents() {
		if (this.src) {
			if (!this.test) {
				this.test = new Image();
				this.test.onerror = () => {
					this.show_photo = false;
					console.warn('Saito image load failed! \n', this.title, this.src);
					if (this.src.toLowerCase().includes('saito')) {
						//
						// Fallback if missing our own hosted photo
						this.src = '/saito/img/backgrounds/red_cube_dark.jpg';
						this.show_photo = true;
					} else if (!this.app.browser.urlRegexp().test(this.src) && !this.src.includes('data:')) {
						//
						// Fall back for raw data
						let img_type = 'jpeg';
						if (this.src.charAt(0) == 'i') {
							img_type = 'png';
						}
						if (this.src.charAt(0) == 'R') {
							img_type = 'gif';
						}
						this.src = `data:image/${img_type};base64,` + this.src;
						this.show_photo = true;
					} else {
						this.src = '/saito/img/dreamscape.png';
					}
					this.render();
				};
				this.test.src = this.src;
			}
		}
	}
}

module.exports = RedSquareLink;
