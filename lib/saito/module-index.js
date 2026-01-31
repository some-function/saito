module.exports = (app, mod, buildNumber) => {
  const modTitle = mod.title ? mod.title : mod.returnName();
  return `
    <!DOCTYPE html>
    <html lang="en" data-theme="lite">
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Welcome to Saito" />
        <meta name="author" content="" />

        <link rel="stylesheet" type="text/css" href="/saito/saito.css?v=${buildNumber}" />
        <link rel="stylesheet" type="text/css" href="/${mod.returnSlug()}/style.css?v=${buildNumber}" />

        <title>${modTitle}</title>
      
        <script type="text/javascript" src="/saito/saito.js?build=${buildNumber}" async></script>
      </head>
      
      <body>
        ${modTitle} is installed.
      </body>
    </html>
  `;
};