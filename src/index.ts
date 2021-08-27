import { app, BrowserWindow, Menu, protocol } from "electron";
import { Server, createConnection } from "net";
import { spawn } from "child_process";
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
    // setTimeout(ffmpegNetworkTest, 5000);

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
    testProc.stderr.on("data", (msg) => stderr += msg);
    testProc.stdout.pause();
    testProc.stdout.on("readable", () => {
        // pacekt size: 1024 * 16
        while (null !== testProc.stdout.read(1024 * 1024)) {
            // Make sure we read all available data
            packetCnt += 1;
        }
    })
    // testProc.stdout.on("data", buff => {
    //     packetCnt += 1;
    // });
    testProc.on("exit", code => {
        let elapsedSec = (new Date().getTime() - testProcStart.getTime()) / 1000;
        console.log("Test process exited with", code, "it took " + elapsedSec + " seconds. Packet count was " + packetCnt);
    });
}

function ffmpegNetworkTest() {
    console.log("Starting networked decode test");

    let packetCnt = 0;

    // listen on a port
    let server = new Server(socket => {
        console.log("Got connection!", socket.localPort)
        socket.on("data", data => {
            packetCnt += 1;
            // console.log("Received from the connection:", data.toString("utf8"));
        });
        socket.on("close", hadError => {
            console.log("Socket was closed. Had error:", hadError);
        })
    });
    server.on("error", e => {
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
    })
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
        testProc.stderr.on("data", (msg) => stderr += msg);
        testProc.stdout.pause();
        testProc.stdout.on("readable", () => {
            // pacekt size: 1024 * 16
            while (null !== testProc.stdout.read(1024 * 1024)) {
                // Make sure we read all available data
                // packetCnt += 1;
            }
        })
        // testProc.stdout.on("data", buff => {
        //     packetCnt += 1;
        // });
        testProc.on("exit", code => {
            let elapsedSec = (new Date().getTime() - testProcStart.getTime()) / 1000;
            console.log("Test process exited with", code, "it took " + elapsedSec + " seconds. Packet count was " + packetCnt);
        });
    };

    // DEBUG TEST
}
