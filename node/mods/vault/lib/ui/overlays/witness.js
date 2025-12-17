const WitnessTemplate = require('./witness.template');
const SaitoOverlay = require('./../../../../../lib/saito/ui/saito-overlay/saito-overlay');


class Witness {

  constructor(app, mod, container = '') {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    this.callback = null;
    this.access_script = null;
  }

  render() {
    this.overlay.show(WitnessTemplate(this.app, this.mod, this));
    
    setTimeout(() => {
      // Prepopulate witness data textarea with template
      if (this.access_script) {
        let scripting_mod = this.app.modules.returnModule("Scripting");
        if (scripting_mod && scripting_mod.generateWitnessFromScript) {
          let witnessTemplate = scripting_mod.generateWitnessFromScript(this.access_script);
          let witnessTextarea = document.querySelector('.witness-data-textarea');
          if (witnessTextarea && witnessTemplate) {
            witnessTextarea.value = JSON.stringify(witnessTemplate, null, 2);
          }
        }
      }
      
      this.attachEvents();
    }, 25);
  }

  attachEvents() {

    try {
      document.getElementById('download_with_witness_btn').onclick = (e) => {
        let witness_data = document.querySelector('.witness-data-textarea').value;
        
        if (!witness_data || witness_data.trim() === '') {
          salert('Please provide witness data to proceed.');
          return;
        }

        // Validate JSON format
        try {
          JSON.parse(witness_data);
        } catch (err) {
          salert('Invalid JSON format in witness data. Please check your input.');
          return;
        }

        if (this.callback) {
          this.callback({ witness_data: witness_data });
          this.overlay.remove();
        } else {
          salert('Error: No callback function defined.');
        }
      };

      // Help link handler
      let helpLink = document.getElementById('witness-help-link');
      if (helpLink) {
        helpLink.onclick = (e) => {
          salert('The witness data must be valid JSON that satisfies the access script requirements. For example, if the script checks a CHECKHASH, you would provide: {"input": "[secret input]"}');
        };
      }
    } catch (err) {
      console.error('Witness overlay attachEvents error:', err);
    }

  }

}

module.exports = Witness;

