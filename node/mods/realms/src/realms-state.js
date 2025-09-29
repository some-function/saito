
	onNewTurn(playernum=0) {

		let p = this.game.state.players_info[player_num-1];

		for (let z = 0; z < p.cards.length; z++) {
			p.cards[z].tapped = false;
		}

	}


	returnState() {

		let state = {};
		state.players_info = [2];
		for (let i = 0; i < 2; i++) {
			state.players_info[i] = {
				health: 20,
				mana: 0, 
				land_played: 0, 
				cards: [],
				graveyard: [],
			};
		}

		state.turn = 1;

		return state;
	}


	returnEventObjects() {

    		let z = [];

    		//
    		// cards in the deck can modify gameloop
    		//
    		for (let key in this.deck) {
    		  z.push(this.deck[key]);
    		} 

		return z;
	}


	deploy(player, cardname) {

	  let c = this.deck[cardname];

	  let obj = {
	    key    	: cardname ,
	    tapped 	: true ,
            affixed 	: [] ,
	  }

	  this.game.state.players_info[player-1].cards.push(obj);
	  this.board.render();

	}

	

