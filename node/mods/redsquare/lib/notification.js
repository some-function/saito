const saito = require('./../../../lib/saito/saito');
const Tweet = require('./tweet');
const SaitoUser = require('./../../../lib/saito/ui/saito-user/saito-user');
const Image = require('./image');

class RedSquareNotification {
	constructor(app, mod, tx = null) {
		this.app = app;
		this.mod = mod;
		this.tx = tx;
		this.user = null;
	}

	render(selector = '') {

		if (this.tx == null) { return; }

		let txmsg = this.tx.returnMessage();
		let tweet = new Tweet(this.app, mod, this.tx, selector);
		tweet.show_controls = 0;
		tweet.render();

	}

	attachEvents() {

		Array.from(document.querySelectorAll('.tweet-container .tweet')).forEach(
			(obj) => {
				obj.onclick = (e) => {

					let sig = e.currentTarget.getAttribute('data-id');
					let tweet = this.mod.returnTweet(sig);

					if (tweet) {
						this.app.connection.emit(
							'redsquare-tweet-render-request',
							tweet
						);
					}

				};
			}
		);
	}
}

module.exports = RedSquareNotification;
