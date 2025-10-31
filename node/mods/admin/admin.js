var ModTemplate = require('../../lib/templates/modtemplate');
const AdminHome = require('./web/index');

class Admin extends ModTemplate {

  constructor(app) {

    super(app);

    this.name            = "Admin";
    this.slug            = "admin";
    this.description     = "Admin module for Saito application management";
    this.categories      = "Admin utilities";
    
    return this;

  }

  async initialize(app) { 
    super.initialize(app);
    console.log("Admin module initialized");
  }

  async render() { 
    if (document.querySelector('body')) {
       console.log("Admin module rendering");  
    }
  }

  webServer(app, expressapp, express) {
    let webdir = `${__dirname}/web`;
    let admin_self = this;

    // Serve the main admin page at /admin/
    expressapp.get('/admin/', async function (req, res) {
      let reqBaseURL = req.protocol + '://' + req.headers.host + '/';
      let updatedSocial = Object.assign({}, admin_self.social);
      updatedSocial.url = reqBaseURL + 'admin/';

      let html = AdminHome(app, admin_self, app.build_number);
      if (!res.finished) {
        res.setHeader('Content-type', 'text/html');
        res.charset = 'UTF-8';
        return res.send(html);
      }
      return;
    });

    // Serve static files
    expressapp.use('/admin/', express.static(webdir));
  }

}

module.exports = Admin;

