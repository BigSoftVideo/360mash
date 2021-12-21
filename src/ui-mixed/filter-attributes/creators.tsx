import "./creator.css";

import * as React from "react";
import {
    FilterAttributes,
    FilterAttributeBinding,
    FilterAttributeKind,
} from "./filter-attributes";
import { GrayscaleFilter } from "../../filters/grayscale";
import { Conv360ShaderKind, Conv360To2DFilter } from "../../filters/conv360to2d";
import { CartoonFilter } from "../../filters/cartoon";
import { NewsPrintFilter } from "../../filters/newsprint";
import { CharcoalFilter } from "../../filters/charcoal";
import { PaintingFilter } from "../../filters/painting";
import { BAndCFilter } from "../../filters/bandc";
import { AspectRatioFitter } from "../../ui-presentational/aspect-ratio-fitter/aspect-ratio-fitter";
import { PreviewPanelProps } from "../preview-panel/preview-panel";

export function GrayscaleAttribsCreator(filter: GrayscaleFilter): JSX.Element {
    let attributes = new Map<string, FilterAttributeBinding<GrayscaleFilter>>();
    return <FilterAttributes filter={filter} attributes={attributes}></FilterAttributes>;
}

export function BAndCAttribsCreator(filter: BAndCFilter): JSX.Element {
    let attributes = new Map<string, FilterAttributeBinding<BAndCFilter>>();
    attributes.set("Brightness", {
        getter: (f) => filter.brightness,
        setter: (f, v) => {
            f.brightness = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: -0.5,
        maxValue: 0.5,
    });
    attributes.set("Contrast", {
        getter: (f) => filter.contrast,
        setter: (f, v) => {
            f.contrast = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: 0.1,
        maxValue: 2.5,
    });
    attributes.set("Saturation", {
        getter: (f) => filter.saturation,
        setter: (f, v) => {
            f.saturation = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: 0,
        maxValue: 2.5,
    });
    attributes.set("Temperature", {
        getter: (f) => filter.temperature,
        setter: (f, v) => {
            f.temperature = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: -1,
        maxValue: 1,
    });
    attributes.set("Tint", {
        getter: (f) => filter.tint,
        setter: (f, v) => {
            f.tint = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: -1,
        maxValue: 1,
    });
    return <FilterAttributes filter={filter} attributes={attributes}></FilterAttributes>;
}

export function PaintingAttribsCreator(filter: PaintingFilter): JSX.Element {
    let attributes = new Map<string, FilterAttributeBinding<PaintingFilter>>();
    attributes.set("Intensity", {
        getter: (f) => filter.intensity,
        setter: (f, v) => {
            f.intensity = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: 1,
        maxValue: 4,
    });
    attributes.set("Radius", {
        getter: (f) => filter.radius,
        setter: (f, v) => {
            f.radius = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: 0.1,
        maxValue: 5,
    });
    return <FilterAttributes filter={filter} attributes={attributes}></FilterAttributes>;
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
    attributes.set("Color Count", {
        getter: (f) => filter.colorCount,
        setter: (f, v) => {
            f.colorCount = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: 0.1,
        maxValue: 17,
    });
    attributes.set("Brightness Count", {
        getter: (f) => filter.brightCount,
        setter: (f, v) => {
            f.brightCount = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: 2,
        maxValue: 15,
    });
    return <FilterAttributes filter={filter} attributes={attributes}></FilterAttributes>;
}

export function NewsPrintAttribsCreator(filter: NewsPrintFilter): JSX.Element {
    let attributes = new Map<string, FilterAttributeBinding<NewsPrintFilter>>();
    attributes.set("Scaling", {
        getter: (f) => filter.scale,
        setter: (f, v) => {
            f.scale = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: 0,
        maxValue: 1.5,
    });
    attributes.set("Angle", {
        getter: (f) => filter.angle,
        setter: (f, v) => {
            f.angle = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: 0.1,
        maxValue: 3.5,
    });
    attributes.set("Brightness", {
        getter: (f) => filter.brightness,
        setter: (f, v) => {
            f.brightness = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: 8.0,
        maxValue: 12.0,
    });
    return <FilterAttributes filter={filter} attributes={attributes}></FilterAttributes>;
}

export function CharcoalAttribsCreator(filter: CharcoalFilter): JSX.Element {
    let attributes = new Map<string, FilterAttributeBinding<CharcoalFilter>>();
    attributes.set("Intensity", {
        getter: (f) => filter.intensity,
        setter: (f, v) => {
            f.intensity = v;
        },
        kind: FilterAttributeKind.Number,
        minValue: 0.1,
        maxValue: 10.0,
    });
    attributes.set("Inverse", {
        getter: (f) => filter.inverse,
        setter: (f, v) => {
            f.inverse = v;
        },
        kind: FilterAttributeKind.Bool,
    });
    return <FilterAttributes filter={filter} attributes={attributes}></FilterAttributes>;
}

export function Conv360To2DAttribsCreator(filter: Conv360To2DFilter): JSX.Element {
    return <Conv360To2DAttributes filter={filter}></Conv360To2DAttributes>;
}

class Conv360To2DAttributes extends React.Component<{ filter: Conv360To2DFilter}> {
    readonly attributes: Map<string, FilterAttributeBinding<Conv360To2DFilter>>;
    protected canvasRefSet: (canvas: HTMLCanvasElement) => void;
    rootDiv: React.RefObject<HTMLDivElement>;
    canvas: React.RefObject<HTMLCanvasElement>;
    canvasElement: HTMLCanvasElement | null;
    
    dragging: boolean;
    mouseDown: (event: MouseEvent) => void;
    mouseUp: (event: MouseEvent) => void;
    mouseMove: (event: MouseEvent) => void;
    mouseWheel: (event: WheelEvent) => void;
    aspectFitterRef: React.RefObject<AspectRatioFitter>;

    constructor(props: any) {
        super(props);

        this.aspectFitterRef = React.createRef();
        this.rootDiv = React.createRef();
        this.canvas = React.createRef();
        this.dragging = false;
        this.canvasElement = null;

        this.canvasRefSet = (canvas: HTMLCanvasElement) => {
            if (this.canvasElement !== canvas) {
                if (this.canvasElement !== null) {
                    console.error("FATAL: The canvas must not change.");
                    throw new Error("FATAL: The canvas must not change.");
                }
                this.canvasElement = canvas;
            }
        };

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
            ],
        });
        // this.attributes.set("Vertical Field of View (radians)", {
        //     getter: (f) => f.fovY,
        //     setter: (f, v) => {
        //         f.fovY = v;
        //     },
        //     kind: FilterAttributeKind.Number,
        //     minValue: 0,
        //     maxValue: Math.PI,
        // });
        // this.attributes.set("Yaw", {
        //     getter: (f) => f.rotUp,
        //     setter: (f, v) => {
        //         this.setRotUp(v);
        //     },
        //     kind: FilterAttributeKind.Number,
        // });
        // this.attributes.set("Pitch", {
        //     getter: (f) => f.rotRight,
        //     setter: (f, v) => {
        //         f.rotRight = v;
        //     },
        //     kind: FilterAttributeKind.Number,
        //     minValue: -Math.PI * 0.5,
        //     maxValue: Math.PI * 0.5,
        // });
    }

    componentDidMount() {
        this.resized();
        if (this.canvasElement) {
            this.props.filter.previewCanvas = this.canvasElement;
        }
        window.addEventListener("mouseup", this.mouseUp);
        window.addEventListener("mousemove", this.mouseMove);
    }

    componentDidUpdate() {
        this.resized();
    }

    componentWillUnmount() {}

    render() {
        return (
            <div ref={this.rootDiv} className="conv360-to-2d-attribs-root">
                <FilterAttributes
                    filter={this.props.filter}
                    attributes={this.attributes}
                ></FilterAttributes>
                <div className="preview-attrib-3d-container">
                    <AspectRatioFitter
                        ref={this.aspectFitterRef}
                        aspectRatio={this.getAspectRatio()}>
                        <canvas
                            className="conv360-to-2d-attrib-video-prev"
                            ref={this.canvasRefSet}
                            onMouseDown={(ev) => this.mouseDown(ev.nativeEvent)}
                            onWheel={(ev) => this.mouseWheel(ev.nativeEvent)}
                        ></canvas>
                    </AspectRatioFitter>
                </div>
            </div>
        );
    }

    getAspectRatio() {
        if (this.canvasElement) {
            return this.canvas.current.width / this.canvas.current.height;
        }       
        return 1;
    }
    
    resized() {
        if (this.aspectFitterRef.current) {
            this.aspectFitterRef.current.resized();
        }
        if (this.canvasElement) {
            let canvas = this.canvasElement;
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.width / this.getAspectRatio();
        }
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
