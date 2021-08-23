import * as util from "util";
import * as fs from "fs";
import * as path from "path";
import { spawn, ChildProcess, ChildProcessWithoutNullStreams } from "child_process";

// const ffmpegBin =
//     "C:\\Users\\Dighumlab2\\Desktop\\Media Tools\\ffmpeg-4.4-full_build\\bin\\ffmpeg";
// const ffprobeBin =
//     "C:\\Users\\Dighumlab2\\Desktop\\Media Tools\\ffmpeg-4.4-full_build\\bin\\ffprobe";

const READ_CHUNK_SIZE = 8 * 1024;

/**
 * Called during encoding to retreive the pixel data for a video frame.
 *
 * When called this function is expected to fill up the buffer with the pixel
 * data. Pixels must be in RGBA format where each channel is an unsigned byte.
 *
 * Pixels must be in row major order and `linesize` (stride) must be respected.
 *
 * The return value is used to determine the end of the video stream. Return 1
 * to indicate that this is the last frame. Return 0 to indicate success and return
 * a negative number to indicate an error. (In case of an error the stream will
 * still be attempted to be closed just like for the last frame)
 *
 * frameId: The sequence number of the frame for which the pixel data is requested.
 * 0 is the first frame and the last frameId is approximately `fps * lenInSec`
 *
 * buffer: The buffer into which the pixel data should be written.
 *
 * linesize: The number of BYTES to step forward from the first pixel of a row to the
 * first pixel of the next row. Note that this is at least `4 * width` (each pixel
 * takes up 4 bytes). This is also known as stride or pitch
 */
export type GetImageCallback = (
    frameId: number,
    buffer: Uint8Array,
    linesize: number
) => Promise<number>;

export type ReceivedMetadataCallback = (metadata: MediaMetadata) => void;
export type ReceivedImageCallback = (buffer: Uint8Array) => void;

export interface MediaMetadata {
    framerate: number;
    width: number;
    height: number;
}

export interface EncoderDesc {
    width: number;
    height: number;
    fps: number;
    bitrate?: number;
    encoder?: string;
    audioFilePath: string;
}

/**
 * A
 */
export class Encoder {
    /** Measures the time in milliseconds between the start and completion of a pipeline write and the end of it. */
    sumWriteMs: number;

    /**
     * Measures the time in milliseconds spent between the start of a write request and the following drain event in case the pipeline was full.
     *
     * I believe that when this is larger than 0, it means that the ffmpeg encoding + pipeline transfer is slower than
     * the decoding and filter application.
     */
    sumDrainWaitMs: number;

    readCbPtr!: number;
    metadataCbPtr!: number;
    decodedAudioCbPtr!: number;
    finishedDecodeCbPtr!: number;

    getImageCbPtr!: number;
    writeCbPtr!: number;
    finishedEncodeCbPtr!: number;
    runningEncoding: boolean;

    userGetImage: GetImageCallback;
    pixelBuffer: Uint8Array;

    width: number;
    height: number;
    frameId: number;
    ffmpegProc: ChildProcessWithoutNullStreams | null;
    encStartTime: Date;

    ffmpegStdout: string;
    ffmpegStderr: string;

    constructor() {
        this.runningEncoding = false;
        this.sumWriteMs = 0;
        this.sumDrainWaitMs = 0;

        // this.inputFile = fs.openSync(
        //     "D:/personal/Documents/DoteExample/Camerawork training Panasonic HD.mp4",
        //     "r"
        // );
        this.pixelBuffer = new Uint8Array();
        this.ffmpegProc = null;
        this.width = 0;
        this.height = 0;
        this.frameId = 0;
        this.ffmpegStdout = "";
        this.encStartTime = new Date();
        this.ffmpegStderr = "";

        this.userGetImage = async (fid, buff, linesize): Promise<number> => {
            console.warn(
                "USING THE DEFAULT GET IMAGE FUNCTION. THIS PROBABLY INDICATES YOU FORGOT TO SET THE `userGetImage` FUNCTION"
            );
            return 0;
        };
    }

    resetEncodingSession() {
        console.log("Resetting the encoding session");
        this.pixelBuffer = new Uint8Array();
        this.ffmpegProc = null;
        this.width = 0;
        this.height = 0;
        this.frameId = 0;
        this.ffmpegStdout = "";
        this.ffmpegStderr = "";
    }

    /**
     * Returns false if the underlying library hasn't been initailized.
     * Returns true otherwise.
     *
     * This function returns immedately and then `getImage` will be called peridically
     * in an asychronnous fashion.
     *
     * The bitrate is specified in kbps
     */
    startEncoding(
        ffmpegBinParentPath: string,
        outFileName: string,
        encoderDesc: EncoderDesc,
        getImage: GetImageCallback,
        onExit: (code: number | null, stderr: string) => void
    ): boolean {
        const ffmpegBin = path.join(ffmpegBinParentPath, "ffmpeg");

        this.sumWriteMs = 0;
        this.sumDrainWaitMs = 0;
        if (this.runningEncoding) {
            // It should be possible in theory to be able to encode multiple streams at once
            // but it is not implemented at the moment.
            console.error(
                "An encoding is already going on. There cannot be multiple encoding at once."
            );
            return false;
        }
        this.runningEncoding = true;
        this.encStartTime = new Date();

        this.userGetImage = getImage;
        this.pixelBuffer = new Uint8Array(encoderDesc.width * encoderDesc.height * 4);
        this.width = encoderDesc.width;
        this.height = encoderDesc.height;
        this.frameId = 0;

        let defaultBitrate = Math.round(Math.sqrt(encoderDesc.width * encoderDesc.height) * 3);
        let bitrate = encoderDesc.bitrate || defaultBitrate;
        console.log("Setting output bitrate to", bitrate);

        let encoder = encoderDesc.encoder || "h264";

        let resStr = encoderDesc.width + "x" + encoderDesc.height;
        let outFileNameArg = outFileName.replace(/\\/g, "/");
        this.ffmpegProc = spawn(
            ffmpegBin,
            [
                "-hide_banner",
                "-loglevel",
                "warning",
                "-f",
                "rawvideo",
                "-vcodec",
                "rawvideo",
                "-pix_fmt",
                "rgba",
                "-framerate",
                encoderDesc.fps.toString(),
                "-video_size",
                resStr,
                "-i",
                "-",
                "-i",
                encoderDesc.audioFilePath,
                "-c:a",
                "aac",
                "-vcodec",
                encoder,
                "-b:v",
                bitrate + "k",
                "-f",
                "mp4",
                "-map",
                "0:v:0",
                "-map",

                // The question mark indicates that it's okay if the source does NOT
                // have an audio track
                "1:a:0?",
                outFileNameArg,
            ],
            {
                stdio: ["pipe", "pipe", "pipe"],
            }
        );

        this.ffmpegProc.stdin.on("finish", () => {
            console.log("The stdin of ffmpeg was successfully closed");
            // this.resetEncodingSession();
        });

        this.ffmpegProc.stdout.on("data", (data) => {
            this.ffmpegStdout += data;
        });
        this.ffmpegProc.stderr.on("data", (data) => {
            this.ffmpegStderr += data;
        });

        this.ffmpegProc.on("exit", (code) => {
            let msg = this.ffmpegStderr;
            console.log("Exiting the ffmpeg proc. The stderr was:", this.ffmpegStderr);
            this.runningEncoding = false;
            this.resetEncodingSession();
            // It's important that we use a copy of the stderr, because that gets reset by the 
            // resetEncodingSession
            onExit(code, msg);
        });

        // Make sure we return before calling the callback. This is just nice because this guarantees
        // for the caller that their callback is always only called after this function has returned
        setImmediate(() => {
            this.writeFrame();
        });

        // chunkyBoy._encode_video_from_callback(
        //     this.chunkyCtx,
        //     width,
        //     height,
        //     fps,
        //     5_000_000,
        //     44100,
        //     192_000,
        //     this.writeCbPtr,
        //     this.getImageCbPtr,
        //     -1,
        //     this.finishedEncodeCbPtr
        // );

        return true;
    }

    async dispose() {}

    writeFrame() {
        if (!this.ffmpegProc || !this.ffmpegProc.stdin.writable) {
            return;
        }

        // TODO it might give some speedup to use double buffering:
        // While one frame is getting filled up by the "getimage" callback
        // the other could be sent down the pipe to ffmpeg
        let frameId = this.frameId;
        this.frameId += 1;
        this.userGetImage(frameId, this.pixelBuffer, this.width * 4).then((getImgRetVal) => {
            let isLastFrame = getImgRetVal == 1;

            //////////////////////////////////////////////
            // TEST
            // if (isLastFrame) {
            //     this.endEncoding();
            // } else {
            //     this.writeFrame();
            // }
            // return;
            //////////////////////////////////////////////

            if (getImgRetVal < 0) {
                // Indicates an error
                console.error(
                    "There was an error during the generation of the pixel buffer. Stopping the encoding process."
                );
                this.endEncoding();
                return;
            }
            if (!this.ffmpegProc) {
                console.error(
                    "Expected to have a reference to ffmpegProc here but there wasn't any"
                );
                return;
            }
            if (!this.ffmpegProc.stdin) {
                console.error("Expected that the ffmpeg process has an stdin but it didn't");
                return;
            }
            let canWriteMore = false;
            let writeDone = (err: Error | null | undefined) => {
                this.sumWriteMs += new Date().getTime() - writeStart.getTime();
                // console.log("Write done - " + frameId);
                if (err) {
                    console.error(
                        "There was an error while writing to ffmpeg: " +
                            err +
                            "\nProc output: " +
                            this.ffmpegStdout
                    );
                    return;
                }
                if (isLastFrame) {
                    // This was the last frame
                    this.endEncoding();
                    return;
                }
                if (canWriteMore) {
                    // If the pipe can accept more data immediately, then we just immediately fetch the
                    // next frame.
                    // TODO this should be handled differently when using double buffering
                    this.writeFrame();
                } else {
                    // console.log("canWriteMore was false after the write completed, not sending frames immediately");
                }
            };

            if (!this.ffmpegProc.stdin.writable) {
                console.log(
                    "The stream was not writeable, this likely indicates that the process was prematurely terminated"
                );
                return;
            }

            let writeStart = new Date();
            canWriteMore = this.ffmpegProc.stdin.write(this.pixelBuffer, writeDone);
            if (!canWriteMore && !isLastFrame) {
                // The pipe is full, we need to wait a while before we can push more data
                // into it.
                let drainWaitStart = new Date();
                this.ffmpegProc.stdin.once("drain", () => {
                    this.sumDrainWaitMs += new Date().getTime() - drainWaitStart.getTime();
                    // console.log("The drain event was triggered on the ffmpeg pipe");
                    this.writeFrame();
                });
            }
        });
    }

    endEncoding() {
        this.runningEncoding = false;
        if (!this.ffmpegProc) {
            console.error(
                "Tried to end the encoding but the ffmpegProc was null"
            );
            this.resetEncodingSession();
            return;
        }

        let endTime = new Date();
        let elapsedSecs = (endTime.getTime() - this.encStartTime.getTime()) / 1000;
        let avgFramerate = this.frameId / elapsedSecs;
        console.log(
            "ENCODING: The avg frametime (ms) was: " +
                (elapsedSecs / this.frameId) * 1000 +
                ". Avg inter frame ms was " +
                this.sumWriteMs / this.frameId +
                ". Avg drain wait time was " +
                this.sumDrainWaitMs / this.frameId
        );

        // The encoding settings are reset by the callback that listens on the "finish" event.
        this.ffmpegProc.stdin?.end();
    }
}

export class Decoder {
    // runningDecoding: boolean;
    decStartTime: Date;
    /** Size in bytes of the average pipe data size */
    avgChunkSize: number;
    sumPacketProcMs: number;
    sumInterPacketMs: number;
    prevPacketEndTime: number;

    prevFrameProcessedTime: Date;

    /** The time in seconds between the end of processing a frame and the moment the next frame
     * is finished transfering. This measures the decoder speed + the speed of the transfer through the pipeline
     */
    sumInterframeSec: number;

    receivedImageCb: ReceivedImageCallback;
    doneCb: (success: boolean) => void;

    pixelBuffer: Uint8Array;

    /** The pipe between ffmpeg and this process does not necessarily allow sending an entire frame
     * at once, we may receive the frame in many smaller packets. Therefore we need to
     * keep track of how many bytes we have received for the current frame (pixelBuffer).
     *
     * This value keeps track of exactly that.
     */
    recvPixelBytes: number;

    ffmpegProc: ChildProcessWithoutNullStreams | null;
    frameId: number;
    metadata: MediaMetadata;

    ffmpegStderr: string;

    constructor() {
        this.pixelBuffer = new Uint8Array();
        this.ffmpegProc = null;
        this.metadata = {
            width: 0,
            height: 0,
            framerate: 0,
        };
        this.frameId = 0;
        this.recvPixelBytes = 0;
        // this.runningDecoding = false;
        this.decStartTime = new Date();
        this.prevFrameProcessedTime = new Date();
        this.sumInterframeSec = 0;
        this.avgChunkSize = 0;
        this.sumPacketProcMs = 0;
        this.sumInterPacketMs = 0;
        this.prevPacketEndTime = 0;

        // this.receivedMetadataCb = () => {
        //     console.error(
        //         "This is the default callback for the received metadata. This indicates that the appropriate callback was not set"
        //     );
        // };
        this.receivedImageCb = () => {
            console.error(
                "This is the default callback for the received image. This indicates that the appropriate callback was not set"
            );
        };
        this.doneCb = () => {
            console.error(
                "This is the default callback for 'done'. This indicates that the appropriate callback was not set"
            );
        };

        this.ffmpegStderr = "";
    }

    startDecoding(
        ffmpegBinParentPath: string,
        inFilePath: string,
        receivedMetadata: ReceivedMetadataCallback,
        receivedImage: ReceivedImageCallback,
        done: (success: boolean) => void
    ): void {
        const ffmpegBin = path.join(ffmpegBinParentPath, "ffmpeg");
        const ffprobeBin = path.join(ffmpegBinParentPath, "ffprobe");

        this.decStartTime = new Date();
        this.sumInterframeSec = 0;
        this.prevFrameProcessedTime = new Date();
        this.sumPacketProcMs = 0;
        this.prevPacketEndTime = 0;

        this.receivedImageCb = receivedImage;
        this.doneCb = done;
        // this.pixelBuffer = new Uint8Array(width * height * 4);
        this.metadata = {
            width: 0,
            height: 0,
            framerate: 0,
        };
        this.frameId = 0;
        this.recvPixelBytes = 0;

        // This is from: https://askubuntu.com/a/468003
        let getFramerateProc = spawn(
            ffprobeBin,
            [
                "-v",
                "0",
                "-of",
                "csv=p=0",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=r_frame_rate",
                "-i",
                inFilePath,
            ],
            {
                stdio: ["pipe", "pipe", "pipe"],
            }
        );

        let framerateStr = "";
        getFramerateProc.stdout.on("data", (data) => {
            framerateStr += data;
        });
        getFramerateProc.on("exit", (code) => {
            if (code !== 0) {
                console.error("Error while trying to obtain the framerate.");
                this.finishedDecoding(false);
                return;
            }
            console.log("Get framerate process completed");
            let [num, denom] = framerateStr
                .trim()
                .split("/")
                .map((s) => Number.parseInt(s));
            this.metadata.framerate = num / denom;

            let getDimensionsProc = spawn(
                ffprobeBin,
                [
                    "-v",
                    "0",
                    "-of",
                    "csv=p=0",
                    "-select_streams",
                    "v:0",
                    "-show_entries",
                    "stream=width,height",
                    "-i",
                    inFilePath,
                ],
                {
                    stdio: ["pipe", "pipe", "pipe"],
                }
            );
            let dimensionsStr = "";
            getDimensionsProc.stdout?.on("data", (data) => {
                dimensionsStr += data;
            });
            getDimensionsProc.on("exit", (code) => {
                if (code !== 0) {
                    console.error("Error while trying to obtain the dimensions.");
                    this.finishedDecoding(false);
                    return;
                }
                let [w, h] = dimensionsStr
                    .trim()
                    .split(",")
                    .map((s) => Number.parseInt(s));
                this.metadata.width = w;
                this.metadata.height = h;

                this.pixelBuffer = new Uint8Array(w * h * 4);
                receivedMetadata(this.metadata);
                this.startProcessingFrames(inFilePath, ffmpegBin);
            });
        });
    }

    protected startProcessingFrames(inFilePath: string, ffmpegBin: string) {
        this.ffmpegProc = spawn(
            `${ffmpegBin}`,
            [
                // Enabling HW acceleration here, doesn't seem to have any effect on the speed
                // "-hwaccel",
                // "d3d11va",
                "-i",
                `${inFilePath}`,
                "-f",
                "rawvideo",
                "-vcodec",
                "rawvideo",
                "-pix_fmt",
                "rgba",
                "-an",
                "pipe:1",
            ],
            {
                stdio: ["pipe", "pipe", "pipe"],
            }
        );
        this.ffmpegProc.on("exit", (code) => {
            if (code === 0) {
                console.log("FFmpeg exited successfully");
                this.finishedDecoding(true);
                return;
            }
            if (code === null) {
                console.warn("ffmpeg seems to have been terminated");
            } else {
                console.warn("ffmpeg returned with the exit code:", code);
            }
            console.warn("ffmpeg stderr was:\n" + this.ffmpegStderr);
            this.finishedDecoding(false);
        });

        // Another way of potentially making the read faster is to ask ffmpeg to send the data over
        // a tcp/udp connection. (instead of a pipe)
        this.ffmpegProc.stdout.pause();
        this.ffmpegProc.stdout.on("readable", () => {
            while (true) {
                // A single readable event may signal that multiple 'read' chunks are available.
                let src: Buffer | null = this.ffmpegProc?.stdout.read();
                if (!src || src.length === 0) {
                    return;
                }
                let packetProcStart = new Date();
                if (this.prevPacketEndTime > 0) {
                    this.sumInterPacketMs +=
                        packetProcStart.getTime() - this.prevPacketEndTime;
                }
                this.avgChunkSize =
                    (src.length + this.avgChunkSize * this.frameId) / (this.frameId + 1);
                let copiedSrcBytes = 0;
                while (copiedSrcBytes < src.length) {
                    // First copy as many bytes into the pixel buffer as we can
                    let pixBufRemaining = this.pixelBuffer.length - this.recvPixelBytes;
                    let remainingSrcBytes = src.length - copiedSrcBytes;
                    let copyAmount = Math.min(remainingSrcBytes, pixBufRemaining);

                    let srcSlice = src.slice(copiedSrcBytes, copiedSrcBytes + copyAmount);
                    this.pixelBuffer.set(srcSlice, this.recvPixelBytes);

                    this.recvPixelBytes += copyAmount;
                    copiedSrcBytes += copyAmount;

                    if (this.recvPixelBytes == this.pixelBuffer.length) {
                        this.sumInterframeSec +=
                            (new Date().getTime() - this.prevFrameProcessedTime.getTime()) /
                            1000;
                        this.receivedImageCb(this.pixelBuffer);
                        this.prevFrameProcessedTime = new Date();
                        this.recvPixelBytes = 0;
                        this.frameId += 1;
                    }
                }
                let endTime = new Date().getTime();
                this.sumPacketProcMs += endTime - packetProcStart.getTime();
                this.prevPacketEndTime = endTime;
            }
        });

        // this.ffmpegProc.stdout.on("data", (src: Buffer) => {
        //     // This was moved to the readable callback in an attempt to better control the chunk
        //     // size that is read
        // });
        this.ffmpegProc.stderr.on("data", (data) => {
            this.ffmpegStderr += data;
        });
    }

    protected finishedDecoding(success: boolean) {
        let now = new Date();
        let elapsed = (now.getTime() - this.decStartTime.getTime()) / 1000;
        console.log(
            [
                `Elapsed time is ${elapsed}, avg decode framerate ${this.frameId / elapsed}.`,
                `Avg inter frame ms ${(this.sumInterframeSec * 1000) / this.frameId}.`,
                `Avg pipe chunk kb ${this.avgChunkSize / 1000}`,
                `Avg inter packet ms ${this.sumInterPacketMs / this.frameId}`,
                `Avg packet proccess ms ${this.sumPacketProcMs / this.frameId}`,
            ].join("\n")
        );
        this.doneCb(success);
    }

    stopDecoding() {
        if (this.ffmpegProc) {
            this.ffmpegProc.kill();
        }
    }
}
