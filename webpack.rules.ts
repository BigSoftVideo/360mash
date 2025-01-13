import type { ModuleOptions } from 'webpack';
import path from "path";

// export const rules: Required<ModuleOptions>['rules'] = [
export const rules: Required<ModuleOptions>['rules'] = [
  // Add support for native node modules
  {
    // We're specifying native_modules in the test because the asset relocator loader generates a
    // "fake" .node file which is really a cjs file.
    // ALSO:
    // Apparently just checking for .node modules is not enough since we need
    // the actual xxx.node to trigger a rebuild of the module into the
    // Electron binary and webpack will create a .node-file that just LINKS to
    // the correct (actual) xxx.node. Without the `native_modules`, a
    // rebuild will never commence, and hence xxx will remain unavailable
    // on macOS
    //              Previously:     test: /native_modules\/.+\.node$/,
    test: /native_modules[/\\].+\.node$/,
    use: [{ loader: 'node-loader'}],
  },
//   {
//     // test: /\.(m?js|node)$/,
//     test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
//     parser: { amd: false },
//     use: {
//       loader: '@vercel/webpack-asset-relocator-loader',
//       options: {
//         outputAssetBase: 'native_modules',
//       },
//     },
//   },
  {
    test: /\.worker\.ts$/,
    use: [
        {
            loader: "worker-loader",
            options: {
                filename: "static/js/[name].js",
                publicPath: "../", // move up from 'main_window',
                // context: "src", // set relative working folder to src
            },
        },
        {
            loader: "ts-loader",
            options: {
                transpileOnly: true,
            },
        },
    ],
  },
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
      },
    },
  },
  {
    // Less loader
    test: /\.less$/,
    use: [
        { loader: 'style-loader' },
        { loader: 'css-loader' },
        { loader: 'less-loader' },
    ],
},
  {
    test: /\.jsx?$/,
    use: {
        loader: "babel-loader",
        options: {
            // exclude: /(node_modules|bower_components|additional)/,
            exclude: [
                path.resolve(__dirname, "/node_modules/"),
                path.resolve(__dirname, "/bower_components/"),
                path.resolve(__dirname, "/additional/")
            ],
                // /(node_modules|bower_components|additional)/,
            presets: ['@babel/preset-env', '@babel/preset-react'],
            // presets: ['@babel/preset-env', { targets: "defaults" }]
        }
    }
},
{
    // Assets loader
    // More information here https://webpack.js.org/guides/asset-modules/
    test: /\.(gif|jpe?g|tiff|png|webp|bmp|svg|eot|ttf|woff|woff2)$/i,
    // use: ['file-loader'],
    // Becasue Webpack 5 (prevents duplication)
    // type: 'javascript/auto',
    type: 'asset',
    generator: {
        filename: 'assets/[hash][ext][query]',
    },
},
];
