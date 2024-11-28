/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */


import './index.css';

import * as React from 'react';
// React 17:
// import * as ReactDOM from 'react-dom';
// React 18:
import { createRoot } from "react-dom/client";

import { App } from "./app";

// React 17:
// ReactDOM.render(
//     <React.StrictMode>
//         {/* <Provider store={store}> */}
//             <App/>
//         {/* </Provider> */}
//     </React.StrictMode>,
//     document.getElementById("app")
// );
// ReactDOM.render(<App />, document.getElementById('app'));
import { initializeIcons } from '@fluentui/react/lib/Icons';
initializeIcons();
//React 18:
/* Render out React component to HTML template */
const container = document.getElementById("app");
const root = createRoot(container!);
root.render(<App />);
/* */
