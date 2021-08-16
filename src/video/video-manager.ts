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
        this.videoReady = (video) => {
            for (const cb of this.videoReadyListeners.values()) {
                cb(video);
            }
        };
        this.renderVideo = (pixelSource?: PackedPixelData) => {
            this.requestedAnimId = 0;
            if (this._video) {
                let outputFrame = this._pipeline.execute(pixelSource || this._video.htmlVideo);
                this.drawToCanvas(targetCanvas, outputFrame);
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

    protected requestRender() {
        this.requestedAnimId = window.requestAnimationFrame(() => this.renderVideo());
    }
}

export interface IVideo {
    videoUrl: URL;
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
    protected ready: boolean;

    constructor(filePath: string, onReady: (self: Video) => void) {
        let videoTextureReady = false;
        let playing = false;
        let timeupdate = false;
        let checkReady = () => {
            if (playing && timeupdate) {
                if (!videoTextureReady) {
                    this.video.pause();
                    this.video.muted = false;
                    videoTextureReady = true;
                    // We use setImmediate to guarantee that the callback only gets
                    // executed after this constructor has returned
                    setImmediate(() => {
                        this.ready = true;
                        onReady(this);
                    });
                }
                return true;
            }
            return false;
        };

        this.ready = false;
        this.url = pathToFileURL(filePath);
        this._filePath = filePath;
        this.video = document.createElement("video");
        this.video.autoplay = true;
        this.video.muted = true;
        this.video.addEventListener(
            "playing",
            () => {
                playing = true;
                checkReady();
            },
            true
        );
        this.video.addEventListener(
            "timeupdate",
            (event: MediaStreamEvent) => {
                timeupdate = true;
                checkReady();
                //onTimeUpdate(event);
            },
            true
        );
        this.video.src = this.url.href;
    }

    toInterface(): IVideo {
        return {
            videoUrl: this.url,
        };
    }

    get filePath(): string {
        return this._filePath;
    }

    get htmlVideo(): HTMLVideoElement {
        return this.video;
    }

    isReady(): boolean {
        return this.ready;
    }
}
