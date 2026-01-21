const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

const webpack = require("webpack");

let minimize = true;
let devtool = undefined;
let entrypoint = "../bundler/default/index/lite.ts";
let outputfile = "saito.js";
if (process.argv.includes("dev")) {
  console.log("dev mode source not minified");
  minimize = false;
  devtool = "eval";
}
if (process.argv.includes("web3")) {
  entrypoint = "../bundler/default/index/lite-web3index.ts";
  outputfile = "web3saito.js";
}
webpack(
  {
    cache: {
      type: "filesystem",
    },
    optimization: {
      minimize: minimize,
      minimizer: [
        new TerserPlugin({
          parallel: true,
        }),
      ],
      splitChunks: {
        chunks: "async",
        minSize: 20000,
        minRemainingSize: 0,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        enforceSizeThreshold: 50000,
        cacheGroups: {
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      },
    },
    target: "web",
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
      {
        "node-turn": "node-turn",
      },
      /\.txt /,
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
    entry: ["babel-polyfill", path.resolve(__dirname, entrypoint)],
    output: {
      path: path.resolve(__dirname, "./../web/saito"),
      filename: outputfile,
    },
    resolve: {
      extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js", ],
      fallback: {
        fs: false,
        tls: false,
        net: false,
        path: require.resolve("path-browserify"),
        zlib: false,
        http: false,
        https: false,
        stream: require.resolve("stream-browserify"),
        buffer: require.resolve("buffer"),
        crypto: require.resolve("crypto-browserify"),
        "crypto-browserify": require.resolve("crypto-browserify"),
      },
    },
    experiments: {
      asyncWebAssembly: true,
      syncWebAssembly: true,
      topLevelAwait: true
    },
    
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /(node_modules)/,
          use: [{
            loader: 'ts-loader',
            options: {
                configFile:path.resolve(__dirname, "../build/tsconfig.json")
            },
            
        }],
        },
        {
          test: /\.js$/,
          use: [
            "source-map-loader",
            {
              loader: "babel-loader",
              options: {
                root: path.resolve(__dirname, './build'),
                rootMode: "upward",
                presets: ["@babel/preset-env", "@babel/preset-react"],
                sourceMaps: false,
                cacheCompression: false,
                cacheDirectory: true,
              },
            },
          ],
        },
        {
          test: /\.mjs$/,
          exclude: /(node_modules)/,
          type: "javascript/auto",
        },
        {
          test: /html$/,
          exclude: [/(mods)/, /(email)/],
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
          test: /\.circom$/,
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
        { 
          test: /\.m?js/, 
          resolve: { 
            fullySpecified: false 
          } 
        }
      ],

    },
    plugins: [
      new webpack.ProvidePlugin({
        Buffer: ["buffer", "Buffer"],
      }),
      new webpack.ProvidePlugin({
        process: "process/browser",
      }),
    ],
 
    mode: "production",
    devtool: devtool,
  },
  (err, stats) => {
    if (err || stats.hasErrors()) {
      console.log(err);
      if (stats) {
        let info = stats.toJson();
        console.log(info.errors);
      }
    }
    console.log("Bundle Success!");
  }
);