
import * as util from "util";
import * as fs from "fs";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";

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
export type GetImageCallback = (frameId: number, buffer: Uint8Array, linesize: number) => Promise<number>;

/**
 * A 
 */
export class Codec {

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
    ffmpegProc: ChildProcess | null;
    encStartTime: Date;

    ffmpegStdout: string;
    // ffmpegStderr: string;

    constructor() {
        this.runningEncoding = false;

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
        // this.ffmpegStderr = "";

        this.userGetImage = async (fid, buff, linesize): Promise<number> => {
            console.warn("USING THE DEFAULT GET IMAGE FUNCTION. THIS PROBABLY INDICATES YOU FORGOT TO SET THE `userGetImage` FUNCTION");
            return 0;
        };
    }

    resetEncodingSession() {
        this.pixelBuffer = new Uint8Array();
        this.ffmpegProc = null;
        this.width = 0;
        this.height = 0;
        this.frameId = 0;
        this.ffmpegStdout = "";
        // this.ffmpegStderr = "";
    }

    /**
     * Returns false if the underlying library hasn't been initailized.
     * Returns true otherwise.
     * 
     * This function returns immedately and then `getImage` will be called peridically
     * in an asychronnous fashion.
     */
    startEncoding(
        outFileName: string,
        width: number,
        height: number,
        fps: number,
        getImage: GetImageCallback
    ): boolean {
        if (this.runningEncoding) {
            // It should be possible in theory to be able to encode multiple streams at once
            // but it is not implemented at the moment.
            console.error("An encoding is already going on. There cannot be multiple encoding at once.");
            return false;
        }
        this.runningEncoding = true;
        this.encStartTime = new Date();

        this.userGetImage = getImage;
        this.pixelBuffer = new Uint8Array(width * height * 4);
        this.width = width;
        this.height = height;
        this.frameId = 0;

        let resStr = width + "x" + height;
        let outFileNameArg = outFileName.replace(/\\/g, "/");
        let ffmpegBin = "C:\\Users\\Dighumlab2\\Desktop\\Media Tools\\ffmpeg-4.4-full_build\\bin\\ffmpeg";
        this.ffmpegProc = spawn(ffmpegBin, [
            "-f", "rawvideo", "-vcodec", "rawvideo", "-pixel_format", "rgba", "-video_size", resStr, "-i", "-", "-an", /*"-vf", "hwupload",*/ "-vcodec", "h264_nvenc", "-f", "mp4", outFileNameArg
        ], {
            stdio: ["pipe", "pipe", "pipe"]
        });

        this.ffmpegProc.stdin?.on("finish", () => {
            console.log("The stdin of ffmpeg was successfully closed");
            this.resetEncodingSession();
        });

        this.ffmpegProc.stdout?.on("data", data => {
            this.ffmpegStdout += data;
        });
        this.ffmpegProc.stderr?.on("data", data => {
            this.ffmpegStdout += data;
        })

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

    async dispose() {
        
    }

    writeFrame() {
        // TODO it might give some speedup to use double buffering: 
        // While one frame is getting filled up by the "getimage" callback
        // the other could be sent down the pipe to ffmpeg
        let frameId = this.frameId;
        this.frameId += 1;
        this.userGetImage(frameId, this.pixelBuffer, this.width * 4).then(getImgRetVal => {
            let isLastFrame = getImgRetVal == 1;

            //////////////////////////////////////////////
            // TEST
            if (isLastFrame) {
                this.endEncoding();
            } else {
                this.writeFrame();
            }
            return;
            //////////////////////////////////////////////


            if (getImgRetVal < 0) {
                // Indicates an error
                console.error("There was an error during the generation of the pixel buffer. Stopping the encoding process.");
                this.endEncoding();
                return;
            }
            if (!this.ffmpegProc) {
                console.error("Expected to have a reference to ffmpegProc here but there wasn't any");
                return;
            }
            if (!this.ffmpegProc.stdin) {
                console.error("Expected that the ffmpeg process has an stdin but it didn't");
                return;
            }
            let canWriteMore = false;
            let writeDone = (err: Error | null | undefined) => {
                // console.log("Write done - " + frameId);
                if (err) {
                    console.error("There was an error while writing to ffmpeg: " + err + "\nProc output: " + this.ffmpegStdout)
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
            }
            // console.log("Calling write - " + frameId);
            canWriteMore = this.ffmpegProc.stdin.write(this.pixelBuffer, writeDone);
            if (!canWriteMore && !isLastFrame) {
                // The pipe is full, we need to wait a while before we can push more data
                // into it.
                this.ffmpegProc.stdin.once("drain", () => {
                    // console.log("The drain event was triggered on the ffmpeg pipe");
                    this.writeFrame();
                });
            }
        })
    }

    endEncoding() {
        this.runningEncoding = false;
        if (!this.ffmpegProc) {
            console.error("Expected to have a reference to ffmpegProc here but there wasn't any");
            this.resetEncodingSession();
            return;
        }

        let endTime = new Date();
        let elapsedSecs = (endTime.getTime() - this.encStartTime.getTime()) / 1000;
        let avgFramerate = this.frameId / elapsedSecs;
        console.log("The avg Framerate was: " + avgFramerate);

        // The encoding settings are reset by the callback that listens on the "finish" event.
        this.ffmpegProc.stdin?.end();
    }
}
