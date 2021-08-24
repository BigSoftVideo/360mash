import "./creator.css";

import * as React from "react";
import { FilterAttributes, FilterAttributeBinding, FilterAttributeKind } from "./filter-attributes";
import { GrayscaleFilter } from "../../filters/grayscale";
import { Conv360ShaderKind, Conv360To2DFilter } from "../../filters/conv360to2d";
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
        kind: FilterAttributeKind.Number,
        minValue: 0,
        maxValue: 1,
    });
    return <FilterAttributes filter={filter} attributes={attributes}></FilterAttributes>;
}

export function Conv360To2DAttribsCreator(filter: Conv360To2DFilter): JSX.Element {
    return <Conv360To2DAttributes filter={filter}></Conv360To2DAttributes>;
}

class Conv360To2DAttributes extends React.Component<{ filter: Conv360To2DFilter }> {
    readonly attributes: Map<string, FilterAttributeBinding<Conv360To2DFilter>>;

    rootDiv: React.RefObject<HTMLDivElement>;
    canvas: React.RefObject<HTMLCanvasElement>;

    dragging: boolean;
    mouseDown: (event: MouseEvent) => void;
    mouseUp: (event: MouseEvent) => void;
    mouseMove: (event: MouseEvent) => void;
    mouseWheel: (event: WheelEvent) => void;

    constructor(props: any) {
        super(props);

        this.rootDiv = React.createRef();
        this.canvas = React.createRef();
        this.dragging = false;

        this.mouseUp = (event) => {
            if (event.button === 0) {
                this.dragging = false;
            }
        };
        this.mouseDown = (event) => {
            if (event.button === 0) {
                this.dragging = true;
            }
        };
        this.mouseMove = (event) => {
            if (this.dragging) {
                let speed = 0.005 * this.props.filter.fovY;

                let rotUp = this.props.filter.rotUp - event.movementX * speed;
                this.setRotUp(rotUp);

                this.props.filter.rotRight -= event.movementY * speed;
                this.forceUpdate();
            }
        };
        this.mouseWheel = (event) => {
            if (event.deltaY > 0) {
                this.props.filter.fovY *= 1 + event.deltaY * 0.002;
            } else {
                this.props.filter.fovY /= 1 + Math.abs(event.deltaY) * 0.002;
            }
            this.forceUpdate();
        };

        this.attributes = new Map<string, FilterAttributeBinding<Conv360To2DFilter>>();
        this.attributes.set("Input", {
            getter: (f) => f.selectedShader,
            setter: (f, v) => {
                f.selectedShader = v;
            },
            kind: FilterAttributeKind.Option,
            optionValues: [
                [Conv360ShaderKind.Equirect360, "360 - Equirectangular"],
                [Conv360ShaderKind.Fisheye180, "180 - Fisheye"],
            ]
        });
        this.attributes.set("Vertical Field of View (radians)", {
            getter: (f) => f.fovY,
            setter: (f, v) => {
                f.fovY = v;
            },
            kind: FilterAttributeKind.Number,
            minValue: 0,
            maxValue: Math.PI,
        });
        this.attributes.set("Yaw", {
            getter: (f) => f.rotUp,
            setter: (f, v) => {
                this.setRotUp(v);
            },
            kind: FilterAttributeKind.Number,
        });
        this.attributes.set("Pitch", {
            getter: (f) => f.rotRight,
            setter: (f, v) => {
                f.rotRight = v;
            },
            kind: FilterAttributeKind.Number,
            minValue: -Math.PI * 0.5,
            maxValue: Math.PI * 0.5,
        });
    }

    componentDidMount() {
        if (this.canvas.current) {
            this.props.filter.previewCanvas = this.canvas.current;
        }
        window.addEventListener("mouseup", this.mouseUp);
        window.addEventListener("mousemove", this.mouseMove);
    }

    componentWillUnmount() {}

    render() {
        return (
            <div
                ref={this.rootDiv}
                className="conv360-to-2d-attribs-root"
            >
                <FilterAttributes
                    filter={this.props.filter}
                    attributes={this.attributes}
                ></FilterAttributes>
                <canvas
                    ref={this.canvas}
                    onMouseDown={(ev) => this.mouseDown(ev.nativeEvent)}
                    onWheel={(ev) => this.mouseWheel(ev.nativeEvent)}
                ></canvas>
            </div>
        );
    }

    protected setRotUp(v: number) {
        // This mess below ensures that the value wraps around when it reaches -PI or PI
        let sign = Math.sign(v);
        v = Math.abs(v);
        v += Math.PI;
        v = v % (Math.PI * 2);
        v -= Math.PI;
        v *= sign;
        this.props.filter.rotUp = v;
    }
}
