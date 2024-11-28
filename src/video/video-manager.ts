import { render } from "react-dom";
import { pathToFileURL } from "url";
import { FilterManager } from "./filter-manager";
import { FilterPipeline, PackedPixelData } from "./filter-pipeline";

export type VideoReadyListener = (video: Video) => void;

export type VideoRendererCallback = (canvas: HTMLCanvasElement, frame: WebGLTexture) => void;

/**
 * This class is used to load the video file, extract information about it,
 * apply a filter pipeline to the video and write the rendered video a file.
 *
 * There may be multiple instanes of this class. This later can allow a
 * server to process multiple videos concurrently.
 */
export class VideoManager {
    protected videoReadyListeners: Set<VideoReadyListener>;
    protected videoReady: (video: Video) => void;
    protected _video: Video | null;
    protected _pipeline: FilterPipeline;
    protected drawToCanvas: VideoRendererCallback;
    protected renderVideo: (pixelSource?: PackedPixelData) => void;

    protected requestedAnimId: number;

    protected keepRendering: boolean;

    public startSec: number;
    public endSec: number;

    /**
     * Consider creating a canvas using `document.createElement('canvas')` when
     * the contents aren't needed to show up on the screen.
     */
    constructor(
        targetCanvas: HTMLCanvasElement,
        drawToCanvas: VideoRendererCallback,
        filterManager: FilterManager
    ) {
        this.videoReadyListeners = new Set();
        this._video = null;
        this._pipeline = new FilterPipeline(filterManager, targetCanvas, []);
        this.drawToCanvas = drawToCanvas;
        this.keepRendering = true;
        this.requestedAnimId = 0;
        this.startSec = 0;
        this.endSec = Infinity;
        this.videoReady = (video:Video) => {
            this.endSec = video.duration;
            for (const cb of this.videoReadyListeners.values()) {
                cb(video);
            }
            video.htmlVideo.addEventListener("timeupdate", () => {
                if (video.htmlVideo.paused) {
                    return;
                }
                // if (video.htmlVideo.currentTime > this.endSec) {
                //     video.htmlVideo.currentTime = this.startSec;
                // }
            });
        };
        this.renderVideo = (pixelSource?: PackedPixelData) => {
            this.requestedAnimId = 0;
            let outputFrame: WebGLTexture | undefined;
            if (pixelSource) {
                outputFrame = this._pipeline.execute(pixelSource);
            } else if (this._video) {
                outputFrame = this._pipeline.execute(this._video.htmlVideo);
            }
            if (outputFrame) {
                this.drawToCanvas(targetCanvas, outputFrame);
            } else {
                // console.warn('No output frame to draw to.');
            }
            if (this.keepRendering) {
                this.requestRender();
            }
        };
        this.requestRender();
    }

    addVideoReadyListener(listener: VideoReadyListener) {
        this.videoReadyListeners.add(listener);
    }
    removeVideoReadyListener(listener: VideoReadyListener) {
        this.videoReadyListeners.delete(listener);
    }

    openVideo(filePath: string): Video {
        this._video = new Video(filePath, this.videoReady);
        return this._video;
    }

    /**
     * Stops rendering and executes the pipeline sychronously.
     *
     * This function does not use `window.requestAnimationFrame`, instead it immediately
     * initiates the execution of the pipeline. This guarantees that by the time this function
     * returns the pipeline has finished executing.
     *
     * (The GPU may still have work to do but all OpenGL calls are already dispatched.)
     */
    renderOnce(pixelSource?: PackedPixelData) {
        this.stopRendering();
        this.renderVideo(pixelSource);
    }

    /**
     * Calls requestAnimationFrame with an inner renderer function.
     * That function also does this unless `stopRendering` was called prior.
     */
    renderContinously() {
        this.keepRendering = true;
        this.requestRender();
    }

    stopRendering() {
        if (this.requestedAnimId) {
            window.cancelAnimationFrame(this.requestedAnimId);
        }
        this.keepRendering = false;
    }

    get pipeline(): FilterPipeline {
        return this._pipeline;
    }

    get video(): Video | null {
        return this._video;
    }

    public requestRender() {
        this.requestedAnimId = window.requestAnimationFrame(() => this.renderVideo());
    }
}

export interface IVideo {
    videoUrl: URL;
}

export interface VideoListener {
    onTimeUpdate?: (currentTime:number) => void;
    onPlay?: () => void;
    onPause?: () => void;
}

/**
 * Represents a single video file.
 * It also provides an offscreen video element that can be used
 * to play the video.
 */
export class Video {
    protected video: HTMLVideoElement;
    protected url: URL;
    protected _filePath: string; // the path to the video represented as a file system path
    protected initialized: boolean;
    public duration:number = 0;

    protected _isPlaying: boolean = false;

    protected listeners = new Set<VideoListener>();

    constructor(filePath: string, onReady: (self: Video) => void) {
        // let videoTextureReady = false;
        // let playing = false;
        // let timeupdate = false;
        // let checkReady = () => {
        //     if (playing && timeupdate) {
        //         if (!videoTextureReady) {
        //             this.video.pause();
        //             this.video.muted = false;
        //             videoTextureReady = true;
        //             // We use setImmediate to guarantee that the callback only gets
        //             // executed after this constructor has returned
        //             setImmediate(() => {
        //                 this.initialized = true;
        //                 onReady(this);
        //             });
        //         }
        //         return true;
        //     }
        //     return false;
        // };

        this.initialized = false;
        console.log('Opening video: ', filePath);
        this.url = pathToFileURL(filePath);
        console.log('Converted to Url: ', this.url);
        this._filePath = filePath;
        this.video = document.createElement("video");
        this.video.autoplay = false;
        this.video.muted = true;
        this.video.loop = false;
        // this.video.addEventListener(
        //     "playing",
        //     () => {
        //         playing = true;
        //         checkReady();
        //     },
        //     true
        // );
        // this.video.addEventListener(
        //     "timeupdate",
        //     (event: MediaStreamEvent) => {
        //         timeupdate = true;
        //         checkReady();
        //         //onTimeUpdate(event);
        //     },
        //     true
        // );
        this.video.addEventListener("loadeddata", () => {
            console.log('Video data loaded');
            this.initialized = true;
            this.duration = this.video.duration;
            onReady(this);
        });
        this.video.addEventListener("canplay", () => {
            console.log('Video data can play');
            // onReady(this);
        });

        this.video.addEventListener("timeupdate", this.onTimeUpdate.bind(this), true);

        this.video.src = this.url.href;
        this.video.load();
    }

    public addListener(listener:VideoListener) {
        this.listeners.add(listener);
    }

    public removeListener(listener:VideoListener) {
        this.listeners.delete(listener);
    }

    public timeUpdate(currentTime:number) {
        for (const listener of this.listeners) {
            if (listener.onTimeUpdate) {
                listener.onTimeUpdate(currentTime);
            }
        }
    }

    public isPlayingUpdate() {
        for (const listener of this.listeners) {
            if (this._isPlaying) {
                if (listener.onPlay) {
                    listener.onPlay();
                }
            } else {
                if (listener.onPause) {
                    listener.onPause();
                }
            }

        }
    }

    protected onTimeUpdate(e:Event) {
        this.timeUpdate(this.video.currentTime);
    }

    // toInterface(): IVideo {
    //     return {
    //         videoUrl: this.url,
    //     };
    // }

    get filePath(): string {
        return this._filePath;
    }

    get htmlVideo(): HTMLVideoElement {
        return this.video;
    }

    isReady(): boolean {
        return this.initialized;
    }

    public getReadyState():number {
        return this.video.readyState;
    }

    public get isPlaying() {
        return this._isPlaying;
    }

    protected set isPlaying(value:boolean) {
        this._isPlaying = value;
        this.isPlayingUpdate();
    }

    public get currentTime():number {
        return this.video.currentTime;
    }

    /**
     * Calls Play() on the HTML element.
     * Run asyncronously
     */
    public async directPlay():Promise<boolean> {
        if (this.initialized) {
            try {
                await this.video.play();
                this.isPlaying = true;
                return true;
            } catch (e) {
                console.error('Error when attempting playback: ' + e);
                return false;
            }
        }
        return false;
    }
    public directPause() {
        if (this.initialized) {
            this.video.pause();
            this.isPlaying = false;
        }
    }

    public directSeekToTime(time:number) {
        if (!this.initialized) {
            return;
        }
        time = Math.max(0, time);
        time = Math.min(time, this.duration);
        this.video.currentTime = time;
    }
}
