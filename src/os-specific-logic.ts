import os, { platform } from "os";

const enum Platforms {
    Windows= "win32",
    Mac= "darwin",
    Linux= "linux",
    Android= "android",
    SunOS= "sunos",
    OpenBSD= "openbsd",
    AIX= "aix"
}

export const enum SpecialCharacters {
    Command= "⌘",
    Shift= "⇧",
    OptionAltMac= "⌥",
    ControlMac= "⌃"
}

// const currentPlatform = platformsNames[os.platform()];

export function OSTextChoice(windowsText:string, macText:string, linuxText:string):string {
    switch (os.platform()) {
        case Platforms.Windows:
            return windowsText;
        case Platforms.Mac:
            return macText;
        case Platforms.Linux:
            return linuxText;
        default:
            return linuxText;
    }
}

// ⌘ ⇧ ⌥ ⌃
export function OSShortcutChoice(win:string, mac:string, linux:string):string {
    return " (" + OSTextChoice(win, mac, linux) + ")";
}

export function isMac():boolean {
    return os.platform() === Platforms.Mac;
}

export function isWindows():boolean {
    return os.platform() === Platforms.Windows;
}