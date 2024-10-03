import "./common-style.css";
import "./app.css";

const packageJson = require("../package.json");

// const { Menu, MenuItem, dialog, getCurrentWindow, app } = require("electron").remote;
import { Menu, MenuItem, dialog, getCurrentWindow, app, shell } from '@electron/remote';

import * as React from "react";

import { SplitPanelHor } from "./ui-presentational/split-panel/split-panel-hor";
import { SplitPanelVer } from "./ui-presentational/split-panel/split-panel-ver";
import { VideoPanel } from "./ui-presentational/video-panel/video-panel";
import { PreviewPanel } from "./ui-mixed/preview-panel/preview-panel";
import { VideoManager, Video } from "./video/video-manager";
import { FilterManager } from "./video/filter-manager";
import { Checklist } from "./ui-presentational/checklist/checklist";
import { Conv360To2DFilter, CONV360T02D_FILTER_NAME } from "./filters/conv360to2d";
import { GrayscaleFilter, GRAYSCALE_FILTER_NAME } from "./filters/grayscale";
import { CharcoalFilter, CHARCOAL_FILTER_NAME } from "./filters/charcoal";
import { PaintingFilter, PAINTING_FILTER_NAME } from "./filters/painting";
import { CartoonFilter, CARTOON_FILTER_NAME } from "./filters/cartoon";
import { BAndCFilter, BANDC_FILTER_NAME } from "./filters/bandc";
import { NewsPrintFilter, NEWSPRINT_FILTER_NAME } from "./filters/newsprint";
import { FilterBase, FilterId } from "./video/filter-base";
import { FilterList } from "./ui-mixed/filter-list/filter-list";
import { Decoder, Encoder } from "./video/codec";
import { ExportPanel } from "./ui-mixed/export-panel/export-panel";
import {
    Conv360To2DAttribsCreator,
    GrayscaleAttribsCreator,
    CartoonAttribsCreator,
    NewsPrintAttribsCreator,
    CharcoalAttribsCreator,
    PaintingAttribsCreator,
    BAndCAttribsCreator,
} from "./ui-mixed/filter-attributes/creators";
import { ExportInfoProvider, ExportOverlay } from "./ui-mixed/export-overlay/export-overlay";
import { DimensionChangeListener } from "./video/filter-pipeline";

// TODO: move this to a redux store maybe
export interface AppState {
    //videoUrl: string;
    outputAspectRatio: number;
    exportInProgress: boolean;
    selectedFilterId: FilterId | null;
}

export class App extends React.Component<{}, AppState> {
    previewPanelRef: React.RefObject<PreviewPanel>;
    filterManager: FilterManager;
    videoManager: VideoManager | null;
    outputDimensionChangeListener: DimensionChangeListener;
    outputDimensionsInitialized: boolean;
    onResized: () => void;
    onVideoReady: (video: Video) => void;

    encoder: Encoder;
    decoder: Decoder;

    exportInfoProvider: ExportInfoProvider;

    filterAttribs: Map<string, (f: FilterBase) => JSX.Element>;

    constructor(params: any) {
        super(params);
        this.state = {
            outputAspectRatio: 16 / 9,
            exportInProgress: false,
            selectedFilterId: CONV360T02D_FILTER_NAME,
        };
        this.encoder = new Encoder();
        this.decoder = new Decoder();
        this.exportInfoProvider = new ExportInfoProvider();

        this.previewPanelRef = React.createRef();

        this.outputDimensionsInitialized = false;
        this.outputDimensionChangeListener = (w, h) => {
            this.outputDimensionsInitialized = true;
            let aspectRatio = w / h;
            console.log("Setting preview panel aspect to " + aspectRatio);
            this.setState({ outputAspectRatio: aspectRatio });
        };
        this.onResized = () => {
            if (this.previewPanelRef.current) {
                this.previewPanelRef.current.resized();
            }
        };
        this.onVideoReady = (video) => {
            let htmlVideo = video.htmlVideo;
            if (!this.outputDimensionsInitialized) {
                this.outputDimensionChangeListener(
                    htmlVideo.videoWidth,
                    htmlVideo.videoHeight
                );
            }
            video.htmlVideo.play();
        };
        this.filterManager = new FilterManager();
        this.filterAttribs = new Map();
        this.filterAttribs.set(CONV360T02D_FILTER_NAME, Conv360To2DAttribsCreator);
        this.filterManager.registerFilter({
            id: CONV360T02D_FILTER_NAME,
            creator: (gl): FilterBase => {
                return new Conv360To2DFilter(gl);
            },
        });
        this.filterAttribs.set(BANDC_FILTER_NAME, BAndCAttribsCreator);
        this.filterManager.registerFilter({
            id: BANDC_FILTER_NAME,
            creator: (gl): FilterBase => {
                return new BAndCFilter(gl);
            },
        });
        this.filterAttribs.set(CARTOON_FILTER_NAME, CartoonAttribsCreator);
        this.filterManager.registerFilter({
            id: CARTOON_FILTER_NAME,
            creator: (gl): FilterBase => {
                return new CartoonFilter(gl);
            },
        });
        this.filterAttribs.set(NEWSPRINT_FILTER_NAME, NewsPrintAttribsCreator);
        this.filterManager.registerFilter({
            id: NEWSPRINT_FILTER_NAME,
            creator: (gl): FilterBase => {
                return new NewsPrintFilter(gl);
            },
        });
        this.filterAttribs.set(GRAYSCALE_FILTER_NAME, GrayscaleAttribsCreator);
        this.filterManager.registerFilter({
            id: GRAYSCALE_FILTER_NAME,
            creator: (gl): FilterBase => {
                return new GrayscaleFilter(gl);
            },
        });
        this.filterAttribs.set(CHARCOAL_FILTER_NAME, CharcoalAttribsCreator);
        this.filterManager.registerFilter({
            id: CHARCOAL_FILTER_NAME,
            creator: (gl): FilterBase => {
                return new CharcoalFilter(gl);
            },
        });
        this.filterAttribs.set(PAINTING_FILTER_NAME, PaintingAttribsCreator);
        this.filterManager.registerFilter({
            id: PAINTING_FILTER_NAME,
            creator: (gl): FilterBase => {
                return new PaintingFilter(gl);
            },
        });
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
            this.videoManager.pipeline.removeDimensionChangeListener(
                this.outputDimensionChangeListener
            );
        }
    }

    render() {
        let filterList;
        let exportPanel;
        let filterAttributes = undefined;
        if (this.videoManager && this.videoManager.video) {
            filterList = (
                <FilterList
                    pipeline={this.videoManager.pipeline}
                    selectedId={this.state.selectedFilterId}
                    selectionChanged={(selectedId) => {
                        this.setState({ selectedFilterId: selectedId });
                    }}
                ></FilterList>
            );
            exportPanel = (
                <ExportPanel
                    startSec={this.videoManager.startSec}
                    endSec={this.videoManager.endSec}
                    encoder={this.encoder}
                    decoder={this.decoder}
                    videoManager={this.videoManager}
                    exportStateChange={(inProgress) => {
                        this.setState({ exportInProgress: inProgress });
                    }}
                    clipRangeChange={(start, end) => {
                        if (this.videoManager) {
                            this.videoManager.startSec = start;
                            this.videoManager.endSec = end;
                            this.forceUpdate();
                        }
                    }}
                    infoProvider={this.exportInfoProvider}
                ></ExportPanel>
            );
            if (this.state.selectedFilterId) {
                let creator = this.filterAttribs.get(this.state.selectedFilterId);
                if (creator) {
                    let filters = this.videoManager.pipeline.getFilters();
                    let selFilter = filters.find((v) => v.id === this.state.selectedFilterId);
                    if (selFilter) {
                        filterAttributes = creator(selFilter.filter);
                    } else {
                        console.error("The selected filter was not found.");
                    }
                } else {
                    console.error("The filter creator was not found.");
                }
            }
        } else {
            filterList = "- Import a video from the File menu -";
            exportPanel = <div> -- </div>;
        }

        let exportOverlay = undefined;
        if (this.state.exportInProgress) {
            exportOverlay = (
                <ExportOverlay infoProvider={this.exportInfoProvider}></ExportOverlay>
            );
        }

        return (
            <div className="app-contents">
                <SplitPanelVer defaultPercentage={40} onResize={this.onResized}>
                    <SplitPanelHor defaultPercentage={25} onResize={this.onResized}>
                        <div>{filterList}</div>
                        <div className="filter-attribs-parent">{filterAttributes}</div>
                    </SplitPanelHor>
                    <SplitPanelHor defaultPercentage={75} onResize={this.onResized}>
                        <PreviewPanel
                            startSec={this.videoManager?.startSec || 0}
                            endSec={this.videoManager?.endSec || 0}
                            ref={this.previewPanelRef}
                            videoAspectRatio={this.state.outputAspectRatio}
                            video={this.videoManager?.video?.htmlVideo}
                        ></PreviewPanel>
                        {exportPanel}
                    </SplitPanelHor>
                </SplitPanelVer>
                {exportOverlay}
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

                // Add all filters here.
                this.videoManager.pipeline.setFilters([
                    CONV360T02D_FILTER_NAME,
                    BANDC_FILTER_NAME,
                    CARTOON_FILTER_NAME,
                    NEWSPRINT_FILTER_NAME,
                    GRAYSCALE_FILTER_NAME,
                    CHARCOAL_FILTER_NAME,
                    PAINTING_FILTER_NAME,
                ]);

                this.videoManager.pipeline.addDimensionChangeListener(
                    this.outputDimensionChangeListener
                );
                this.forceUpdate();
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
                title: "Import Video",
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
                this.videoManager.openVideo(value.filePaths[0]);
                //TODO wait until the first frame is available and only then set the aspect ratio.
                // Otherwise the videoWidth and height won't yet be available.
            });
    }
}
