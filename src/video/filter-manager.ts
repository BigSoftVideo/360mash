import { FilterBase, FilterDescriptor } from "./filter-base";

/**
 * Keeps record of existing filters and provides them to
 * `FilterPipeline`s.
 */
export class FilterManager {
    filterTypes: Map<string, FilterDescriptor>;

    constructor() {
        this.filterTypes = new Map();
    }

    registerFilter(desc: FilterDescriptor) {
        this.filterTypes.set(desc.id, desc);
    }

    createFilter(filterId: string, gl: WebGL2RenderingContext, outWidth: number, outHeight: number): FilterBase {
        let desc = this.filterTypes.get(filterId);
        if (!desc) {
            throw new Error(`Filter with the following id was not registered: ${filterId}`);
        }
        return desc.creator(gl, outWidth, outHeight);
    }
}
