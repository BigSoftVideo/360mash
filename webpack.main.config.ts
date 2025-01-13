import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import path from 'path';

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: {
    main: './src/index.ts'
  },
  externals: ['bufferutil', 'utf-8-validate'],
//   output: {
//     path: path.resolve(__dirname, 'dist'),
//     filename: '[name].js',
//     chunkFilename: '[id].[chunkhash].js'
//   },
  // Put your normal webpack config below here
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    // modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
    alias: require('./webpack.aliases'),
  },
  stats: 'minimal',
  target: 'electron-main'
};