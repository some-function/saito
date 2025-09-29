const BoardTemplate = require('./board.template');

class Board {
	constructor(app, mod, container = '.gameboard') {
		this.app = app;
		this.mod = mod;
	}

	render() {

		let realms_self = this.mod;

		let me = realms_self.game.player;
		let opponent = 1;
		if (me == 1) {
			opponent = 2;
		}

		//
		// refresh board
		//
		if (document.querySelector(".gameboard .realms-board")) {
			this.app.browser.replaceElementBySelector(BoardTemplate(), ".gameboard .realms-board");
		} else {
			this.app.browser.addElementToSelector(
				BoardTemplate(),
				".gameboard"
			);
		}

		//
		// all cards
		//
		let deck = realms_self.returnDeck();


		//
		//
		//
		let opponent_cards_on_table = realms_self.game.state.players_info[opponent - 1].cards;
		let player_cards_on_table = realms_self.game.state.players_info[realms_self.game.player - 1].cards;

		//
		// put opponent cards on table
		//
		this.num = 0;
		for (
			let i = 0;
			i < opponent_cards_on_table.length && i < 5;
			i++
		) {

			if (i >= opponent_cards_on_table.length) {

				realms_self.app.browser.addElementToSelector(
					this.html("") ,
					'.battlefield.player'
				);

			} else {

				let cobj = opponent_cards_on_table[i];
				let key = cobj.key;
				let card = deck[key];

				if (card.type == 'land') {
					realms_self.app.browser.addElementToSelector(
						this.html(key) ,
						'.battlefield.opponent'
					);
				}

				if (card.type == 'creature') {
					realms_self.app.browser.addElementToSelector(
						this.html(key) ,
						'.battlefield.opponent'
					);
				}

				if (card.type == 'artifact') {
					realms_self.app.browser.addElementToSelector(
						this.html(key) ,
						'.battlefield.opponent'
					);
				}
			}
		}

		//
		// put my cards on table
		//
		this.num = 0;
		for (
			let i = 0;
			i < player_cards_on_table.length && i < 5;
			i++
		) {

			if (i >= player_cards_on_table.length) {

				realms_self.app.browser.addElementToSelector(
					this.html("") ,
					'.battlefield.player'
				);

			} else {

				let cobj = player_cards_on_table[i];
				let key = cobj.key;
				let card = deck[key];

				if (card.type == 'land') {
					realms_self.app.browser.addElementToSelector(
						this.html(key) ,
						'.battlefield.player'
					);
				}

				if (card.type == 'creature') {
					realms_self.app.browser.addElementToSelector(
						this.html(key) ,
						'.battlefield.player'
					);
				}

				if (card.type == 'artifact') {
					realms_self.app.browser.addElementToSelector(
						this.html(key) ,
						'.battlefield.player'
					);
				}

			}
		}
	}



	html(key) {

		let realms_self = this.mod;
		this.num++;

		return `
			<div class="card-container" data-slot="${this.num}">
				${realms_self.returnCardImage(key)}
			</div>
		`;
	}

}

module.exports = Board;
