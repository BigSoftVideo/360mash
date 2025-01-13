/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/no-unresolved */
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import  WebpackPlugin  from '@electron-forge/plugin-webpack';
// const WebpackPlugin = require('@electron-forge/plugin-webpack');

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

// const dotenv = require('dotenv');
import dotenv from 'dotenv';
dotenv.config();

import packageJson from './package.json';

const { version } = packageJson;

const buildArch = process.argv[5];
buildArch === "x64"
    ? console.log('\n*** Using x64 binary for DMG ***')
    : console.log('\n*** Using arm64 binary for DMG ***');
const macBinaryLocation = buildArch === "x64"
    ? `${process.cwd()}/out/360mash-darwin-x64/360mash.app`
    : `${process.cwd()}/out/360mash-darwin-arm64/360mash.app`;


const config:ForgeConfig = {
    packagerConfig: {
        name: '360mash',
        // executableName: '360mash',
        // appBundleId: 'dk.aau.360mash',
        // Set application copyright
        // appCopyright: 'Copyright (C) BigSoftVideo 2024',

        icon: "appicons/360mash",

        // Create asar archive for main, renderer process files
        // asar: true,
        asar: {
            // We must add native node modules to this option. Doing so ensures that
            // the modules will be code-signed. (They still end up in the final
            // app.asar file, but they will be code-signed.) Code signing these dylibs
            // is required on macOS for the Node process to properly load them.
            unpack: '*.{node,dll}'
            // unpack: "**/node_modules/**/*.node",
        },

        osxSign: {
            identity: "Developer ID Application: Jacob Davidsen (A6V8WPHL77)",
            optionsForFile: (/*filepath*/) => ({
                // Ensure you return the right entitlements path here based on the file being signed.
                // E.g. The Login Helper should get oldOptions['entitlements-loginhelper']
                entitlements: "entitlements.plist",
                hardenedRuntime: true,
                signatureFlags: "library",
            }),
            // "identity": "Developer ID Application: Jacob Davidsen (A6V8WPHL77)",
            // "hardened-runtime": true,
            // entitlements: "entitlements.plist",
            // "entitlements-inherit": "entitlements.plist",
            // "signature-flags": "library",
            // "gatekeeper-assess": false,
            // "verbose": true
        },
        osxNotarize: (process.env.NOTARIZE && process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD && process.env.APPLE_TEAM_ID)
            ? {
                tool: 'notarytool',
                appleId: process.env.APPLE_ID,
                appleIdPassword: process.env.APPLE_ID_PASSWORD,
                teamId: process.env.APPLE_TEAM_ID,
              }
            : undefined,
        win32metadata: {
            CompanyName: 'BigSoftVideo',
            OriginalFilename: '360mash',
        },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
        name: '360mash',
        authors: 'BigSoftVideo',
        exe: '360mash.exe',
        setupExe: `360mash-win-x64-${version}.exe`,
        setupIcon: __dirname + "/appicons/360mash.ico",
        iconUrl: __dirname + "/appicons/360mash.ico",
        skipUpdateIcon: true,
        // loadingGif: __dirname + '/config/forge/installer_assets/Dote_Installing_squirrel.gif',
    }),
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
        name: `360mash-osx-1.0.0-beta-1`,
        icon: `${process.cwd()}/appicons/360mash.icns`,
        // iconTextSize: 14,
        iconSize: 96,
        additionalDMGOptions: {
            window: {
                position: {
                    x: 100, y: 100
                },
                size: {
                    width: 640, height: 470
                }
            },
            // "code-sign": {
            //     "signing-identity": ""
            //     // identifier:
            // },
        },
        // background: 'config/forge/installer_assets/DMG-wallpaper-1.0.2.tif',
        contents: [
            { name: "360mash.app", x: 140, y: 325, type: "file", path: `${macBinaryLocation}`},
            { name: "Applications", x: 510, y: 320, type: "link", path: "/Applications" },
            // { name: "EULA.pdf", x: 510, y: 175, type: "file", path: `${process.cwd()}/config/forge/installer_assets/EULA.pdf`},
            // { name: ".background", x: 2000, y: 2000, type: "position", path: '.background'},
            { name: ".VolumeIcon", x: 2100, y: 2000, type: "position", path: '.VolumeIcon.icns'}
        ],
        format: 'ULFO',
        overwrite: true,
  }),
  new MakerRpm({}), new MakerDeb({})],
  plugins:
  [
    // new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
        mainConfig: mainConfig,
    //   devContentSecurityPolicy: "default-src 'self'; media-src file:; script-src 'unsafe-eval'; script-src-elem 'self'; img-src *; style-src 'self' 'unsafe-inline'; font-src 'self' https://static2.sharepointonline.com/files/fabric/assets/icons/; connect-src 'self';",
        devContentSecurityPolicy: "script-src 'self' 'unsafe-eval' file: *;",
        port: 3000, // Webpack Dev Server port
        loggerPort: 9000, // Logger port

        renderer: {
            config: rendererConfig,
            entryPoints: [
                {
                    html: "./src/index.html",
                    js: "./src/renderer.tsx",
                    name: "main_window"
                }
            ]
        }
    }),
  ],
};

function notarizeMaybe() {
    if (process.platform !== 'darwin') {
        return;
    }

    if (!process.env.NOTARIZE) {
        console.log(`Notarize flag off, skipping notarization for this build`);
        return;
    }

    if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD || !process.env.APPLE_TEAM_ID) {
        console.warn(
            'Should be notarizing, but environment variables APPLE_ID or APPLE_ID_PASSWORD or APPLE_TEAM_ID are missing!',
        );
        return;
    }
    if (config.packagerConfig) {
        config.packagerConfig.osxNotarize = {
            tool: 'notarytool',
            // appBundleId: 'dk.aau.id.dote', // No longer used under 'notarytool' [https://github.com/electron/notarize]
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_ID_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
        };
    } else {
        console.warn(`PackagerConfig is not defined, could not set notarize components.`);
    }
}

notarizeMaybe();

module.exports = config;
