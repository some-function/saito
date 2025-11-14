const saito = require('./../../lib/saito/saito');
const SaitoHeader = require('./../../lib/saito/ui/saito-header/saito-header');
const ModTemplate = require('./../../lib/templates/modtemplate');
const VaultMain = require('./lib/ui/main');


class Vault extends ModTemplate {

	constructor(app) {

		super(app);

		this.appname = 'Vault';
		this.name = 'Vault';
		this.slug = 'vault';
		this.description = 'Storage Vault regulated by NFT Keys';
		this.categories = 'Utility Cryptography Programming';

		this.main = new VaultMain(this.app, this, ".saito-container");

	}

	initialize(app) {

		this.header = new SaitoHeader(this.app, this);

	}

	render() {

		this.header.render();
		this.main.render();

	}

}

module.exports = Vault;

