

	canPlayerCastSpell(card) {

		let realms_self = this;

		//
		// calculate how much mana is available
		//
		let red_mana = 0;
		let green_mana = 0;
		let black_mana = 0;
		let white_mana = 0;
		let blue_mana = 0;
		let other_mana = 0;
		
		let p = this.game.state.players_info[this.game.player-1];

		for (let z = 0; z < p.cards.length; z++) {
			if (p.cards[z].untapped == true) {

			}
		}

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




