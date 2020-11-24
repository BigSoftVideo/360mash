
import * as React from "react";
import { FilterAttributes, FilterAttributeBinding } from "./filter-attributes";
import { GrayscaleFilter } from "../../filters/grayscale";
import { Conv360To2DFilter } from "../../filters/conv360to2d";

export function GrayscaleAttribsCreator(filter: GrayscaleFilter): JSX.Element {
    return <FilterAttributes filter={filter} attributes={new Map()}></FilterAttributes>;
}

export function Conv360To2DAttribsCreator(filter: Conv360To2DFilter): JSX.Element {
    let attributes = new Map<string, FilterAttributeBinding<Conv360To2DFilter>>();

    attributes.set(
        "Vertical Field of View (radians)",
        {
            getter: f => f.fovY,
            setter: (f, v) => {
                f.fovY = v;
            }
        }
    );
    attributes.set(
        "Yaw",
        {
            getter: f => f.rotUp,
            setter: (f, v) => {
                f.rotUp = v;
            }
        }
    );
    attributes.set(
        "Pitch",
        {
            getter: f => f.rotRight,
            setter: (f, v) => {
                f.rotRight = v;
            }
        }
    );

    return (
        <FilterAttributes filter={filter} attributes={attributes}></FilterAttributes>
    );
}
