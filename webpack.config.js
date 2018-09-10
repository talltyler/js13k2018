const webpack = require("webpack");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
module.exports = {
  mode: 'development', // 'production', // 
  entry: "./src/main.js",
  // devtool: 'source-map',
  output: {
    path: __dirname + '/build',
    // libraryTarget: "umd",
    // libraryTarget: "iift",
    filename: "build.js",
    // sourceMapFilename: "build.js.map"
  },
  optimization: {
    minimizer: [
      // we specify a custom UglifyJsPlugin here to get source maps in production
      new UglifyJsPlugin({
        cache: true,

        parallel: true,
        uglifyOptions: {
          passes:2,
          unsafe:true,
          unsafe_arrows: true,
          unsafe_methods: true,
          unsafe_proto: true,
          toplevel: true,
          hoist_funs:false,
          hoist_vars: true, // test
          compress: true,
          ecma: 8,
          mangle: true
        },
        sourceMap: false
      })
    ]
  }
};
