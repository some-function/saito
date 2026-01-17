const ModTemplate = require('./modtemplate');

class UIModTemplate extends ModTemplate {
  constructor(app, mod, container = '') {
    super(app, mod, container);

    this.browser_active = 1;

    if (this.name == '') {
      this.name = 'UI Component';
    }
  }

  async initialize(app) {
    if (!app.modules.uimods.includes(this)) {
      app.modules.uimods.push(this);
    }
    await super.initialize(app);
  }
}

module.exports = UIModTemplate;