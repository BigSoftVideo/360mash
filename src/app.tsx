const packageJson = require("../package.json");

const { Menu, MenuItem, dialog, getCurrentWindow, app } = require("electron").remote;

import { pathToFileURL } from "url";

import * as React from "react";

import { SplitPanelHor } from "./ui-presentational/split-panel/split-panel-hor";
import { SplitPanelVer } from "./ui-presentational/split-panel/split-panel-ver";

import "./common-style.css";
import "./app.css";
import { VideoPanel } from "./ui-presentational/video-panel/video-panel";
import { PreviewPanel } from "./ui-presentational/preview-panel/preview-panel";

// TODO: move this to a redux store
export interface AppState {
    videoUrl: string;
}

export class App extends React.Component<{}, AppState> {

    previewPanelRef: React.RefObject<PreviewPanel>;
    onResized: () => void;

    constructor(params: any) {
        super(params);
        this.state = {
            videoUrl: "",
        };

        this.previewPanelRef = React.createRef();
        this.onResized = () => {
            if (this.previewPanelRef.current) {
                this.previewPanelRef.current.resized();
            }
        };
    }

    componentDidMount() {
        this.createMenu();
        window.addEventListener("resize", this.onResized);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onResized);
    }

    render() {
        return (
            <div className="app-contents">
                <SplitPanelVer defaultPercentage={40} onResize={this.onResized}>
                    <SplitPanelHor defaultPercentage={25} onResize={this.onResized}>
                        <div>Filter list</div>
                        <div>Filter properties</div>
                    </SplitPanelHor>
                    <SplitPanelHor defaultPercentage={75} onResize={this.onResized}>
                        <PreviewPanel
                            ref={this.previewPanelRef}
                            videoUrl={this.state.videoUrl}
                        >
                        </PreviewPanel>
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
