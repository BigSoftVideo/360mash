import React from "react";
import os from "os";

import { ActionKind, ButtonHoverText, inputKeyToShortcutText } from "../userinput";

import { OSShortcutChoice, OSTextChoice, SpecialCharacters } from "../os-specific-logic";
//Icons
import {
    GripperBarHorizontalIcon,
    PauseIcon,
    DoubleChevronLeftIcon,
    ChevronLeftIcon,
    ChevronLeftEnd6Icon,
    ChevronRightEnd6Icon,
    DoubleChevronRightIcon,
    ChevronRightIcon,
    PlaySolidIcon,
    RepeatAllIcon,
    RepeatOneIcon,
    ClearSelectionIcon,
} from "@fluentui/react-icons-mdl2";
import { HiMiniArrowRightStartOnRectangle, HiMiniArrowLeftStartOnRectangle } from "react-icons/hi2";
import { TbBracketsContainStart, TbBracketsContainEnd } from "react-icons/tb";

import { Pane } from "evergreen-ui";
import { Video, VideoListener, VideoManager } from "../video/video-manager";
import { InputManager } from "../app";


export interface TransportProps {
    video: Video | null;
    selectionStartSec: number;
    selectionEndSec: number;
    updateSelection: (start:number, end:number) => void;
}

interface TransportState {
    isPlaying: boolean;
}

export class TransportControls extends React.Component<TransportProps, TransportState>
implements VideoListener
{
    protected handleShortcuts: (action: ActionKind) => void = (nullAction) => {};
    protected actionButtonPanelRef: React.RefObject<HTMLDivElement>;

    constructor(props:TransportProps) {
        super(props);
        this.actionButtonPanelRef = React.createRef();
        this.state = {
            isPlaying : false,
        };
    }

    componentDidMount() {
        this.initTransportShortcuts();
    }

    componentWillUnmount() {

    }

    componentDidUpdate(prevProps: Readonly<TransportProps>, prevState: Readonly<TransportState>, snapshot?: any): void {
        if (prevProps.video !== this.props.video) {
            prevProps.video?.removeListener(this);
            this.props.video?.addListener(this);
        }
    }

    public initTransportShortcuts() {
        this.handleShortcuts = (action: ActionKind) => {
            let video = this.props.video;
            switch (action) {
                case ActionKind.TinyStepBack:
                    this.props.video?.directSeekToTime(this.props.video.currentTime - 0.03);
                    break;
                case ActionKind.TinyStepForward:
                    this.props.video?.directSeekToTime(this.props.video.currentTime + 0.03);
                    break;
                case ActionKind.ShortJumpBack:
                    this.props.video?.directSeekToTime(this.props.video.currentTime - 1);
                    break;
                case ActionKind.ShortJumpForward:
                    this.props.video?.directSeekToTime(this.props.video.currentTime + 1);
                    break;
                case ActionKind.LongJumpBack:
                    this.props.video?.directSeekToTime(this.props.video.currentTime - 5);
                    break;
                case ActionKind.LongJumpForward:
                    this.props.video?.directSeekToTime(this.props.video.currentTime + 5);
                    break;
                case ActionKind.TogglePlayback:
                    if (this.state.isPlaying) {
                        this.props.video?.directPause();
                    } else {
                        this.props.video?.directPlay();
                    }
                    break;
                case ActionKind.MoveSelectionStartToPlayhead:
                    if (video) {
                        let start = video.htmlVideo.currentTime;
                        let end = Math.max(this.props.selectionEndSec, start);
                        this.props.updateSelection(start, end);
                    }
                    break;
                case ActionKind.MoveSelectionEndToPlayhead:
                    if (video) {
                        let end = video.htmlVideo.currentTime;
                        let start = Math.min(this.props.selectionStartSec, end);
                        this.props.updateSelection(start, end);
                    }
                    break;
                case ActionKind.JumpToSelectionStart:
                    this.props.video?.directSeekToTime(this.props.selectionStartSec);
                    break;
                case ActionKind.JumpToSelectionEnd:
                    this.props.video?.directSeekToTime(this.props.selectionEndSec);
                    break;
                // case ActionKind.TogglePlaybackWithReturn:
                //     if (Global.MediaController.isPlaying) {
                //         this.pause();
                //     } else {
                //         this.play(true);
                //     }
                //     break;
                // case ActionKind.Deselect:
                //     this.clearSelection();
                //     // Global.CueManager.clearSelectedVideoCues();
                //     // Global.CueManager.clearSelectedVideoCues();
                //     // Global.SyncCodeManager.selected.clear();
                //     Global.ProjectManager.activeTranscript?.syncCodeManager.selected.clear();
                //     break;
                // case ActionKind.CreateSelection:
                //     if (this.isPlaying) {
                //         this.pause();
                //     } else {
                //         // Start creating selection
                //         if (this.hasSelection) {
                //             this.clearSelection();
                //         } else {
                //             this.generatingSelection = true;
                //             this.selectionGenStart = this.currentTime;
                //             this.play();
                //         }
                //     }
                //     break;
                default:
                    break;
            }
        }

        const UIM = InputManager;
        UIM.registerAction(ActionKind.ShortJumpBack, this.handleShortcuts);
        UIM.registerAction(
            ActionKind.ShortJumpForward,
            this.handleShortcuts
        );
        UIM.registerAction(ActionKind.LongJumpBack, this.handleShortcuts);
        UIM.registerAction(
            ActionKind.LongJumpForward,
            this.handleShortcuts
        );
        UIM.registerAction(ActionKind.TinyStepBack, this.handleShortcuts);
        UIM.registerAction(
            ActionKind.TinyStepForward,
            this.handleShortcuts
        );
        UIM.registerAction(
            ActionKind.TogglePlayback,
            this.handleShortcuts
        );
        UIM.registerAction(
            ActionKind.TogglePlaybackWithReturn,
            this.handleShortcuts
        );
        UIM.registerAction(
            ActionKind.Deselect,
            this.handleShortcuts
        );
        UIM.registerAction(
            ActionKind.CreateSelection,
            this.handleShortcuts
        );
        UIM.registerAction(
            ActionKind.MoveSelectionStartToPlayhead,
            this.handleShortcuts
        );
        UIM.registerAction(
            ActionKind.MoveSelectionEndToPlayhead,
            this.handleShortcuts
        );
        UIM.registerAction(
            ActionKind.JumpToSelectionStart,
            this.handleShortcuts
        );
        UIM.registerAction(
            ActionKind.JumpToSelectionEnd,
            this.handleShortcuts
        );

    }

    public disposeTransportShortcuts() {
        const UIM = InputManager;
        UIM.removeAction(ActionKind.ShortJumpBack, this.handleShortcuts);
        UIM.removeAction(
            ActionKind.ShortJumpForward,
            this.handleShortcuts
        );
        UIM.removeAction(ActionKind.LongJumpBack, this.handleShortcuts);
        UIM.removeAction(ActionKind.LongJumpForward, this.handleShortcuts);
        UIM.removeAction(ActionKind.TinyStepBack, this.handleShortcuts);
        UIM.removeAction(ActionKind.TinyStepForward, this.handleShortcuts);
        UIM.removeAction(ActionKind.TogglePlayback, this.handleShortcuts);
        UIM.removeAction(
            ActionKind.TogglePlaybackWithReturn,
            this.handleShortcuts
        );
        UIM.removeAction(ActionKind.Deselect, this.handleShortcuts);
        UIM.removeAction(ActionKind.CreateSelection, this.handleShortcuts);
        UIM.removeAction(ActionKind.MoveSelectionStartToPlayhead, this.handleShortcuts);
        UIM.removeAction(ActionKind.MoveSelectionEndToPlayhead, this.handleShortcuts);
        UIM.removeAction(ActionKind.JumpToSelectionStart, this.handleShortcuts);
        UIM.removeAction(ActionKind.JumpToSelectionEnd, this.handleShortcuts);

    }

    // From Video Listener
    onPlay() {
        this.setState ({
            isPlaying : true,
        });
    }
    // From Video Listener
    onPause() {
        this.setState ({
            isPlaying : false,
        });
    }

    render() {
        let playPauseIcon = <PlaySolidIcon className="c-icon" />;
        if (this.state.isPlaying) {
            playPauseIcon = <PauseIcon className="c-icon" />;
        }

        return (
            <Pane
                ref={this.actionButtonPanelRef}
                display="flex" flexDirection="row"
                flexShrink={0}
                padding={5}
                justifyContent="center" alignItems="center" overflow="hidden"
                backgroundColor="#393939"
                >
                    <button
                        className="c-button c-no-focus action-button"
                        title={ButtonHoverText.SetSelectionStart
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.MoveSelectionStartToPlayhead))
                            ??  OSShortcutChoice("CTRL+[", "⌘ [", ""))
                        }
                        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                            this.handleShortcuts(ActionKind.MoveSelectionStartToPlayhead);
                        }}
                    >
                        <span className="icon-container">
                            <HiMiniArrowRightStartOnRectangle size={20} className="c-icon" />
                        </span>
                    </button>
                    <button
                        className="c-button c-no-focus action-button action-button-first"
                        title={ButtonHoverText.JumpToSelectionStart
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.JumpToSelectionStart))
                            ??  OSShortcutChoice("CTRL+SHIFT+[", "⌘ ⇧ [", ""))
                        }
                        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                            this.handleShortcuts(ActionKind.JumpToSelectionStart)
                        }}
                    >
                        <span className="icon-container">
                            <TbBracketsContainStart size={20} className="c-icon" />
                        </span>
                    </button>
                    <button
                        className="c-button c-no-focus action-button"
                        title={ButtonHoverText.LongJumpBack
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.LongJumpBack))
                            ??  OSShortcutChoice("CTRL+SHIFT+J", "⌘ ⇧ J", ""))}
                        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                            this.handleShortcuts(ActionKind.LongJumpBack);
                        }}
                    >
                        <span className="icon-container">
                            <DoubleChevronLeftIcon className="c-icon action-button-left" />L
                        </span>
                    </button>
                    <button
                        className="c-button c-no-focus action-button"
                        title={ButtonHoverText.ShortJumpBack
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.ShortJumpBack))
                            ?? OSShortcutChoice("CTRL+J", "⌘ J", ""))}
                        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                            this.handleShortcuts(ActionKind.ShortJumpBack);
                        }}
                    >
                        <span className="icon-container">
                            <ChevronLeftIcon className="c-icon action-button-left" />S
                        </span>
                    </button>
                    <button
                        className="c-button c-no-focus action-button"
                        title={ButtonHoverText.TinyJumpBack
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.TinyStepBack))
                            ?? OSShortcutChoice("CTRL+ALT+J", "⌃ ⌥ J", ""))}
                        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                            this.handleShortcuts(ActionKind.TinyStepBack);
                        }}
                    >
                        <span className="icon-container">
                            <ChevronLeftEnd6Icon className="c-icon action-button-left" />F
                        </span>
                    </button>
                    <button
                        className="c-button c-no-focus action-button action-button-play"
                        title={this.state.isPlaying ?
                            ButtonHoverText.Pause
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.TogglePlayback))
                            ?? OSShortcutChoice("CTRL+SPACE", "⌘ N", ""))
                            :
                            ButtonHoverText.Play
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.TogglePlayback))
                            ?? OSShortcutChoice("CTRL+SPACE", "⌘ N", "")) }
                        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                            this.handleShortcuts(ActionKind.TogglePlayback);
                        }}
                    >
                        <span className="icon-container">
                            {playPauseIcon}
                        </span>
                    </button>
                    <button
                        className="c-button c-no-focus action-button"
                        title={ButtonHoverText.TinyJumpForward
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.TinyStepForward))
                            ?? OSShortcutChoice("CTRL+ALT+K", "⌃ ⌥ K", ""))}
                        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                            this.handleShortcuts(ActionKind.TinyStepForward);
                        }}
                    >
                        <span className="icon-container">
                            F<ChevronRightEnd6Icon className="c-icon action-button-right" />
                        </span>
                    </button>
                    <button
                        className="c-button c-no-focus action-button"
                        title={ButtonHoverText.ShortJumpForward
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.ShortJumpForward))
                            ?? OSShortcutChoice("CTRL+K", "⌥ K", ""))}
                        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                            this.handleShortcuts(ActionKind.ShortJumpForward);
                        }}
                    >
                        <span className="icon-container">
                            S<ChevronRightIcon className="c-icon action-button-right" />
                        </span>
                    </button>
                    <button
                        className="c-button c-no-focus action-button"
                        title={ButtonHoverText.LongJumpForward
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.LongJumpForward))
                            ?? OSShortcutChoice("CTRL+SHIFT+K", "⌘ ⇧ K", ""))}
                        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                            this.handleShortcuts(ActionKind.LongJumpForward);
                        }}
                    >
                        <span className="icon-container">
                            L<DoubleChevronRightIcon className="c-icon action-button-right" />
                        </span>
                    </button>
                    <button
                        className="c-button c-no-focus action-button action-button-last"
                        title={ButtonHoverText.JumpToSelectionEnd
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.JumpToSelectionEnd))
                            ??  OSShortcutChoice("CTRL+SHIFT+]", "⌘ ⇧ ]", ""))
                        }
                        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                            this.handleShortcuts(ActionKind.JumpToSelectionEnd);
                        }}
                    >
                        <span className="icon-container">
                            <TbBracketsContainEnd size={20} className="c-icon" />
                        </span>
                    </button>
                    <button
                        className="c-button c-no-focus action-button"
                        title={ButtonHoverText.SetSelectionEnd
                            + (inputKeyToShortcutText(InputManager.getBinding(ActionKind.MoveSelectionEndToPlayhead))
                            ??  OSShortcutChoice("CTRL+]", "⌘ ]", ""))
                        }
                        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                            this.handleShortcuts(ActionKind.MoveSelectionEndToPlayhead);
                        }}
                    >
                        <span className="icon-container">
                            <HiMiniArrowLeftStartOnRectangle size={20} className="c-icon" />
                        </span>
                    </button>
                </Pane>
        );
    }

}
