const ScriptoriumMainTemplate = require('./main.template.js');
const SignMessageOverlay = require('./overlays/sign_message.js');
const GenerateHashOverlay = require('./overlays/generate_hash.js');
const VerifySignatureOverlay = require('./overlays/verify_signature.js');
const AdvancedScriptOverlay = require('./overlays/advanced_script.js');


class ScriptoriumMain {

  constructor(app, mod, container = "") {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this.sign_message_overlay = new SignMessageOverlay(this.app, this.mod);
    this.generate_hash_overlay = new GenerateHashOverlay(this.app, this.mod);
    this.verify_signature_overlay = new VerifySignatureOverlay(this.app, this.mod);
    this.advanced_script_overlay = new AdvancedScriptOverlay(this.app, this.mod);

    this.is_script_ok = 0;
    this.is_witness_ok = 0;
    this.is_evaluate_ok = 0;

  }

  render(container = "") {
    if (container !== "") {
      this.container = container;
    }

    // Defensive check — if no container defined, default to .main
    if (!this.container || this.container.trim() === "") {
      this.container = ".main";
    }

    const html = ScriptoriumMainTemplate(this.app, this.mod);

    //
    // if scriptorium doesn't exist, append it
    // otherwise, replace its content (for dynamic refresh)
    //
    if (!document.querySelector(".saito-scriptorium")) {
      this.app.browser.addElementToSelector(html, this.container);
    } else {
      this.app.browser.replaceElementBySelector(html, ".saito-scriptorium");
    }

    //
    // dynamic component rendering
    //
    this.renderOpcodes();
    this.attachEvents();

  }



  attachEvents() {

    document.querySelector('.ss-template-select').onchange = (e) => {
      const selectedOp = e.target.value.toUpperCase();
      const op = this.mod.opcodes[selectedOp];
      if (!op) { return; }
      const exampleScript = op.exampleScript || { op: op.name };
      const exampleWitness = op.exampleWitness || {};
      document.querySelector('.ss-script').value = JSON.stringify(exampleScript, null, 2);
      document.querySelector('.ss-witness').value = JSON.stringify(exampleWitness, null, 2);
    };

    document.querySelector('.ss-sign-msg').onclick = (e) => {
      this.sign_message_overlay.render();
    }

    document.querySelector('.ss-generate-hash').onclick = (e) => {
      this.generate_hash_overlay.render();
    }

    document.querySelector('.ss-verify-sig').onclick = (e) => {
      this.verify_signature_overlay.render();
    }

    document.querySelector('.ss-generate-expert').onclick = (e) => {
      this.advanced_script_overlay.render();
    };

    document.querySelector('.ss-mode-basic').onclick = (e) => {
      this.enableBasicMode();
    };

    document.querySelector('.ss-mode-expert').onclick = (e) => {
      this.enableExpertMode();
    };

    document.querySelector('.ss-script').addEventListener('input', (e) => {
      this.evaluateScript();
    });

    document.querySelector('.ss-witness').addEventListener('input', (e) => {
      this.evaluateWitness();
    });

  }

  evaluateScript() {

    this.is_script_ok = 0;

    try {
      const script = JSON.parse(document.querySelector('.ss-script').value);
      this.is_script_ok = 0;
      this.updateEvalState('script', 'green');
      this.evaluateWitness();
    } catch (err) {
      this.updateEvalState('script', 'gray');
      this.updateEvalState('witness', 'gray');
      this.updateEvalState('eval', 'gray');
    }

  }

  evaluateWitness() {

    this.is_witness_ok = 0;

    try {
      const script = JSON.parse(document.querySelector('.ss-witness').value);
      this.is_witness_ok = 1;
      if (this.is_script_ok == 1) {
        this.updateEvalState('witness', 'green');
      } else {
        this.updateEvalState('witness', 'orange');
      }
      this.evaluateScriptAndWitness();
    } catch (err) {
      this.updateEvalState('witness', 'gray');
      this.updateEvalState('eval', 'gray');
    }
  }

  evaluateScriptAndWitness() {

    this.is_evaluate_ok = 0;

    try {
      const script = JSON.parse(document.querySelector('.ss-script').value);
      const witness = JSON.parse(document.querySelector('.ss-witness').value);
      const result = this.mod.evaluate('', script, witness, {});

      if (result === true) {
        this.is_evaluate_ok = 1;
        this.updateEvalState('eval', 'green');
      } else {
        this.updateEvalState('eval', 'yellow');
      }
    } catch {
      if (this.is_script_ok && this.is_witness_ok) {
        this.updateEvalState('eval', 'red');
      } else {
        this.updateEvalState('eval', 'gray');
      }
    }

  }

  updateEvalState(which, state) {
    const el = document.querySelector(`.ss-eval-${which}`);
    if (!el) { return; }
    el.classList.remove('green', 'yellow', 'red', 'gray');
    el.classList.add(state);
  }

  enableBasicMode() {

alert("TESTING BASIC");

    document.querySelector('.ss-template-select').disabled = false;
    document.querySelector('.ss-template-select').classList.remove('ss-disabled');

    //document.querySelector('.ss-script').readOnly = true;
    //document.querySelector('.ss-witness').readOnly = true;

    document.querySelector('.ss-mode-basic').classList.add('active');
    document.querySelector('.ss-mode-expert').classList.remove('active');

    this.evaluateScript();
  }


  enableExpertMode() {

alert("TESTING EXPERT");

    document.querySelector('.ss-template-select').disabled = true;
    document.querySelector('.ss-template-select').classList.add('ss-disabled');

    //document.querySelector('.ss-script').readOnly = false;
    //document.querySelector('.ss-witness').readOnly = false;

    document.querySelector('.ss-mode-expert').classList.add('active');
    document.querySelector('.ss-mode-basic').classList.remove('active');

    const scriptBox = document.querySelector('.ss-script');
    const witnessBox = document.querySelector('.ss-witness');

    const scriptVal = scriptBox.value.trim();
    const witnessVal = witnessBox.value.trim();

    if ((scriptVal === "" && witnessVal === "") || (scriptVal.length < 10)) {
      const expertExample = {
        op: "AND",
        args: [
          { op: "CHECKSIG", publickey: "<publickey>", msg: "hello world" },
          { op: "OR",
            args: [
              { op: "CHECKTIME", after: 1720000000 }
            ]
          }
        ]
      };

      scriptBox.value = JSON.stringify(expertExample, null, 2);
      witnessBox.value = JSON.stringify({}, null, 2);
    }

    this.evaluateScript();
  }



  insertIntoWitness(field, value) {
    const textarea = document.querySelector('.ss-witness');
    textarea.value = textarea.value + `\n${field}: "${value}",`;
  }

  setEditMode(mode) {
    console.log(`Switching to ${mode} mode`);
    // placeholder – will toggle views later
  }


  renderOpcodes() {

    const select = document.querySelector('.ss-template-select');
    if (!select || !this.mod.opcodes) { return; }
    select.querySelectorAll('option:not([disabled])').forEach(opt => opt.remove());
    const opEntries = Object.values(this.mod.opcodes).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const op of opEntries) {
      const opt = document.createElement('option');
      opt.value = op.name.toLowerCase();
      opt.textContent = `${op.name} — ${op.description || 'No description'}`;
      select.appendChild(opt);
    }
  }

}

module.exports = ScriptoriumMain;


