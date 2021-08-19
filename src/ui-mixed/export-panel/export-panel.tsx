import * as React from "react";
import * as path from "path";
import * as util from "util";
import { Decoder, Encoder, MediaMetadata } from "../../video/codec";
import { VideoManager } from "../../video/video-manager";
import { AlignedPixelData, PackedPixelData } from "../../video/filter-pipeline";

/** Wait for the next event loop iteration */
const setImmedateAsync = util.promisify(setImmediate);

export interface ExportPanelProps {
    encoder: Encoder;
    decoder: Decoder;
    videoManager: VideoManager;
}

export class ExportPanel extends React.Component<ExportPanelProps> {

    sumInputFrameWaitMs: number;

    canvasRef: React.RefObject<HTMLCanvasElement>;

    pathRef: React.RefObject<HTMLInputElement>;

    constructor(params: any) {
        super(params);
        this.canvasRef = React.createRef();
        this.pathRef = React.createRef();
        this.sumInputFrameWaitMs = 0;
    }

    render() {
        return (
            <div>
                <input ref={this.pathRef} placeholder="Output file path"></input>
                <div>
                    <button onClick={this.startFFmpegExport.bind(this)}>Export</button>
                </div>
                <button onClick={this.fetchFrame.bind(this)}>Get current frame</button>
                <canvas ref={this.canvasRef} width={800} height={400}></canvas>
            </div>
        );
    }

    protected startExport() {
        if (!this.props.videoManager.video) {
            throw new Error("There must be an initialized video");
        }
        let video = this.props.videoManager.video.htmlVideo;
        this.sumInputFrameWaitMs = 0;
        video.pause();
        this.props.videoManager.stopRendering();

        let totalTime = video.duration;

        const [width, height] = this.props.videoManager.pipeline.getOutputDimensions();
        const outFps = 29.97;

        let nextFrameId = 0;
        let readyFrameId = -1;

        let seeked = () => {
            readyFrameId = nextFrameId;
            console.log("Video finished seeking. Time", video.currentTime);
            this.props.videoManager.renderOnce();
        };
        // A bit of a hack, setting the time to NOT zero so that we get our callback called
        // for the first frame
        video.currentTime = 0.5;
        video.addEventListener("seeked", seeked);
        video.currentTime = 0;
        let getImage = async (
            outFrameId: number,
            buffer: Uint8Array,
            linesize: number
        ): Promise<number> => {
            const waitStart = new Date();
            while (readyFrameId < outFrameId) {
                await setImmedateAsync();
            }
            this.sumInputFrameWaitMs += (new Date().getTime() - waitStart.getTime()) / 1000;
            let targetPixelBuffer: AlignedPixelData = {
                data: buffer,
                linesize: linesize,
                w: width,
                h: height,
            };
            this.props.videoManager.pipeline.fillPixelData(targetPixelBuffer);
            nextFrameId = outFrameId + 1;

            const nextTime = nextFrameId / outFps;
            if (nextTime > totalTime) {
                video.removeEventListener("seeked", seeked);
                return 1;
            }
            // Initiate loading and rendering the next frame while this one is being encoded.
            video.currentTime = nextTime;

            return 0;
        };

        let filename = this.dateToFilename(new Date()) + ".mp4";
        let fullpath = path.join(this.pathRef.current!.value, filename);
        this.props.encoder.startEncoding(fullpath, width, height, outFps, getImage);
    }

    protected startFFmpegExport() {
        console.log("Starting ffmpeg export");
        if (!this.props.videoManager.video) {
            throw new Error("There must be an initialized video");
        }
        this.sumInputFrameWaitMs = 0;
        let video = this.props.videoManager.video;

        this.props.videoManager.stopRendering();

        const [outWidth, outHeight] = this.props.videoManager.pipeline.getOutputDimensions();

        // This is just a default, but actually we will use the same framerate as the input
        let outFps = 29.97;

        let nextOutFrameId = 0;
        let readyOutFrameId = -1;
        let isDone = false;

        let getImage = async (
            outFrameId: number,
            buffer: Uint8Array,
            linesize: number
        ): Promise<number> => {
            const waitStart = new Date();
            // When this function gets called, the next frame may not yet be decoded. In this case
            // we wait until it's ready.
            while (readyOutFrameId < outFrameId) {
                await setImmedateAsync();
            }
            this.sumInputFrameWaitMs += new Date().getTime() - waitStart.getTime();
            let targetPixelBuffer: AlignedPixelData = {
                data: buffer,
                linesize: linesize,
                w: outWidth,
                h: outHeight,
            };
            this.props.videoManager.pipeline.fillPixelData(targetPixelBuffer);
            nextOutFrameId = outFrameId + 1;

            if (isDone) {
                console.log("Export panel done. Avg ms spent waiting on the input frame " + this.sumInputFrameWaitMs / outFrameId);
                return 1;
            }

            return 0;
        };

        // Decoding portion
        let inWidth = 0;
        let inHeight = 0;
        let inFrameIdx = -1;

        let receivedMetadata = (metadata: MediaMetadata) => {
            console.log("Received metadata: " + JSON.stringify(metadata));
            // A custom output framerate could be allowed later but having it identical to the input framerate,
            // makes things easier for now.
            outFps = metadata.framerate;
            inWidth = metadata.width;
            inHeight = metadata.height;

            let filename = this.dateToFilename(new Date()) + ".mp4";
            let fullpath = path.join(this.pathRef.current!.value, filename);
            this.props.encoder.startEncoding(fullpath, outWidth, outHeight, outFps, getImage);
        };
        let receivedImage = (buffer: Uint8Array) => {
            inFrameIdx += 1;

            // TODO if the input framerate is different from the output framerate
            // we need to check if we even need to render this frame

            // console.log("Video finished seeking. Time", video.currentTime);
            let pixelData: PackedPixelData = {
                data: buffer,
                w: inWidth,
                h: inHeight,
            };
            this.props.videoManager.renderOnce(pixelData);
            readyOutFrameId = nextOutFrameId;
        };
        let inputDone = (success: boolean) => {
            console.log("Called done, success was", success);

            // TODO This is a bit of a hack, we are rendering the last frame one more time
            // optimally the getImage function should be able to indicate when the current frame
            // is PAST the end (not when the current frame is the last)
            readyOutFrameId = nextOutFrameId;
            isDone = true;
        };

        this.props.decoder.startDecoding(
            video.filePath,
            receivedMetadata,
            receivedImage,
            inputDone
        );
    }

    fetchFrame() {
        if (this.canvasRef.current) {
            let ctx = this.canvasRef.current.getContext("2d");
            if (!ctx) {
                console.error("Could not get 2d context");
                return;
            }
            let pixelData = this.props.videoManager.pipeline.getPixelData();
            if (!pixelData) {
                console.error("Could not get pixel data");
                return;
            }
            console.log("Received pixel data of size " + pixelData.w + ", " + pixelData.h);
            let imgData = ctx.createImageData(pixelData.w, pixelData.h);
            for (let y = 0; y < pixelData.h; y++) {
                for (let x = 0; x < pixelData.w; x++) {
                    let index = y * pixelData.w + x;
                    imgData.data[index * 4 + 0] = pixelData.data[index * 4 + 0];
                    imgData.data[index * 4 + 1] = pixelData.data[index * 4 + 1];
                    imgData.data[index * 4 + 2] = pixelData.data[index * 4 + 2];
                    imgData.data[index * 4 + 3] = 255;
                }
            }
            createImageBitmap(imgData, { resizeWidth: 800, resizeHeight: 400 }).then((img) => {
                ctx?.drawImage(img, 0, 0);
            });
        }
    }

    protected dateToFilename(date: Date): string {
        return (
            date.getFullYear() +
            "-" +
            (date.getMonth() + 1) +
            "-" +
            date.getDate() +
            "--" +
            date.getHours() +
            "-" +
            date.getMinutes() +
            "-" +
            date.getSeconds()
        );
    }
}
