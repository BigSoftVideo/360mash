import { guardOfNeverland } from "./nodeless-util";
import { isMac, OSTextChoice } from "./os-specific-logic";
import { webFrame } from "electron";

export type UserInputActionCallback = (action: ActionKind) => void;

enum KeyCodeValues {
    Enter = "Enter",
    Space = "Space",
    Escape = "Escape",
    Q = "KeyQ",
    W = "KeyW",
    E = "KeyE",
    R = "KeyR",
    T = "KeyT",
    Y = "KeyY",
    U = "KeyU",
    I = "KeyI",
    O = "KeyO",
    P = "KeyP",
    A = "KeyA",
    S = "KeyS",
    D = "KeyD",
    F = "KeyF",
    G = "KeyG",
    H = "KeyH",
    J = "KeyJ",
    K = "KeyK",
    L = "KeyL",
    Z = "KeyZ",
    X = "KeyX",
    C = "KeyC",
    V = "KeyV",
    B = "KeyB",
    N = "KeyN",
    M = "KeyM",
    F1 = "F1",
    F2 = "F2",
    F3 = "F3",
    F4 = "F4",
    F5 = "F5",
    F6 = "F6",
    F7 = "F7",
    F8 = "F8",
    F9 = "F9",
    F10 = "F10",
    F11 = "F11",
    F12 = "F12",
    ArrowUp = "ArrowDown",
    ArrowDown = "ArrowDown",
    ArrowLeft = "ArrowLeft",
    ArrowRight = "ArrowRight",
    OpenBracket = "BracketLeft",
    CloseBracket = "BracketRight",
}

const noOP = () => {console.warn("NoOP called in UserInput before Init() was called");};

export class UserInputManager {
    // The modifiers are treated as a bitflag
    protected activeModifiers: number;
    protected inputMap: Map<ActionKind, InputKey>;
    protected shortCutKeyCodeMap: Map<string, ActionKind>;
    protected shortCutKeyMap: Map<string, ActionKind>;
    protected actions: Map<ActionKind, UserInputActionCallback>;

    // public doteModifierKey: VirtualModifier;

    /** This is null when all actions are enabled */
    protected enabledActions: Set<ActionKind> | null;

    // protected constructedAt: string;


    protected upHandler: (e: KeyboardEvent) => void = noOP;
    protected downHandler: (e: KeyboardEvent) => void = noOP;
    protected focusOutHandler: () => void = noOP;

    constructor() {
        this.activeModifiers = 0;
        this.actions = new Map();

        // Note: InputMap will get replaced in Init()
        this.inputMap = new Map<ActionKind, InputKey>();
        this.shortCutKeyCodeMap = new Map<string, ActionKind>();
        this.shortCutKeyMap = new Map<string, ActionKind>();

        this.enabledActions = null;
    }

    public init(/*inputMapArray: [ActionKind, InputKey][]*/) {
        // console.log("Creating a user input manager with an input map:", inputMapArray);
        // if (inputMapArray && inputMapArray.length > 0) {
        //     let first = inputMapArray[0];
        //     if (isInputKey(first[1])) {
        //         this.inputMap = resolveInputCollision(new Map<ActionKind, InputKey>(inputMapArray));
        //         let sortedMap = new Map<ActionKind, InputKey>();
        //         // Sort input map
        //         for (const action of ActionsUiOrder) {
        //             let binding = this.inputMap.get(action);
        //             if (!binding) continue;
        //             sortedMap.set(action, binding);
        //         }
        //         this.inputMap = sortedMap;
        //         getMissingDefaultKeyCodes(this.inputMap);
        //     } else {
        //         this.inputMap = new Map<ActionKind, InputKey>(DEFAULT_INPUT_MAP.entries());
        //     }
        // } else {
            this.inputMap = new Map<ActionKind, InputKey>(DEFAULT_INPUT_MAP.entries());
        // }
        for (const [defaultAction, defaultButton] of DEFAULT_INPUT_MAP.entries()) {
            if (!this.inputMap.has(defaultAction)) {
                this.inputMap.set(defaultAction, defaultButton);
            }
        }
        this.rebuildPerformanceMaps();

        this.downHandler = (e: KeyboardEvent) => {
            console.log("Key pressed", e.key);
            console.log("Modifiers were: ", this.activeModifiers);
            let modifier = parseModifier(e.key);
            if (modifier !== VirtualModifier.None) {
                this.activeModifiers |= modifier;
            }
            // console.log(`-#- '${e.key}' down with modifiers: `, JSON.stringify(modifierMaskToList(this.activeModifiers).map(m => VirtualModifier[m])));
            if (e.key === undefined) {
                // there seems to be a bug in React/Chrome that we get a keydown event when
                // the drop-down `list` of an `input`. This event has an undefined `key`
                return;
            }
            const action = this.getAction(e);
            let actionCb = this.actions.get(action);

            let actionEnabled = true;
            if (this.enabledActions !== null) {
                actionEnabled = this.enabledActions.has(action);
            }
            if (actionCb && actionEnabled) {
                actionCb(action);
                e.preventDefault();
            }
        };
        this.upHandler = (e) => {
            let modifier = parseModifier(e.key);
            if (modifier !== VirtualModifier.None) {
                let inverseMod = ~modifier;
                this.activeModifiers &= inverseMod;
            }
            // console.log(`-#- '${e.key}' UP with modifiers: `, JSON.stringify(modifierMaskToList(this.activeModifiers).map(m => VirtualModifier[m])));
        };
        this.focusOutHandler = () => {
            this.activeModifiers = VirtualModifier.None;
        };
        window.addEventListener("keydown", this.downHandler);
        window.addEventListener("keyup", this.upHandler);
        window.addEventListener("focusout", this.focusOutHandler);

        //Register zooming of entire window
        this.registerAction(ActionKind.ZoomUiIn, () => {
            let level = webFrame.getZoomLevel();
            webFrame.setZoomLevel(level + 1);
        });
        this.registerAction(ActionKind.ZoomUiOut, () => {
            let level = webFrame.getZoomLevel();
            webFrame.setZoomLevel(level - 1);
        });
    }

    public dispose() {
        window.removeEventListener("keydown", this.downHandler);
        window.removeEventListener("keyup", this.upHandler);
        window.removeEventListener("focusout", this.focusOutHandler);
    }

    public registerAction(action: ActionKind, callback: UserInputActionCallback) {
        this.actions.set(action, callback);
    }

    public removeAction(action: ActionKind, callback: UserInputActionCallback) {
        let registeredCb = this.actions.get(action);
        if (registeredCb === callback) {
            this.actions.delete(action);
        }
    }

    public rebuildPerformanceMaps() {
        this.shortCutKeyCodeMap.clear();
        this.shortCutKeyMap.clear();
        for (let [action, input] of this.inputMap) {
            let mods = 0;
            for (let mod of input.modifiers) {
                mods |= mod;
            }
            this.shortCutKeyMap.set(input.key.toLocaleLowerCase() + mods, action);
            if (input.code !== undefined) {
                this.shortCutKeyCodeMap.set(input.code + mods, action);
            }
        }
    }

    // public updateInputMap(inputMap: Map<ActionKind, InputKey>) {
    //     this.inputMap = inputMap;
    //     this.rebuildPerformanceMaps();
    //     //Save
    //     Global.Settings.inputMap = this.inputMap;
    // }

    /** Normally this should never return undefined */
    public getBinding(action: ActionKind): InputKey | undefined {
        return this.inputMap.get(action);
    }

    protected getAction(e: KeyboardEvent): ActionKind {
        let keyCodeAction;
        let keyAction;
        // console.log("Code: " + e.code + " Key: " + e.key);
        // console.log("ActiveMods: " + this.activeModifiers);
        if (e.altKey && isMac()) {
            keyCodeAction = this.shortCutKeyCodeMap.get(e.code + this.activeModifiers);
        } else {
            keyAction = this.shortCutKeyMap.get(e.key.toLocaleLowerCase() + this.activeModifiers);
        }

        return keyCodeAction ?? keyAction ?? ActionKind.None;

        // for (let [action, input] of this.inputMap) {
        //     let modMask = 0;
        //     for (const modifier of input.modifiers) {
        //         modMask |= modifier;
        //     }

        //     let bindingKey = input.key.toLocaleLowerCase();
        //     let bindingCode = input.code;
        //     if (modMask == this.activeModifiers && bindingKey == inputKey) {
        //         // console.log("Triggered action: " + getActionDescription(action));
        //         return action;
        //     }
        // }
        // return ActionKind.None;
    }

    public enableAllActions() {
        this.enabledActions = null;
    }

    /** Passing an empty container to this will disable all actions */
    public enableOnly(enabled: Iterable<ActionKind>) {
        this.enabledActions = new Set(enabled);
    }

    /**
     * Returns null when all actions are enabled, returns an empty set when no action is enabled,
     * and returns the set of enabled actions otherwise.
     */
    public getEnabledActions(): ReadonlySet<ActionKind> | null {
        return this.enabledActions;
    }
}

export enum VirtualModifier {
    None = 0,
    CtrlOrCommand = 1 << 0,
    Alt = 1 << 1,
    Shift = 1 << 2,
}

export function modifierMaskToList(mask: number): VirtualModifier[] {
    function dec2bin(dec: number): string {
        return (dec >>> 0).toString(2);
    }

    let result: VirtualModifier[] = [];
    // console.log("Converting the modifier mask " + dec2bin(mask) + " to a list");
    for (const modAny in VirtualModifier) {
        let modifier = Number(modAny);
        if (isNaN(modifier)) {
            continue;
        }
        if (modifier === VirtualModifier.None) {
            continue;
        }
        // let modifier = VirtualModifier[VirtualModifier.Alt];
        if ((mask & (modifier as number)) == modifier) {
            let item = modifier as VirtualModifier;
            result.push(item);
            // console.log("Item: " + VirtualModifier[item]);
        }
    }
    return result;
}

export function modifierListToMask(modList: VirtualModifier[]): number {
    let result = 0;
    for (const modifier of modList) {
        result |= modifier;
    }
    return result;
}

/** Checks if the provided key can be considered as one of the valid modifiers and returns
 * the one that it can be.
 *
 * For example if the key is any of the function keys from F4 and aboove, this function
 * returns VirtualModifier.Dote as those key may be used as the Dote modifier key.
 *
 * As another example if the key is the Command key on a Mac, this function returns
 * VirtualModifier.CtrlOrCommand as that is also a valid modifier.
 */
export function parseModifier(key: string): VirtualModifier {
    if (process.platform == "darwin") {
        if (key === "Meta") return VirtualModifier.CtrlOrCommand;
    } else {
        if (key === "Control") return VirtualModifier.CtrlOrCommand;
    }
    if (key === "Alt") {
        return VirtualModifier.Alt;
    }
    if (key == "Shift") {
        return VirtualModifier.Shift;
    }
    // if (key.length >= 2) {
    //     if (key[0] === "F") {
    //         let number = parseInt(key.slice(1, 3));
    //         if (number <= 20) {
    //             return VirtualModifier.F1 + (number - 1);
    //         }
    //     }
    // }
    return VirtualModifier.None;
}

export function getActionDescription(action: ActionKind): string {
    switch (action) {
        case ActionKind.None:
            return "-No Action-";
        case ActionKind.TinyStepBack:
            return "Step Approximately a Frame Back";
        case ActionKind.TinyStepForward:
            return "Step Approximately a Frame Ahead";
        case ActionKind.ShortJumpBack:
            return "Jump 1 Second Back";
        case ActionKind.ShortJumpForward:
            return "Jump 1 Second Ahead";
        case ActionKind.LongJumpBack:
            return "Jump 4 Seconds Back";
        case ActionKind.LongJumpForward:
            return "Jump 4 Seconds Ahead";
        case ActionKind.TogglePlayback:
            return "Toggle Playback/Pause";
        case ActionKind.TogglePlaybackWithReturn:
            return "Toggle Playback/Pause With Return";
        case ActionKind.MoveSyncCodeBackward:
            return "Nudge Sync-code Backwards";
        case ActionKind.MoveSyncCodeForward:
            return "Nudge Sync-code Forwards";
        case ActionKind.AddSyncCode:
            return "Add Sync-code To The Current Line";
        case ActionKind.ToggleUnderline:
            return "Toggle Underlining of Selected";
        case ActionKind.ZoomUiIn:
            return "Zoom UI In";
        case ActionKind.ZoomUiOut:
            return "Zoom UI Out";
        case ActionKind.Deselect:
            return "Clear Waveform Selection";
        case ActionKind.CreateSelection:
            return "Initiate the Creation of a Selection";
        case ActionKind.EnterPressed:
            return "Enter Key";
        case ActionKind.MoveSelectionStartToPlayhead:
            return "Move selection start to the current time";
        case ActionKind.MoveSelectionEndToPlayhead:
            return "Move the selection end to the current time";
        case ActionKind.JumpToSelectionStart:
            return "Jump to the start of the selection";
        case ActionKind.JumpToSelectionEnd:
            return "Jump to the end of the selection";
        default:
            guardOfNeverland(action);
    }
}

export enum ButtonHoverText {
    Checkpoints= "View, Create & Restore from Checkpoints History",
    Autosaves= "View & Restore from Autobackups History",
    MediaManager= "Import/Delete/Select media files in current Project and Transcript",

    //Transport Controls
    Play ="Play",
    Pause ="Pause",
    PlayWithReturn= "Play & Return on Stop",
    PauseWithReturn= "Pause & Return",
    LongJumpBack= "Jump Back 4 Seconds",
    ShortJumpBack= "Jump Back 1 Second",
    TinyJumpBack= "Jump Back 1 Frame",
    TinyJumpForward= "Jump Forward 1 Frame",
    ShortJumpForward= "Jump Forward 1 Second",
    LongJumpForward= "Jump Forward 4 Seconds",
    LoopToggle= "Toggle Looping or Single Playback of Waveform Selection",
    ClearSelection= "Clear Waveform Selection",
    SetSelectionStart= "Move the selection start to the current time",
    SetSelectionEnd= "Move the selection end to the current time",
    JumpToSelectionStart= "Jump the current time to the start of the selection",
    JumpToSelectionEnd= "Jump the current time to the end of the selection",

    // Video Options
    SelectCurrentVideo= "Select media file",
    ShowVideoSection= "Show/Hide Primary video panel",
    SecondView= "Show/Hide Secondary video panel",
    ShowVideoCues= "Show/Hide Video-cue panel",
    VideoFollowsCues= "Force video panel to follow Video-cues",
    VideoViewSaveChanges="Save changes to video viewport (selected video, zoom & pan)",
    VideoViewFreeView="Free view: any changes made to the video viewport will not be saved",
    VideoDoteView="Saved view from DOTE",
    VideoDotebaseView="Changes made to video viewport will only be available in DOTEbase, and not accessible in DOTE",
    VideoFormatType="Select 2D standard video or 360° equirectangular",
    VideoProjectionType= "Select how 360° video should be rendered",

    // Audio Options
    MinimizeWaveform= "Shrink Audio Waveform",
    RestoreWaveform= "Expand Audio Waveform",
    AudioControlPanel= "",
    VolumeSliderToggle= "Show/Hide Volume Control",
    MuteToggle= "Mute/Unmute audio",

    // Interface
    CollapseLeftPane= "Minimize Media Control Panels",
    ExpandLeftPane= "Restore Media Control Panels",
    CollapseRightPane= "Minimize Transcript Editor",
    ExpandRightPane= "Restore Transcript Editor",
    TranscriptOptionsButton= "Open and edit Transcript Options",
    AddVideoCue= "Add a new Video-cue",
    EditVideoCue= "Edit selected Video-cue",

    // Media Manager
    RegenerateWaveform= "Clear waveform cache for this file",
    SetActiveCheckbox= "Make this file available in current Transcript",

    AutoBackupStrategy= "Select how you would like to manage retention of automatically generated backups.\n\n" +
                        "Only a single backup: Only the most recent backup will be kept.\n\n" +
                        "Never Delete Backups: All backups will be kept.\n\n" +
                        "Smart Backup Solution: \n" +
                        "     Every 5 min for the past 2 hours\n" +
                        "     Every hour for the past 24 hours\n" +
                        "     Every day for the past month\n" +
                        "     One per month after that\n" +
                        "     (A minimum of 20 backups are kept regardless)\n\n" +
                        "Only Keep Backups for 30 Days: Backups older than 30 days will be deleted.\n\n",

    // Code Editor
    NewClipButton = "Create a new Transcript Clip from selected region of text",
    DeleteClipButton = "Delete the Transcript Clip at the cursors location",
    EditClipButton = "Edit this Transcript Clip",
    ClipsUnavailableWhenUnlicensed = "The creation or editing of Transcript-Clips is unavailabled in the unlicensed version of DOTE",

    // Video Cue Editor Dialog
    SelectVideoForCue = "Select media file",
}

export interface InputKey {
    modifiers: VirtualModifier[];
    key: string;
    code?: string;
}
export function inputKeyEquals(a: InputKey, b: InputKey): boolean {
    if (a.key != b.key) return false;
    let modFalgsA = modifierListToMask(a.modifiers);
    let modFlagsB = modifierListToMask(b.modifiers);
    if (modFalgsA != modFlagsB) {
        return false;
    }
    return true;
}
export function isInputKey(value: any): value is InputKey {
    return value.key != undefined && value.modifiers != undefined;
}
export function inputKeyToShortcutText(key: InputKey | undefined): string | undefined {
    if (key === undefined)
        return undefined;
    let result = "  -  ";
    for (const mod of key.modifiers) {
        let modName = "";
        switch (mod) {
            case VirtualModifier.CtrlOrCommand:
                modName = OSTextChoice("Ctrl", "⌘", "Ctrl");
            break;
            case VirtualModifier.Alt:
                modName = OSTextChoice("Alt", "⌥", "Alt");
            break;
            case VirtualModifier.Shift:
                modName = OSTextChoice("Shift", "⇧", "Shift");
            break;
        }
        result += modName + OSTextChoice(" + ", " ", " + ");
    }
    let keyText = "";
    if (key.key === " ") {
        keyText = "Space";
    } else {
        keyText = `${key.key.toLocaleUpperCase()}`;
    }
    result += keyText;
    result += " "
    return result;
}
// Converts an input binding to a user-friendly textual description
export function inputKeyToText(key: InputKey): string {
    let result = "";
    if (key.modifiers.length > 0) {
        result = "hold down ";
        let isFirstMod = true;
        for (const mod of key.modifiers) {
            let modName = "";
            switch (mod) {
                case VirtualModifier.CtrlOrCommand:
                    modName = OSTextChoice("Ctrl", "⌘", "Ctrl");
                break;
                case VirtualModifier.Alt:
                    modName = OSTextChoice("Alt", "⌥", "Alt");
                break;
                case VirtualModifier.Shift:
                    modName = OSTextChoice("Shift", "⇧", "Shift");
                break;
            }
            if (!isFirstMod) {
                result += " and ";
            }
            result += modName;
            isFirstMod = false;
        }
        result += " and ";
    }
    let keyText = "";
    if (key.key === " ") {
        keyText = "Space";
    } else {
        keyText = `'${key.key.toLocaleUpperCase()}'`;
    }
    result += `press ${keyText}`;
    return result;
}

export enum ActionKind {
    // !!
    // WARNING
    // ALWAYS ADD NEW ITEMS TO THE END OF THIS ENUM BECAUSE
    // THESE VALUES ARE SERAILIZED BY THEIR ID (sequence number)
    // !!
    None = 0,
    TinyStepBack,
    TinyStepForward,
    ShortJumpBack,
    ShortJumpForward,
    LongJumpBack,
    LongJumpForward,
    MoveSyncCodeBackward,
    MoveSyncCodeForward,
    TogglePlayback,
    AddSyncCode,
    ToggleUnderline,

    /** When paused using this action, the playhead jumps back to where it started playing from. */
    TogglePlaybackWithReturn,

    ZoomUiIn,
    ZoomUiOut,
    /** Clears the selection of the waveform. */
    Deselect,

    CreateSelection,
    EnterPressed,
    MoveSelectionStartToPlayhead,
    MoveSelectionEndToPlayhead,
    JumpToSelectionStart,
    JumpToSelectionEnd,
}

export const ActionsUiOrder = [
    ActionKind.TogglePlayback,
    ActionKind.TogglePlaybackWithReturn,
    ActionKind.TinyStepBack,
    ActionKind.TinyStepForward,
    ActionKind.ShortJumpBack,
    ActionKind.ShortJumpForward,
    ActionKind.LongJumpBack,
    ActionKind.LongJumpForward,
    ActionKind.MoveSyncCodeBackward,
    ActionKind.MoveSyncCodeForward,
    ActionKind.AddSyncCode,
    ActionKind.ToggleUnderline,
    ActionKind.ZoomUiIn,
    ActionKind.ZoomUiOut,
    ActionKind.Deselect,
    ActionKind.CreateSelection,
    ActionKind.EnterPressed,
    ActionKind.MoveSelectionStartToPlayhead,
    ActionKind.MoveSelectionEndToPlayhead,
    ActionKind.JumpToSelectionStart,
    ActionKind.JumpToSelectionEnd
];
// Dividing by two because for each variant there are two keys: the ID and the NAME of the variant.
// Subtracting one, because the `None` value doesnt need to be displayed on the ui.
const NUM_OF_ACTIONS = Object.keys(ActionKind).length / 2 - 1;
if (NUM_OF_ACTIONS != ActionsUiOrder.length) {
    console.log("Values are ", JSON.stringify(Object.values(ActionKind)));
    console.error("THE `ActionsUiOrder` ARRAY MUST CONTAIN ALL ACTIONS");
}

// export class InputMap {
//     public mappings: Map<ActionKind, InputKey>;

//     constructor(mappings: Map<ActionKind, InputKey>) {
//         this.mappings = mappings;
//     }
// }

export function jsonifyInputMap(map: Map<ActionKind, InputKey>): string {
    let array = [...map.entries()];
    return JSON.stringify(array);
}

export function createInputMapFromJson(json: string): Map<ActionKind, InputKey> {
    let array = JSON.parse(json);
    return new Map(array);
}

export function resolveInputCollision(map: Map<ActionKind, InputKey>): Map<ActionKind, InputKey> {
    let result = new Map();
    for (const [srcAction, srcInput] of map.entries()) {
        let dstInput = srcInput;
        if (inputCollides(result, srcInput)) {
            dstInput = DEFAULT_INPUT_MAP.get(srcAction)!;
        }
        result.set(srcAction, dstInput);
    }
    return result;
}

// Returns ActionKind.None if the input does not collide
export function inputCollides(map: Map<ActionKind, InputKey>, newInput: InputKey): ActionKind {
    for (const [action, knownInput] of map.entries()) {
        if (inputKeyEquals(knownInput, newInput)) {
            return action;
        }
    }
    return ActionKind.None;
}

export function getMissingDefaultKeyCodes(inputMap:Map<ActionKind, InputKey>) {
    let defaultInputMap = getDefaultInputMap();
    for ( let [actionKind, inputKey] of inputMap) {
        // Check if still using default key-binding
        // If so, add any missing keycodes
        let defaults = defaultInputMap.get(actionKind);
        if (defaults && inputKey.code === undefined
            && defaults.key === inputKey.key
            && defaults.code !== undefined) {
                inputMap.set(actionKind, {... inputKey, code: defaults.code});
            }
    }

}

// On Mac
// option + abcdefghijklmnopqrstuvwxyz
// gives -> å∫ç∂´ƒ©˙ˆ∆˚¬µ˜øπœ®ß†¨√∑≈¥Ω

function getDefaultInputMap(): Map<ActionKind, InputKey> {
    // Platform independent defaults
    let inputMap = new Map<ActionKind, InputKey>();
    if (isMac()) {
        inputMap.set(ActionKind.TogglePlayback, {
            modifiers: [VirtualModifier.CtrlOrCommand],
            key: "n",
            code: KeyCodeValues.N,
        });
        inputMap.set(ActionKind.TogglePlaybackWithReturn, {
            modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Shift],
            key: "n",
            code: KeyCodeValues.N,
        });
    } else {
        inputMap.set(ActionKind.TogglePlayback, {
            modifiers: [VirtualModifier.CtrlOrCommand],
            key: " ",
            code: KeyCodeValues.Space,
        });
        inputMap.set(ActionKind.TogglePlaybackWithReturn, {
            modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Shift],
            key: " ",
            code: KeyCodeValues.Space,
        });
    }
    inputMap.set(ActionKind.TinyStepBack, {
        modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Alt],
        key: "j",
        code: KeyCodeValues.J,
    });
    inputMap.set(ActionKind.TinyStepForward, {
        modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Alt],
        key: "k",
        code: KeyCodeValues.K,
    });
    inputMap.set(ActionKind.ShortJumpBack, {
        modifiers: [VirtualModifier.CtrlOrCommand],
        key: "j",
        code: KeyCodeValues.J,
    });
    inputMap.set(ActionKind.ShortJumpForward, {
        modifiers: [VirtualModifier.CtrlOrCommand],
        key: "k",
        code: KeyCodeValues.K,
    });
    inputMap.set(ActionKind.LongJumpBack, {
        modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Shift],
        key: "j",
        code: KeyCodeValues.J,
    });
    inputMap.set(ActionKind.LongJumpForward, {
        modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Shift],
        key: "k",
        code: KeyCodeValues.K,
    });
    inputMap.set(ActionKind.MoveSelectionStartToPlayhead, {
        modifiers: [VirtualModifier.CtrlOrCommand],
        key: "[",
        code: KeyCodeValues.OpenBracket,
    });
    inputMap.set(ActionKind.MoveSelectionEndToPlayhead, {
        modifiers: [VirtualModifier.CtrlOrCommand],
        key: "]",
        code: KeyCodeValues.CloseBracket,
    });
    inputMap.set(ActionKind.JumpToSelectionStart, {
        modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Shift],
        key: "[",
        code: KeyCodeValues.OpenBracket,
    });
    inputMap.set(ActionKind.JumpToSelectionEnd, {
        modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Shift],
        key: "]",
        code: KeyCodeValues.CloseBracket,
    });
    inputMap.set(ActionKind.MoveSyncCodeBackward, {
        modifiers: [VirtualModifier.CtrlOrCommand],
        key: "h",
        code: KeyCodeValues.H,
    });
    inputMap.set(ActionKind.MoveSyncCodeForward, {
        modifiers: [VirtualModifier.CtrlOrCommand],
        key: "l",
        code: KeyCodeValues.L,
    });
    inputMap.set(ActionKind.AddSyncCode, {
        modifiers: [VirtualModifier.CtrlOrCommand],
        key: "m",
        code: KeyCodeValues.M,
    });
    inputMap.set(ActionKind.ToggleUnderline, {
        modifiers: [VirtualModifier.CtrlOrCommand],
        key: "u",
        code: KeyCodeValues.U,
    });
    inputMap.set(ActionKind.ZoomUiIn, {
        modifiers: [],
        key: "F10",
    });
    inputMap.set(ActionKind.ZoomUiOut, {
        modifiers: [],
        key: "F9",
    });
    if (isMac()) {
        inputMap.set(ActionKind.Deselect, {
            modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Shift, VirtualModifier.Alt],
            key: "n",
            code: KeyCodeValues.N
        });
    } else {
        inputMap.set(ActionKind.Deselect, {
            modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Shift, VirtualModifier.Alt],
            key: " ",
            code: KeyCodeValues.Space,
        });
    }
    if (isMac()) {
        inputMap.set(ActionKind.CreateSelection, {
            modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Alt],
            key: "n",
            code: KeyCodeValues.N
        });
    } else {
        inputMap.set(ActionKind.CreateSelection, {
            modifiers: [VirtualModifier.CtrlOrCommand, VirtualModifier.Alt],
            key: " ",
        });
    }
    inputMap.set(ActionKind.EnterPressed, {
        modifiers: [],
        key: "ENTER",
        code: KeyCodeValues.Enter,
    })
    return inputMap;
}

export const DEFAULT_INPUT_MAP: Map<ActionKind, InputKey> = getDefaultInputMap();
