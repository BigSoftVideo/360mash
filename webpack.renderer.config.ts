import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';
import path from 'path';

rules.push({
    test: /\.css$/,
    use: [
        { loader: 'style-loader' },
        { loader: 'css-loader' },
        ],
    // exclude: path.resolve(__dirname, "/node_modules/")
    // include: [path.resolve(__dirname, "app/src")],
});

export const rendererConfig: Configuration = {
    module: {
        rules,
        //noParse: /src\/dynamic-require.js$/,
        noParse: /\/dynamic-require.js$/,
    },
    externals:
    //     // electron: 'commonjs2 electron',
        //[/node_modules/, 'bufferutil', 'utf-8-validate', 'electron', 'commonjs2']
        ['bufferutil', 'utf-8-validate']
    ,
    plugins,
    resolve: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
        modules: ['node_modules'],
        // modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
        alias: {
            // React Hot Loader Patch
            // 'react-dom': '@hot-loader/react-dom',
            // Custom Aliases
            ...require('./webpack.aliases'),
        },
        // alias: {
        //     'gl-matrix': path.resolve(__dirname, 'node_modules/gl-matrix'),
        // },
    },
    stats: 'minimal',
    target: 'electron-renderer',
};
