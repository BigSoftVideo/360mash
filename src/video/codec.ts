
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
 * A 
 */
export class Codec {

    //chunkyBoy: any;
    chunkyBoyInitialized: boolean;

    constructor() {
        this.chunkyBoyInitialized = false;
        //const chunkyBoy: any = chunkyBoyInitialize();
        //this.chunkyBoy = chunkyBoy;
        chunkyBoy.onChunkyBoyInitialized = () => {
            const cbPtr = chunkyBoy.addFunction((ptr: number, length: number) => {
                for (let index = 0; index < length; index++) {
                    chunkyBoy.HEAP32[ptr / 4 + index] *= 3;
                }
            }, "vii");
            console.log("Calling test function");
            const retval = chunkyBoy._heap_test(cbPtr) as number;
            console.log("Function retval: " + retval);
            chunkyBoy.removeFunction(cbPtr);

            /*
                const read = util.promisify(fs.read);
                this.readCbPtr = chunkyBoy.userJsCallbacks.length;
                chunkyBoy.userJsCallbacks[this.readCbPtr] = async (
                    ptr: number,
                    length: number
                ) => {
                    //const retval = fs.readSync(this.mediaFile, chunky_boy.HEAP8, ptr, length, null);
                    //return retval;
                    try {
                        let result = await read(
                            this.mediaFile,
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
                    console.log("Duration of the stream is " + duration + " seconds.");
                    this.sourceSampleRate = sampleRate;
                    this.sourceSampleCount = duration * sampleRate;
                    this.duration = duration;
                    this.bufferSampleCount = Math.min(this.sourceSampleCount, this.maxSamples);
                    this.sampleStep = this.sourceSampleCount / this.bufferSampleCount;
                    this.bufferSampleRate = this.bufferSampleCount / duration;
                    if (this.metadataReceivedUserCb) {
                        this.metadataReceivedUserCb();
                    }
                };
                this.decodedAudioCbPtr = chunkyBoy.userJsCallbacks.length;
                chunkyBoy.userJsCallbacks[this.decodedAudioCbPtr] = (
                    samplesPtr: number,
                    numSamples: number,
                    numChannels: number
                ) => {
                    for (let i = 0; i < numSamples; i++) {
                        const sample = chunkyBoy.HEAPF32[samplesPtr / 4 + i * numChannels];
                        this.unprocessedSamples.push(sample);
                    }
                    this.processBufferSamples();
                    if (this.newSamplesReadyUserCb) {
                        this.newSamplesReadyUserCb();
                    }
                };
                this.finishedCbPtr = chunkyBoy.userJsCallbacks.length;
                chunkyBoy.userJsCallbacks[this.finishedCbPtr] = () => {
                    console.log("Setting runningNative to false.");
                    this.runningNative = false;
                };
            */

            /// DO NOT CALL `_start_event_loop` HERE. IT'S BAD. IT WILL HURT YOU.
            /// 1, this function is called from the `main` function of the wasm module
            /// 2, and `_start_event_loop` does emscripten async magic
            /// 3, but `main` is not supposed to do emscripten async magic or call any function that
            ///    does that kind of stuff or call any function that calls any function... you get
            ///    the idea

            this.chunkyBoyInitialized = true;
        };
    }
}
