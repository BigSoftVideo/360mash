import React, { useRef, useState, useEffect, RefObject, MutableRefObject, ForwardedRef, Ref } from 'react';
import { ArrowRightIcon, Badge, Button, Dialog, majorScale, minorScale, Pane, Text, TextInput, TextInputField } from "evergreen-ui";
import { Settings } from '../settings';
import { Menu, MenuItem, dialog, getCurrentWindow, app, shell } from '@electron/remote';
import path from 'path';
import { VideoManager } from '../video/video-manager';
import { ffMpedInstalledStates as ffMpegInstalledStates, FFMpegInstallerDialogMethods } from '../ffmpeg-installer/ffmpeg-installer';
import { settings } from '../app';

interface TitleBarProps {
    videoManager: VideoManager | null;
    ffMpegInstalledState: ffMpegInstalledStates;
    showFFmpegInstallerDialog: () => void;
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

    return (
        <Pane display="flex" flexDirection="row"
            alignItems="center"
            padding={minorScale(1)}
            borderBottom="solid 1px"
            backgroundColor="#AAAAAA33"
        >
            <Button
                marginX={majorScale(1)}
                marginRight={majorScale(2)}
                onClick={() => {

                }}
            >
                App Settings
            </Button>
            <Pane display="flex" flexDirection="row"
                flexGrow={1}
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
            <Pane display="flex" flexDirection="row">
                {   ffmpegStatus    }
            </Pane>
            <Button
                onClick={() => {
                    props.showFFmpegInstallerDialog();
                }}
            >FFmpeg Gear Icon</Button>
        </Pane>
    )

});