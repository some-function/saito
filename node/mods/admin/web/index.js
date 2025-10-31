module.exports = (app, mod, build_number) => {
  return `

  
  <!DOCTYPE html>
  <html lang="en" data-theme="dark">
  
  <head>

    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />

    <meta name="description" content="${app.browser.escapeHTML(mod.description)}" />
    <meta name="keywords" content="${mod.categories}"/>
    <meta name="author" content="Saito"/>
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=yes" />
  
    <link rel="stylesheet" href="/saito/lib/font-awesome-6/css/fontawesome.min.css" type="text/css" media="screen" />
    <link rel="stylesheet" href="/saito/lib/font-awesome-6/css/all.css" type="text/css" media="screen" />
  
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="application-name" content="saito.io admin" />
    <meta name="apple-mobile-web-app-title" content="Saito Admin" />
    <meta name="theme-color" content="#FFFFFF" />
    <meta name="msapplication-navbutton-color" content="#FFFFFF" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="msapplication-starturl" content="/index.html" />
  
    <!--script data-pace-options='{ "restartOnRequestAfter" : false, "restartOnPushState" : false}' src="/saito/lib/pace/pace.min.js"></script>
    <link rel="stylesheet" href="/saito/lib/pace/center-atom.css">
    <link rel="stylesheet" type="text/css" href="/saito/saito.css?v=${build_number}" /-->
    
    <title>Saito Admin</title>
  
    <!--style type="text/css">
    /* css for fade-out bg effect while content is loading */
    
    body::before {
      content: "";
      opacity: 1;
      z-index: 160;
      /*saito-header has z-index:15 */
      position: absolute;
      top: 0;
      left: 0;
      display: block;
      height: 100vh;
      width: 100vw;
      /* hardcode bg colors used because saito-variables arent accessible here */
      background-color: #1c1c23;
      background-image: url('/saito/img/tiled-logo.svg');
    }
      
  </style-->
  </head>
  
  <body>
    <h1>Welcome to Saito Admin!</h1>
    <p>If you are reading this, your node is working</p>
    <p>For online documentation, refer to our <a href="wiki.saito.io">wiki</a>.</p>
  </body>
  <!--script type="text/javascript" src="/saito/saito.js?build=${build_number}" >
</script-->
  </html>
  
  `;
};