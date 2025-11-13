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
  		  		this.opcodes[op.name.toLowerCase()] = op;
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
    			return this.canonicalizeString(script);
    		}

    		if (script !== null && typeof script === "object") {
      			return this.canonicalizeObject(script);
    		}

   	 	return null;

  	}

  	//
  	// strings
  	//
  	canonicalizeString(script_json="") {
    		if (script_json === null || typeof script_json !== "string") {
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
    		let vhash = this.hash(script);
    		if (vhash !== hash) {
    		  	console.warn("Saito Scripting: script reduces to incorrect hash", vhash, "≠", hash);
    		  	return false;
    		}

    		//
    		// swap witness data into script and evaluate the rules
    		//
    		return this._eval(script, witness, vars, counter);

  	}


_eval(script, witness, vars, counter) {

  //
  // Safety checks
  //
  counter.node++;
  if (counter.depth > this.MAX_DEPTH) {
    console.warn(`Saito Scripting: exceeded max recursion depth (${this.MAX_DEPTH})`);
    return false;
  }
  if (counter.node > this.MAX_NODES) {
    console.warn(`Saito Scripting: exceeded max node count (${this.MAX_NODES})`);
    return false;
  }

  if (!script || typeof script !== "object") return false;
  if (!witness || typeof witness !== "object") return false;

  // normalize opcode
  const op = (script.op || "").toLowerCase();

  //
  // LOGICAL OPS (built-in)
  //
  switch (op) {
    case "and": {
      counter.depth++;
      try {
        return script.args.every(arg => this._eval(arg, witness, vars, counter));
      } finally {
        counter.depth--;
      }
    }

    case "or": {
      counter.depth++;
      try {
        return script.args.some(arg => this._eval(arg, witness, vars, counter));
      } finally {
        counter.depth--;
      }
    }

    case "not": {
      counter.depth++;
      try {
        return !this._eval(script.args[0], witness, vars, counter);
      } finally {
        counter.depth--;
      }
    }
  }

  //
  // APPLICATION OPS (dynamic from this.opcodes)
  //
  const opcode = this.opcodes[op];
  if (!opcode) {
    console.warn("Unknown opcode:", op);
    return false;
  }

  //
  // opcode.execute(scriptFields, witnessFields, vars)
  //
  try {
    return opcode.execute(script, witness, vars);
  } catch (err) {
    console.error(`Error executing opcode '${op}':`, err);
    return false;
  }
}





/********************************************************************
 * convertScriptDescriptionToScriptAndWitnessJSON(description)
 * ------------------------------------------------------------
 * Main entry point.
 ********************************************************************/
convertScriptDescriptionToScriptAndWitnessJSON(description = "") {

  // 1. Normalize input (flexible → canonical)
  const normalized = this._normalizeDescription(description);

  // 2. Tokenize
  const tokens = this._tokenize(normalized);

  // 3. Parse into raw AST
  const { ast } = this._parseTokens(tokens);

  // 4. Apply opcode schemas
  const checkedAst = this._applyOpcodeSchemas(ast);

  // 5. Build final script + witness JSON
  return this._assembleScriptAndWitness(checkedAst);
}


/********************************************************************
 * 1. NORMALIZATION LAYER
 * ------------------------------------------------------------
 * Turns flexible syntax into canonical symbolic Saito form.
 ********************************************************************/
_normalizeDescription(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Empty script description.");
  }

  let t = text.trim();

  //
  // Basic cleanup: remove commas, collapse whitespace
  //
  t = t.replace(/,/g, " ");
  t = t.replace(/\s+/g, " ");

  //
  // Add parentheses around top-level AND/OR/NOT expressions if missing
  //
  if (!t.startsWith("(") && /^[A-Za-z]+ /.test(t)) {
    t = "(" + t + ")";
  }

  //
  // Allow natural ish English:
  // "require", "must", "needs", "need" etc.
  //
  t = t.replace(/\brequire(s)?\b/gi, " ");
  t = t.replace(/\bmust\b/gi, " ");
  t = t.replace(/\bneed(s)?\b/gi, " ");

  //
  // Map lowercase operators to uppercase canonical names
  //
  t = t.replace(/\band\b/gi, "AND");
  t = t.replace(/\bor\b/gi, "OR");
  t = t.replace(/\bnot\b/gi, "NOT");

  //
  // Expand known synonyms for opcodes (extendable)
  //
  for (const opName in this.opcodes) {
    const re = new RegExp("\\b" + opName.toLowerCase() + "\\b", "gi");
    t = t.replace(re, opName);
  }

  return t;
}


/********************************************************************
 * 2. TOKENIZER
 ********************************************************************/
_tokenize(text) {
  const tokens = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "(") { tokens.push({ type: "LPAREN" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "RPAREN" }); i++; continue; }
    if (ch === "=") { tokens.push({ type: "EQUAL" }); i++; continue; }

    // quoted string
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j++;
      if (j >= text.length) throw new Error("Unterminated quoted string.");
      tokens.push({ type: "STRING", value: text.slice(i+1, j) });
      i = j + 1;
      continue;
    }

    // word: letters / numbers / underscores
    if (/[A-Za-z0-9_\-]/.test(ch)) {
      let j = i + 1;
      while (j < text.length && /[A-Za-z0-9_\-]/.test(text[j])) j++;
      const word = text.slice(i, j);
      tokens.push({ type: "WORD", value: word });
      i = j;
      continue;
    }

    // unknown character
    throw new Error("Unexpected character: " + ch);
  }

  return tokens;
}


/********************************************************************
 * 3. RECURSIVE DESCENT PARSER
 ********************************************************************/
_parseTokens(tokens) {
  let i = 0;

  const peek = () => tokens[i];
  const next = () => tokens[i++];

  const parseExpr = () => {
    const tok = peek();
    if (!tok) throw new Error("Unexpected end of input");

    //
    // Unary NOT without parentheses
    //
    if (tok.type === "WORD" && tok.value.toLowerCase() === "not") {
      next(); // consume NOT
      const arg = parseExpr();
      return { type: "operation", op: "not", args: [arg] };
    }

    //
    // Parenthesized expression
    //
    if (tok.type === "LPAREN") {
      next(); // '('
      const opTok = next();
      if (!opTok || opTok.type !== "WORD")
        throw new Error("Expected operator after '('");

      const op = opTok.value.toLowerCase();
      const args = [];

      while (peek() && peek().type !== "RPAREN") {
        args.push(parseExpr());
      }

      if (!peek()) throw new Error("Missing closing ')'");
      next(); // ')'

      return { type: "operation", op, args };
    }

    //
    // Bare WORD → opcode_call
    //
    if (tok.type === "WORD") {
      const nameTok = next(); // consume WORD
      const name = nameTok.value.toLowerCase();
      const fields = {};

      while (peek() && peek().type === "WORD") {
        const keyTok = next();
        if (peek() && peek().type === "EQUAL") {
          next(); // "="
          const valTok = next();
          if (!valTok || (valTok.type !== "WORD" && valTok.type !== "STRING"))
            throw new Error("Expected value after '='");
          fields[keyTok.value] = valTok.value;
        } else {
          fields[keyTok.value] = true;
        }
      }

      return { type: "opcode_call", name, fields };
    }

    throw new Error("Unexpected token: " + JSON.stringify(tok));
  };

  const ast = parseExpr();
  if (i < tokens.length)
    throw new Error("Unexpected tokens at end of input.");

  return { ast };
}


/********************************************************************
 * 4. APPLY OPCODE SCHEMAS (semantic validation)
 ********************************************************************/
_applyOpcodeSchemas(node) {

  const logicalOps = ["and", "or", "not"];

  //
  // 1. If parser emitted opcode_call but it is really logical
  //
  if (node.type === "opcode_call") {
    const op = (node.name || "").toLowerCase();

    if (logicalOps.includes(op)) {
      return {
        type: "logical",
        op,
        args: []      // will be filled by surrounding structure or unary NOT
      };
    }
  }

  //
  // 2. operation nodes
  //
  if (node.type === "operation") {
    const op = (node.op || "").toLowerCase();

    if (logicalOps.includes(op)) {
      const args = node.args.map(a => this._applyOpcodeSchemas(a));
      return { type: "logical", op, args };
    }

    // treat as opcode_call
    return this._applyOpcodeSchemas({
      type: "opcode_call",
      name: op,
      fields: node.fields || {}
    });
  }

  //
  // 3. opcode_call nodes (real opcodes)
  //
  if (node.type === "opcode_call") {
    const opName = (node.name || "").toLowerCase();
    const opcode = this.opcodes[opName];

    if (!opcode)
      throw new Error(`Unknown opcode: ${opName}`);

    const scriptFields = {};
    const witnessFields = {};
    const schema = opcode.schema || { script: {}, witness: {} };

    for (const key in node.fields) {
      const val = node.fields[key];
      if (key in schema.script) {
        scriptFields[key] = val;
      } else if (key in schema.witness) {
        witnessFields[key] = val;
      } else {
        throw new Error(`Unknown field '${key}' for opcode '${opName}'.`);
      }
    }

    if (opcode.exampleScript) {
      for (const key in schema.script) {
        if (!(key in scriptFields) && opcode.exampleScript[key]) {
          scriptFields[key] = opcode.exampleScript[key];
        }
      }
    }

    if (opcode.exampleWitness) {
      for (const key in schema.witness) {
        if (!(key in witnessFields) && opcode.exampleWitness[key]) {
          witnessFields[key] = opcode.exampleWitness[key];
        }
      }
    }

    for (const k in schema.script) {
      if (!(k in scriptFields))
        throw new Error(`Missing script field '${k}' for opcode '${opName}'.`);
    }

    for (const k in schema.witness) {
      if (!(k in witnessFields))
        witnessFields[k] = opcode.exampleWitness?.[k] || "";
    }

    return {
      type: "opcode",
      name: opName,
      scriptFields,
      witnessFields
    };
  }

  throw new Error("Invalid AST node type: " + node.type);
}


/********************************************************************
 * 5. ASSEMBLE FINAL JSON
 ********************************************************************/
_assembleScriptAndWitness(ast) {
  const witness = {};

  const buildScript = (node) => {
    if (node.type === "logical") {
      return {
        op: node.op,
        args: node.args.map(buildScript)
      };
    }

    if (node.type === "opcode") {
      // accumulate witness fields
      for (const k in node.witnessFields) {
        witness[k] = node.witnessFields[k];
      }

      return {
        op: node.name,
        ...node.scriptFields
      };
    }

    throw new Error("Unknown AST node in assembly");
  };

  const script = buildScript(ast);
  return { script, witness };
}


}

module.exports = Scripting;

