
import "./export-overlay.css";

import * as React from "react";


export type ProgressListener = (progress: number) => void;

export class ExportInfoProvider {

    progressListeners: Set<ProgressListener>;

    constructor() {
        this.progressListeners = new Set();
    }

    registerProgressListener(listener: ProgressListener) {
        this.progressListeners.add(listener);
    }

    removeProgressListener(listener: ProgressListener) {
        this.progressListeners.delete(listener);
    }

    /** Calls all progress listeners */
    reportProgress(progress: number) {
        for (const listener of this.progressListeners.values()) {
            listener(progress);
        }
    }
}

export interface ExportOverlayProps {
    infoProvider: ExportInfoProvider
}

interface ExportOverlayState {
    /** Value between 0 and 1 indicating the progress. 0 means just started, 1 means complete */
    progess: number;
}

export class ExportOverlay extends React.Component<ExportOverlayProps, ExportOverlayState> {

    progressListener: ProgressListener;

    constructor(props: any) {
        super(props);
        this.progressListener = progress => { this.setState({ progess: progress }) };
        this.state = {
            progess: 0
        }
    }

    componentDidMount() {
        this.props.infoProvider.registerProgressListener(this.progressListener);
    }

    componentWillUnmount() {
        this.props.infoProvider.removeProgressListener(this.progressListener);
    }

    render() {
        return (
            <div className="export-overlay-root">
                <div className="export-overlay-center">
                    <div className="export-overlay-contents">
                        Exporting in progress
                        <div className="export-overlay-progress-bar-parent">
                            <div className="export-overlay-progress-bar" style={{ width: (this.state.progess * 100) + "%" }}></div>
                            <div className="export-overlay-progress-bar-outline"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
