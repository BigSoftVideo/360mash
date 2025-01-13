
import Store from 'electron-store';
import { isDeepStrictEqual } from 'util';
import { isMac } from './os-specific-logic';
import * as fs from 'fs-extra';
import path from 'path';

import package_json from "../package.json";
import debounce, { DebouncedFunction } from 'debounce';
import { app } from '@electron/remote';

const DEBOUNCE_FILE_SAVE_REFRESH_RATE = 500; //ms or once every half-second

type SettingsSchema = {
    appVersion: string;
    windowSize: number[];
    windowPos: number[] | undefined;
    userInstalledFFmpeg: boolean;
    ffMpegPath: string;
    outputPath: string;
    lastUsedInputPath: string;

    __internal__: { migrations: { version: string } }
}

export interface SettingsListener {
    onUserPreferencesUpdated: () => void;
}

export class Settings {
    protected settingsStore: Store<SettingsSchema>;
    protected settingsCache: SettingsSchema;

    protected listeners = new Set<SettingsListener>();

    constructor() {
        console.log('Init Settings Store...')
        this.settingsStore = new Store<SettingsSchema>({
            cwd: 'Settings',
            defaults: {
                appVersion: package_json.version,
                windowSize: [1024, 768],
                windowPos: undefined,
                userInstalledFFmpeg: false,
                ffMpegPath: app.getPath('userData'),
                outputPath: app.getPath('documents'),
                lastUsedInputPath: app.getPath('documents'),

                __internal__: {
                    migrations: {
                        version: package_json.version,
                    },
                },
            },
            beforeEachMigration: (store, context) => {
                console.log(`Migrating Settings from ${context.fromVersion} to ${context.toVersion}`);
            },
            migrations: {
                '1.0.0': (store) => {
                    // Backup

                },

            }
        });
        // Force data to be read.
        this.settingsCache = this.getAllSettings();

        // if (this.ffMpegPath.length === 0) {
        //     let appPath:string = app.getPath('exe');
        //     let appFolder = path.dirname(appPath);

        //     if (isMac()) {
        //         const possibleffmpegPath = path.normalize(path.join(appFolder, 'ffmpeg')); // path.normalize(path.join('/Applications', "DOTE.app", "Contents", "MacOS", "ffmpeg"));
        //         console.log(`MAC: Checking for existence of ffmpeg at: ${possibleffmpegPath}`)
        //         fs.exists(possibleffmpegPath).then( (result) => {
        //             console.log('MAC: Exists: ', result);
        //             if (result) {
        //                 this.ffMpegPath = possibleffmpegPath;
        //             }
        //         });
        //     } else {
        //         const possibleffmpegPath = path.normalize(path.join(appFolder, 'ffmpeg.exe')); //path.normalize(path.join(appDataPath, "..", "Local", "DOTE", "ffmpeg.exe"));
        //         console.log(`Checking for existence of ffmpeg at: ${possibleffmpegPath}`)
        //         fs.exists(possibleffmpegPath).then( (result) => {
        //             console.log('Exists: ', result);
        //             if (result) {
        //                 this.ffMpegPath = possibleffmpegPath;
        //             }
        //         });
        //     }
        // }
    }

    public dispose() {
        for (const saver of this.debouncedSavers.values()) {
            saver.flush();
        }
    }

    public addListener(listener:SettingsListener) {
        this.listeners.add(listener);
    }

    public removeListener(listener:SettingsListener) {
        this.listeners.delete(listener);
    }

    public callPreferencesListenerUpdate() {
        this.listeners.forEach( (listener) => {
            listener.onUserPreferencesUpdated();
        });
    }

    public getAllSettings():SettingsSchema {
        return this.settingsStore.store;
    }

    protected debouncedSavers = new Map<keyof SettingsSchema, DebouncedFunction<(key: keyof SettingsSchema, value: SettingsSchema[keyof SettingsSchema]) => void>>();
    protected saveSetting(key: keyof SettingsSchema, value: SettingsSchema[keyof SettingsSchema]) {
        const existing = this.debouncedSavers.get(key);
        if (existing) {
            existing(key, value);
        } else {
            const debounced = debounce((key: keyof SettingsSchema, value: SettingsSchema[keyof SettingsSchema]) => {
                this.settingsStore.set(key, value);
            }, DEBOUNCE_FILE_SAVE_REFRESH_RATE);
            this.debouncedSavers.set(key, debounced);
            debounced(key, value);
        }
    }

    /**
     * Setting values
     */

    public get AppVersion(): string {
        return this.settingsCache.appVersion;
    }
    public set AppVersion(value:string) {
        this.settingsCache.appVersion = value;
        this.saveSetting('appVersion', value);
    }

    public get WindowSize(): number[] {
        return this.settingsCache.windowSize;
    }
    public set WindowSize(value:number[]) {
        this.settingsCache.windowSize = value;
        this.saveSetting('windowSize', value);
    }
    public get WindowPosition(): number[] | undefined {
        return this.settingsCache.windowPos;
    }
    public set WindowPosition(value:number[] | undefined) {
        this.settingsCache.windowPos = value;
        this.saveSetting('windowPos', value);
    }

    public get ffMpegPath(): string {
        return this.settingsCache.ffMpegPath;
    }
    public set ffMpegPath(value: string) {
        this.settingsCache.ffMpegPath = value;
        this.callPreferencesListenerUpdate();
        this.saveSetting('ffMpegPath', value);
    }
    public get ffMpegExecutablePath(): string {
        return path.join(this.ffMpegPath, isMac() ? 'ffmpeg' : 'ffmpeg.exe');
    }
    public get ffProbeExecutablePath(): string {
        return path.join(this.ffMpegPath, isMac() ? 'ffprobe' : 'ffprobe.exe');
    }

    public get userInstalledFFmpeg(): boolean {
        return this.settingsCache.userInstalledFFmpeg;
    }
    public set userInstalledFFmpeg(value: boolean) {
        this.settingsCache.userInstalledFFmpeg = value;
        this.callPreferencesListenerUpdate();
        this.saveSetting('userInstalledFFmpeg', value);
    }

    public get outputPath(): string {
        return this.settingsCache.outputPath;
    }
    public set outputPath(value: string) {
        this.settingsCache.outputPath = value;
        this.callPreferencesListenerUpdate();
        this.saveSetting('outputPath', value);
    }

    public get lastUsedInputPath(): string {
        return this.settingsCache.lastUsedInputPath;
    }
    public set lastUsedInputPath(value: string) {
        this.settingsCache.lastUsedInputPath = value;
        this.callPreferencesListenerUpdate();
        this.saveSetting('lastUsedInputPath', value);
    }


    // protected _uiSettings = new UISettingsHandler(
    //     () => {
    //         return this.settingsCache.uiSettings;
    //     },
    //     (settings) => {
    //         this.settingsCache.uiSettings = settings;
    //         this.saveSetting('uiSettings', settings);
    //     }
    // );
    // public get uiSettings():UISettingsHandler {
    //     return this._uiSettings;
    // }
}
