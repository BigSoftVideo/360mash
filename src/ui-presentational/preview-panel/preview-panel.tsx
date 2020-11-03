
import * as React from "react";

import { VideoPanel } from "../video-panel/video-panel";
import { AspectRatioFitter } from "../aspect-ratio-fitter/aspect-ratio-fitter";

import "./preview-panel.css"

export interface PreviewPanelProps {
    videoUrl: string;
}

export class PreviewPanel extends React.Component<PreviewPanelProps> {

    aspectFitterRef: React.RefObject<AspectRatioFitter>;

    constructor(params: any) {
        super(params);
        this.aspectFitterRef = React.createRef();
    }

    render() {
        // TODO retrieve the aspect ratio from the video.
        return (
            <AspectRatioFitter aspectRatio={16/9} ref={this.aspectFitterRef}>
                <VideoPanel
                    className="preview-video"
                    videoUrl={this.props.videoUrl}
                    requestedTime={0}
                    isPlaying={true}
                >
                </VideoPanel>
            </AspectRatioFitter>
        )
    }

    resized() {
        if (this.aspectFitterRef.current) {
            this.aspectFitterRef.current.resized();
        }
    }
}
