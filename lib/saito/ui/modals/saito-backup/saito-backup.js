const SaitoBackupTemplate = require('./saito-backup.template');
const SaitoOverlay = require('./../../saito-overlay/saito-overlay');

class SaitoBackup {
  constructor(app, mod) {
    this.app = app;
    this.mod = mod;
    this.overlay = new SaitoOverlay(this.app, this.mod);
    this.msg = null;
    this.title = null;
    this.success_callback = null;

    this.app.connection.on('saito-backup-render-request', async (obj) => {
      let key = this.app.keychain.returnKey(this.publicKey);
      if (key?.email && key?.wallet_decryption_secret && key?.wallet_retrieval_hash) {
        this.app.connection.emit('recovery-backup-overlay-render-request', obj);
        return;
      }

      this.app.options.wallet.backup_required = obj?.msg || false;
      this.msg =
        obj?.msg ||
        'Protect your balances, contacts, and keys by downloading a snapshot of your current wallet state';
      this.title = obj?.title || 'WALLET BACKUP';
      this.success_callback = () => {
        delete this.app.options.wallet.backup_required;
        this.overlay.remove();
        if (obj.success_callback) {
          obj.success_callback();
        }
      };

      await this.render();
    });
  }

  render() {
    if (!document.getElementById('backup-template')) {
      this.overlay.show(SaitoBackupTemplate(this), this.callBackFunction.bind(this));
    } else {
      this.app.browser.replaceElementById(SaitoBackupTemplate(this), 'backup-template');
    }

    this.attachEvents();
  }

  attachEvents() {
    let this_self = this;

    document.querySelector('#saito-backup-manual').addEventListener('click', async () => {
      await this.app.wallet.backupWallet();
      this.success_callback();
    });

    if (document.querySelector('#saito-backup-auto')) {
      document.querySelector('#saito-backup-auto').addEventListener('click', async () => {
        this.app.connection.emit('recovery-backup-overlay-render-request', {
          success_callback: this.success_callback
        });
      });
    }
  }

  async callBackFunction() {
    await this.app.wallet.saveWallet();
  }
}

module.exports = SaitoBackup;