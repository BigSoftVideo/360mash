const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = [
  new ForkTsCheckerWebpackPlugin(),
  new CopyWebpackPlugin({
    patterns: [
      {
          from: "additional/chunky-boy/chunky-boy.wasm",
          to: "chunky-boy.wasm",
      },
      {
          from: "additional/chunky-boy/chunky-boy.worker.js",
          to: "chunky-boy.worker.js",
      },
      {
        from: "additional/chunky-boy/chunky-boy.js",
        to: "chunky-boy.js",
      },
    ]
  }),
];
