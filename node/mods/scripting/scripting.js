const saito = require('./../../lib/saito/saito');
const SaitoHeader = require('./../../lib/saito/ui/saito-header/saito-header');
const ModTemplate = require('./../../lib/templates/modtemplate');
const ScriptingMain = require('./lib/ui/main');


/////////////
// OPCODES //
/////////////
const OpcodeCheckSig     = require('./lib/opcodes/checksig');
//const OpcodeCheckMultiSig = require('./lib/opcodes/checkmultisig');
//const OpcodeCheckOwn      = require('./lib/opcodes/checkown');
//const OpcodeCheckExpiry   = require('./lib/opcodes/checkexpiry');
//const OpcodeOwnsNFTBy     = require('./lib/opcodes/ownsnftby');

class Scripting extends ModTemplate {

	constructor(app) {

		super(app);

		this.appname = 'Scripting';
		this.name = 'Scripting';
		this.slug = 'scripting';
		this.description = 'Support Tools for writing and testing Saito Script';
		this.categories = 'Utility Cryptography Programming';

    		this.MAX_DEPTH = 8;
    		this.MAX_NODES = 16;

		this.main = new ScriptingMain(this.app, this, ".saito-container");

		this.opcodes = {};

	}

	initialize(app) {

		this.header = new SaitoHeader(this.app, this);

		//
		// initialize our opcodes
		//
		[OpcodeCheckSig].forEach((op) => { 
  			if (op?.name && typeof op.execute === "function") {
  		  		this.opcodes[op.name] = op;
  			}
		});


	}

	render() {

		this.header.render();
		this.main.render();

/*****
  		//
                // CHECKSIG
                //
                let a_script = {
                        "op": "CHECKSIG",
                        "pubkey": "<creator_pubkey>"
                }
                let a_witness = {
                        "signature": "<signature_by_creator>",
                        "requester_pubkey": "<creator_pubkey>"
                }

		document.querySelector(".script").value = JSON.stringify(a_script, null, 2);
		document.querySelector(".witness").value = JSON.stringify(a_witness, null, 2);

		//
		// verify script
		//
		document.querySelector(".verify").onclick = (e) => {

			alert("Attempting to Validate!");

			let script = document.querySelector(".script").value;
			let witness = document.querySelector(".witness").value;
			let hash = this.generate(script);

			console.log("hash is: " + hash);

			console.log("does this validates? " + this.evaluate(hash, script, witness, {}));

		}

		//
		// sign a message
		//
		document.querySelector(".sign-button").onclick = async (e) => {

			alert("Attempting to Sign!");

			let msg = document.querySelector(".sign-me").value;
			let hash = this.app.crypto.hash(msg);
			let privatekey = await this.app.wallet.getPrivateKey();
      			let sig = await this.app.crypto.signMessage(msg, privatekey);

			alert("sig: " + sig);
			console.log("sig: " + sig);

		}
******/
	}



  	//
  	// Canonicalize
  	//
  	// this converts the input into a standarized object so that when 
  	// it is hashed the output will be consistent and the same hash will
  	// be generated on every system.
  	//
  	canonicalize(script=null) {

    		if (script !== null && typeof script === "string") {
    			return canonicalizeString(script);
    		}

    		if (script !== null && typeof script === "object") {
      			return canonicalizeObject(script);
    		}

   	 	return null;

  	}

  	//
  	// strings
  	//
  	canonicalizeString(script_json="") {
    		if (script_obj === null || typeof script_obj !== "string") {
      			return null;
    		}
    		return this.canonicalizeObject(JSON.parse(script_json));
  	}

  	//
  	// objects
  	//
  	canonicalizeObject(script_obj) {

    		if (script_obj === null || typeof script_obj !== "object") {
      			return null;
    		}

    		if (Array.isArray(script_obj)) {
      			return "[" + script_obj.map(this.canonicalize).join(",") + "]";
    		}

    		const keys = Object.keys(script_obj).sort();
    		const parts = keys.map(k => JSON.stringify(k) + ":" + this.canonicalize(script_obj[k]));
    		return "{" + parts.join(",") + "}";

  	}

  	//
  	//
  	//
  	hash(script) {
    		if (script === null) { return ""; }
    		const json = this.canonicalize(script);
    		if (json == null) { return ""; }
    		return this.app.crypto.hash(json);
  	}

  	//
  	// evaluate
  	//
  	// this takes the HASH of a script, a submitted script, and the
  	// witness variables to insert in the script and evaluates it to 
  	// return TRUE or FALSE based on whether the script validates
  	// successfully or not.
  	//
  	evaluate(hash="", script="", witness = {}, vars = {}) {

		let counter = {};
		counter.node = 0;
		counter.depth = 0;

    		//
    		// scripts are communicated over the network as JSON strings, so we 
    		// convert the script into an object that can be canonicalized to 
    		// confirm that the hash is correct before evaluating its contents.
    		// make sure script is JSON object
    		//
    		if (typeof script === "string") {
      			try {
        			script = JSON.parse(script);
      			} catch (err) {
        			console.warn("Saito Scripting: invalid JSON script string");
        			return false;
      			}
    		}

    		//
    		// first we check the correctness of the HASH that is provided, as
    		// there is no point in trying to evaluate the script if it is not 
    		// the correct one.
    		//
    		let vhash = this.generate(script);
    		if (vhash !== hash) {
    		  	console.warn("Saito Scripting: script reduces to incorrect hash", computed_hash, "≠", hash);
    		  	return false;
    		}

    		//
    		// swap witness data into script and evaluate the rules
    		//
    		return this._eval(script, witness, vars, counter);

  	}


  	_eval(script, witness, vars, counter) {

    		//
    		// prevent DDOS attacks on the scripting mechanism by limiting the depth
    		// with which we will recurse into commands and the number of commands we
    		// will process in total.
    		//
    		counter.node++;

    		if (counter.depth > this.MAX_DEPTH) {
      			console.warn(`Saito Scripting: exceeded max recursion depth (${this.MAX_DEPTH})`);
      			return false;
    		}

    		if (counter.depth > this.MAX_NODES) {
      			console.warn(`Saito Scripting: exceeded max node count (${this.MAX_NODES})`);
      			return false;
    		}

    		//
    		// validate that we have the correct type of variables to continue...
    		//
    		if (!script  || typeof script  !== "object") { return false; }
    		if (!witness || typeof witness !== "object") { return false; }

    		//
    		// 
    		//
    		switch (script.op) {

      			case "AND": {
				counter.depth++;
        			try {
					return script.args.every(arg => this._eval(arg, witness, vars, counter));
				} finally {
    					counter.depth--;
  				}
			}

      			case "OR": {
				counter.depth++;
        			try {
					return script.args.some(arg => this._eval(arg, witness, vars, counter));
                                } finally {
                                        counter.depth--;
                                }
			}

      			case "NOT": {
				counter.depth++;
        			try {
        				return !this._eval(script.args[0], witness, vars, counter);
				} finally {
					counter.depth--;
				}
			}

      			case "CHECKSIG": {
        			const sig = witness.signature || witness.signatures?.[0];
        			const msg = vars.message || "saito-validation";
        			return this.app.crypto.verifyMessage(sig, script.pubkey, msg);
      			}

      			case "CHECKMULTISIG": {
        			const sigs = witness.signatures || [];
        			const pubkeys = script.pubkeys || [];
        			const m = script.m || pubkeys.length;
        			let valid = 0;
        			for (let i = 0; i < pubkeys.length && i < sigs.length; i++) {
          				if (this.app.crypto.verifyMessage(sigs[i], pubkeys[i], vars.message || "saito-validation")) {
            					valid++;
          				}
        			}
        			return valid >= m;
      			}

      			case "CHECKOWN": {
        			const nft_sig = script.nft_sig;
        			const requester = witness.requester_pubkey;
        			if (!this.app.wallet) { return false; }
        			return this.app.wallet.isSlipSpendable(nft_sig, requester);
      			}

      			case "CHECKEXPIRY": {
        			const now = vars.current_time || Date.now();
        			return now <= script.t;
      			}

      			default:
        			console.warn("Unknown opcode:", script.op);
        			return false;
		}
	}



/******
	test() {

    		//
    		// CHECKSIG
    		//
    		let a_script = {
      			"op": "CHECKSIG",
      			"pubkey": "<creator_pubkey>",
			"msg" : "......"
    		}
    		let a_witness = {
      			"signature": "<signature_by_creator>",
      			"requester_pubkey": "<creator_pubkey>"
    		}

    		//
    		// CHECKMULTISIG
    		//
    		let b_script = {
      			"op": "CHECKMULTISIG",
      			"m": 2,
      			"pubkeys": ["<pkA>", "<pkB>", "<pkC>"]
    		}
    		let b_witness = {
      			"signatures": ["<sig_by_pkA>", "<sig_by_pkB>"]
    		}

    		//
    		// CHECKOWN
    		//
    		let c_script = {
      			"op": "CHECKOWN",
      			"nft_sig": "0xABC123..."
    		}
    		let c_witness = {
      			"requester_pubkey": "<user_pubkey>"
    		}


  	}
*****/

     
}

module.exports = Scripting;

