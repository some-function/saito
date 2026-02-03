module.exports = (app, mod) => {
  const publicOptions = Object.assign({}, app.options);
  delete publicOptions.wallet;
  const opt_str = JSON.stringify(publicOptions, (_, v) => (typeof v === "bigint" ? v.toString() : v));

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>

        <title>Saito Status</title>

        <link rel="stylesheet" href="/saito/saito.css?v=${app.buildNumber}"/>
        <link rel="stylesheet" href="/status/style.css?v=${app.buildNumber}"/>
      </head>

      <body>
        <div id="status-container"></div>

        <script type="text/javascript">
          window.statusOptions = "${opt_str}";
        </script>

        <script src="/saito/saito.js?build=${app.buildNumber}"></script>
      </body>
    </html>
  `;
};