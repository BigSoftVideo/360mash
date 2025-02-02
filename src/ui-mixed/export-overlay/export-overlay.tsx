import "./export-overlay.css";

import * as React from "react";
import { secsToTimeString } from "../../util";
import { Decoder, Encoder } from "../../video/codec";

export interface MiscExportInfo {
    /** The number of exported video frames per second */
    fps: number;

    /** The approximate remaining time in ms */
    remainingMs: number;
}

export type ProgressListener = (progress: number) => void;
export type InfoListener = (info: MiscExportInfo) => void;

export class ExportInfoProvider {
    progressListeners: Set<ProgressListener>;
    infoListeners: Set<InfoListener>;

    constructor() {
        this.progressListeners = new Set();
        this.infoListeners = new Set();
    }

    registerProgressListener(listener: ProgressListener) {
        this.progressListeners.add(listener);
    }
    removeProgressListener(listener: ProgressListener) {
        this.progressListeners.delete(listener);
    }

    registerInfoListener(listener: InfoListener) {
        this.infoListeners.add(listener);
    }
    removeInfoListener(listener: InfoListener) {
        this.infoListeners.delete(listener);
    }

    /** Calls all progress listeners */
    reportProgress(progress: number) {
        for (const listener of this.progressListeners.values()) {
            listener(progress);
        }
    }
    reportInfo(info: MiscExportInfo) {
        for (const listener of this.infoListeners.values()) {
            listener(info);
        }
    }
}

export interface ExportOverlayProps {
    infoProvider: ExportInfoProvider;
    encoder: Encoder;
    decoder: Decoder;
}

interface ExportOverlayState {
    /** Value between 0 and 1 indicating the progress. 0 means just started, 1 means complete */
    progess: number;
    miscInfo: MiscExportInfo;
}

export class ExportOverlay extends React.Component<ExportOverlayProps, ExportOverlayState> {
    progressListener: ProgressListener;
    infoListener: InfoListener;

    constructor(props: any) {
        super(props);
        this.progressListener = (progress) => {
            this.setState({ progess: progress });
        };
        this.infoListener = (info) => {
            this.setState({ miscInfo: info });
        };
        this.state = {
            progess: 0,
            miscInfo: {
                fps: 0,
                remainingMs: NaN,
            },
        };
    }

    componentDidMount() {
        this.props.infoProvider.registerProgressListener(this.progressListener);
        this.props.infoProvider.registerInfoListener(this.infoListener);
    }

    componentWillUnmount() {
        this.props.infoProvider.removeProgressListener(this.progressListener);
        this.props.infoProvider.removeInfoListener(this.infoListener);
    }

    render() {
        let remStr = "Unknown";
        if (
            !isNaN(this.state.miscInfo.remainingMs) &&
            this.state.miscInfo.remainingMs !== Infinity
        ) {
            let remainigSec = Math.floor(this.state.miscInfo.remainingMs / 1000);
            remStr = secsToTimeString(remainigSec);
        }
        let fpsStr = Math.round(this.state.miscInfo.fps).toString();
        return (
            <div className="export-overlay-root">
                <div className="export-overlay-center">
                    <div className="export-overlay-contents">
                        Exporting in progress
                        <table className="export-overlay-table">
                            <tbody>
                                <tr>
                                    <td>Export framerate: {fpsStr} FPS</td>
                                    <td>Remaining time: {remStr}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="export-overlay-progress-bar-parent">
                            <div
                                className="export-overlay-progress-bar"
                                style={{ width: this.state.progess * 100 + "%" }}
                            ></div>
                            <div className="export-overlay-progress-bar-outline"></div>
                        </div>
                        <div className="export-overlay-buttons-parent">
                            <button className="export-overlay-cancel-button" onClick={ () => {
                                this.props.decoder.stopDecoding();
                                this.props.encoder.stopEncoding();
                            }}>Cancel encoding</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
