const BoardTemplate = require('./board.template');
const ManaWheel = require('./mana');

class Board {
	constructor(app, mod, container = '.gameboard') {
		this.app = app;
		this.mod = mod;
		this.mana_player = new ManaWheel(app, mod, `.player .showcard[data-slot="1"]`);
		this.mana_opponent = new ManaWheel(app, mod, `.opponent .showcard[data-slot="1"]`);
	}

	render() {

		let realms_self = this.mod;

		let me = realms_self.game.player;
		let opponent = 1;
		if (me == 1) { opponent = 2; }

		this.mana_player.player = me;
		this.mana_opponent.player = opponent;


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
		this.mana_depicted = 0;
		for (
			let i = 0;
			i < opponent_cards_on_table.length || i < 5;
			i++
		) {

			if (i >= opponent_cards_on_table.length) {

				realms_self.app.browser.addElementToSelector(
					this.html("") ,
					'.battlefield.opponent'
				);

			} else {

				let cobj = opponent_cards_on_table[i];
				let key = cobj.key;
				let card = deck[key];

				if (card.type == 'land') {
					if (this.mana_depicted == 0) {
						realms_self.app.browser.addElementToSelector(
							this.html("") ,
							'.battlefield.opponent'
						);
						this.mana_opponent.render();
						this.mana_depicted = 1;
					}
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
		this.mana_depicted = 0;
		for (
			let i = 0;
			i < player_cards_on_table.length || i < 5;
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
					if (this.mana_depicted == 0) {
						realms_self.app.browser.addElementToSelector(
							this.html("") ,
							'.battlefield.player'
						);
						this.mana_player.render();
						this.mana_depicted = 1;
					}
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


	attachEvents() {

		let opponent_cards_on_table = realms_self.game.state.players_info[opponent - 1].cards;
		let player_cards_on_table = realms_self.game.state.players_info[realms_self.game.player - 1].cards;
	
		for (let z = 0; z < opponent_cards_on_table.length; z++) {
			let key = opponent_cards_on_table[z];
			this.attachCardEvents(key);
		}
		for (let z = 0; z < player_cards_on_table.length; z++) {
			let key = player_cards_on_table[z];
			this.attachCardEvents(key);
		}

	}

	attachCardEvents(key) {

		let realms_self = this.mod;

		$(`.${key}`).off();
        	$(`.${key}`).on('mouseover', function () {
			realms_self.cardbox.show(key);
            	});
        	$(`.${key}`).on('mouseout', function () {
			realms_self.cardbox.hide();
            	});
	}


	html(key) {

		let realms_self = this.mod;
		this.num++;

		return `
			<div class="showcard card card-container .${key}" id="${key}" data-slot="${this.num}">
				${realms_self.returnCardImage(key)}
			</div>
		`;
	}

}

module.exports = Board;
