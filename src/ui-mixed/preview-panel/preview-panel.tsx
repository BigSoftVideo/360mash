import "./preview-panel.css";

import * as React from "react";

import { AspectRatioFitter } from "../../ui-presentational/aspect-ratio-fitter/aspect-ratio-fitter";
import { Video, VideoListener, VideoManager } from "../../video/video-manager";
import { Regular2DProjectionShader } from "./preview-render";
import { secsToTimeString } from "../../util";
import { Range } from "react-range";
import { TimelineSelector } from "../../timeline-selector/timeline-selector";
import throttle from "throttleit";
import { Pane } from "evergreen-ui";
import { TransportControls } from "../../transport-controls/transport-controls";

export interface PreviewPanelProps {
    //videoManager: VideoManager | null;
    selectionStartSec: number;
    selectionEndSec: number;
    updateSelection: (start:number, end:number) => void;
    videoAspectRatio: number;
    video: Video | null;
}

interface PreviewPanelState {
    videoTime: number;
}

export class PreviewPanel extends React.Component<PreviewPanelProps, PreviewPanelState>
    implements VideoListener
{
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
            videoTime: 0,
        };

        this.aspectFitterRef = React.createRef();
        this.canvasElement = null;
        this.shader = null;
        this.videoTimeUpdate = () => {
            if (this.props.video) {
                this.setState({ videoTime: this.props.video.currentTime });
            }
        };
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
        this.props.video?.addListener(this);
    }

    componentWillUnmount(): void {
        this.props.video?.removeListener(this);
    }

    componentDidUpdate(prevProps: Readonly<PreviewPanelProps>, prevState: Readonly<PreviewPanelState>, snapshot?: any): void {
        this.resized();

        if (prevProps.video !== this.props.video) {
            if (prevProps.video !== this.props.video) {
                prevProps.video?.removeListener(this);
                this.props.video?.addListener(this);
            }

            if (this.props.video) {
                this.setState({ videoTime: this.props.video.currentTime });
            }
        }
    }

    onTimeUpdate(currentTime: number) {
        this.setState({ videoTime: currentTime });
    }

    render() {
        let videoLen = this.props.video?.duration || 0;
        let videoEnd = this.props.selectionEndSec;
        if (videoEnd === Infinity) {
            videoEnd = videoLen;
        }

        return (
            <div className="preview-root">
                <Pane display="flex" flexDirection="column">
                    <TransportControls
                        video={this.props.video}
                        selectionStartSec={this.props.selectionStartSec}
                        selectionEndSec={this.props.selectionEndSec}
                        updateSelection={this.props.updateSelection}
                    />
                    {/* <button
                        className="preview-playback-controls-play"
                        onClick={this.togglePlay.bind(this)}
                    >
                        Play/Pause
                    </button> */}
                    <Pane display="flex" flexDirection="row" justifyContent="center" alignContent="center">
                        {secsToTimeString(this.state.videoTime)}
                        {/* <button
                            onClick={() => {
                                let video = this.props.video;
                                if (video) {
                                    let start = video.htmlVideo.currentTime;
                                    let end = Math.max(this.props.selectionEndSec, start);
                                    this.props.updateSelection(start, end);
                                }
                            }}
                        >
                            Set start frame: {secsToTimeString(this.props.selectionStartSec)}
                        </button>
                        <button
                            onClick={() => {
                                let video = this.props.video;
                                if (video) {
                                    let end = video.htmlVideo.currentTime;
                                    let start = Math.min(this.props.selectionStartSec, end);
                                    this.props.updateSelection(start, end);
                                }
                            }}
                        >
                            Set end frame: {secsToTimeString(this.props.selectionEndSec)}
                        </button> */}
                    </Pane>
                    {/* <button
                        className="preview-playback-controls-frameshifter"
                        onClick={this.addAndDecreaseTime.bind(this, -0.05)}
                    >
                        -
                    </button>
                    <button
                        className="preview-playback-controls-frameshifter"
                        onClick={this.addAndDecreaseTime.bind(this, 0.05)}
                    >
                        +
                    </button> */}
                    {/* <input
                        className="preview-timeline"
                        type="range"
                        min={0}
                        max={videoLen}
                        step={0.01}
                        onChange={this.videoTimeSet.bind(this)}
                        value={this.state.videoTime}
                    ></input> */}

                    <TimelineSelector
                        videoLength={videoLen}
                        currentTime={this.state.videoTime}
                        setTime={ (newTime) => {
                            this.setState({ videoTime: newTime });
                            this.setVideoTime(newTime);
                        }}
                        selectionStart={this.props.selectionStartSec}
                        selectionEnd={this.props.selectionEndSec}
                        setSelection={(start, end) => {
                            this.props.updateSelection(start, end);
                        }}
                    />
                </Pane>
                <div className="preview-video-container">
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
            </div>
        );
    }

    protected setVideoTime = throttle(this._setVideoTime, 30);
    protected _setVideoTime(newTime:number) {
        if (this.props.video) {
            this.props.video.directSeekToTime(newTime);
        }
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

    // protected togglePlay() {
    //     if (this.props.video) {
    //         if (this.props.video.paused) {
    //             this.props.video.play();
    //         } else {
    //             this.props.video.pause();
    //         }
    //     }
    // }

    // protected videoTimeSet(event: React.ChangeEvent<HTMLInputElement>) {
    //     if (this.props.video) {
    //         this.props.video.currentTime = event.target.valueAsNumber;
    //     }
    // }

    // protected addAndDecreaseTime(time: number) {
    //     if (this.props.video) {
    //         if (this.props.video.currentTime + time >= 0) {
    //             this.props.video.currentTime = this.props.video.currentTime + time;
    //         } else if (this.props.video.currentTime + time > this.props.video.duration) {
    //             this.props.video.currentTime = this.props.video.duration;
    //         } else {
    //             this.props.video.currentTime = 0;
    //         }
    //     }
    // }
}
