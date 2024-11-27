import * as util from "util";
import { FilterBase, FilterId } from "./filter-base";
import { FilterManager } from "./filter-manager";
import { Video } from "./video-manager";
import { GlTexture, RenderTexture, TargetDimensions } from "./core";
import {
    PlanarYuvToRgbShader,
    RgbToUShader,
    RgbToVShader,
    RgbToYShader,
} from "../misc-shaders/colorspace";

const setImmedateAsync = util.promisify(setImmediate);

export enum ImageFormat {
    RGBA,
    YUV420P,
}

export interface FilterDesc {
    id: FilterId;
    filter: FilterBase;
    active: boolean;
}

/**
 * Each value in data is the value of a single chanel of a single pixel within the image. The order
 * of the channels is (RED, GREEN, BLUE, ALPHA). Each channel takes up a single byte so each pixel
 * takes up 4 bytes.
 *
 * The word 'aligned' mean that there may be some padding bytes between the last pixel of a row and
 * the fist pixel of the next. The number of bytes from the START of one row to the start of the
 * next is stored in `linesize`. This is also known as stride. (Note that linesize is always at
 * least `w*4`)
 *
 * To access the first channel (RED) of the pixel at (x, y) index the `data` field with `y*linesize
 * + x*4`
 */
export interface AlignedPixelData {
    data: Uint8Array;

    /** Size of each row in BYTES. See the documentation of the type for more */
    linesize: number;
    w: number;
    h: number;
}

/**
 * Similar to `AlignedPixelData` but each row starts immediately after the previous, there's no
 * padding
 */
export interface PackedPixelData {
    data: Uint8Array;
    w: number;
    h: number;

    format: ImageFormat;
}
function isPackedPixelData(a: any): a is PackedPixelData {
    return (
        a.data && typeof a.w == "number" && typeof a.h == "number" && a.linesize === undefined
    );
}
{
    let a: PackedPixelData = {
        data: new Uint8Array(),
        w: 0,
        h: 0,
        format: ImageFormat.RGBA,
    };
    if (!isPackedPixelData(a)) {
        console.error("isPackedPixelData seems to have a faulty implementation");
    }
}

export type DimensionChangeListener = (w: number, h: number) => void;

/**
 * This class stores a list of filters to apply to a video.
 *
 * Given a video object it applies each filter to the output of the previous
 * and writes the final output to a WebGL texture object
 */
export class FilterPipeline {
    protected filters: FilterDesc[];
    protected filterManager: FilterManager;
    protected targetWidth: number;
    protected targetHeight: number;

    /** False if the output dimensions need to be updated (for example because a new filter was inserted) */
    protected outputDimensionsValid: boolean;
    protected gl: WebGL2RenderingContext;

    /**
     * When using RGBA input, this is the only relevant input texture.
     *
     * When using YUV420P input, this is the Y plane. It's resolution is identical to the
     * full video resolution.
     */
    protected inputTex0: GlTexture | null;

    /**
     * When using YUV420P input, this is the U plane. In 420 mode its resolution is half along
     * both dimensions (the number of values is quater the number of image pixels)
     */
    protected inputTex1: GlTexture | null;
    /**
     * When using YUV420P input, this is the V plane. In 420 mode its resolution is half along
     * both dimensions (the number of values is quater the number of image pixels)
     */
    protected inputTex2: GlTexture | null;

    protected yuvToRgbShader: PlanarYuvToRgbShader;
    protected yuvToRgbOutput: RenderTexture;

    protected rgbToYShader: RgbToYShader;
    protected rgbToUShader: RgbToUShader;
    protected rgbToVShader: RgbToVShader;
    protected rgbToYOutput: RenderTexture;
    protected rgbToUOutput: RenderTexture;
    protected rgbToVOutput: RenderTexture;

    protected pixelDataValid: boolean;
    protected pixelData: AlignedPixelData;

    protected lastRt: RenderTexture | null;

    protected dimensionChangeListeners: Set<DimensionChangeListener>;

    //copyToCpu: boolean;

    /**
     * Each filter pipeline is associated with a specific <canvas> object. This
     * is due to the fact that textures, shaders, and such have to be created within
     * a particular WebGL context and such object cannot be shared across webgl contexts.
     *
     * Construct the filter manager and register all filters before passing it to
     * this constructor.
     * This strange architecture is to make sure that each pipeline
     * creates a new set of filters on construction which is to make sure
     * that a single pipeline has exclusive ownership over all of its
     * filters.
     *
     */
    constructor(
        filterManager: FilterManager,
        canvas: HTMLCanvasElement,
        filterIds: FilterId[]
    ) {
        this.targetWidth = 1280;
        this.targetHeight = 720;
        this.outputDimensionsValid = false;
        this.filters = [];
        this.filterManager = filterManager;
        //this.copyToCpu = true;
        this.pixelDataValid = false;
        this.pixelData = {
            data: new Uint8Array(0),
            linesize: 0,
            w: 0,
            h: 0,
        };
        this.lastRt = null;
        this.dimensionChangeListeners = new Set();
        let gl = canvas.getContext("webgl2");
        if (!gl) {
            throw new Error("FATAL: Requested webgl context was null.");
        }
        this.gl = gl;
        this.inputTex0 = null;
        this.inputTex1 = null;
        this.inputTex2 = null;
        this.yuvToRgbShader = new PlanarYuvToRgbShader(this.gl);
        this.yuvToRgbOutput = new RenderTexture(this.gl, gl.RGBA);
        this.rgbToYShader = new RgbToYShader(this.gl);
        this.rgbToUShader = new RgbToUShader(this.gl);
        this.rgbToVShader = new RgbToVShader(this.gl);
        this.rgbToYOutput = new RenderTexture(this.gl, gl.R8);
        this.rgbToUOutput = new RenderTexture(this.gl, gl.R8);
        this.rgbToVOutput = new RenderTexture(this.gl, gl.R8);
        for (const id of filterIds) {
            this.filters.push({
                id: id,
                filter: filterManager.createFilter(id, this.gl),
                active: false,
            });
        }
    }

    addDimensionChangeListener(listener: DimensionChangeListener) {
        this.dimensionChangeListeners.add(listener);
    }

    removeDimensionChangeListener(listener: DimensionChangeListener) {
        this.dimensionChangeListeners.delete(listener);
    }

    setTargetDimensions(width: number, height: number) {
        this.targetWidth = width;
        this.targetHeight = height;
    }

    /** Returns the output resolution of the last filter */
    updateDimensions(): [number, number] {
        if (this.inputTex0 === null) {
            throw new Error(
                "Cannot update the dimensions at this point, because the input texture was not yet initialized"
            );
        }
        let prevOutW = this.inputTex0.width;
        let prevOutH = this.inputTex0.height;
        let targetDim: TargetDimensions = {
            width: this.targetWidth,
            height: this.targetHeight,
        };
        for (const filter of this.filters) {
            if (filter.active) {
                let [outW, outH] = filter.filter.updateDimensions(
                    prevOutW,
                    prevOutH,
                    targetDim
                );
                prevOutW = outW;
                prevOutH = outH;
            }
        }
        console.log(
            "Finished updating the pipeline dimensions",
            prevOutW,
            prevOutH,
            "aspect:",
            prevOutW / prevOutH
        );
        for (const listener of this.dimensionChangeListeners) {
            listener(prevOutW, prevOutH);
        }
        return [prevOutW, prevOutH];
    }

    getTargetDimensions(): [number, number] {
        return [this.targetWidth, this.targetHeight];
    }

    getRealOutputDimensions(imgSource: HTMLVideoElement | PackedPixelData): [number, number] {
        let [inWidth, inHeight] = FilterPipeline.getImgSrcDimensions(imgSource);
        this.updateVideoSize(inWidth, inHeight);
        return this.updateDimensions();
    }

    getFilters(): readonly FilterDesc[] {
        return this.filters;
    }

    /**
     * Instantiates the named filter and inserts it into the pipeline.
     * @param index Where to put the filter in order of execution. If this is 0 the filter will be the first to get applied.
     * @param id An identifier for a filtered registered with the filter manager.
     */
    insertFilter(index: number, id: FilterId) {
        let newFilter = this.filterManager.createFilter(id, this.gl);
        this.filters.splice(index, 0, { id: id, filter: newFilter, active: true });
        this.outputDimensionsValid = false;
    }

    /**
     * Rearranges the sequence of filters to match the sequence specified by the parameter.
     *
     * @param indicies Each element in this array is an index of a specific filter in this pipeline.
     * These filter indicies are identical to the indicies of the filters in the array returned by
     * `getFilters`. The length of this parameter must match the number of filters in this pipeline.
     */
    setOrder(indicies: number[]) {
        let newFilters = [];
        for (let i = 0; i < indicies.length; i++) {
            const oldIndex = indicies[i];
            newFilters.push(this.filters[oldIndex]);
        }
        this.filters = newFilters;
        this.outputDimensionsValid = false;
    }

    /**
     *
     * @param active The `n`th element in this array specifies whether the `n`th filter should be active
     */
    setActive(active: boolean[]) {
        for (let i = 0; i < active.length; i++) {
            this.filters[i].active = active[i];
        }
        this.outputDimensionsValid = false;
    }

    /**
     * Replace the existing set of filters with the one provided as an argument.
     *
     * Note that existing filters that are also within the `ids` list are retained.
     */
    setFilters(ids: FilterId[]) {
        let existing = new Map<FilterId, FilterDesc>();
        for (const f of this.filters) {
            existing.set(f.id, f);
        }
        let newFilters = [];
        for (const id of ids) {
            let filterDesc = existing.get(id);
            if (filterDesc) {
                existing.delete(id);
            } else {
                let f = this.filterManager.createFilter(id, this.gl);
                filterDesc = {
                    id: id,
                    filter: f,
                    active: false,
                };
            }
            newFilters.push(filterDesc);
        }
        // Delete the ones that are not needed anymore.
        for (const f of existing.values()) {
            f.filter.dispose();
        }
        this.filters = newFilters;
        this.outputDimensionsValid = false;
    }

    /**
     * Applies the first filter to the video, and then every filter in sequence
     * to the output of the previous.
     *
     * @param video The video to which the filters should be applied
     */
    execute(imgSource: HTMLVideoElement | PackedPixelData) {
        let gl = this.gl;

        let [inWidth, inHeight] = FilterPipeline.getImgSrcDimensions(imgSource);

        // The assignment wouldn't be necessary, we just do this to tell the compiler
        // that `this.videoAsTexture` is set to some non-null value.
        this.inputTex0 = this.updateVideoSize(inWidth, inHeight);

        let prevOutput: WebGLTexture = this.inputTex0.texture;

        if (isPackedPixelData(imgSource)) {
            if (imgSource.format === ImageFormat.RGBA) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.inputTex0.texture);
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    inWidth,
                    inHeight,
                    0,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    imgSource.data
                );
            } else if (imgSource.format === ImageFormat.YUV420P) {
                this.updateYuvSource(imgSource);

                // Convert from YUV to RGBA
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.yuvToRgbOutput.framebuffer);
                gl.viewport(0, 0, this.yuvToRgbOutput.width, this.yuvToRgbOutput.height);
                this.yuvToRgbShader.draw(gl);
                this.lastRt = this.yuvToRgbOutput;
                prevOutput = this.yuvToRgbOutput.color;
            }
        } else {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.inputTex0.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgSource);
        }
        for (const { filter, active } of this.filters) {
            if (active) {
                this.lastRt = filter.execute(prevOutput);
                prevOutput = this.lastRt.color;
            }
        }
        this.pixelDataValid = false;
        return prevOutput;
    }

    public static getImgSrcDimensions(
        imgSource: HTMLVideoElement | PackedPixelData
    ): [number, number] {
        let inWidth: number;
        let inHeight: number;
        if (isPackedPixelData(imgSource)) {
            inWidth = imgSource.w;
            inHeight = imgSource.h;
        } else {
            inWidth = imgSource.videoWidth;
            inHeight = imgSource.videoHeight;
        }
        return [inWidth, inHeight];
    }

    /**
     * Uploads the data from imgSource into inputTex0, inputTex1, and inputTex2
     *
     * And also binds the correspongind textures to TEXTURE0, TEXTURE1, and TEXTURE2 respectively
     */
    protected updateYuvSource(imgSource: PackedPixelData) {
        if (!this.inputTex0) {
            throw new Error("The input texture must be non null at this point");
        }
        if (imgSource.format !== ImageFormat.YUV420P) {
            throw new Error("The source image format must be YUV420P here");
        }
        let inWidth = imgSource.w;
        let inHeight = imgSource.h;

        let gl = this.gl;
        this.yuvToRgbOutput.ensureDimensions(inWidth, inHeight);
        // Luma (Y) has w * h values, and both U and V have `w/2 * h/2` values
        let halfW = Math.floor(inWidth / 2);
        let halfH = Math.floor(inHeight / 2);

        ///////////////////////////////////////////////////////////////////
        // Y channel
        ///////////////////////////////////////////////////////////////////
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.inputTex0.texture);
        let dataY = imgSource.data.subarray(0, inWidth * inHeight);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.LUMINANCE,
            inWidth,
            inHeight,
            0,
            gl.LUMINANCE,
            gl.UNSIGNED_BYTE,
            dataY
        );

        ///////////////////////////////////////////////////////////////////
        // U channel
        ///////////////////////////////////////////////////////////////////
        if (this.inputTex1 === null) {
            this.inputTex1 = this.createInputTexture(halfW, halfH, gl.TEXTURE1);
        }
        // Update the size in case it was already initialized but the size changed
        this.inputTex1 = {
            width: halfW,
            height: halfH,
            texture: this.inputTex1.texture,
        };
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.inputTex1.texture);
        let offsetU = dataY.byteLength;
        let dataU = imgSource.data.subarray(offsetU, offsetU + halfW * halfH);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.LUMINANCE,
            halfW,
            halfH,
            0,
            gl.LUMINANCE,
            gl.UNSIGNED_BYTE,
            dataU
        );

        ///////////////////////////////////////////////////////////////////
        // V channel
        ///////////////////////////////////////////////////////////////////
        if (this.inputTex2 === null) {
            this.inputTex2 = this.createInputTexture(halfW, halfH, gl.TEXTURE2);
        }
        // Update the size in case it was already initialized but the size changed
        this.inputTex2 = {
            width: halfW,
            height: halfH,
            texture: this.inputTex2.texture,
        };
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.inputTex2.texture);
        let offsetV = dataU.byteOffset + dataU.byteLength; // V comes after U
        let dataV = imgSource.data.subarray(offsetV, offsetV + halfW * halfH);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.LUMINANCE,
            halfW,
            halfH,
            0,
            gl.LUMINANCE,
            gl.UNSIGNED_BYTE,
            dataV
        );
    }

    protected updateVideoSize(inWidth: number, inHeight: number): GlTexture {
        if (this.inputTex0 === null) {
            this.inputTex0 = this.createInputTexture(inWidth, inHeight, this.gl.TEXTURE0);
            this.updateDimensions();
        } else if (inWidth != this.inputTex0.width || inHeight != this.inputTex0.height) {
            this.inputTex0 = {
                width: inWidth,
                height: inHeight,
                texture: this.inputTex0.texture,
            };
            this.updateDimensions();
        } else if (!this.outputDimensionsValid) {
            this.updateDimensions();
            this.outputDimensionsValid = true;
        }
        return this.inputTex0;
    }

    protected createInputTexture(w: number, h: number, attachmentPoint: number): GlTexture {
        let gl = this.gl;
        let tex = gl.createTexture();
        if (!tex) {
            throw new Error("Could not create texture");
        }
        gl.activeTexture(attachmentPoint);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        // On webgl1, if the wrap is not set to CLAMP_TO_EDGE then non-power-of-two textures
        // are not allowed. Otherwise it won't give an error, it'll just give all black pixels.
        // but we are using webgl2 so this doesn't affect this code.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        return {
            width: w,
            height: h,
            texture: tex,
        };
    }

    /**
     * @param linesize The number of bytes to go from the beggining of a row to the begginig of
     * the next. Also known as stride or pitch. See: https://docs.microsoft.com/en-us/windows/win32/medfound/image-stride
     *
     * This corresponds to `PACK_ROW_LENGTH` for the `readPixels` operation HOWEVER it's not the
     * same value. `PACK_ROW_LENGTH` is measured in pixels while `linesize` is measured in bytes.
     * Thererfore, here `linesize` must be a multiple of 4 (which is the size of a pixel in bytes).
     *
     * If specified, the RED component of the pixel at (x, y) can be accessed by indexing
     * the result with `y*linesize + x*4`. Otherwise it's `(y*width + x)*4`
     */
    public getRgbaPixelData(linesize?: number): AlignedPixelData | null {
        if (!this.pixelDataValid) {
            linesize = linesize || 0;
            if (!this.lastRt) {
                // TODO: allow having no active filter
                console.error(
                    "Trying to copy to CPU, so there has to be at least one filter active. TODO: allow having no active filter."
                );
                return null;
            }
            let w = this.lastRt.width;
            let h = this.lastRt.height;
            if (linesize === 0) {
                linesize = w * 4;
            }
            let targetBufferSize = h * linesize;
            if (targetBufferSize != this.pixelData.data.length) {
                this.pixelData = {
                    data: new Uint8Array(targetBufferSize),
                    linesize: linesize,
                    w: w,
                    h: h,
                };
            }
            this.fillRgbaPixelData(this.pixelData);
            this.pixelDataValid = true;
        }
        return this.pixelData;
    }

    /**
     * Just like `getPixelData` but it fills an already allocated buffer
     * rather than creating a buffer.
     */
    public fillRgbaPixelData(buffer: AlignedPixelData) {
        if (buffer.linesize % 4 != 0) {
            throw new Error(
                "`linesize` was not a multiple of 4. Note `linesize` has to be specified in bytes and each pixel is 4 bytes."
            );
        }
        let gl = this.gl;
        if (!this.lastRt) {
            // TODO: allow having no active filter
            console.error(
                "Trying to copy to CPU, so there has to be at least one filter active. TODO: allow having no active filter."
            );
            return;
        }
        let prevActiveFb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.lastRt.framebuffer);
        let w = this.lastRt.width;
        let h = this.lastRt.height;
        if (buffer.w != w || buffer.h != h) {
            throw new Error(
                `The target buffer dimensions must match the framebuffer dimensions. Target buffer (${buffer.w}, ${buffer.h}). Framebuffer (${w}, ${h})`
            );
        }
        if (buffer.linesize > 0 && w * 4 > buffer.linesize) {
            throw new Error(
                "The width of the image was larger than `linesize` which is invalid. Note `linesize` has to be specified in bytes and each pixel is 4 bytes."
            );
        }
        let prevRowLength = gl.getParameter(gl.PACK_ROW_LENGTH);
        gl.pixelStorei(gl.PACK_ROW_LENGTH, buffer.linesize / 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buffer.data);
        gl.pixelStorei(gl.PACK_ROW_LENGTH, prevRowLength);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prevActiveFb);
    }

    /**
     * Fills the provided buffer with YUV420P pixel data.
     *
     * This means that the first `w*h` bytes will all be Y channel values.
     *
     * The next `w/2 * h/2` bytes will all be U channel values.
     * The final `w/2 * h/2` bytes will all be V channel values.
     */
    public async fillYuv420pPixelData(buffer: PackedPixelData): Promise<void> {
        if (!this.lastRt) {
            throw new Error(
                "Trying to copy to CPU, but no rendertarget was found that was written to."
            );
        }
        if (this.lastRt.width % 2 != 0) {
            throw new Error(
                "The width of the last render target was not an even number. Can't export to yuv420. Width was " +
                    this.lastRt.width
            );
        }
        if (this.lastRt.height % 2 != 0) {
            throw new Error(
                "The height of the last render target was not an even number. Can't export to yuv420. Height was " +
                    this.lastRt.height
            );
        }
        let w = this.lastRt.width;
        let h = this.lastRt.height;
        let halfW = w / 2;
        let halfH = h / 2;

        let targetByteCount = w * h + 2 * (halfW * halfH);
        console.log(`Filter pipline. targetByteCount: ${targetByteCount}. Buffer length: ${buffer.data.byteLength}`);
        if (targetByteCount !== buffer.data.byteLength) {
            // TODO: Should this be an exception? If the readPixels function allocates the buffer
            // than we don't even need to warn about it. But if the buffer must be already allocated
            // than we should probably throw an exception here.
            console.warn(
                "The target buffer was not of the expected size for YUV data. Expected " +
                    targetByteCount +
                    ", got " +
                    buffer.data.byteLength
            );
        }
        if (w !== buffer.w) {
            throw new Error("The target buffer width does not match the framebuffer width");
        }
        if (h !== buffer.h) {
            throw new Error("The target buffer height does not match the framebuffer height");
        }

        let gl = this.gl;

        let start = new Date().getTime();
        // this.renderRtToYuv(this.lastRt);

        this.updateYuv420pOutputSize(this.lastRt.width, this.lastRt.height);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.lastRt.color);

        // Render Y
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rgbToYOutput.framebuffer);
        gl.viewport(0, 0, this.rgbToYOutput.width, this.rgbToYOutput.height);
        this.rgbToYShader.draw(gl);

        // let elapsed = new Date().getTime() - start;
        // console.log("renderRtToY", elapsed);

        let prevActiveFb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
        let prevRowLength = gl.getParameter(gl.PACK_ROW_LENGTH);
        // Pack rows tightly after each other
        gl.pixelStorei(gl.PACK_ROW_LENGTH, 0);

        // Just before we start reading the pixels, lets give some time for other stuff to execute
        await setImmedateAsync();

        let dataY = buffer.data.subarray(0, w * h);
        // console.log("Y size", dataY.byteLength);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.rgbToYOutput.framebuffer);
        // Even thought the single channel texture format is R8, the single channel framebuffer
        // read format is RED. (Those two values may not be the same)
        start = new Date().getTime();
        gl.readPixels(0, 0, w, h, gl.RED, gl.UNSIGNED_BYTE, dataY);
        // elapsed = new Date().getTime() - start;
        // console.log("readPixels dataY", elapsed);

        // await setImmedateAsync();

        // Render U
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rgbToUOutput.framebuffer);
        gl.viewport(0, 0, this.rgbToUOutput.width, this.rgbToUOutput.height);
        this.rgbToUShader.draw(gl);

        let offsetU = dataY.byteLength;
        let dataU = buffer.data.subarray(offsetU, offsetU + halfW * halfH);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.rgbToUOutput.framebuffer);
        start = new Date().getTime();
        gl.readPixels(0, 0, halfW, halfH, gl.RED, gl.UNSIGNED_BYTE, dataU);
        // elapsed = new Date().getTime() - start;
        // console.log("readPixels dataU", elapsed);

        // await setImmedateAsync();

        // Render V
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rgbToVOutput.framebuffer);
        gl.viewport(0, 0, this.rgbToVOutput.width, this.rgbToVOutput.height);
        this.rgbToVShader.draw(gl);

        let offsetV = dataU.byteOffset + dataU.byteLength;
        let dataV = buffer.data.subarray(offsetV, offsetV + halfW * halfH);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.rgbToVOutput.framebuffer);
        gl.readPixels(0, 0, halfW, halfH, gl.RED, gl.UNSIGNED_BYTE, dataV);

        gl.pixelStorei(gl.PACK_ROW_LENGTH, prevRowLength);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prevActiveFb);
        buffer.format = ImageFormat.YUV420P;
    }

    protected renderRtToYuv(rt: RenderTexture) {
        let gl = this.gl;

        this.updateYuv420pOutputSize(rt.width, rt.height);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, rt.color);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rgbToYOutput.framebuffer);
        gl.viewport(0, 0, this.rgbToYOutput.width, this.rgbToYOutput.height);
        this.rgbToYShader.draw(gl);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rgbToUOutput.framebuffer);
        gl.viewport(0, 0, this.rgbToUOutput.width, this.rgbToUOutput.height);
        this.rgbToUShader.draw(gl);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rgbToVOutput.framebuffer);
        gl.viewport(0, 0, this.rgbToVOutput.width, this.rgbToVOutput.height);
        this.rgbToVShader.draw(gl);
    }

    protected updateYuv420pOutputSize(w: number, h: number) {
        if (w % 2 != 0) {
            throw new Error(
                "Tried to set the yuv buffer sizes according to yuv420p but the width was not even: " +
                    w
            );
        }
        if (h % 2 != 0) {
            throw new Error(
                "Tried to set the yuv buffer sizes according to yuv420p but the height was not even: " +
                    h
            );
        }
        this.rgbToYOutput.ensureDimensions(w, h);
        this.rgbToUOutput.ensureDimensions(w / 2, h / 2);
        this.rgbToVOutput.ensureDimensions(w / 2, h / 2);
    }
}
