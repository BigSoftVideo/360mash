
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

    chunkyCtx: number;
    readCbPtr!: number;
    metadataCbPtr!: number;
    mediaFile!: number;
    decodedAudioCbPtr!: number;
    finishedCbPtr!: number;
    runningNative: boolean;

    constructor() {
        this.chunkyBoyInitialized = false;
        this.runningNative = false;
        this.chunkyCtx = 0;
        return;

        this.mediaFile = fs.openSync(
            "D:/personal/Documents/DoteExample/Camerawork training Panasonic HD.mp4",
            "r"
        );

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
            this.readCbPtr = chunkyBoy.userJsCallbacks.length;
            chunkyBoy.userJsCallbacks[this.readCbPtr] = async (
                ptr: number,
                length: number
            ) => {
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
                console.log("METADATA: Duration " + duration + " seconds. Sample rate ", sampleRate);
            };
            this.decodedAudioCbPtr = chunkyBoy.userJsCallbacks.length;
            chunkyBoy.userJsCallbacks[this.decodedAudioCbPtr] = (
                samplesPtr: number,
                numSamples: number,
                numChannels: number
            ) => {
                // for (let i = 0; i < numSamples; i++) {
                //     const sample = chunkyBoy.HEAPF32[samplesPtr / 4 + i * numChannels];
                //     this.unprocessedSamples.push(sample);
                // }
                // this.processBufferSamples();
                // if (this.newSamplesReadyUserCb) {
                //     this.newSamplesReadyUserCb();
                // }
            };
            this.finishedCbPtr = chunkyBoy.userJsCallbacks.length;
            chunkyBoy.userJsCallbacks[this.finishedCbPtr] = () => {
                console.log("Finished decoding. Setting runningNative to false.");
                this.runningNative = false;
                fs.closeSync(this.mediaFile);
            };
            

            /// DO NOT CALL `_start_event_loop` HERE. IT'S BAD. IT WILL HURT YOU.
            /// 1, this function is called from the `main` function of the wasm module
            /// 2, and `_start_event_loop` does emscripten async magic
            /// 3, but `main` is not supposed to do emscripten async magic or call any function that
            ///    does that kind of stuff or call any function that calls any function... you get
            ///    the idea

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
                        this.finishedCbPtr
                    );
                });
                //----------------------------------------

                this.chunkyCtx = chunkyBoy._create_context();
                // `_start_event_loop` doesn't return
                chunkyBoy._start_event_loop(this.chunkyCtx);
            });
        });
    }

    async dispose() {
        if (this.chunkyCtx) {
            await chunkyBoy.delete_context(this.chunkyCtx);
        }
    }
}
