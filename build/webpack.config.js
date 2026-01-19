const path = require("path");

module.exports = {
  optimization: {
    minimize: false,
  },
  target: "web",
  node: {
    fs: "empty",
  },

    
  experiments: {
    asyncWebAssembly: true,
    syncWebAssembly: true,
    topLevelAwait: true
  },
  externals: [
    {
      archiver: "archiver",
    },
    {
      child_process: "child_process",
    },
    {
      nodemailer: "nodemailer",
    },
    {
      jimp: "jimp",
    },
    {
      "image-resolve": "image-resolver",
    },
    {
      sqlite: "sqlite",
    },
    {
      unzipper: "unzipper",
    },
    {
      webpack: "webpack",
    },
    /\.txt/,
    /\.png$/,
    /\.jpg$/,
    /\.html$/,
    /\.css$/,
    /\.sql$/,
    /\.md$/,
    /\.pdf$/,
    /\.sh$/,
    /\.zip$/,
    /\/web\//,
    /\/www\//,
  ],
  entry: ["babel-polyfill", path.resolve(__dirname, "./../../bundler/default/apps/lite/index.js")],

  output: {
    path: path.resolve(__dirname, "./../../web/saito"),
    filename: "saito.js",
  },

  module: {
    rules: [
      {
        test: /html$/,
        exclude: [/(mods)/, /(email)/],
      },
      {
        test: /\.(js|jsx)$/, 
        exclude: /(node_modules)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
      {
        test: /quirc\.js$/,
        loader: "exports-loader",
      },
      {
        test: /\.wasm$/,
         type: "asset/resource",
         generator: {
           filename: 'static/zkey/[name][hash][ext]'
         }
      },
      {
        test: /\.zkey$/,
        type: "asset/resource",
        generator: {
          filename: 'static/zkey/[name][hash][ext]'
        }
      },
      {
        test: /\.ptau$/,
        type: "asset/resource",
        generator: {
          filename: 'static/zkey/[name][hash][ext]'
        }
      },
      {
        test: /\.zip$/,
        exclude: [
          path.resolve(__dirname, "../mods/devtools/bundler"),
          path.resolve(__dirname, "../mods/devtools/mods"),
        ],
      },
    ],
  },
  resolve: {
    alias: {
      ModTemplate$: path.resolve(__dirname, "../lib/templates/modtemplate.js"),
    },
  },
  mode: "development",
  devtool: "cheap-module-eval-source-map",
};
