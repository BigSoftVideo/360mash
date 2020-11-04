import { Filter } from "electron/main";

export type FilterId = string;

export interface FilterDescriptor {
    /**
     * Unique identifier for this TYPE of filter.
     *
     * This should be a user-friendly string that can be displayed on
     * the ui.
     */
    id: FilterId;

    /**
     * This function should return a new instance of the filter.
     */
    creator: (gl: WebGL2RenderingContext) => FilterBase;
}

//////////////////////
// It's important that each filter pipeline has excusive ownership
// over each of its filters. Two identical filters may be stored in two
// pipelines but the same filter instance must not be. This is because if
// there are two pipelines sharing the same filter instance, they also
// share a single texture for the filter output. If things happen in an
// unlucky order, one pipeline may owerwrite the output of said filter
// before the other could read the filter's output.
////////////////////////
export abstract class FilterBase {
    protected canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    // This should probably not exist. I don't think that cloning
    // WebGL textures is a good idea.
    // Preferred method is to create a new instance of the filter with the
    // constructor
    //clone() {
    // I might end up needing this. In this case a new
    //}

    /**
     * Implementors must create all webgl resources using `this.canvas` in the constructor then
     * `this.canvas` must be used within this function to get the webgl context.
     */
    abstract execute(source: WebGLTexture): WebGLTexture;
}
