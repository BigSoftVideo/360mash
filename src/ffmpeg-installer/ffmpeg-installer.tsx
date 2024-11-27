import React, { useRef, useState, useEffect, RefObject, MutableRefObject, ForwardedRef, Ref } from 'react';
import fs from "fs-extra";
import path from "path";
// @ts-ignore
import { Progress } from 'react-sweet-progress';
import "react-sweet-progress/lib/style.css";
// import { Settings } from "../settings";
import { X_OK } from "constants";
import { isMac } from "../os-specific-logic";
import { app, dialog, getCurrentWindow } from "@electron/remote";
import { Button, Dialog, majorScale, minorScale, Pane, Text, TextInput } from "evergreen-ui";
import { info } from 'console';
// import { BasicDialog } from '@src/components/_dialogs/dialog-templates';
import ffbinaries from 'ffbinaries';
import { Settings } from '../settings';
import { settings } from '../app';
import "./ffmpeg-installer.css";


const CheckTimerInterval = 2000; // ms

export type ffMpedInstalledStates = "Installed" | "Missing" | "Checking" | "Downloading";

export interface FFmpegInstalledListener {
    installedStateChanged: (state:ffMpedInstalledStates) => void;
}

export interface FFMpegInstallerDialogMethods {
    showDialog: () => void;
    hideDialog: () => void;
    subscribe: (listener: FFmpegInstalledListener) => void;
    unsubscribe: (listener: FFmpegInstalledListener) => void;
    isFFmpegInstalled: () => boolean;
    isFFprobeInstalled: () => boolean;
    isAllInstalled: () => boolean;
}

interface InstallerDialogProps {
    // settings:Settings;
    // changeFFmpegInstalledState: (newState:ffMpedInstalledStates) => void;
}

let fileCheckTimer: number | null = null;
const listeners = new Set<FFmpegInstalledListener>();

export const FFmpegInstaller = React.forwardRef<FFMpegInstallerDialogMethods, InstallerDialogProps>( (props:InstallerDialogProps, ref) => {

    const [dialogVisible, setDialogVisible] = useState<boolean>(false);
    const [_redraw, _setDraw] = useState<number>(0);
    const [ffmpegState, setffmpegState] = useState<ffMpedInstalledStates>("Checking");
    const [ffmpegInstalled, setFFmpegInstalled] = useState<boolean>(false);
    const [ffprobeInstalled, setFFprobeInstalled] = useState<boolean>(false);
    const [ffmpegDownloadProgressPercent, setFFmpegDownloadProgressPercent] = useState<number>(-1);
    const [ffprobeDownloadProgressPercent, setFFprobeDownloadProgressPercent] = useState<number>(-1);

    function redraw() {
        _setDraw(_redraw + 1);
    }

    React.useImperativeHandle(ref, () => ({
        showDialog: () => {
            setDialogVisible(true);
            // startTimer();
        },
        hideDialog: () => {
            // stopTimer();
            setDialogVisible(false);
        },
        subscribe: (listener: FFmpegInstalledListener) => {
            listeners.add(listener);
        },
        unsubscribe: (listener: FFmpegInstalledListener) => {
            listeners.delete(listener);
        },
        isFFmpegInstalled: () => {
            return ffmpegInstalled;
        },
        isFFprobeInstalled: () => {
            return ffprobeInstalled;
        },
        isAllInstalled: () => {
            return ffmpegInstalled && ffprobeInstalled;
        }
    }));

    //Constructor
    useEffect( () => {
        // update();
        startTimer();
        return () => {
            stopTimer();
        }
    }, []);

    useEffect( () =>  {
        console.log('State updated to: ' + ffmpegState);
        update();
    }, [ffmpegState]);

    useEffect( () => {
        console.log('ffmpeginstalled updated to : ' + ffmpegInstalled);
        if (ffmpegState === 'Downloading') {
            return;
        }
        const installed = ffmpegInstalled && ffprobeInstalled;
        if (ffmpegState === "Checking") {
            setffmpegState(installed ? "Installed" : "Missing");
        } else
        if (installed && ffmpegState !== 'Installed') {
            setffmpegState("Installed");
        } else
        if (!installed && ffmpegState !== "Missing") {
            setffmpegState("Missing");
        }
    }, [ffmpegInstalled, ffprobeInstalled]);

    useEffect( () => {
        // Recreate the timer so that it has the current values
        stopTimer();
        startTimer();
    }, [ffmpegInstalled, ffprobeInstalled, ffmpegState]);

    function update() {
        listeners.forEach( (listener) => {
            listener.installedStateChanged(ffmpegState);
        });
    }

    function startTimer() {
        if (fileCheckTimer) {
            stopTimer();
        }
        fileCheckTimer = window.setInterval( () => {
            timerInterval();
        }, CheckTimerInterval);
    }

    function stopTimer() {
        if (fileCheckTimer) {
            clearInterval(fileCheckTimer);
            fileCheckTimer = null;
        }
    }

    function timerInterval() {
        if (ffmpegState === "Downloading") {
            return;
        }
        let ffmpegAvailable = false;
        let ffprobeAvailable = false;
        try {
            fs.accessSync(settings.ffMpegExecutablePath, X_OK);
            ffmpegAvailable = true;
        } catch {}
        try {
            fs.accessSync(settings.ffProbeExecutablePath, X_OK);
            ffprobeAvailable = true;
        } catch {}
        console.log(`Checking for installed. MPEG: ${ffmpegAvailable}, PROBE: ${ffprobeAvailable}`);
        if (ffmpegAvailable !== ffmpegInstalled || ffprobeAvailable !== ffprobeInstalled || ffmpegState === "Checking") {
            console.log('Updating installed status...');
            setFFmpegInstalled(ffmpegAvailable);
            setFFprobeInstalled(ffprobeAvailable);
            if (ffmpegState === "Checking") {
                setffmpegState( ffmpegAvailable && ffprobeAvailable ? "Installed" : "Missing");
            }
        }
    }

    function resetFFmpegPath() {
        let appPath:string = app.getPath('exe');
        let dest = path.dirname(appPath);
        settings.ffMpegPath = dest;
    }

    function downloadFFmpeg() {
        info('Downloading FFmpeg')
        settings.userInstalledFFmpeg = true;
        setffmpegState('Downloading');

        if (ffmpegDownloadProgressPercent >= 0 || ffprobeDownloadProgressPercent >= 0) {
            // There is already a download in progress. Abort
            return;
        }
        const platform = ffbinaries.detectPlatform();
        info("Detected Platform: " + platform);


        info(`Downloading binaries for ${platform} to destination [${settings.ffMpegPath}]:`);
        setFFmpegDownloadProgressPercent(0);
        setFFprobeDownloadProgressPercent(0);
        ffbinaries.clearCache();
        let options:ffbinaries.DownloadOptions = {
            destination: settings.ffMpegPath,
            platform: platform,
            force: true,
            tickerInterval: 100, // ms
            tickerFn: ffmpegDownloadUpdate,
        }

        ffbinaries.downloadBinaries(['ffmpeg', 'ffprobe'], options, (err:any, data:any) => {
            if (err) {
                info('err: '+ err);
            }
            info(`Download complete.`);
            for (let fileResult of data) {
                info(`${fileResult.filename} downloaded to: ${fileResult.path} with status: ${fileResult.status}`);
            }
            setffmpegState("Checking");
            // Clear the progress bars
            // We do this as a timeout just in case there is still an update pending (it occationally happened in testing)
            const d = setTimeout( () => {
                setFFmpegDownloadProgressPercent(-1);
                setFFprobeDownloadProgressPercent(-1);
                update();
            }, 101);
        });
    }

    function removeFFmpeg() {
        info('Deleting FFmpeg...');
        settings.userInstalledFFmpeg = false;
        try {
            fs.accessSync(settings.ffMpegExecutablePath, X_OK); // Throws exception is missing
            fs.rmSync(settings.ffMpegExecutablePath, { force: true });
            info('FFmpeg deleted.');
        } catch {}
        try {
            fs.accessSync(settings.ffProbeExecutablePath, X_OK); // Throws exception is missing
            fs.rmSync(settings.ffProbeExecutablePath, { force: true });
            info('FFprobe deleted.');
        } catch {}
        setffmpegState("Checking");
    }

    function ffmpegDownloadUpdate(data:any) {
        // console.log(`Downloading: ${data.filename} : ${(data.progress * 100).toFixed(1)}%`);
        if (data.filename.startsWith('ffmpeg')) {
            setFFmpegDownloadProgressPercent(Math.round(data.progress * 100));
        }
        if (data.filename.startsWith('ffprobe')) {
            setFFprobeDownloadProgressPercent(Math.round(data.progress * 100));
        }
    }

    function showSelectFFmpegDirectoryDialog() {
        dialog.showOpenDialog(
            getCurrentWindow(), {
                title: "Select the Directory containing FFmpeg executables",
                properties: [
                    "openDirectory",
                    "createDirectory",  //MacOS only
                ],
                defaultPath: settings.ffMpegPath,

            }).then((value:any) => {
                if (value.canceled || value.filePaths === undefined || value.filePaths.length === 0) {
                    return;
                }
                settings.ffMpegPath = value.filePaths[0];
                redraw();
            });
    }

    return (
        <Dialog
            title={"Install FFmpeg"}
            hasHeader={false}
            isShown={dialogVisible}
            onOpenComplete={ () => {

            }}
            onCloseComplete={ () => {
                // stopTimer();
                setDialogVisible(false);
            }}
            onConfirm={ (close: () => void) => {
                close();
            } }
            confirmLabel={"Close"}
        >
            <Pane display="flex" flexDirection="column" overflowY="scroll">
                <Text alignSelf="center" fontSize={20} fontWeight="bold" marginY={majorScale(2)}>
                    Install FFmpeg & FFprobe
                </Text>
                <hr style={{width:"80%", alignSelf:"center", borderWidth:"thin", marginBottom:"12px"}}></hr>
                {/* PATH OF FFMPEG */}
                <Pane display="flex" flexDirection="row">
                    <Text padding={majorScale(1)}>{"Path to FFmpeg: "}</Text>
                    <TextInput margin={minorScale(1)} flex="auto"
                        readOnly
                        placeContent="No Directory Provided"
                        value={settings.ffMpegPath}
                        // onChange={ (e:React.ChangeEvent<HTMLInputElement>) => { this.setState({pathOfDoteApp: e.target.value})}}
                    />
                    <Button margin={minorScale(1)} onClick={ showSelectFFmpegDirectoryDialog } >Manually Set Path</Button>
                </Pane>
                <Pane display="flex" flexDirection="row">
                    <Button margin={minorScale(1)} onClick={ resetFFmpegPath } >Reset Path</Button>
                    <Button margin={minorScale(1)} onClick={ removeFFmpeg } >Remove FFmpeg</Button>
                    <Button margin={minorScale(1)} onClick={ downloadFFmpeg } >Download FFmpeg & FFprobe</Button>
                </Pane>
                <Pane display="flex" flexDirection="column">
                    {
                        ffmpegDownloadProgressPercent < 0
                        ?   ffmpegInstalled
                                ?   <Pane display="flex" flexDirection="row" alignItems="center" justifyContent="flex-start" whiteSpace="nowrap"><i className="icon icon-green icofont-check-circled"></i><span>FFmpeg Available</span></Pane>
                                :   <Pane display="flex" flexDirection="row" alignItems="center" justifyContent="flex-start" whiteSpace="nowrap"><i className="icon icon-red icofont-exclamation-tringle"></i><span>FFmpeg Missing</span></Pane>
                        :   <Pane display="flex" flexDirection="row">
                                <span>Downloading FFmpeg... </span>
                                <Progress percent={ffmpegDownloadProgressPercent} status={"active"}/>
                            </Pane>
                    }
                    {
                        ffprobeDownloadProgressPercent < 0
                        ?   ffprobeInstalled
                            ?   <Pane display="flex" flexDirection="row" alignItems="center" justifyContent="flex-start" whiteSpace="nowrap"><i className="icon icon-green icofont-check-circled"></i><span>FFprobe Available</span></Pane>
                            :   <Pane display="flex" flexDirection="row" alignItems="center" justifyContent="flex-start" whiteSpace="nowrap"><i className="icon icon-red icofont-exclamation-tringle"></i><span>FFprobe Missing</span></Pane>
                        :   <Pane display="flex" flexDirection="row">
                                <span>Downloading FFmpeg... </span>
                                <Progress percent={ffmpegDownloadProgressPercent} status={"active"}/>
                            </Pane>
                    }
                </Pane>
            </Pane>
        </Dialog>
    );
});