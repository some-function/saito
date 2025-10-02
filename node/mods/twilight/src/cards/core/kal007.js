
    if (card == "KAL007") {

      this.game.state.vp += 2;
      this.updateVictoryPoints();

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


      if (this.isControlled("us", "southkorea") == 1) {
        this.game.queue.push("resolve\tKAL007");
        this.game.queue.push("unlimit\tcoups");
        this.game.queue.push("ops\tus\tKAL007\t4");
        this.game.queue.push("setvar\tgame\tstate\tback_button_cancelled\t1");
        this.game.queue.push("limit\tcoups"); 
      } 
      
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
      

    }


