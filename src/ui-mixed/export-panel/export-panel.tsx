
import * as React from "react";
import * as path from "path";
import * as util from "util";
import { Codec } from "../../video/codec";
import { VideoManager } from "../../video/video-manager";
import { PixelData } from "../../video/filter-pipeline";

/** Wait for the next event loop iteration */ 
const setImmedateAsync = util.promisify(setImmediate);

export interface ExportPanelProps {
    codec: Codec;
    videoManager: VideoManager;
}

export class ExportPanel extends React.Component<ExportPanelProps> {
    canvasRef: React.RefObject<HTMLCanvasElement>;

    pathRef: React.RefObject<HTMLInputElement>;

    constructor(params: any) {
        super(params);
        this.canvasRef = React.createRef();
        this.pathRef = React.createRef();
    }

    render() {
        return (<div>
            <input ref={this.pathRef} placeholder="Output file path"></input>
            <div>
                <button onClick={this.startExport.bind(this)}>
                    Export
                </button>
            </div>
            <button onClick={this.fetchFrame.bind(this)}>
                Get current frame
            </button>
            <canvas ref={this.canvasRef} width={800} height={400}></canvas>
        </div>);
    }

    protected startExport() {
        if (!this.props.videoManager.video) {
            throw new Error("There must be an initialized video");
        }
        let video = this.props.videoManager.video.htmlVideo;

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
            while (readyFrameId < outFrameId) {
                await setImmedateAsync();
            }
            let targetPixelBuffer: PixelData = {
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
        this.props.codec.startEncoding(fullpath, width, height, outFps, getImage);
    }

    fetchFrame() {
        if (this.canvasRef.current) {
            let ctx = this.canvasRef.current.getContext('2d');
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
                    let index = y*pixelData.w + x;
                    imgData.data[index*4 + 0] = pixelData.data[index*4 + 0];
                    imgData.data[index*4 + 1] = pixelData.data[index*4 + 1];
                    imgData.data[index*4 + 2] = pixelData.data[index*4 + 2];
                    imgData.data[index*4 + 3] = 255;
                }
            }
            createImageBitmap(imgData, {resizeWidth: 800, resizeHeight: 400}).then(img => {
                ctx?.drawImage(img, 0, 0);
            });
        }
    }

    protected dateToFilename(date: Date): string {
        return (
            date.getFullYear() + "-" +
            (date.getMonth()+1) + "-" +
            date.getDate() + "--" +
            date.getHours() + "-" +
            date.getMinutes() + "-" +
            date.getSeconds()
        );
    }
}
