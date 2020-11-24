import "./preview-panel.css";

import * as React from "react";

import { VideoPanel } from "../../ui-presentational/video-panel/video-panel";
import { AspectRatioFitter } from "../../ui-presentational/aspect-ratio-fitter/aspect-ratio-fitter";
import { VideoManager } from "../../video/video-manager";
import { Regular2DProjectionShader } from "./preview-render";

export interface PreviewPanelProps {
    //videoManager: VideoManager | null;
    videoAspectRatio: number;
    video: HTMLVideoElement | undefined;
}

interface PreviewPanelState {
    videoTime: number;
}

export class PreviewPanel extends React.Component<PreviewPanelProps, PreviewPanelState> {
    protected aspectFitterRef: React.RefObject<AspectRatioFitter>;
    //protected canvasRef: React.RefObject<HTMLCanvasElement>;
    protected shader: Regular2DProjectionShader | null;
    // Using a callback function for this ref to detect if it changes.
    protected canvasElement: HTMLCanvasElement | null;
    protected canvasRefSet: (canvas: HTMLCanvasElement) => void;

    protected videoTimeUpdate: () => void;

    constructor(params: any) {
        super(params);

        this.state = {
            videoTime: 0
        };

        this.aspectFitterRef = React.createRef();
        this.canvasElement = null;
        this.shader = null;
        this.videoTimeUpdate = () => {
            if (this.props.video) {
                this.setState({videoTime: this.props.video.currentTime});
            }
        }
        this.canvasRefSet = (canvas: HTMLCanvasElement) => {
            if (this.canvasElement !== canvas) {
                if (this.canvasElement !== null) {
                    console.error("FATAL: The canvas must not change.");
                    throw new Error("FATAL: The canvas must not change.");
                }
                this.canvasElement = canvas;
                let gl = canvas.getContext("webgl2");
                if (!gl) {
                    throw new Error("FATAL: canvas.getContext('webgl2') returned null.");
                }
                this.shader = new Regular2DProjectionShader(gl);
            }
        };
        //this.canvasRef = React.createRef();
    }

    componentDidMount() {
        this.resized();
    }

    componentDidUpdate(prevProps: PreviewPanelProps) {
        this.resized();

        if (prevProps.video !== this.props.video) {
            if (prevProps.video) {
                prevProps.video.removeEventListener('timeupdate', this.videoTimeUpdate);
            }

            if (this.props.video) {
                this.setState({ videoTime: this.props.video.currentTime})
                this.props.video.addEventListener('timeupdate', this.videoTimeUpdate);
            }
        }
    }

    render() {
        let videoLen = this.props.video?.duration || 0;

        return (
            <div>
                <div className="preview-playback-controls">
                    <button onClick={this.togglePlay.bind(this)}>Toggle Play</button>
                    <input
                        className="preview-timeline"
                        type="range"
                        min={0}
                        max={videoLen}
                        onChange={this.videoTimeSet.bind(this)}
                        value={this.state.videoTime}
                    >
                    </input>
                </div>
                <AspectRatioFitter
                    ref={this.aspectFitterRef}
                    aspectRatio={this.props.videoAspectRatio}
                >
                    <canvas ref={this.canvasRefSet} className="preview-video"></canvas>
                    {/* <VideoPanel
                        className="preview-video"
                        videoUrl={this.props.videoUrl}
                        requestedTime={0}
                        isPlaying={true}
                    >
                    </VideoPanel> */}
                </AspectRatioFitter>
            </div>
        );
    }

    resized() {
        if (this.aspectFitterRef.current) {
            this.aspectFitterRef.current.resized();
        }
        if (this.canvasElement) {
            let canvas = this.canvasElement;
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.width / this.props.videoAspectRatio;
        }
    }

    getCanvas(): HTMLCanvasElement | null {
        return this.canvasElement;
    }

    drawToCanvas(canvas: HTMLCanvasElement, videoFrame: WebGLTexture) {
        if (!this.shader) {
            return;
        }
        let gl = canvas.getContext("webgl2")!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        //this.shader.useProgram(gl);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoFrame);
        let aspect = canvas.width / canvas.height;
        this.shader.updateParameters(
            {
                fovY: Math.PI,
                rotRight: 0,
                rotUp: 0,
            },
            aspect
        );
        this.shader.draw(gl);
    }

    protected togglePlay() {
        if (this.props.video) {
            if (this.props.video.paused) {
                this.props.video.play();
            } else {
                this.props.video.pause();
            }
        }
    }

    protected videoTimeSet(event: React.ChangeEvent<HTMLInputElement>) {
        if (this.props.video) {
            this.props.video.currentTime = event.target.valueAsNumber;
        }
    }
}
