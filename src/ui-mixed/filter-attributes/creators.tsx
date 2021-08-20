import * as React from "react";
import { FilterAttributes, FilterAttributeBinding } from "./filter-attributes";
import { GrayscaleFilter } from "../../filters/grayscale";
import { Conv360To2DFilter } from "../../filters/conv360to2d";
import { CartoonFilter } from "../../filters/cartoon";

export function GrayscaleAttribsCreator(filter: GrayscaleFilter): JSX.Element {
    return <FilterAttributes filter={filter} attributes={new Map()}></FilterAttributes>;
}

export function CartoonAttribsCreator(filter: CartoonFilter): JSX.Element {
    let attributes = new Map<string, FilterAttributeBinding<CartoonFilter>>();
    attributes.set("Outline Intensity", {
        getter: (f) => filter.edgeIntensity,
        setter: (f, v) => {
            f.edgeIntensity = v;
        },
        minValue: 0,
        maxValue: 1,
    });
    return <FilterAttributes filter={filter} attributes={attributes}></FilterAttributes>;
}

export function Conv360To2DAttribsCreator(filter: Conv360To2DFilter): JSX.Element {
    let attributes = new Map<string, FilterAttributeBinding<Conv360To2DFilter>>();

    attributes.set("Vertical Field of View (radians)", {
        getter: (f) => f.fovY,
        setter: (f, v) => {
            f.fovY = v;
        },
        minValue: 0,
        maxValue: Math.PI,
    });
    attributes.set("Yaw", {
        getter: (f) => f.rotUp,
        setter: (f, v) => {
            // This mess below ensures that the value wraps around when it reaches -PI or PI
            let sign = Math.sign(v);
            v = Math.abs(v);
            v += Math.PI;
            v = v % (Math.PI * 2);
            v -= Math.PI;
            v *= sign;
            f.rotUp = v;
        },
    });
    attributes.set("Pitch", {
        getter: (f) => f.rotRight,
        setter: (f, v) => {
            f.rotRight = v;
        },
        minValue: -Math.PI * 0.5,
        maxValue: Math.PI * 0.5,
    });

    return <FilterAttributes filter={filter} attributes={attributes}></FilterAttributes>;
}
