import React, { useRef, useState, useEffect, RefObject, MutableRefObject, ForwardedRef, Ref } from 'react';
import { ArrowRightIcon, Badge, Button, CogIcon, Dialog, DownloadIcon, IconButton, majorScale, minorScale, Pane, Text, TextInput, TextInputField } from "evergreen-ui";
import { Settings } from '../settings';
import { Menu, MenuItem, dialog, getCurrentWindow, app, shell } from '@electron/remote';
import path from 'path';
import { VideoManager } from '../video/video-manager';
import { ffMpedInstalledStates as ffMpegInstalledStates, FFMpegInstallerDialogMethods } from '../ffmpeg-installer/ffmpeg-installer';
import { settings } from '../app';
import { AvailableEncoders, ExportPanel } from '../ui-mixed/export-panel/export-panel';
import { Decoder, Encoder } from '../video/codec';
import { ExportInfoProvider } from '../ui-mixed/export-overlay/export-overlay';

interface TitleBarProps {
    videoManager: VideoManager | null;
    ffMpegInstalledState: ffMpegInstalledStates;
    showFFmpegInstallerDialog: () => void;
    encoder: Encoder;
    decoder: Decoder;
    exportStateChange: (inProgress: boolean) => void;
    infoProvider: ExportInfoProvider;
}

export interface SettingsBarMethods {

}

export const SettingsBar = React.forwardRef<SettingsBarMethods, TitleBarProps>( (props:TitleBarProps, ref) => {

    const [sourcePath, setSourcePath] = useState<string>("");
    // const [destPath, setDestPath] = useState<string>(settings.outputPath);

    // Constructor
    useEffect( () => {

    }, []);

    React.useImperativeHandle(ref, () => ({

    }));

    let ffmpegStatus: JSX.Element = <></>;
    if (props.ffMpegInstalledState === 'Checking') {
        ffmpegStatus = <Badge color="neutral">FFmpeg: checking...</Badge>;
    } else
    if (props.ffMpegInstalledState === 'Installed') {
        ffmpegStatus = <Badge color="green">FFmpeg installed</Badge>;
    } else
    if (props.ffMpegInstalledState === "Missing") {
        ffmpegStatus = <Badge color="red">FFmpeg not found!</Badge>;
    } else
    if (props.ffMpegInstalledState === "Downloading") {
        ffmpegStatus = <Badge color="teal">Downloading FFmpeg...</Badge>
    }

    let ffmpegIcon = CogIcon;
    if (props.ffMpegInstalledState === "Installed") {
        ffmpegIcon = CogIcon;
    } else
    if (props.ffMpegInstalledState === "Missing") {
        ffmpegIcon = DownloadIcon;
    }

    return (
        <Pane display="flex" flexDirection="row"
            alignItems="center"
            padding={minorScale(1)}
            borderBottom="solid 1px"
            backgroundColor="#AAAAAA33"
        >
            <Pane display="flex" flexDirection="column" alignItems="center" justifyContent="center"
                marginX={majorScale(1)}
                marginRight={majorScale(2)}
            >
                <Button
                    marginY={minorScale(1)}
                    onClick={() => {

                    }}
                >
                    Application Settings
                </Button>
                <Pane display="flex" flexDirection="row" alignItems="center" justifyContent="center">
                    <Pane display="flex" flexDirection="row">
                        {   ffmpegStatus    }
                    </Pane>
                    <IconButton width={26} height={26} marginX={4} icon={ffmpegIcon}
                        onClick={() => {
                            props.showFFmpegInstallerDialog();
                        }}
                    />
                </Pane>
            </Pane>
            <Pane display="flex" flexDirection="column" flexGrow={1}>
                <Pane display="flex" flexDirection="row" flexGrow={1}
                    alignItems="center"
                    border="inset"
                    padding={minorScale(1)}
                    backgroundColor="#ffffff"
                >
                    <TextInputField
                        marginX={minorScale(1)}
                        marginBottom={0}
                        flexGrow={1}
                        readOnly
                        label="Source video file location"
                        placeholder="click 'Browse' to locate"
                        value={ sourcePath }
                    />
                    <Button
                        marginX={minorScale(1)}
                        onClick={ () => {
                            const mainWindow = getCurrentWindow();
                            dialog
                                .showOpenDialog(mainWindow, {
                                    title: "Import Video",
                                    buttonLabel: "Open",
                                    properties: ["openFile"],
                                    filters: [
                                        {
                                            name: "Media Files",
                                            extensions: ["mp4", "webm", "mov", "avi", "mkv", "flv", "wmv"],
                                        },
                                        {   name: 'All Files',
                                            extensions: ['*']}
                                    ],
                                    defaultPath: settings.lastUsedInputPath,
                                })
                                .then((value: any) => {
                                    if (value.canceled || value.filePaths.length === 0) {
                                        return;
                                    }
                                    if (!props.videoManager) {
                                        console.error('Video Manager not defined.');
                                        return;
                                    }
                                    //console.log("File path is " + value.filePaths[0]);
                                    //this.setState({ videoUrl: fileURL });
                                    setSourcePath(value.filePaths[0]);
                                    settings.lastUsedInputPath = path.dirname(value.filePaths[0]);
                                    props.videoManager.openVideo(value.filePaths[0]);
                                    //TODO wait until the first frame is available and only then set the aspect ratio.
                                    // Otherwise the videoWidth and height won't yet be available.
                                });
                        }}
                    >Browse</Button>
                </Pane>
                <Pane display="flex" flexDirection="row"
                    flexGrow={1}
                    alignItems="center"
                    border="inset"
                    padding={minorScale(1)}
                    backgroundColor="#ffffff"
                >
                    <ExportPanel
                        videoManager={props.videoManager}
                        encoder={props.encoder}
                        decoder={props.decoder}
                        exportStateChange={props.exportStateChange}
                        infoProvider={props.infoProvider}
                    />
                </Pane>
            </Pane>
            {/* <ArrowRightIcon marginX={majorScale(1)}/>
            <Pane display="flex" flexDirection="row"
                flexGrow={1}
                alignItems="center"
                border="inset"
                padding={minorScale(1)}
                backgroundColor="#ffffff"
            >
                <TextInputField
                    marginX={minorScale(1)}
                    flexGrow={1}
                    marginBottom={0}
                    readOnly
                    label="Destination location"
                    placeholder="click 'Browse' to select desintation directory"
                    value={ destPath }
                />
                <Button
                    marginX={minorScale(1)}
                    onClick={ () => {
                        const mainWindow = getCurrentWindow();
                        dialog
                            .showOpenDialog(mainWindow, {
                                title: "Import Video",
                                buttonLabel: "Open",
                                properties: ["openDirectory"],
                                defaultPath: settings.outputPath,
                            })
                            .then((value: any) => {
                                if (value.canceled || value.filePaths.length === 0) {
                                    return;
                                }

                                //console.log("File path is " + value.filePaths[0]);
                                //this.setState({ videoUrl: fileURL });
                                setDestPath(value.filePaths[0]);
                                settings.outputPath = value.filePaths[0];
                            });
                    }}
                >Browse</Button>
            </Pane> */}
        </Pane>
    )

});