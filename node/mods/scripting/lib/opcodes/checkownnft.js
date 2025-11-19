const Slip = require('../../../../lib/saito/slip').default;

module.exports = {
  name: "CHECKOWNNFT",
  description: 'Verify NFT belongs to self via utxokeys',
  exampleScript: {
    op: 'CHECKOWNNFT',
    nftid: '<nftid>',
  },
  exampleWitness: {
    utxokey1: '<utxokey1>',
    utxokey2: '<utxokey2>',
    utxokey3: '<utxokey3>',
  },
  schema: {
    script: {
      nftid: "string",
    },
    witness: {
      utxokey1: "string",
      utxokey2: "string",
      utxokey3: "string",
    }
  },

  execute: async function (app, script, witness, vars, tx, blk) {
    let tx_sender = null;
    if (tx.from.length > 0) {
      tx_sender = tx.from[0].publicKey;
    } else {
      return false;
    }

    //
    // check tx.signature is correct / validates
    //

    const nftid    = script.nftid || "";
    const utxokey1 = witness.utxokey1 || "";
    const utxokey2 = witness.utxokey2 || "";
    const utxokey3 = witness.utxokey3 || "";

    if (!nftid) { return false; }
    if (!utxokey1 || !utxokey2 || !utxokey3) { return false; }

    const [
      isSlip1Spendable,
      isSlip2Spendable,
      isSlip3Spendable
    ] = await Promise.all([
      app.blockchain.isSlipSpendable(utxokey1),
      app.blockchain.isSlipSpendable(utxokey2),
      app.blockchain.isSlipSpendable(utxokey3),
    ]);

    if (
      isSlip1Spendable &&
      isSlip2Spendable &&
      isSlip3Spendable
    ) {

      const slip1 = Slip.fromUtxoKey(utxokey1);
      if (!slip1) { return false; }

      const slip2 = Slip.fromUtxoKey(utxokey2);
      if (!slip2) { return false; }

      const slip3 = Slip.fromUtxoKey(utxokey3);
      if (!slip3) { return false; }

      const creator_publicKey = slip1.publicKey;
      const owner_publicKey   = slip2.publicKey;
      const slip3_publicKey   = slip3.publicKey;

      console.log("slip1: ", slip1);
      console.log("slip2: ", slip2);
      console.log("slip3: ", slip3);

      console.log("creator_publicKey: ", creator_publicKey);
      console.log("owner_publicKey: ", owner_publicKey);
      console.log("slip3_publicKey: ", slip3_publicKey);

      //
      // check nft belongs to me
      //
      if (owner_publicKey !== tx_sender) {
        return false;
      }

      //
      // check all three slips come from same tx (same blockId and txOrdinal)
      //
      const slip1_blockid = BigInt(slip1.blockId);
      const slip2_blockid = BigInt(slip2.blockId);
      const slip3_blockid = BigInt(slip3.blockId);

      const slip1_txOrdinal = BigInt(slip1.txOrdinal);
      const slip2_txOrdinal = BigInt(slip2.txOrdinal);
      const slip3_txOrdinal = BigInt(slip3.txOrdinal);

      if (!(slip1_blockid === slip2_blockid && 
          slip2_blockid === slip3_blockid && 
          slip1_txOrdinal === slip2_txOrdinal 
          && slip2_txOrdinal === slip3_txOrdinal)
      ) {
        console.log("CHECKOWNNFT failed: slips not from same tx");
        return false;
      }

      //
      // check index are consecutive (i, i+1, i+2)
      //
      const index1 = Number(slip1.index);
      const index2 = Number(slip2.index);
      const index3 = Number(slip3.index);

      if (!(index2 === index1 + 1 && index3 === index2 + 1)) {
        console.log("CHECKOWNNFT failed: slip indices not consecutive", { index1, index2, index3 });
        return false;
      }

      return true;
    }

    return false;
  }
};
