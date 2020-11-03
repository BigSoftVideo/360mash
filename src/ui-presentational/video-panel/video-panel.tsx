import * as React from "react";

export interface VideoPanelProps {

    className?: string;
    videoUrl: string;
    /** The time in seconds to which the playhead should be set.
     *
     * Internally, the previous value of this property is stored
     * and every time the properties are changed, the current
     * value is compared to the previous. If the two are practically
     * identical, the video will not be affected. Otherwise the current
     * time will be changed to match the requested time.
     */
    requestedTime: number;
    isPlaying: boolean;
}

export class VideoPanel extends React.Component<VideoPanelProps> {
    video: React.RefObject<HTMLVideoElement>;

    constructor(params: any) {
        super(params);

        this.video = React.createRef();
    }

    componentDidUpdate(prevProps: VideoPanelProps) {
        if (this.video.current) {
            if (prevProps.videoUrl !== this.props.videoUrl) {
                this.video.current.src = this.props.videoUrl;
            }
            if (this.props.isPlaying) {
                this.video.current.play();
            } else {
                this.video.current.pause();
            }
            let timeDiff = Math.abs(prevProps.requestedTime - this.props.requestedTime);
            if (timeDiff > 0.01) {
                this.video.current.currentTime = this.props.requestedTime;
            }
        }
    }

    render() {
        return <video ref={this.video} className={this.props.className}></video>;
    }
}
