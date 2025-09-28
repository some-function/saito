
	returnCardImage(cardname) {

	  	if (this.deck[cardname]) {
	  		return this.deck[cardname].returnCardImage();
	  	}


		return '';

	}


        importCard(key, card) {

                let game_self = this;

                let c = {
                        key		:	key,
                        name		: 	"Unnamed",
                        color		: 	"*",
                        cost		: 	[],
                        power		: 	0,
                        toughness	: 	0,
                        text		: 	"This card has not provided text",
                        img		: 	"/img/cards/sample.png",
                };
                c = Object.assign(c, card);


                //
                // add dummy events that return 0 (do nothing)
                //
		if (!c.returnCardImage) {
                	c.returnCardImage = function() {
				return `<div class="card"><img class="card cardimg" src="/realms/img/cards/016_shellring_vindicator.png"></div>`;
                	};
	        }
                if (!c.oninstant) {
                	c.oninstant = function (game_self, player, card) {
                        	return 0;
                	};
                }
                if (!c.onEnterBattlefield) {
                        c.onEnterBattlefield = function (game_self, player, card) {
                                return 0;
                        };
                }
                if (!c.onCostAdjustment) {
                        c.onCostAdjustment = function (game_self, player, card) {
                                return 0;
                        };
                }

		
                game_self.deck[c.key] = c;

        }




	////////////////////////////////
	/// Cards and Card Functions ///
	////////////////////////////////
	returnDeck(color="") {

		var deck = {};

		deck['0001'] {
			nqme : "" ,
			type : "instant" ,
			color: "" ,
			cost: ['*', '*', 'red'] ,
			text : "" ,
			lore : "" ,
			img : "0001_valkyrie_of_the_endless_battle.png" ,
		}

		if (color != "") {
			for (let card in deck) {
				if (card.color !== color) {
					delete deck[card];
				}
			}
		}

		return deck;
	}


	returnWhiteDeck() { return this.returnDeck("white"); }
	returnRedDeck() { return this.returnDeck("red"); }
	returnBlackDeck() { return this.returnDeck("black"); }
	returnGreenDeck() { return this.returnDeck("green"); }
	returnBlueDeck() { return this.returnDeck("blue"); }


