import { FilterBase, FilterId } from "./filter-base";
import { FilterManager } from "./filter-manager";
import { Video } from "./video-manager";
import { GlTexture, RenderTexture } from "./core";

export interface FilterDesc {
    id: FilterId;
    filter: FilterBase;
    active: boolean;
}

/**
 * Each value in data is the value of a single chanel of a single pixel within the image.
 * The order of the channels is (RED, GREEN, BLUE, ALPHA). Each channel takes up a single byte
 * so each pixel takes up 4 bytes.
 * 
 * To access the first channel (RED) of the pixel at (x, y) index the `data`
 * field with `y*linesize + x*4`
 */
export interface PixelData {
    data: Uint8Array;

    /** Size of each row in BYTES. See the documentation for `PixelData` for more */
    linesize: number;
    w: number;
    h: number;
}

/**
 * This class stores a list of filters to apply to a video.
 *
 * Given a video object it applies each filter to the output of the previous
 * and writes the final output to a WebGL texture object
 */
export class FilterPipeline {
    protected filters: FilterDesc[];
    protected filterManager: FilterManager;
    protected outWidth: number;
    protected outHeight: number;
    protected gl: WebGL2RenderingContext;

    protected videoAsTexture: GlTexture | null;

    protected pixelDataValid: boolean;
    protected pixelData: PixelData;

    protected lastRt: RenderTexture | null;

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
        this.outWidth = 1280;
        this.outHeight = 720;
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
        let gl = canvas.getContext("webgl2");
        if (!gl) {
            throw new Error("FATAL: Requested webgl context was null.");
        }
        this.gl = gl;
        this.videoAsTexture = null;
        for (const id of filterIds) {
            this.filters.push({
                id: id,
                filter: filterManager.createFilter(id, this.gl, this.outWidth, this.outHeight),
                active: true,
            });
        }
    }

    setOutputDimensions(width: number, height: number) {
        this.outWidth = width;
        this.outHeight = height;
        for (const filter of this.filters) {
            filter.filter.setOutputDimensions(width, height);
        }
    }

    getOutputDimensions(): [number, number] {
        return [this.outWidth, this.outHeight];
    }

    getFilters(): FilterId[] {
        return this.filters.map((desc) => desc.id);
    }

    /**
     * Instantiates the named filter and inserts it into the pipeline.
     * @param index Where to put the filter in order of execution. If this is 0 the filter will be the first to get applied.
     * @param id An identifier for a filtered registered with the filter manager.
     */
    insertFilter(index: number, id: FilterId) {
        let newFilter = this.filterManager.createFilter(id, this.gl, this.outWidth, this.outHeight);
        this.filters.splice(index, 0, { id: id, filter: newFilter, active: true });
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
    }

    /**
     * 
     * @param active The `n`th element in this array specifies whether the `n`th filter should be active
     */
    setActive(active: boolean[]) {
        for (let i = 0; i < active.length; i++) {
            this.filters[i].active = active[i];
        }
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
                let f = this.filterManager.createFilter(id, this.gl, this.outWidth, this.outHeight);
                filterDesc = {
                    id: id,
                    filter: f,
                    active: true
                };
            }
            newFilters.push(filterDesc);
        }
        // Delete the ones that are not needed anymore.
        for (const f of existing.values()) {
            f.filter.dispose();
        }
        this.filters = newFilters;
    }

    /**
     * Applies the first filter to the video, and then every filter in sequence
     * to the output of the previous.
     *
     * @param video The video to which the filters should be applied
     */
    execute(video: Video) {
        let gl = this.gl;
        let videoTex = this.videoAsTexture;
        let htmlVideo = video.htmlVideo;
        let videoW = htmlVideo.videoWidth;
        let videoH = htmlVideo.videoHeight;
        if (videoTex === null) {
            let tex = gl.createTexture();
            if (!tex) {
                throw new Error("Could not create texture");
            }
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            // On webgl1, if the wrap is not set to CLAMP_TO_EDGE then non-power-of-two textures
            // are not allowed. Otherwise it won't give an error, it'll just give all black pixels.
            // but we are using webgl2 so this doesn't affect this code.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            videoTex = {
                width: htmlVideo.videoWidth,
                height: htmlVideo.videoHeight,
                texture: tex,
            };
            this.videoAsTexture = videoTex;
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTex.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video.htmlVideo);
        let prevOutput: WebGLTexture = videoTex.texture;
        for (const { filter, active } of this.filters) {
            if (active) {
                this.lastRt = filter.execute(prevOutput);
                prevOutput = this.lastRt.color;
            }
        }
        this.pixelDataValid = false;
        return prevOutput;
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
    public getPixelData(linesize?: number): PixelData | null {
        if (!this.pixelDataValid) {
            linesize = linesize || 0;
            if (!this.lastRt) {
                // TODO: allow having no active filter
                console.error("Trying to copy to CPU, so there has to be at least one filter active. TODO: allow having no active filter.");
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
            this.fillPixelData(this.pixelData);
            this.pixelDataValid = true;
        }
        return this.pixelData;
    }

    /**
     * Just like `getPixelData` but it fills an already allocated buffer
     * rather than creating a buffer.
     */
    public fillPixelData(buffer: PixelData) {
        if (buffer.linesize % 4 != 0) {
            throw new Error("`linesize` was not a multiple of 4. Note `linesize` has to be specified in bytes and each pixel is 4 bytes.");
        }
        let gl = this.gl;
        if (!this.lastRt) {
            // TODO: allow having no active filter
            console.error("Trying to copy to CPU, so there has to be at least one filter active. TODO: allow having no active filter.");
            return null;
        }
        let prevActiveFb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.lastRt.framebuffer);
        let w = this.lastRt.width;
        let h = this.lastRt.height;
        if (buffer.w != w || buffer.h != h) {
            throw new Error(`The target buffer dimensions must match the framebuffer dimensions. Target buffer (${buffer.w}, ${buffer.h}). Framebuffer (${w}, ${h})`);
        }
        if (buffer.linesize > 0 && (w*4) > buffer.linesize) {
            throw new Error("The width of the image was larger than `linesize` which is invalid. Note `linesize` has to be specified in bytes and each pixel is 4 bytes.");
        }
        gl.pixelStorei(gl.PACK_ROW_LENGTH, buffer.linesize / 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buffer.data);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prevActiveFb);
    }
}
