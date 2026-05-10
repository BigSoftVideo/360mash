import { DecoderController, DecoderDesc, Encoder2, EncoderController, EncoderDesc, getYuvBufferSize, MediaMetadata } from "./codec";
import { AlignedPixelData, ImageFormat, PackedPixelData } from "./filter-pipeline";
import { VideoManager } from "./video-manager";

export type ExporterDesc = {
    inFilePath: string;
    outFilePath: string;

    startSec: number;

    /** May be set to Infinity, which means that it should last until the end of the input */
    endSec: number;

    outputWidth: number;
    outputHeight: number;

    // Encoding specific
    bitrate?: string;
    encoder?: string;

    onProgress: (progress: number) => void;
    onDone: (code: number | null, stderr: string) => void;

    decoderController: DecoderController;
    encoderController: EncoderController;
    videoManager: VideoManager;
};

export class Exporter {
    videoManager: VideoManager;

    encoderController: EncoderController;
    decoderController: DecoderController;

    /**
     * Upon constructing this class, it immediately starts exporting
     */
    constructor(desc: ExporterDesc) {
        this.encoderController = desc.encoderController;
        this.decoderController = desc.decoderController;
        this.videoManager = desc.videoManager;
        this.videoManager.video?.htmlVideo.pause();
        this.videoManager.stopRendering();

        const recvImgShouldNotBeCalledYet = async (_: Uint8Array): Promise<void> => {
            throw new Error("This function should not have been called yet");
        };

        const recvMetadataShouldNotBeCalledYet = (_: MediaMetadata): void => {
            throw new Error("This function should not have been called yet");
        };

        const encodingDone = (code: number | null, stderr: string) => {
            desc.videoManager.renderContinously();
            desc.onDone(code, stderr);
        }

        let encoder = null as Encoder2 | null;

        let startTime = new Date();

        const decoderDesc: DecoderDesc = {
            inFilePath: desc.inFilePath,
            onExit: (code) => {
                const now = new Date();
                console.log("DECODER EXITED. Exporting took " + (now.getTime() - startTime.getTime()) + " ms");
                if (!encoder) {
                    console.warn("Decoder exited before the encoder was set up. This likely means that the decoder failed to start.");
                    desc.onDone(-1, "Encoder not found when decoder exited.");
                } else {
                    if (code) {
                        encoder.cancelEncoding();
                    } else {
                        encoder.finishEncoding();
                    }
                }
            },
            receivedImageCb: recvImgShouldNotBeCalledYet,
            receivedMetadataCb: recvMetadataShouldNotBeCalledYet,
            startSec: desc.startSec,
            endSec: desc.endSec
        };

        const handleReceivedMetadata = (metadata: MediaMetadata) => {
            const encoderDesc: EncoderDesc = {
                audioFilePath: desc.inFilePath,
                audioStartSec: desc.startSec,
                audioEndSec: desc.endSec,

                fps: metadata.framerate,
                width: desc.outputWidth,
                height: desc.outputHeight,
            };

            // SET UP the encoder
            encoder = desc.encoderController.startEncoding(
                desc.outFilePath, encoderDesc, encodingDone
            );
            const outW = desc.outputWidth;
            const outH = desc.outputHeight;
            const outputBuffer: PackedPixelData = {
                data: new Uint8Array(getYuvBufferSize(outW, outH)),
                w: outW,
                h: outH,
                format: ImageFormat.YUV420P
            };
            decoderDesc.receivedImageCb = async (buffer: Uint8Array) => {
                const inputImage: PackedPixelData = {
                    data: buffer,
                    format: ImageFormat.YUV420P,
                    w: metadata.width,
                    h: metadata.height
                };
                this.videoManager.renderOnce(inputImage);
                this.videoManager.pipeline.fillYuv420pPixelData(outputBuffer);
                await encoder.encode(outputBuffer.data);
            };
        };
        decoderDesc.receivedMetadataCb = handleReceivedMetadata;
        
        desc.decoderController.startDecoding(decoderDesc)
    }

    public cancelExport() {
        this.decoderController.stopDecoding();
        this.encoderController.cancelEncoding();
    }
}
