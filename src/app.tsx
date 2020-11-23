
import "./common-style.css";
import "./app.css";

const packageJson = require("../package.json");

const { Menu, MenuItem, dialog, getCurrentWindow, app } = require("electron").remote;

import { pathToFileURL } from "url";

import * as React from "react";

import { SplitPanelHor } from "./ui-presentational/split-panel/split-panel-hor";
import { SplitPanelVer } from "./ui-presentational/split-panel/split-panel-ver";
import { VideoPanel } from "./ui-presentational/video-panel/video-panel";
import { PreviewPanel } from "./ui-mixed/preview-panel/preview-panel";
import { VideoManager, Video } from "./video/video-manager";
import { FilterManager } from "./video/filter-manager";
import { Checklist } from "./ui-presentational/checklist/checklist";
import { GrayscaleFilter, GRAYSCALE_FILTER_NAME } from "./filters/grayscale";
import { FilterBase } from "./video/filter-base";
import { FilterList } from "./ui-mixed/filter-list/filter-list";
import { Codec } from "./video/codec";
import { ExportPanel } from "./ui-mixed/export-panel/export-panel";

// TODO: move this to a redux store maybe
export interface AppState {
    //videoUrl: string;
    videoAspectRatio: number;
}

export class App extends React.Component<{}, AppState> {
    previewPanelRef: React.RefObject<PreviewPanel>;
    filterManager: FilterManager;
    videoManager: VideoManager | null;
    onResized: () => void;
    onVideoReady: (video: Video) => void;

    codec: Codec;

    constructor(params: any) {
        super(params);
        this.state = {
            videoAspectRatio: 16 / 9,
        };

        this.codec = new Codec();

        this.previewPanelRef = React.createRef();
        this.onResized = () => {
            if (this.previewPanelRef.current) {
                this.previewPanelRef.current.resized();
            }
        };
        this.onVideoReady = (video) => {
            let htmlVideo = video.htmlVideo;
            let aspectRatio = htmlVideo.videoWidth / htmlVideo.videoHeight;
            console.log("Setting aspect to " + aspectRatio);
            video.htmlVideo.play();
            this.setState({ videoAspectRatio: aspectRatio });
        };
        this.filterManager = new FilterManager();
        this.filterManager.registerFilter({
            id: GRAYSCALE_FILTER_NAME,
            creator: (gl, w, h): FilterBase => {
                return new GrayscaleFilter(gl, w, h);
            }
        })
        this.videoManager = null;
    }

    componentDidMount() {
        this.createMenu();
        window.addEventListener("resize", this.onResized);

        this.initializeVideoManager();
    }

    componentDidUpdate() {
        this.initializeVideoManager();
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onResized);

        if (this.videoManager) {
            this.videoManager.removeVideoReadyListener(this.onVideoReady);
        }
    }

    render() {
        let filterList;
        let exportPanel;
        if (this.videoManager) {
            filterList = <FilterList pipeline={this.videoManager.pipeline}></FilterList>;
            exportPanel = (
                <ExportPanel codec={this.codec} videoManager={this.videoManager}>
                </ExportPanel>
            );
        } else {
            filterList = "--";
            exportPanel = <div> -- </div>;
        }

        return (
            <div className="app-contents">
                <SplitPanelVer defaultPercentage={40} onResize={this.onResized}>
                    <SplitPanelHor defaultPercentage={25} onResize={this.onResized}>
                        <div>
                            {filterList}
                        </div>
                        <div>Filter properties</div>
                    </SplitPanelHor>
                    <SplitPanelHor defaultPercentage={75} onResize={this.onResized}>
                        <PreviewPanel
                            ref={this.previewPanelRef}
                            videoAspectRatio={this.state.videoAspectRatio}
                            //videoManager={this.videoManager}
                        ></PreviewPanel>
                        {exportPanel}
                    </SplitPanelHor>
                </SplitPanelVer>
            </div>
        );
    }

    initializeVideoManager() {
        if (this.videoManager) {
            return;
        }
        let previewPanel = this.previewPanelRef.current;
        if (previewPanel) {
            let canvas = previewPanel.getCanvas();
            if (canvas) {
                this.videoManager = new VideoManager(
                    canvas,
                    previewPanel.drawToCanvas.bind(previewPanel),
                    this.filterManager
                );
                this.videoManager.addVideoReadyListener(this.onVideoReady);
                this.videoManager.pipeline.setFilters([GRAYSCALE_FILTER_NAME]);
            }
        }
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
                if (!this.videoManager) {
                    return;
                }
                //console.log("File path is " + value.filePaths[0]);
                //this.setState({ videoUrl: fileURL });
                let fileURL = pathToFileURL(value.filePaths[0]);
                this.videoManager.openVideo(fileURL);
                //TODO wait until the first frame is available and only then set the aspect ratio.
                // Otherwise the videoWidth and height won't yet be available.
            });
    }
}
