import { render } from "react-dom";
import { FilterManager } from "./filter-manager";
import { FilterPipeline } from "./filter-pipeline";

export type VideoManagerListener = () => void;

export type VideoRendererCallback = (canvas: HTMLCanvasElement, frame: WebGLTexture) => void;

/**
 * This class is used to load the video file, extract information about it,
 * apply a filter pipeline to the video and write the rendered video a file.
 *
 * There may be multiple instanes of this class. This later can allow a
 * server to process multiple videos concurrently.
 */
export class VideoManager {
    protected listeners: Set<VideoManagerListener>;
    protected _video: Video | null;
    protected _pipeline: FilterPipeline;
    protected renderToCanvas: VideoRendererCallback;
    protected renderVideo: () => void;

    /**
     * Consider creating a canvas using `document.createElement('canvas')` when
     * the contents aren't needed to show up on the screen.
     */
    constructor(
        targetCanvas: HTMLCanvasElement,
        renderToCanvas: VideoRendererCallback,
        filterManager: FilterManager
    ) {
        this.listeners = new Set();
        this._video = null;
        this._pipeline = new FilterPipeline(filterManager, targetCanvas, []);
        this.renderToCanvas = renderToCanvas;
        this.renderVideo = () => {
            if (this._video) {
                let outputFrame = this._pipeline.execute(this._video);
                this.renderToCanvas(targetCanvas, outputFrame);
            }
            window.requestAnimationFrame(this.renderVideo);
        };
        window.requestAnimationFrame(this.renderVideo);
    }

    addListener(listener: VideoManagerListener) {
        this.listeners.add(listener);
    }
    removeListener(listener: VideoManagerListener) {
        this.listeners.delete(listener);
    }

    openVideo(fileUrl: URL): Video {
        this._video = new Video(fileUrl);
        return this._video;
    }

    // get pipeline(): FilterPipeline {
    //     return this._pipeline;
    // }

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
    protected _offscreenVideo: HTMLVideoElement;
    protected url: URL;

    constructor(videoUrl: URL) {
        this.url = videoUrl;
        this._offscreenVideo = document.createElement("video");
        this.offscreenVideo.src = videoUrl.href;
    }

    toInterface(): IVideo {
        return {
            videoUrl: this.url,
        };
    }

    get offscreenVideo(): HTMLVideoElement {
        return this._offscreenVideo;
    }
}
