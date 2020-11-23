
import * as util from "util";
import * as fs from "fs";
import * as path from "path";
import dynamic_require from "../dynamic-require";

// The `copy-webpack-plugin` copies the appropriate chunky-boy files
// to the build, where it can be accessed at the top level
// eslint-disable-next-line @typescript-eslint/no-var-requires
//const chunkyBoy = dynamic_require("/chunky-boy.js");
//const chunkyBoy = dynamic_require("D:/personal/software/contribution/360mash/.webpack/renderer/chunky-boy.js");

let chunkyBoy: any;
if (process.env.NODE_ENV === "development") {
    let target = path.join(__dirname, "../../../../../../additional/chunky-boy/chunky-boy.js");
    console.log("chunky boy from: ", target);
    chunkyBoy = dynamic_require(target);
} else {
    // Todo figure out how to bundle a group of files into the build
    let target = path.join(__dirname, "chunky-boy.js");
    chunkyBoy = dynamic_require(target);
}

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
    //chunkyBoy: any;
    chunkyBoyInitialized: boolean;

    inputFile!: number;
    outputFile!: number;

    chunkyCtx: number;
    readCbPtr!: number;
    metadataCbPtr!: number;
    decodedAudioCbPtr!: number;
    finishedDecodeCbPtr!: number;

    getImageCbPtr!: number;
    writeCbPtr!: number;
    finishedEncodeCbPtr!: number;
    runningNative: boolean;

    userGetImage: GetImageCallback;

    constructor() {
        this.chunkyBoyInitialized = false;
        this.runningNative = false;
        this.chunkyCtx = 0;

        this.inputFile = fs.openSync(
            "D:/personal/Documents/DoteExample/Camerawork training Panasonic HD.mp4",
            "r"
        );

        // As a defult, define a function that fills the image with a solid color
        this.userGetImage = 

        //const chunkyBoy: any = chunkyBoyInitialize();
        //this.chunkyBoy = chunkyBoy;
        chunkyBoy.whenInitialized(() => {
            const cbPtr = chunkyBoy.addFunction((ptr: number, length: number) => {
                for (let index = 0; index < length; index++) {
                    chunkyBoy.HEAP32[ptr / 4 + index] *= 3;
                }
            }, "vii");
            console.log("Calling test function");
            const retval = chunkyBoy._heap_test(cbPtr) as number;
            console.log("Function retval: " + retval);
            chunkyBoy.removeFunction(cbPtr);

            const read = util.promisify(fs.read);
            const write = util.promisify(fs.write);

            ////////////////////////////////////////////////////////////
            // Decoding
            ////////////////////////////////////////////////////////////
            this.readCbPtr = chunkyBoy.userJsCallbacks.length;
            chunkyBoy.userJsCallbacks[this.readCbPtr] = async (
                ptr: number,
                length: number
            ) => {
                try {
                    let result = await read(
                        this.inputFile,
                        chunkyBoy.HEAP8,
                        ptr,
                        length,
                        null
                    );
                    return result.bytesRead;
                } catch (error) {
                    console.exception(error);
                    return 0;
                }
            };
            this.metadataCbPtr = chunkyBoy.userJsCallbacks.length;
            chunkyBoy.userJsCallbacks[this.metadataCbPtr] = (
                duration: number,
                sampleRate: number
            ) => {
                console.log("METADATA: Duration " + duration + " seconds. Sample rate ", sampleRate);
            };
            this.decodedAudioCbPtr = chunkyBoy.userJsCallbacks.length;
            chunkyBoy.userJsCallbacks[this.decodedAudioCbPtr] = (
                samplesPtr: number,
                numSamples: number,
                numChannels: number
            ) => {
            };
            this.finishedDecodeCbPtr = chunkyBoy.userJsCallbacks.length;
            chunkyBoy.userJsCallbacks[this.finishedDecodeCbPtr] = () => {
                console.log("Finished decoding. Setting runningNative to false.");
                this.runningNative = false;
                fs.closeSync(this.inputFile);
            };
            ////////////////////////////////////////////////////////////

            ////////////////////////////////////////////////////////////
            // Encoding
            ////////////////////////////////////////////////////////////
            this.getImageCbPtr = chunkyBoy.userJsCallbacks.length;
            chunkyBoy.userJsCallbacks[this.getImageCbPtr] = async (
                frameId: number, buffer: number, len: number, linesize: number
            ) => {
                let bufArray = chunkyBoy.HEAPU8.subarray(buffer, buffer+len);
                return await this.userGetImage(frameId, bufArray, linesize);
            };

            this.writeCbPtr = chunkyBoy.userJsCallbacks.length;
            chunkyBoy.userJsCallbacks[this.writeCbPtr] = async (
                ptr: number, len: number, pos: number
            ) => {
                let bytesWritten = (await write(
                    this.outputFile,
                    chunkyBoy.HEAP8,
                    ptr,
                    len,
                    pos
                )).bytesWritten;
                return bytesWritten;
            };

            this.finishedEncodeCbPtr = chunkyBoy.userJsCallbacks.length;
            chunkyBoy.userJsCallbacks[this.finishedEncodeCbPtr] = (result: any) => {
                console.log("Finished encoding. Result was", result);
                this.runningNative = false;
                fs.closeSync(this.outputFile);
            };
            ////////////////////////////////////////////////////////////

            /// DO NOT CALL `_start_event_loop` HERE. IT'S BAD. IT WILL HURT YOU.
            /// 1, this function is called from a function within the wasm module
            ///    which does not support async magic
            /// 2, and `_start_event_loop` does emscripten async magic

            this.chunkyBoyInitialized = true;

            // By using setImmediate the stuff within set immediate won't be called from
            // this function. This function will have returned by the time the stuff
            // in there gets called.
            setImmediate(() => {
                //----------------------------------------
                // TEST ONLY
                setImmediate(() => {
                    chunkyBoy._decode_from_callback(
                        this.chunkyCtx,
                        this.readCbPtr,
                        this.metadataCbPtr,
                        this.decodedAudioCbPtr,
                        this.finishedDecodeCbPtr
                    );
                });
                //----------------------------------------

                this.chunkyCtx = chunkyBoy._create_context();
                // `_start_event_loop` doesn't return
                chunkyBoy._start_event_loop(this.chunkyCtx);
            });
        });
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
        if (!this.chunkyBoyInitialized) {
            return false;
        }
        if (this.runningNative) {
            throw new Error("Cannot initiate an action while there's another still in-progress on this codec");
        }
        this.runningNative = true;

        this.outputFile = fs.openSync(outFileName, "w");
        this.userGetImage = getImage;

        chunkyBoy._encode_video_from_callback(
            this.chunkyCtx,
            width,
            height,
            fps,
            5_000_000,
            44100,
            192_000,
            this.writeCbPtr,
            this.getImageCbPtr,
            -1,
            this.finishedEncodeCbPtr
        );

        return true;
    }

    async dispose() {
        if (this.chunkyCtx) {
            await chunkyBoy.delete_context(this.chunkyCtx);
        }
    }
}
