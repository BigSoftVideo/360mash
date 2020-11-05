import { render } from "react-dom";
import { FilterManager } from "./filter-manager";
import { FilterPipeline } from "./filter-pipeline";

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
    protected renderVideo: () => void;

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
        this.videoReady = (video) => {
            for (const cb of this.videoReadyListeners.values()) {
                cb(video);
            }
        };
        this.renderVideo = () => {
            if (this._video) {
                let outputFrame = this._pipeline.execute(this._video);
                this.drawToCanvas(targetCanvas, outputFrame);
            }
            window.requestAnimationFrame(this.renderVideo);
        };
        window.requestAnimationFrame(this.renderVideo);
    }

    addVideoReadyListener(listener: VideoReadyListener) {
        this.videoReadyListeners.add(listener);
    }
    removeVideoReadyListener(listener: VideoReadyListener) {
        this.videoReadyListeners.delete(listener);
    }

    openVideo(fileUrl: URL): Video {
        this._video = new Video(fileUrl, this.videoReady);
        return this._video;
    }

    get pipeline(): FilterPipeline {
        return this._pipeline;
    }

    get video(): Video | null {
        return this._video;
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
    protected ready: boolean;

    constructor(videoUrl: URL, onReady: (self: Video) => void) {
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
        this.url = videoUrl;
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
        this.video.src = videoUrl.href;
    }

    toInterface(): IVideo {
        return {
            videoUrl: this.url,
        };
    }

    get htmlVideo(): HTMLVideoElement {
        return this.video;
    }

    isReady(): boolean {
        return this.ready;
    }
}
