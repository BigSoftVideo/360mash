import { FilterBase, FilterId } from "./filter-base";
import { FilterManager } from "./filter-manager";
import { Video } from "./video-manager";
import { GlTexture } from "./core";

export interface FilterDesc {
    id: FilterId;
    filter: FilterBase;
}

/**
 * This class stores a list of filters to apply to a video.
 *
 * Given a video object it applies each filter to the output of the previous
 * and writes the final output to a WebGL texture object
 */
export class FilterPipeline {
    filters: FilterDesc[];
    filterManager: FilterManager;
    gl: WebGL2RenderingContext;

    videoAsTexture: GlTexture | null;

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
        this.filters = [];
        this.filterManager = filterManager;
        let gl = canvas.getContext("webgl2");
        if (!gl) {
            throw new Error("FATAL: Requested webgl context was null.");
        }
        this.gl = gl;
        this.videoAsTexture = null;
        for (const id of filterIds) {
            this.filters.push({
                id: id,
                filter: filterManager.createFilter(id, this.gl),
            });
        }
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
        let newFilter = this.filterManager.createFilter(id, this.gl);
        this.filters.splice(index, 0, { id: id, filter: newFilter });
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
        for (const { filter } of this.filters) {
            prevOutput = filter.execute(prevOutput);
        }
        return prevOutput;
    }
}
