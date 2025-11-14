const VaultMainTemplate = require('./main.template.js');

class VaultMain {

  constructor(app, mod, container = "") {

    this.app = app;
    this.mod = mod;
    this.container = container;

  }

  render(container = "") {

    if (container !== "") {
      this.container = container;
    }

    if (!this.container || this.container.trim() === "") {
      this.container = ".saito-container";
    }

    const html = VaultMainTemplate(this.app, this.mod);

    //
    // if scriptorium doesn't exist, append it
    // otherwise, replace its content (for dynamic refresh)
    //
    if (!document.querySelector(".saito-vault")) {
      this.app.browser.addElementToSelector(html, this.container);
    } else {
      this.app.browser.replaceElementBySelector(html, ".saito-vault");
    }

   
    this.attachEvents();

  }



  attachEvents() {

  }

}

module.exports = VaultMain;


