const KeyTemplate = require('./keyentry.template');
const PhraseTemplate = require('./phraseentry.template');
const SaitoOverlay = require('./../../saito-overlay/saito-overlay');

class SaitoRecover {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;

    this.modal_overlay = new SaitoOverlay(this.app, this.mod);
  }

  render(mode = 'key') {
    if (mode == 'key') {
      this.modal_overlay.show(KeyTemplate());
    } else {
      this.modal_overlay.show(PhraseTemplate());
    }

    document.querySelector('.saito-overlay-form-input').focus();

    this.attachEvents();
  }

  attachEvents() {
    if (document.getElementById('private-key-submit')) {
      document.getElementById('private-key-submit').onclick = (e) => {
        let privatekey = document.getElementById('private-key-input').value;
        this.loadPrivateKey(privatekey);
      };
    }

    if (document.getElementById('seed-phrase-submit')) {
      document.getElementById('seed-phrase-submit').onclick = (e) => {
        let seedPhrase = document.getElementById('seed-phrase-input').value;
        let privatekey = this.app.crypto.getPrivateKeyFromSeed(seedPhrase);
        this.loadPrivateKey(privatekey);
      };
    }

    if (document.getElementById('input-seed-phrase')) {
      document.getElementById('input-seed-phrase').onclick = () => {
        this.render('phrase');
      };
    }

    if (document.getElementById('input-private-key')) {
      document.getElementById('input-private-key').onclick = () => {
        this.render('key');
      };
    }
  }

  loadFile() {
    if (!document.getElementById('file-input')) {
      this.app.browser.addElementToDom(
        `<input id="file-input" class="file-input" type="file" accept=".json, .aes" style="display:none;" />`
      );
    }

    document.getElementById('file-input').onChange = async function (e) {
      var file = e.target.files[0];

      let wallet_reader = new FileReader();
      wallet_reader.readAsBinaryString(file);
      wallet_reader.onloadend = async () => {
        let result = await app.wallet.onUpgrade('import', '', wallet_reader);

        if (result === true) {
          alert('Restoration Complete ... click to reload Saito');
          reloadWindow(300);
        } else {
          let err = result;
          if (err.name == 'SyntaxError') {
            salert('Error reading wallet file. Did you upload the correct file?');
          } else if (false) {
            // put this back when we support encrypting wallet backups again...
            salert('Error decrypting wallet file. Password incorrect');
          } else {
            salert('Unknown error<br/>' + err);
          }
        }
      };
    };

    document.getElementById('file-input').click();
  }

  async loadPrivateKey(privatekey) {
    if (privatekey) {
      try {
        let result = await this.app.wallet.onUpgrade('import', privatekey);

        if (result === true) {
          let c = await sconfirm('Success! Confirm to reload');
          if (c) {
            reloadWindow(300);
          }
        } else {
          let err = result;
          salert('Something went wrong: ' + err.name);
        }
      } catch (e) {
        salert('Restore Private Key ERROR: <br> ' + e);
        console.error('Restore Private Key ERROR: ' + e);
      }
    }
  }
}

module.exports = SaitoRecover;
