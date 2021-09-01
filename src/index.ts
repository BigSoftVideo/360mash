import { app, BrowserWindow, Menu, protocol } from "electron";
import { Server, createConnection } from "net";
import { spawn } from "child_process";
import * as util from "util";
import * as path from "path";

import { VideoManager } from "./video/video-manager";
import { FilterManager } from "./video/filter-manager";
import { CONV360T02D_FILTER_NAME, Conv360To2DFilter } from "./filters/conv360to2d";
import { FilterBase } from "./video/filter-base";
import { CartoonFilter, CARTOON_FILTER_NAME } from "./filters/cartoon";
import { GrayscaleFilter, GRAYSCALE_FILTER_NAME } from "./filters/grayscale";
import { ImageFormat, PackedPixelData } from "./video/filter-pipeline";
import { Decoder, Encoder, EncoderDesc, MediaMetadata } from "./video/codec";

/** Wait for the next event loop iteration */
const setImmedateAsync = util.promisify(setImmediate);

declare const MAIN_WINDOW_WEBPACK_ENTRY: any;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
    // eslint-disable-line global-require
    app.quit();
}

Menu.setApplicationMenu(null);

const isDevMode = process.env.NODE_ENV === "development";

const createWindow = (): void => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        height: 600,
        width: 800,
        webPreferences: {
            enableRemoteModule: true,
            nodeIntegration: true,
            webSecurity: !isDevMode,
        },
    });

    // and load the index.html of the app.
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

    // Open the DevTools.
    if (isDevMode) {
        mainWindow.webContents.openDevTools();
    }
};
const appReady = () => {
    setTimeout(dateBenchmark, 5000);

    if (isDevMode) {
        protocol.registerFileProtocol("file", (request, callback) => {
            const path = decodeURI(request.url.replace("file:///", ""));
            callback(path);
        });
    }

    createWindow();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", appReady);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

function ffmpegTest() {
    console.log("Starting decode test");
    // DEBUG TEST
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
            "pipe:1",
        ],
        {
            stdio: ["pipe", "pipe", "pipe"],
        }
    );
    let stderr = "";
    let packetCnt = 0;
    testProc.stderr.on("data", (msg) => (stderr += msg));
    testProc.stdout.pause();
    testProc.stdout.on("readable", () => {
        // pacekt size: 1024 * 16
        while (null !== testProc.stdout.read(1024 * 1024)) {
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
}

function dateBenchmark() {
    let start = new Date();
    let foo = 0;
    for (let i = 0; i < 1000; i++) {
        foo += new Date().getTime() / 1000;
    }
    let end = new Date();
    let elapsed = (end.getTime() - start.getTime()) / 1000;
    console.log("Date elapsed sec", elapsed, "foo", foo);
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

function fullExportTest() {
    console.log("Started full export test");
    const INPUT_VIDEO_PATH = "Y:\\Dote-Projects\\New Horizon\\GoPro Back.mp4";

    let canvas = document.createElement("canvas");

    // let gl = canvas.getContext("webgl2");
    // if (!gl) {
    //     throw new Error("Could not get WebGL 2 context");
    // }

    let filterManager = new FilterManager();
    filterManager.registerFilter({
        id: CONV360T02D_FILTER_NAME,
        creator: (gl): FilterBase => {
            return new Conv360To2DFilter(gl);
        },
    });
    filterManager.registerFilter({
        id: CARTOON_FILTER_NAME,
        creator: (gl): FilterBase => {
            return new CartoonFilter(gl);
        },
    });
    filterManager.registerFilter({
        id: GRAYSCALE_FILTER_NAME,
        creator: (gl): FilterBase => {
            return new GrayscaleFilter(gl);
        },
    });
    let videoManager = new VideoManager(canvas, () => {}, filterManager);
    videoManager.stopRendering();

    videoManager.pipeline.setFilters([CARTOON_FILTER_NAME]);

    // The target is Full HD
    videoManager.pipeline.setTargetDimensions(1920, 1080);

    let encoder = new Encoder();
    let decoder = new Decoder();

    //////////////////////////////////////////////////////////////////////////////////////

    // let video = videoManager.video;
    // let duration = video.htmlVideo.duration;

    videoManager.stopRendering();

    // const htmlVideo = props.videoManager.video.htmlVideo;
    // htmlVideo.pause();
    const pipeline = videoManager.pipeline;

    // WARNING
    // WARNING
    // WARNING
    // TODO: WARNING! Hardcoded for "GoPro Back.mp4"
    // WARNING
    // WARNING
    // WARNING
    // Video resolution: 3840x2160
    // TODO: This function should probably just take a width and a height since that's all it needs
    const [outWidth, outHeight] = pipeline.getRealOutputDimensions({
        w: 3840,
        h: 2160,
        data: new Uint8Array(),
        format: 0,
    });

    // This is just a default, but actually we will use the same framerate as the input
    let outFps = 29.97;

    let nextOutFrameId = 0;
    let readyOutFrameId = -1;
    let isDone = false;

    let getImage = async (outFrameId: number, buffer: Uint8Array): Promise<number> => {
        const waitStart = new Date();
        // When this function gets called, the next frame may not yet be decoded. In this case
        // we wait until it's ready.
        while (readyOutFrameId < outFrameId) {
            await setImmedateAsync();
        }
        let targetPixelBuffer: PackedPixelData = {
            data: buffer,
            w: outWidth,
            h: outHeight,
            format: ImageFormat.YUV420P,
        };
        videoManager.pipeline.fillYuv420pPixelData(targetPixelBuffer);
        // let progress = outFrameId / outFps / duration;
        nextOutFrameId = outFrameId + 1;

        if (isDone) {
            console.log(
                "Export panel done. Avg ms spent waiting on the input frame " // +
                // sumInputFrameWaitMs / outFrameId
            );
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

        let filename = dateToFilename(new Date()) + ".mp4";
        let fullpath = path.join("C:\\Users\\Dighumlab2\\Videos\\360mash export", filename);
        let encoderDesc: EncoderDesc = {
            width: outWidth,
            height: outHeight,
            fps: outFps,
            audioFilePath: INPUT_VIDEO_PATH,
        };
        encoder.startEncoding(
            "C:\\ffmpeg-4.4-full_build\\bin",
            fullpath,
            encoderDesc,
            getImage,
            encodingExitHandler
        );
    };
    let encodingExitHandler = (code: number | null, stderr: string) => {
        if (code === null || code !== 0) {
            console.log(`Encoder error. Output:\n${stderr}`);
            decoder.stopDecoding();
        } else {
            console.log("Finished exporting");
        }
    };

    let receivedImage = async (buffer: Uint8Array) => {
        inFrameIdx += 1;

        // TODO if the input framerate is different from the output framerate
        // we need to check if we even need to render this frame

        // console.log("Video finished seeking. Time", video.currentTime);
        let pixelData: PackedPixelData = {
            data: buffer,
            w: inWidth,
            h: inHeight,

            // TODO: change this if requesting the data from ffmpeg in another format
            format: ImageFormat.YUV420P,
        };
        videoManager.renderOnce(pixelData);
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

    decoder.startDecoding(
        "C:\\ffmpeg-4.4-full_build\\bin",
        INPUT_VIDEO_PATH,
        receivedMetadata,
        receivedImage,
        inputDone
    );
}

function dateToFilename(date: Date): string {
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
