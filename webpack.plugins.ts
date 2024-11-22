
import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
// eslint-disable-next-line @typescript-eslint/no-var-requires
// const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
// const relocateLoader = require('@vercel/webpack-asset-relocator-loader');
// const CopyWebpackPlugin = require("copy-webpack-plugin");

export const plugins = [
    // new ForkTsCheckerWebpackPlugin({
    //     // logger: 'webpack-infrastructure',
    // }),
];
// module.exports = [
    // new ForkTsCheckerWebpackPlugin(),
    // new CopyWebpackPlugin({
    //   patterns: [
    //     {
    //         from: "additional/chunky-boy/chunky-boy.wasm",
    //         to: "chunky-boy.wasm",
    //     },
    //     {
    //         from: "additional/chunky-boy/chunky-boy.worker.js",
    //         to: "chunky-boy.worker.js",
    //     },
    //     {
    //       from: "additional/chunky-boy/chunky-boy.js",
    //       to: "chunky-boy.js",
    //     },
    //   ]
    // }),
// ];
