
import * as React from "react";
import { SplitPanelBase } from "../split-panel-base/split-panel-base";

import "../../common-style.css";

export class SplitPanelHor extends SplitPanelBase {
    
    constructor(params: any) {
        super(params);
    }

    renderWithChildren(first: React.ReactNode, second: React.ReactNode): JSX.Element {
        return (
            <div className="c-split-panel-container">
                <div className="c-panel-split-h" ref={this.splitFirst}>
                    {first}
                </div>
                <div
                    className="c-split c-split-horizontal"
                    onMouseDown={() => {
                        this.splitMouseDown();
                    }}
                    onMouseUp={() => {
                        this.splitMouseUp();
                    }}
                ></div>
                <div className="c-panel-split-h" ref={this.splitSecond}>
                    {second}
                </div>
            </div>
        );
    }
    
    setSplitterPos(event: MouseEvent): void {
        this.setSplitterPageX(event.pageX);
    }

    setSplitterPageX(pageX: number) {
        const parentRect = this.splitFirst.current?.parentElement?.getBoundingClientRect();
        if (parentRect) {
            const parentX = Math.max(0, pageX - parentRect.left);
            const parentPercentage = (parentX / parentRect.width) * 100;
            this.setSplitterPercentage(parentPercentage);
        }
    }

    setSplitterPercentage(percentage: number): void {
        this.splitFirst.current!.style.width = "calc(" + percentage + "% - 0.5px)";
        this.splitSecond.current!.style.width = "calc(" + (100 - percentage) + "% - 1.0px)";
    }
}
