

	canPlayerCastSpell(card) {

		let realms_self = this;
		let deck = realms_self.returnDeck();

		//
		// calculate how much mana is available
		//
		let red_mana = 0;
		let green_mana = 0;
		let black_mana = 0;
		let white_mana = 0;
		let blue_mana = 0;
		let other_mana = 0;
		let total_mana = 0;
		
		let p = this.game.state.players_info[this.game.player-1];

		for (let z = 0; z < p.cards.length; z++) {
			let card = deck[p.cards[z].key];
			if (p.cards[z].untapped == true) {
				if (card.type == "land" && card.color == "black") { black_mana++; }
				if (card.type == "land" && card.color == "red") { red_mana++; }
				if (card.type == "land" && card.color == "green") { green_mana++; }
				if (card.type == "land" && card.color == "blue") { blue_mana++; }
				if (card.type == "land" && card.color == "white") { white_mana++; }
			}
		}

		//
		// sum available mana
		//
		total_mana = red_mana + green_mana + black_mana + white_mana + blue_mana + other_mana;

		//
		// card casting cost
		//
		let red_needed = 0;
		let green_needed = 0;
		let black_needed = 0;
		let white_needed = 0;
		let blue_needed = 0;
		let any_needed = 0;

		let cost = deck[card].cost;

		for (let z = 0; z < cost.length; z++) {
			if (cost[z] === "*") { any_needed++; }
			if (cost[z] === "red") { red_needed++; }
			if (cost[z] === "green") { green_needed++; }
			if (cost[z] === "white") { white_needed++; }
			if (cost[z] === "blue") { blue_needed++; }
			if (cost[z] === "black") { black_needed++; }
		}

		//
		// sum total needed
		//
		let total_needed = red_needed + green_needed + black_needed + white_needed + blue_needed + any_needed;

		if (green_mana < green_needed) { return 0; }
		if (red_mana < red_needed) { return 0; }
		if (black_mana < black_needed) { return 0; }
		if (white_mana < white_needed) { return 0; }
		if (blue_mana < blue_needed) { return 0; }
		if (total_needed < total_mana) { return 0; }

		return 1;

	}

	playerTurn() {

		let realms_self = this;

		if (this.browser_active == 0) {
			return;
		}

		//
		// show my hand
		//
		this.updateStatusAndListCards(

		  	`play card(s) or click board to attack <span id="end-turn" class="end-turn">[ or pass ]</span>`,

		    	this.game.deck[this.game.player-1].hand,

			function(cardname) {

				let card = realms_self.deck[cardname];

				if (card.type == "land") {
					this.deploy(realms_self.game.player, cardname);
					this.addMove(`deploy\tland\t${realms_self.game.player}\t${cardname}\t${realms_self.game.player}`);
					this.addMove(`counter_or_acknowledge\t${realms_self.returnPlayerUsername(this.game.player)} places ${this.popup(cardname)}\tdeploy_land\t${card}`);
					this.addMove("RESETCONFIRMSNEEDED\tall");
					this.addMove(`discard\t${realms_self.game.player}\t${cardname}`);
					this.endTurn();
				}
				if (card.type == "creature") {
					this.deploy(realms_self.game.player, cardname);
					this.addMove(`deploy\tcreature\t${realms_self.game.player}\t${cardname}\t${realms_self.game.player}`);
					this.addMove(`counter_or_acknowledge\t${realms_self.returnPlayerUsername(this.game.player)} casts ${this.popup(cardname)}\tdeploy_creature\t${card}`);
					this.addMove("RESETCONFIRMSNEEDED\tall");
					this.addMove(`discard\t${realms_self.game.player}\t${cardname}`);
					this.endTurn();
				}
				if (card.type == "artifact") {
					this.deploy(realms_self.game.player, cardname);
					this.addMove(`deploy\tartifact\t${realms_self.game.player}\t${cardname}\t${realms_self.game.player}`);
					this.addMove(`counter_or_acknowledge\t${realms_self.returnPlayerUsername(this.game.player)} casts ${this.popup(cardname)}\tdeploy_artifact\t${card}`);
					this.addMove("RESETCONFIRMSNEEDED\tall");
					this.addMove(`discard\t${realms_self.game.player}\t${cardname}`);
					this.endTurn();
				}
				if (card.type == "sorcery") {
					this.deploy(realms_self.game.player, cardname);
					this.addMove(`deploy\tsorcery\t${realms_self.game.player}\t${cardname}\t${realms_self.game.player}`);
					this.addMove(`counter_or_acknowledge\t${realms_self.returnPlayerUsername(this.game.player)} casts ${this.popup(cardname)}\tdeploy_sorcery\t${card}`);
					this.addMove("RESETCONFIRMSNEEDED\tall");
					this.addMove(`discard\t${realms_self.game.player}\t${cardname}`);
					this.endTurn();
				}

			}
		);

		//
		// or end their turn
		//
		document.getElementById("end-turn").onclick = (e) => {
			this.prependMove("RESOLVE\t" + this.publicKey);
			this.endTurn();
		};

	}




