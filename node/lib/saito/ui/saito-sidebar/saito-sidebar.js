const SaitoSidebarTemplate = require('./saito-sidebar.template');
const UIModTemplate = require('./../../../templates/uimodtemplate');

class SaitoSidebar extends UIModTemplate {
  constructor(app, mod = null, container = '.saito-container') {
    super(app, mod);

    this.app = app;
    this.mod = mod;
    this.container = container;
    this.name = 'SaitoSidebar UIComponent';
    this.align = 'left';

    this.initialize(app);
  }

  async render() {
    let qs = `.saito-sidebar.${this.align}`;

    if (document.querySelector(qs)) {
      this.app.browser.replaceElementBySelector(SaitoSidebarTemplate(this.align), qs);
    } else {
      this.app.browser.addElementToSelector(SaitoSidebarTemplate(this.align), this.container);
    }

    await super.render();
    this.attachEvents();
  }

  attachEvents() {}
}

module.exports = SaitoSidebar;
