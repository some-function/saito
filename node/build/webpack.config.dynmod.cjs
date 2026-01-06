const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");

const entryArg = process.argv.find((arg) => arg.startsWith("--entrypoint="));
const entrypoint = `../tmp_mod/${entryArg.split("=")[1]}`;

webpack(
  {
    optimization: {minimize: false, minimizer: [new TerserPlugin({parallel: true})]}, entry: [path.resolve(__dirname, entrypoint)],
    target: "web", externalsType: "global", experiments: {asyncWebAssembly: true, outputModule: true}, mode: "production", devtool: undefined,
    output: {path: path.resolve(__dirname, "../build/dyn/web"), filename: "dyn.module.js", library: {name: "Dyn", type: "window"}},
    plugins: [new webpack.ProvidePlugin({Buffer: ["buffer", "Buffer"]}), new webpack.ProvidePlugin({process: "process/browser"})],
    externals: {
      "saito-js": "saito-js", "saito-js/lib/transaction": "saito-js/lib/transaction", "saito-js/lib": "saito-js/lib",
      "saito-js/lib/slip": "saito-js/lib/slip", "saito-js/lib/block": "saito-js/lib/block",
    },
    resolve: {
      extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js",".template.js"],
      fallback: {
        fs: false, tls: false, net: false, zlib: false, http: false, https: false,
        stream: require.resolve("stream-browserify"), buffer: require.resolve("buffer"), crypto: require.resolve("crypto-browserify"),
        "crypto-browserify": require.resolve("crypto-browserify"), path: require.resolve("path-browserify"),
      }
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/, exclude: /(node_modules)/,
          use: [{loader: "ts-loader", options: {configFile: path.resolve(__dirname, "../build/tsconfig.json")}}]
        },
        {
          test: /\.js$/, exclude: /(node_modules)/,
          use: [
            "source-map-loader",
            {loader: "babel-loader", options: {presets: ["@babel/preset-env"], sourceMaps: false, cacheCompression: false, cacheDirectory: true}},
          ]
        },
        {
          test: /\.mjs$/, exclude: /(node_modules)/,
          use: [{loader: "babel-loader", options: {presets: ["@babel/preset-env"], sourceMaps: false, cacheCompression: false, cacheDirectory: true}}],
        },
        {test: /html$/, exclude: [/(mods)/, /(email)/]}, {test: /\.(png|svg|jpg|jpeg|gif)$/i, type: "asset/inline"},
        {test: /\.zip$/, exclude: [path.resolve(__dirname, "../mods/devtools/bundler"), path.resolve(__dirname, "../mods/devtools/mods")]}
      ]
    }
  },
  (err, stats) => {
    if (err || stats.hasErrors()) { console.error(err); if (stats) { console.error(stats.toJson().errors); } }
    console.log("Bundle Success!");
  }
);