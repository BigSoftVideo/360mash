const packageJson = require("../package.json");

const { Menu, MenuItem, dialog, getCurrentWindow, app } = require("electron").remote;

import { pathToFileURL } from "url";

import * as React from "react";

import { SplitPanelHor } from "./ui/split-panel/split-panel-hor";
import { SplitPanelVer } from "./ui/split-panel/split-panel-ver";

import "./common-style.css";
import "./app.css";
import { VideoPanel } from "./ui/video-panel/video-panel";

// TODO: move this to a redux store
export interface AppState {
    videoUrl: string;
}

export class App extends React.Component<{}, AppState> {
    constructor(params: any) {
        super(params);

        this.state = {
            videoUrl: "",
        };
    }

    componentDidMount() {
        this.createMenu();
    }

    render() {
        return (
            <div className="app-contents">
                <SplitPanelVer defaultPercentage={40}>
                    <SplitPanelHor defaultPercentage={25}>
                        <div>Filter list</div>
                        <div>Filter properties</div>
                    </SplitPanelHor>
                    <SplitPanelHor defaultPercentage={75}>
                        <div>
                            <h4>Video preview</h4>
                            <VideoPanel
                                videoUrl={this.state.videoUrl}
                                isPlaying={true}
                                requestedTime={0}
                            ></VideoPanel>
                        </div>
                        <div>Export options</div>
                    </SplitPanelHor>
                </SplitPanelVer>
            </div>
        );
    }

    createMenu() {
        const mainWindow = getCurrentWindow();
        const menu = new Menu();
        const aboutMenuItem = new MenuItem({
            label: "About",
            click: () => {
                dialog.showMessageBox(mainWindow, {
                    title: "About 360mash",
                    message: "360mash version: " + packageJson["version"],
                });
            },
        });
        if (process.platform === "darwin") {
            const appMenu = new Menu();
            const quitMenuItem = new MenuItem({
                label: "Quit 360mash",
                role: "quit",
            });
            appMenu.append(aboutMenuItem);
            appMenu.append(quitMenuItem);
            const appMenuItem = new MenuItem({
                role: "appMenu",
                submenu: appMenu,
            });
            menu.append(appMenuItem);
        }
        const fileMenu = new Menu();
        const openMenuItem = new MenuItem({
            accelerator: "CommandOrControl+O",
            click: () => {
                this.openVideo();
            },
            label: "Open Video",
        });
        fileMenu.append(openMenuItem);
        //fileMenu.append(new MenuItem({ type: "separator" }));
        const fileMenuItem = new MenuItem({
            label: "File",
            role: "fileMenu",
            submenu: fileMenu,
        });
        menu.append(fileMenuItem);

        const editMenu = new Menu();
        const copyMenuItem = new MenuItem({
            role: "copy",
        });
        editMenu.append(copyMenuItem);
        const cutMenuItem = new MenuItem({
            role: "cut",
        });
        editMenu.append(cutMenuItem);
        const pasetMenuItem = new MenuItem({
            role: "paste",
        });
        editMenu.append(pasetMenuItem);
        const editMenuItem = new MenuItem({
            role: "editMenu",
            //submenu: editMenu,
        });
        menu.append(editMenuItem);
        const helpMenu = new Menu();
        if (process.platform !== "darwin") {
            helpMenu.append(aboutMenuItem);
        }
        const helpMenuItem = new MenuItem({
            role: "help",
            label: "Help",
            submenu: helpMenu,
        });
        menu.append(helpMenuItem);
        Menu.setApplicationMenu(menu);
    }

    openVideo() {
        const mainWindow = getCurrentWindow();
        dialog
            .showOpenDialog(mainWindow, {
                title: "Open Video",
                filters: [
                    {
                        name: "Media Files",
                        // Allow every file type for testing
                        //extensions: [],
                        extensions: ["mp4", "webm", "mov", "avi", "mkv", "flv", "wmv"],
                    },
                ],
            })
            .then((value: any) => {
                if (value.canceled) {
                    return;
                }
                //console.log("File path is " + value.filePaths[0]);
                let fileURL = pathToFileURL(value.filePaths[0]).toString();
                this.setState({ videoUrl: fileURL });
            });
    }
}
