const saito = require('../../lib/saito/saito');
const ModTemplate = require('../../lib/templates/modtemplate');
const ConfigTemplate = require('./lib/config.template.js');
const AdminHome = require('./index');

class Admin extends ModTemplate {
  constructor(app) {
    super(app);

    this.name = 'Admin';
    this.slug = 'admin';
    this.description = 'Admin module for Saito application management';
    this.categories = 'Admin utilities';
  }

  async initialize(app) {
    await super.initialize(app);
    console.log('initializing admin in saito.js');
  }


  async render() {

    if (!document.querySelector('body')) {
      console.error('No body');
      return;
    }

    console.log('Admin module rendering');

    document.getElementById('page-header').innerHTML =
      `Welcome ${window.need_to_set_key ? '' : 'Back '}to Saito Admin!`;

    this.peerKey = document.getElementById('node-publickey').dataset['publickey'];

    if (window.need_to_set_key) {
      this.setAdminKey();
    }
  }

  /**
   *  GUI for setting the administrator key on initial set up of node
   */
  setAdminKey() {
    this.app.browser.addElementToDom(`
      <hr>
      <h3>Set Trusted Admin Key</h3>
      <p>The node does not have an admin. Please enter the public key you will use to act as admin. If you don't have a public-private key pair ready, you can generate one now.</p>
      <input type="text" id="admin-public-key" value="${this.publicKey}"/>
      <button id="submit-button" type="submit">Submit</button>`);

    document.getElementById('submit-button').onclick = async (e) => {
      let publicKey = document.getElementById('admin-public-key')?.value;

      console.log(publicKey);
      if (!this.app.crypto.isValidPublicKey(publicKey)) {
        salert('Not a valid Saito public key!');
        return;
      }

      e.currentTarget.onclick = null;

      let tx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(this.peerKey);
      tx.msg = {
        module: 'Admin',
        request: 'set-admin-key',
        key: publicKey
      };
      await tx.sign();

      this.app.network.sendTransactionWithCallback(tx, (res_tx) => {
        let res = res_tx.returnMessage();
        if (res?.err) {
          salert(res.err);
        } else {
          siteMessage('admin key successfully set! reloading...');
          reloadWindow(3000);
        }
      });

      await salert('Browser wallet private key copied to clipboard...');
    };
  }

  /**
   * Wait until connected to network to check admin credentials (to return the node info)
   */
  async onPeerHandshakeComplete(app, peer) {

    //
    // we don't care about this if we aren't looking at the admin module
    //
    if (!app.browser_active) { return; }

    if (app.BROWSER && !window.need_to_set_key) {
      if (!document.getElementById('id-check')) {
        this.app.browser.addElementToDom('<div id="id-check">Checking your credentials...</div>');
      }

      let tx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(this.peerKey);
      tx.msg = {
        module: 'Admin',
        request: 'validate-admin-key',
        key: this.publicKey
      };
      await tx.sign();

      this.app.network.sendTransactionWithCallback(tx, (res_tx) => {
        let res = res_tx.returnMessage();
        console.log(res);
        if (res?.err) {
          salert(res.err);
        } else {
          document.getElementById('id-check').remove();
          this.renderConfig(res);
        }
      });
    }
  }

  /**
   * Admin communicates to the node through off-chain transactions
   */
  async handlePeerTransaction(app, tx = null, peer, mycallback) {
    if (this.app.BROWSER) {
      return;
    }

    if (!tx.isTo(this.publicKey)) {
      return;
    }

    if (app.options.admin?.length) {
      let validated = false;
      for (let a of app.options.admin) {
        if (tx.isFrom(a)) {
          validated = true;
        }
      }

      if (!validated) {
        console.error('Unauthorized access!');
        if (mycallback) {
          mycallback({ err: 'Unauthorized access' });
        }

        return;
      }
    }

    let txmsg = tx.returnMessage();

    if (txmsg.request == 'set-admin-key') {
      if (!this.app.options.admin) {
        this.app.options.admin = [];
      }

      this.app.options.admin.push(txmsg.key);
      this.app.storage.saveOptions();

      if (mycallback) {
        mycallback(1);
      }
    }

    if (txmsg.request == 'validate-admin-key') {
      console.log('ADMIN KEY VALIDATION REQUEST!!!!!!');
      mycallback(this.getOptions());
    }

    if (txmsg.request == 'update-modules-config') {
      this.writeModuleConfig(txmsg.config);
    }
  }

  /**
   * Read config/options files from node directory and return summary to administrator
   */
  getOptions() {
    const path = this.app.storage.returnPath();
    const fs = this.app.storage.returnFileSystem();

    const node_info = {};

    if (fs && path) {
      const config_dir = path.normalize(`${__dirname}/../../config`);
      const modules_dir = path.normalize(`${__dirname}/../../mods`);

      if (fs.existsSync(modules_dir)) {
        node_info.available_modules = fs.readdirSync(modules_dir);
      } else {
        console.warn('Cannot find: ', modules_dir);
      }

      if (fs.existsSync(config_dir)) {
        let mcf = fs.readFileSync(`${config_dir}/modules.config.js`, { encoding: 'UTF-8' });

        // Process the file into parsable json
        mcf = mcf.replace(/\s/g, '').replace(/'/g, `"`);
        mcf = mcf.replace('core', `"core"`).replace('lite', `"lite"`);
        mcf = mcf.match(/=.*;/)[0];
        mcf = mcf.substring(1, mcf.length - 1);

        node_info.module_config = JSON.parse(mcf);
      }
    } else {
      console.warn('no path or filesystem available');
    }

    return node_info;
  }

  writeModuleConfig(config_str) {
    const path = this.app.storage.returnPath();
    const fs = this.app.storage.returnFileSystem();
    if (fs && path) {
      const filename = path.normalize(`${__dirname}/../../config/.temp.modules.config.js`);

      fs.writeFileSync(filename, `module.exports = ${config_str};`);
    }
  }

  renderConfig(config_obj) {
    if (!document.getElementById('node-config')) {
      this.app.browser.addElementToDom(ConfigTemplate(config_obj));
    } else {
      this.app.browser.replaceElementById(ConfigTemplate(config_obj), 'node-config');
    }

    // Attach events

    if (document.getElementById('modconfig-button')) {
      document.getElementById('modconfig-button').onclick = async (e) => {
        const inputs = document.querySelectorAll('.mod-config-table input');
        let new_mod_config = { lite: [], core: [] };

        Array.from(inputs).forEach((element) => {
          if (element.checked) {
            let values = element.name.split('-');
            if (values[1] == 'lite') {
              new_mod_config.lite.push(`${values[0]}/${values[0]}.js`);
            } else {
              new_mod_config.core.push(`${values[0]}/${values[0]}.js`);
            }
          }
        });

        console.log('New config: ');
        console.log(new_mod_config);

        let tx = await this.app.wallet.createUnsignedTransactionWithDefaultFee(this.peerKey);
        tx.msg = {
          module: 'Admin',
          request: 'update-modules-config',
          config: JSON.stringify(new_mod_config)
        };
        await tx.sign();

        this.app.network.sendTransactionWithCallback(tx, (res_tx) => {
          let res = res_tx.returnMessage();
          if (res?.err) {
            salert(res.err);
          } else {
            siteMessage('Modules updated');
          }
        });
      };
    }
  }

  webServer(app, expressapp, express) {
    let webdir = `${__dirname}/web`;
    let admin_self = this;

    const serverFn = async (req, res) => {
      let reqBaseURL = req.protocol + '://' + req.headers.host + '/';
      let html = await AdminHome(app, admin_self, app.build_number);
      if (!res.finished) {
        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        return res.send(html);
      }
      return;
    };

    expressapp.get('/', serverFn);
    expressapp.get('/' + encodeURI('admin'), serverFn);
    expressapp.use('/' + encodeURI('admin'), express.static(webdir));
  }
}

module.exports = Admin;
