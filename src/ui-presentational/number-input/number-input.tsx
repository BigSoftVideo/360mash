import "./number-input.css";

import * as React from "react";

export interface NumberInputProps {
    onChanged: (newValue: number) => void;
    value: number;

    minValue?: number;
    maxValue?: number;
}

export class NumberInput extends React.Component<NumberInputProps> {
    mouseDown: (event: MouseEvent) => void;
    mouseUp: (event: MouseEvent) => void;
    mouseMove: (event: MouseEvent) => void;

    mouseEnter: () => void;
    mouseLeave: () => void;
    onKeyDown: (event: KeyboardEvent) => void;
    onKeyUp: (event: KeyboardEvent) => void;

    onDirectChange: (event: React.ChangeEvent<HTMLInputElement>) => void;

    slowModifierDown: boolean;
    mouseInside: boolean;
    mouseDragging: boolean;

    dragStartValue: number;

    constructor(props: any) {
        super(props);

        this.mouseInside = false;
        this.mouseDragging = false;
        this.dragStartValue = 0;
        this.slowModifierDown = false;

        this.mouseDown = (event) => {
            if (this.mouseInside) {
                this.mouseDragging = true;
                this.dragStartValue = this.props.value;
            }
        };
        this.mouseUp = (event) => {
            if (this.mouseDragging) {
                this.mouseDragging = false;
            }
        };
        this.mouseMove = (event) => {
            if (this.mouseDragging) {
                let speedFactor = 0.015;
                if (this.slowModifierDown) {
                    speedFactor = 0.001;
                }
                let dragSpeed =
                    Math.sqrt(Math.max(Math.abs(this.dragStartValue), 0.01)) * speedFactor;
                let newVal = this.props.value - event.movementY * dragSpeed;
                this.props.onChanged(newVal);
            }
        };
        this.mouseEnter = () => {
            this.mouseInside = true;
        };
        this.mouseLeave = () => {
            this.mouseInside = false;
        };
        this.onKeyDown = (e) => {
            if (e.key == "Shift") {
                this.slowModifierDown = true;
            }
        };
        this.onKeyUp = (e) => {
            if (e.key == "Shift") {
                this.slowModifierDown = false;
            }
        };
        this.onDirectChange = (e) => {
            this.props.onChanged(e.target.valueAsNumber);
        };
    }

    componentDidMount() {
        window.addEventListener("mousedown", this.mouseDown);
        window.addEventListener("mouseup", this.mouseUp);
        window.addEventListener("mousemove", this.mouseMove);
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
    }

    componentWillUnmount() {
        window.removeEventListener("mousedown", this.mouseDown);
        window.removeEventListener("mouseup", this.mouseUp);
        window.removeEventListener("mousemove", this.mouseMove);
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
    }

    componentDidUpdate() {
        if (this.props.minValue !== undefined) {
            if (this.props.value < this.props.minValue) {
                this.props.onChanged(this.props.minValue);
            }
        }
        if (this.props.maxValue !== undefined) {
            if (this.props.value > this.props.maxValue) {
                this.props.onChanged(this.props.maxValue);
            }
        }
    }

    render() {
        return (
            <input
                type="number"
                className="number-input-root"
                onMouseEnter={this.mouseEnter}
                onMouseLeave={this.mouseLeave}
                value={this.props.value}
                onChange={this.onDirectChange}
            >
                {/* {.toPrecision(6)} */}
            </input>
        );
    }
}
