const ScriptoriumMainTemplate = require('./main.template.js');
const SignMessageOverlay = require('./overlays/sign_message.js');
const GenerateHashOverlay = require('./overlays/generate_hash.js');
const VerifySignatureOverlay = require('./overlays/verify_signature.js');

class ScriptoriumMain {

  constructor(app, mod, container = "") {
    this.app = app;
    this.mod = mod;
    this.container = container;
    this.sign_message_overlay = new SignMessageOverlay(this.app, this.mod);
    this.generate_hash_overlay = new GenerateHashOverlay(this.app, this.mod);
    this.verify_signature_overlay = new VerifySignatureOverlay(this.app, this.mod);
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


    document.querySelector('.ss-script').addEventListener('input', (e) => {
      try {
        JSON.parse(e.target.value);
        this.updateEvalState('script', 'green');
        this.evaluateScriptAndWitness();
      } catch {
        this.updateEvalState('script', 'red');
        this.updateEvalState('eval', 'gray');
      }
    });

    document.querySelector('.ss-witness').addEventListener('input', (e) => {
      try {
        JSON.parse(e.target.value);
        this.updateEvalState('witness', 'green');
        this.evaluateScriptAndWitness();
      } catch {
        this.updateEvalState('witness', 'red');
        this.updateEvalState('eval', 'gray');
      }
    });

  }

  evaluateScriptAndWitness() {

    try {
      const script = JSON.parse(document.querySelector('.ss-script').value);
      const witness = JSON.parse(document.querySelector('.ss-witness').value);
      const result = this.mod.evaluate('', script, witness, {});

      if (result === true) {
        this.updateEvalState('eval', 'green');
      } else {
        this.updateEvalState('eval', 'yellow');
      }
    } catch {
      this.updateEvalState('eval', 'red');
    }

  }

  updateEvalState(which, state) {
    const el = document.querySelector(`.ss-eval-${which}`);
    if (!el) { return; }
    el.classList.remove('green', 'yellow', 'red', 'gray');
    el.classList.add(state);
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


