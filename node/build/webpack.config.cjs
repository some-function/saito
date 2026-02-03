const webpack = require("webpack");  const path = require("path");  const relPath = (absPath) => path.resolve(__dirname, absPath);
const resolve = require.resolve;  const babelPresets = ["@babel/preset-env", ["@babel/preset-react", {runtime: "automatic"}]];
const babelOptions = {presets: babelPresets, sourceMaps: false, cacheCompression: false, cacheDirectory: true};
webpack({
  output: {path: relPath("../web/saito"), filename: "saito.js"},
  entry: ["babel-polyfill", relPath("../bundler/default/index/lite.ts")], mode: "production", target: "web", cache: {type: "filesystem"},
  experiments: {asyncWebAssembly: true, syncWebAssembly: true, topLevelAwait: true}, devtool: process.argv.includes("dev") ? "eval" : undefined,
  plugins: [new webpack.ProvidePlugin({Buffer: ["buffer", "Buffer"]}), new webpack.ProvidePlugin({process: "process/browser"})],
  optimization: {
    minimize: !process.argv.includes("dev"), minimizer: [new (require("terser-webpack-plugin"))({parallel: true})],
    splitChunks: {
      chunks: "async", minSize: 20000, minRemainingSize: 0, minChunks: 1, maxAsyncRequests: 30, maxInitialRequests: 30, enforceSizeThreshold: 50000,
      cacheGroups: {
        defaultVendors: {priority: -10, reuseExistingChunk: true, test: /[\\/]node_modules[\\/]/},
        default:        {priority: -20, reuseExistingChunk: true, minChunks: 2},
      }
    }
  },
  externals: [
    ...["archiver", "child_process", "nodemailer", "jimp", "sqlite", "unzipper", "webpack", "node-turn"].map((p) => Object.fromEntries([[p, p]])),
    {"image-resolve": "image-resolver"}, /\.(txt|png|jpg|html|css|sql|md|pdf|sh|zip)$/, /\/(web|www)\//
  ],
  resolve: {
    extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js", ".jsx"],
    fallback: {
      fs: false, tls: false, net: false, zlib: false, path: resolve("path-browserify"), "crypto-browserify": resolve("crypto-browserify"),
      http: false, https: false, stream: resolve("stream-browserify"), buffer: resolve("buffer"), crypto: resolve("crypto-browserify")
    }
  },
  module: {rules: [
    {test: /\.tsx?$/, exclude: /(node_modules)/, use: [{loader: "ts-loader", options: {configFile: relPath("../build/tsconfig.json")}}]},
    {test: /\.jsx?$/, use: ["source-map-loader", {loader: "babel-loader", options: babelOptions}]}, {test: /html$/, exclude: [/(mods)/, /(email)/]},
    {test: /\.mjs$/, exclude: /(node_modules)/, type: "javascript/auto"}, {test: /\.m?js/, resolve: {fullySpecified: false}},
    {test: /\.(wasm|zkey|ptau|circom)$/, type: "asset/resource", generator: {filename: "static/zkey/[name][hash][ext]"}},
    {test: /\.zip$/, exclude: ["bundler", "mods"].map((dir) => relPath(`../mods/devtools/${dir}`))}, {test: /quirc\.js$/, loader: "exports-loader"}
  ]}
}, (err, stats) => {
  if (err || stats.hasErrors()) { console.log(err); if (stats) { console.log(stats.toJson().errors); } } else { console.log("Bundle Success!"); }
});