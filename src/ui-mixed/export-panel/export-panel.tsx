import "./export-panel.css";

import { Server } from "net";
import { spawn } from "child_process";
import * as React from "react";
import * as path from "path";
import * as util from "util";
import { dialog, getCurrentWindow } from '@electron/remote';
import { Decoder, DecoderDesc, Encoder, EncoderDesc, MediaMetadata } from "../../video/codec";
import { VideoManager } from "../../video/video-manager";
import { AlignedPixelData, ImageFormat, PackedPixelData } from "../../video/filter-pipeline";
import { ExportInfoProvider, MiscExportInfo } from "../export-overlay/export-overlay";
import { secsToTimeString } from "../../util";
import { FFmpegExists, settings } from "../../app";
import { minorScale, Pane, Text } from "evergreen-ui";

// const settings = require("settings-store");

const MATCH_INPUT_RESOLUTION = "MATCH_INPUT";

export type WindowsEncoders = "h264_amf" | "h264_nvenc";

export type MacEncoders = "h264_videotoolbox";

export type AvailableEncoders = "h264" | WindowsEncoders | MacEncoders;

let settingsInitialized = false;

/** Wait for the next event loop iteration */
const setImmediateAsync = util.promisify(setImmediate);

function timeoutAsync(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export interface ExportPanelProps {
    encoder: Encoder;
    decoder: Decoder;
    videoManager: VideoManager | null;
    exportStateChange: (inProgress: boolean) => void;
    infoProvider: ExportInfoProvider;
    // clipRangeChange: (startSec: number, endSec: number) => void;
}

interface ExportPanelState {
    statusMessage: string | null;
}

export class ExportPanel extends React.Component<ExportPanelProps, ExportPanelState> {
    sumInputFrameWaitMs: number;
    sumInputWaitIterations: number;

    canvasRef: React.RefObject<HTMLCanvasElement>;

    // pathRef: React.RefObject<HTMLInputElement>;
    // ffmpegFolderRef: React.RefObject<HTMLInputElement>;

    // selectedOutputHeight: number;
    // selectedOutputWidth: number;
    selectedOutputDim: [number, number] | "MATCH_INPUT";
    selectedEncoder: AvailableEncoders;
    sumRenderTimeCpu: number;

    outFrameCount: number;
    sumFrameReadTime: number;
    sumOutputWaitTime: number;

    frameProcessStartTime: number;
    infoReportInterval: NodeJS.Timeout | null;
    progress: number;

    constructor(params: any) {
        super(params);
        this.canvasRef = React.createRef();
        // this.pathRef = React.createRef();
        // this.ffmpegFolderRef = React.createRef();
        this.sumInputFrameWaitMs = 0;
        this.sumInputWaitIterations = 0;
        this.sumRenderTimeCpu = 0;
        this.sumFrameReadTime = 0;
        this.outFrameCount = 0;
        this.sumOutputWaitTime = 0;
        this.progress = 0;
        this.frameProcessStartTime = NaN;
        this.infoReportInterval = null;
        // this.selectedOutputHeight = 2160;
        // this.selectedOutputWidth = 3840;
        this.selectedOutputDim = MATCH_INPUT_RESOLUTION;
        this.selectedEncoder = "h264";
        this.state = {
            statusMessage: null,
        };
    }

    componentDidMount() {
        // if (!settingsInitialized) {
        //     settingsInitialized = true;
        //     settings.init({
        //         appName: "360mash", //required,
        //         reverseDNS: "com.BigVideo.360mash", //required for macOS
        //     });
        // }

        // if (this.ffmpegFolderRef.current) {
        //     let saved = settings.value("ffmpegFolderPath");
        //     if (saved) {
        //         this.ffmpegFolderRef.current.value = saved;
        //     }
        // }
        // if (this.pathRef.current) {
        //     let saved = settings.value("outputPath");
        //     if (saved) {
        //         this.pathRef.current.value = saved;
        //     }
        // }
    }

    render() {
        let statusMessage = undefined;
        if (this.state.statusMessage) {
            let elements = [];
            let i = 0;
            for (const segment of this.state.statusMessage.split("\n")) {
                elements.push(<div key={i++}>{segment}</div>);
            }
            statusMessage = <div className="export-panel-status-message">{elements}</div>;
        }

        let encoderKinds = [
            <option key="h264" value="h264">
                H.264 (CPU)
            </option>,
        ];
        if (navigator.platform.startsWith("Win")) {
            encoderKinds.push(
                <option key="h264_amf" value="h264_amf">
                    H.264 AMD AMF (GPU)
                </option>,
                <option key="h264_nvenc" value="h264_nvenc">
                    H.264 NVENC (GPU)
                </option>
            );
        }
        if (navigator.platform.startsWith("Mac")) {
            encoderKinds.push(
                <option key="h264_videotoolbox" value="h264_videotoolbox">
                    H.264 VideoToolbox (GPU)
                </option>
            );
        }

        return (
            <Pane display="flex" flexDirection="row" flexGrow={1}>
            {/* <div className="export-panel-root"> */}
                {/* <div className="export-panel-flex-section"> */}
                    {/* <div className="export-panel-text-line">
                        <input
                            ref={this.ffmpegFolderRef}
                            placeholder="ffmpeg.exe folder path"
                            onChange={(event) => {
                                settings.setValue("ffmpegFolderPath", event.target.value);
                            }}
                        ></input>
                    </div>
                    <div className="export-panel-text-line">
                        <input
                            ref={this.pathRef}
                            placeholder="Output folder path"
                            onChange={(event) => {
                                settings.setValue("outputPath", event.target.value);
                            }}
                        ></input>
                    </div> */}
                    {/* <button
                        onClick={() => {
                            let video = this.props.videoManager.video;
                            if (video) {
                                let start = video.htmlVideo.currentTime;
                                let end = Math.max(this.props.endSec, start);
                                this.props.clipRangeChange(start, end);
                            }
                        }}
                    >
                        Set start frame: {secsToTimeString(this.props.startSec)}
                    </button>
                    <button
                        onClick={() => {
                            let video = this.props.videoManager.video;
                            if (video) {
                                let end = video.htmlVideo.currentTime;
                                let start = Math.min(this.props.startSec, end);
                                this.props.clipRangeChange(start, end);
                            }
                        }}
                    >
                        Set end frame: {secsToTimeString(this.props.endSec)}
                    </button> */}
                    <Text marginLeft={minorScale(1)} fontWeight={500}>Export options: </Text>
                    <Pane marginX={minorScale(1)}>
                        <select
                            name="resolutions"
                            onChange={(event) => {
                                if (event.target.value == MATCH_INPUT_RESOLUTION) {
                                    this.selectedOutputDim = MATCH_INPUT_RESOLUTION;
                                } else {
                                    let [w, h] = event.target.value
                                        .split("*")
                                        .map((v) => Number.parseInt(v));
                                    this.selectedOutputDim = [w, h];
                                    // this.selectedOutputWidth = w;
                                    // this.selectedOutputHeight = h;
                                }
                                console.log("Selected resolution is", this.selectedOutputDim);
                            }}
                        >
                            <option value={MATCH_INPUT_RESOLUTION}>Match Source Resolution</option>
                            <option value="3840*2160">4K (3840 × 2160)</option>
                            <option value="1920*1080">Full HD (1920 × 1080)</option>
                            <option value="1280*720">HD (1280 × 720)</option>
                            <option value="854*480">480p (854 × 480)</option>
                        </select>
                    </Pane>
                    <Pane marginX={minorScale(1)}>
                        <select
                            name="encoders"
                            onChange={(event) => {
                                this.selectedEncoder = event.target.value as AvailableEncoders;
                            }}
                        >
                            {encoderKinds}
                        </select>
                    </Pane>
                    <Pane marginX={minorScale(1)} marginLeft="auto">
                        <button
                            disabled={!settings.ffMpegPath || !settings.outputPath || !this.props.videoManager || !this.props.videoManager.video}
                            onClick={this.startFFmpegExport.bind(this)}>Export</button>
                    </Pane>
                    {/* {statusMessage} */}
                    {/* <button onClick={this.fetchFrame.bind(this)}>Get current frame</button> */}
                {/* </div> */}
                {/* <canvas ref={this.canvasRef} width={800} height={400}></canvas> */}
            {/* </div> */}
            </Pane>
        );
    }

    // NOT USED
    protected startExport() {
        if (!this.props.videoManager || !this.props.videoManager.video) {
            throw new Error("There must be an initialized video");
        }
        if (!settings.ffMpegExecutablePath || !settings.ffProbeExecutablePath) {
            throw new Error("There must be an initialized ffmpegFolderRef");
        }

        this.props.exportStateChange(true);

        // let ffmpegParentPath = this.ffmpegFolderRef.current.value;
        let video = this.props.videoManager.video.htmlVideo;
        this.sumInputFrameWaitMs = 0;
        video.pause();
        this.props.videoManager.stopRendering();

        let totalTime = video.duration;

        const pipeline = this.props.videoManager.pipeline;
        let selectedW;
        let selectedH;
        if (this.selectedOutputDim === MATCH_INPUT_RESOLUTION) {
            selectedW = video.videoWidth;
            selectedH = video.videoHeight;
        } else {
            selectedW = this.selectedOutputDim[0];
            selectedH = this.selectedOutputDim[1];
        }
        pipeline.setTargetDimensions(selectedW, selectedH);
        const [width, height] = pipeline.getRealOutputDimensions(video);
        //Todo: Take a look if this is applied anywhere
        const outFps = 29.97;

        let nextFrameId = 0;
        let readyFrameId = -1;

        let seeked = () => {
            readyFrameId = nextFrameId;
            console.log("Video finished seeking. Time", video.currentTime);
            this.props.videoManager?.renderOnce();
        };
        // A bit of a hack, setting the time to NOT zero so that we get our callback called
        // for the first frame
        video.currentTime = 0.5;
        video.addEventListener("seeked", seeked);
        video.currentTime = 0;
        let getImage = async (outFrameId: number, buffer: Uint8Array): Promise<number> => {
            if (!this.props.videoManager) {
                throw Error('Video Manager not defined');
            }
            const waitStart = new Date();
            while (readyFrameId < outFrameId) {
                await setImmediateAsync();
            }
            this.sumInputFrameWaitMs += new Date().getTime() - waitStart.getTime();
            let targetPixelBuffer: AlignedPixelData = {
                data: buffer,
                linesize: width * 4,
                w: width,
                h: height,
            };
            this.props.videoManager.pipeline.fillRgbaPixelData(targetPixelBuffer);
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

        let targetFilename = this.dateToFilename(new Date()) + ".mp4";
        // Ask user for filename
        try {
            let mp4Filter: Electron.FileFilter = {
                extensions: ["mp4"],
                name: "mp4 video file",
            };
            let options: Electron.SaveDialogOptions = {
                filters: [mp4Filter],
                properties: [
                    "createDirectory",  //MacOS only
                ]
            };

            dialog.showSaveDialog(getCurrentWindow(), options).then((dialogResult: any) => {
                if (dialogResult.canceled) {
                    return;
                }
                targetFilename = dialogResult.filePath as string;
                targetFilename = path.resolve(targetFilename);
            });
        } finally {

        }

        // let fullpath = path.join(this.pathRef.current!.value, filename);
        let encoderDesc: EncoderDesc = {
            width,
            height,
            fps: outFps,
            audioFilePath: this.props.videoManager.video.filePath,
            audioStartSec: this.props.videoManager.startSec,
            audioEndSec: this.props.videoManager.endSec,
        };
        this.props.encoder.startEncoding(
            targetFilename,
            encoderDesc,
            getImage,
            this.encodingExitHandler.bind(this)
        );
    }

    protected async startFFmpegExport() {
        if (!settings.ffMpegExecutablePath || !settings.ffProbeExecutablePath) {
            throw new Error("There must be an initialized ffmpegFolderRef");
        }
        if (!FFmpegExists()) {
            console.warn('FFmpeg not available');
            dialog.showErrorBox("FFmpeg missing!", "FFmpeg is not installed. Please use the built-in downloader via the cog button in the upper right corner.");
            return false;
        }
        console.log("Starting ffmpeg export");
        if (!this.props.videoManager || !this.props.videoManager.video) {
            throw new Error("There must be an initialized video");
        }

        this.setState({ statusMessage: "Exporting" });

        let targetFilename = this.dateToFilename(new Date()) + ".mp4";
        // Ask user for filename
        try {
            let mp4Filter: Electron.FileFilter = {
                extensions: ["mp4"],
                name: "mp4 video file",
            };
            let options: Electron.SaveDialogOptions = {
                filters: [mp4Filter],
                properties: [
                    "createDirectory",  //MacOS only
                ],
                defaultPath: settings.outputPath
            };

            const dialogResult = await dialog.showSaveDialog(getCurrentWindow(), options);
            if (dialogResult.canceled) {
                return;
            }
            targetFilename = dialogResult.filePath as string;
            settings.outputPath = path.basename(targetFilename);
            targetFilename = path.resolve(targetFilename);
        } finally {

        }

        this.props.exportStateChange(true);
        this.props.infoProvider.reportProgress(0);
        this.sumRenderTimeCpu = 0;
        this.sumFrameReadTime = 0;
        this.frameProcessStartTime = NaN;

        this.sumInputFrameWaitMs = 0;
        this.sumInputWaitIterations = 0;
        this.sumOutputWaitTime = 0;
        this.progress = 0;
        let video = this.props.videoManager.video;
        let duration = video.htmlVideo.duration;
        if (isFinite(this.props.videoManager.endSec)) {
            duration = this.props.videoManager.endSec - this.props.videoManager.startSec;
        }

        console.log("Video duration is", duration);

        this.props.videoManager.stopRendering();

        const htmlVideo = this.props.videoManager.video.htmlVideo;
        htmlVideo.pause();
        const pipeline = this.props.videoManager.pipeline;
        let selectedW;
        let selectedH;
        if (this.selectedOutputDim === MATCH_INPUT_RESOLUTION) {
            selectedW = video.htmlVideo.videoWidth;
            selectedH = video.htmlVideo.videoHeight;
        } else {
            selectedW = this.selectedOutputDim[0];
            selectedH = this.selectedOutputDim[1];
        }
        pipeline.setTargetDimensions(selectedW, selectedH);
        const [outWidth, outHeight] = pipeline.getRealOutputDimensions(htmlVideo);

        // This is just a default, but actually we will use the same framerate as the input
        let outFps = 29.97;

        let nextOutFrameId = 0;

        // The frame id of the most recent rendered but not yet encoded frame. Measured in output
        // frames
        let renderedOutFrameId = -1;

        let lastInFrameId = Infinity;

        let getOutputImage = async (
            outFrameId: number,
            buffer: Uint8Array
        ): Promise<number> => {
            if (!this.props.videoManager) {
                throw Error('Video Manager not defined');
            }
            const waitStart = new Date();
            // When this function gets called, the next frame may not yet be decoded. In this case
            // we wait until it's ready.
            // console.log("OUT Get output image called.")
            while (renderedOutFrameId < outFrameId) {
                await timeoutAsync(5);
                this.sumInputWaitIterations += 1;
            }
            // console.log("OUT Starting to read-out frame", renderedOutFrameId, outFrameId);
            this.sumInputFrameWaitMs += new Date().getTime() - waitStart.getTime();
            let targetPixelBuffer: PackedPixelData = {
                data: buffer,
                w: outWidth,
                h: outHeight,
                format: ImageFormat.YUV420P,
            };
            let frameReadStart = new Date().getTime();
            await this.props.videoManager.pipeline.fillYuv420pPixelData(targetPixelBuffer);
            let frameReadEnd = new Date().getTime();
            this.sumFrameReadTime += frameReadEnd - frameReadStart;
            let outTime = outFrameId / outFps;
            // console.log("Curr out time", outTime, "fps", outFps, "duration", duration);
            this.progress = outTime / duration;
            nextOutFrameId = outFrameId + 1;

            // TODO: handle this differently if the input framerate is different from the
            // output framerate
            // console.log("outFrameId === lastInFrameId", outFrameId, "===", lastInFrameId, outFrameId === lastInFrameId)
            if (outFrameId >= lastInFrameId) {
                // console.log(
                //     "Export panel done. Avg ms spent waiting on the input frame " +
                //         this.sumInputFrameWaitMs / outFrameId
                // );
                return 1;
            }

            return 0;
        };

        // Decoding portion
        let inWidth = 0;
        let inHeight = 0;
        let inFrameIdx = -1;

        let receivedMetadata = (metadata: MediaMetadata) => {
            if (!this.props.videoManager) {
                throw Error('Video Manager not defined');
            }
            console.log("Received metadata: " + JSON.stringify(metadata));
            // A custom output framerate could be allowed later but having it identical to the input framerate,
            // makes things easier for now.
            outFps = metadata.framerate;
            inWidth = metadata.width;
            inHeight = metadata.height;

            this.frameProcessStartTime = new Date().getTime();
            this.infoReportInterval = setInterval(() => {
                let elapsedMs = new Date().getTime() - this.frameProcessStartTime;
                let remainingMs = (elapsedMs / this.progress) * (1 - this.progress);
                let fps = this.outFrameCount / (elapsedMs / 1000);
                let info: MiscExportInfo = {
                    remainingMs: remainingMs,
                    fps,
                };
                this.props.infoProvider.reportInfo(info);
                this.props.infoProvider.reportProgress(this.progress);
            }, 250);

            let encoderDesc: EncoderDesc = {
                width: outWidth,
                height: outHeight,
                fps: outFps,
                encoder: this.selectedEncoder,
                audioFilePath: video.filePath,
                audioStartSec: this.props.videoManager.startSec,
                audioEndSec: this.props.videoManager.endSec,
            };
            this.props.encoder.startEncoding(
                targetFilename,
                encoderDesc,
                getOutputImage,
                this.encodingExitHandler.bind(this)
            );
        };
        let receivedInputImage = async (buffer: Uint8Array) => {
            if (!this.props.videoManager) {
                throw Error('Video Manager not defined');
            }
            inFrameIdx += 1;

            // TODO if the input framerate is different from the output framerate
            // we need to check if we even need to render this frame
            let outFrameId = inFrameIdx;

            this.outFrameCount = outFrameId + 1;

            let waitStart = new Date().getTime();
            // console.log("IN Starting to wait for prev frame to complete", outFrameId);
            while (nextOutFrameId < outFrameId) {
                // This means that the most recent input frame hasn't yet finished encoding.
                // We must wait with rendering this frame until the previous is done encoding.
                await setImmediateAsync();
            }
            // console.log("IN Rendering input image", nextOutFrameId, outFrameId);
            let waitEnd = new Date().getTime();
            this.sumOutputWaitTime += waitEnd - waitStart;

            // console.log("Video finished seeking. Time", video.currentTime);
            let pixelData: PackedPixelData = {
                data: buffer,
                w: inWidth,
                h: inHeight,

                // TODO: change this if requesting the data from ffmpeg in another format
                format: ImageFormat.YUV420P,
            };
            let renderStart = new Date().getTime();
            this.props.videoManager.renderOnce(pixelData);
            let renderEnd = new Date().getTime();
            this.sumRenderTimeCpu += renderEnd - renderStart;
            renderedOutFrameId = nextOutFrameId;
        };
        let inputDone = (success: boolean) => {
            console.log("Called done, success was", success);

            // TODO This is a bit of a hack, we are rendering the last frame one more time
            // optimally the getImage function should be able to indicate when the current frame
            // is PAST the end (not when the current frame is the last)
            renderedOutFrameId = nextOutFrameId;
            lastInFrameId = inFrameIdx;
            console.log(
                "Set renderedOutFrameId to",
                renderedOutFrameId,
                "set lastInFrameId to",
                lastInFrameId
            );
        };

        let endSec = undefined;
        if (isFinite(this.props.videoManager.endSec)) {
            endSec = this.props.videoManager.endSec;
        }
        let desc: DecoderDesc = {
            startSec: this.props.videoManager.startSec,
            endSec,
        };
        this.props.decoder.startDecoding(
            video.filePath,
            desc,
            receivedMetadata,
            receivedInputImage,
            inputDone
        );
    }

    fetchFrame() {
        if (!this.props.videoManager) {
            throw Error('Video Manager not defined');
        }
        if (this.canvasRef.current) {
            let ctx = this.canvasRef.current.getContext("2d");
            if (!ctx) {
                console.error("Could not get 2d context");
                return;
            }
            let pixelData = this.props.videoManager.pipeline.getRgbaPixelData();
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

    protected encodingExitHandler(code: number | null, stderr: string) {
        if (!this.props.videoManager) {
            throw Error('Video Manager not defined');
        }
        if (code === null || code !== 0) {
            this.setState({ statusMessage: `Encoder error. Output:\n${stderr}` });
            this.props.decoder.stopDecoding();
        } else {
            this.setState({ statusMessage: "Finished exporting" });
        }
        this.props.exportStateChange(false);
        console.log(
            [
                "-- EXPORT PIPELINE Finished.",
                `Avg wait iterations ${this.sumInputWaitIterations / this.outFrameCount}`,
                `Avg ms waiting on input ${this.sumInputFrameWaitMs / this.outFrameCount}`,
                `Avg frame read time ${this.sumFrameReadTime / this.outFrameCount}`,

                `Avg ms waiting on output ${this.sumOutputWaitTime / this.outFrameCount}`,
                `Avg render time ${this.sumRenderTimeCpu / this.outFrameCount}`,
            ].join("\n")
        );
        if (this.infoReportInterval) {
            clearInterval(this.infoReportInterval);
            this.infoReportInterval = null;
        }
        // Re-start rendering after the export has finished
        this.props.videoManager.renderContinously();
    }
}

function ffmpegPipeTest() {
    console.log("Starting piped decode test");

    let packetCnt = 0;

    let testProcStart = new Date();
    let testProc = spawn(
        "C:\\ffmpeg-4.4-full_build\\bin\\ffmpeg",
        [
            "-i",
            "Y:\\Dote-Projects\\New Horizon\\GoPro Back.mp4",
            "-f",
            "rawvideo",
            "-vcodec",
            "rawvideo",
            "-pix_fmt",
            "yuv420p",
            "-an",
            `pipe:1`,
        ],
        {
            stdio: ["pipe", "pipe", "pipe"],
        }
    );
    let stderr = "";
    testProc.stderr.on("data", (msg) => (stderr += msg));
    testProc.stdout.pause();
    testProc.stdout.on("readable", () => {
        // pacekt size: 1024 * 16
        const packetSize = 12441600;
        while (null !== testProc.stdout.read(packetSize)) {
            // Make sure we read all available data
            packetCnt += 1;
        }
    });
    // testProc.stdout.on("data", buff => {
    //     packetCnt += 1;
    // });
    testProc.on("exit", (code) => {
        let elapsedSec = (new Date().getTime() - testProcStart.getTime()) / 1000;
        console.log(
            "Test process exited with",
            code,
            "it took " + elapsedSec + " seconds. Packet count was " + packetCnt
        );
    });
    // let processPackets = () => {
    //     const packetSize = 12441600;
    //     while (null !== testProc.stdout.read()) {
    //         // Make sure we read all available data
    //         packetCnt += 1;
    //     }
    //     setImmediate(processPackets);
    // };
    // setImmediate(processPackets);
}

function ffmpegNetworkTest() {
    console.log("Starting networked decode test");

    let packetCnt = 0;

    // listen on a port
    let server = new Server((socket) => {
        console.log("Got connection!", socket.localPort);
        socket.on("data", (data) => {
            packetCnt += 1;
            // console.log("Received from the connection:", data.toString("utf8"));
        });
        socket.on("close", (hadError) => {
            console.log("Socket was closed. Had error:", hadError);
        });
    });
    server.on("error", (e) => {
        console.log("Error happened with the server: ", e);
    });
    server.on("listening", () => {
        let address = server.address();
        if (!address) {
            console.error("Failed to get address even though already listening.");
            return;
        }
        if (typeof address == "string") {
            console.error("The address was a string but expected an object.");
            return;
        }
        console.log("Server is now listening on port", address.port);

        // --------------------------------------------------------
        // Test the server by connecting to it and sending some data.
        // --------------------------------------------------------
        // let connection = createConnection(address.port, "127.0.0.1", () => {
        //     connection.write("login", "utf8", (err) => {
        //         if (err) {
        //             console.log("Error occured while trying to send login message:", err);
        //         }
        //         connection.end();
        //     });
        // });
        // --------------------------------------------------------

        startFfmpeg(address.port);
    });
    // 0 as port means that the OS will give us an available port.
    server.listen(0, "127.0.0.1");

    let startFfmpeg = (port: number) => {
        let testProcStart = new Date();
        let testProc = spawn(
            "C:\\ffmpeg-4.4-full_build\\bin\\ffmpeg",
            [
                "-i",
                "Y:\\Dote-Projects\\New Horizon\\GoPro Back.mp4",
                "-f",
                "rawvideo",
                "-vcodec",
                "rawvideo",
                "-pix_fmt",
                "yuv420p",
                "-an",
                `tcp://127.0.0.1:${port}`,
            ],
            {
                stdio: ["pipe", "pipe", "pipe"],
            }
        );
        let stderr = "";
        testProc.stderr.on("data", (msg) => (stderr += msg));
        testProc.stdout.pause();
        testProc.stdout.on("readable", () => {
            // pacekt size: 1024 * 16
            while (null !== testProc.stdout.read(1024 * 1024)) {
                // Make sure we read all available data
                // packetCnt += 1;
            }
        });
        // testProc.stdout.on("data", buff => {
        //     packetCnt += 1;
        // });
        testProc.on("exit", (code) => {
            let elapsedSec = (new Date().getTime() - testProcStart.getTime()) / 1000;
            console.log(
                "Test process exited with",
                code,
                "it took " + elapsedSec + " seconds. Packet count was " + packetCnt
            );
        });
    };

    // DEBUG TEST
}
