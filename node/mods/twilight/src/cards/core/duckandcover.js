

    ////////////////////
    // Duck and Cover //
    ////////////////////
    if (card == "duckandcover") {

      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }

      this.lowerDefcon();

      //
      // THE TUCHO BUG
      //
      // someone lost, so stop in case this pushes the US to victory and they are
      // the ones responsible for lowering defcon, but their ISP is on-fire and
      // they're slower to acknowledge the loss, resulting in the faster network
      // connecting giving victory to teh US.
      //
      if (this.game.state.defcon == 1) {
	return 0;
      } 

     
      let vpchange = 5-this.game.state.defcon;

      this.game.state.vp = this.game.state.vp+vpchange;
      this.updateLog("US gains "+vpchange+" VP from Duck and Cover");
      this.updateVictoryPoints();

      return 1;
    }




