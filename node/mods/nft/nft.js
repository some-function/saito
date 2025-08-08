var ModTemplate = require('../../lib/templates/modtemplate');

class NFT extends ModTemplate {

  constructor(app) {

    super(app);

    this.name            = "NFT";
    this.slug            = "nft";
    this.description     = "Module to handle NFT related operations";
    this.categories       = 'Entertainment';
    return this;

  }

  async initialize(app) { 
    super.initialize(app);
  }

  async onConfirmation(blk, tx, conf) {
    let txmsg = tx.returnMessage();

    console.log("NFT onConfirmation tx: ", tx);
    console.log("NFT txmsg txmsg: ", txmsg);

    if (conf == 0) {
      
      if (txmsg.module === 'NFT') {
        
        await nft_self.app.storage.saveTransaction(
          newtx,
          {field1: 'NFT'},
          'localhost'
        );
      }
    }
  }

 onNewBlock(blk, lc) {
    let nft_self = this;

    try {
      blk.transactions.forEach(async(transaction) => {
     
        let tx = transaction.toJson();
        tx.msg = transaction.returnMessage();
        
        if (tx.msg.module === 'NFT') {
          
          await nft_self.app.storage.saveTransaction(
            transaction,
            {field1: 'NFT'},
            'localhost'
          );
        }

      });
    } catch (err) {
      console.error(err);
    }
  }

}

module.exports = NFT;


