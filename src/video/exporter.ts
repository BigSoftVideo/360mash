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

    deconderController: DecoderController;
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
        this.decoderController = desc.deconderController;
        this.videoManager = desc.videoManager;
        this.videoManager.video?.htmlVideo.pause();
        this.videoManager.stopRendering();

        let handleReceivedImage = async (_: Uint8Array): Promise<void> => {
            throw new Error("This function should not have been called yet");
        };

        const encodingDone = (code: number | null, stderr: string) => {
            desc.videoManager.renderContinously();
            desc.onDone(code, stderr);
        }

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
            const encoder = desc.encoderController.startEncoding(
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
            handleReceivedImage = async (buffer: Uint8Array) => {
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

        const decoderDesc: DecoderDesc = {
            inFilePath: desc.inFilePath,
            onExit: () => console.log("DECODER EXITED. Sent from exporter"),
            receivedImageCb: handleReceivedImage,
            receivedMetadataCb: handleReceivedMetadata
        };
        desc.deconderController.startDecoding(decoderDesc)
    }

    public cancelExport() {
        this.decoderController.stopDecoding();
        this.encoderController.cancelEncoding();
    }
}
