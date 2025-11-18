module.exports = {
  name: "CHECKOWN",
  description: 'Verify slip belongs to self via utxokey',
  exampleScript: {
    op: 'CHECKOWN',
    utxokey: '<utxokey>',
  },
  exampleWitness: {
  },
  schema: {
    script: { utxokey: "string" },
    witness: {  }
  },
  execute: async function (app, script, witness, vars, tx, blk) {
    const utxokey = script.utxokey || "";
    console.log("utxokey: ", utxokey);
    console.log("isSlipSpendable: ", await app.blockchain.isSlipSpendable(utxokey));

   let isSlipSpendable = await app.blockchain.isSlipSpendable(utxokey); 
    return isSlipSpendable;
  }
};

