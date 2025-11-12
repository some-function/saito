module.exports = {
  name: "CHECKSIG",
  description: 'Verify a signature against a message.',
  exampleScript: {
    op: 'CHECKSIG',
    publickey: '<publickey>',
    msg: 'hello world'
  },
  exampleWitness: {
    signature: '<signature>'
  },
  execute(app, script, witness, vars) {
    const sig = witness.signature;
    const msg = script.msg || vars.message || 'saito-validation';
    return app.crypto.verifyMessage(msg, sig, script.publickey);
  },
  schema: {
    script: { publickey: "string", msg: "string" },
    witness: { signature: "string" }
  },
  execute: function (app, script, witness, vars) {
    const sig = witness.signature;
    const msg = script.msg || vars.message || "saito-validation";
    return app.crypto.verifyMessage(msg, signature, script.publickey);
  }
};

