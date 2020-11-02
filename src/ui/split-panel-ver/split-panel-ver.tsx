
import * as React from "react";
import { SplitPanelBase } from "../split-panel-base/split-panel-base";

export class SplitPanelVer extends SplitPanelBase {
    constructor(params: any) {
        super(params);
    }

    renderWithChildren(first: React.ReactNode, second: React.ReactNode): JSX.Element {
        return (
            <div className="c-split-panel-container">
                <div className="c-panel-split-v" ref={this.splitFirst}>
                    {first}
                </div>
                <div
                    className="c-split c-split-vertical"
                    onMouseDown={() => {
                        this.splitMouseDown();
                    }}
                    onMouseUp={() => {
                        this.splitMouseUp();
                    }}
                ></div>
                <div className="c-panel-split-v" ref={this.splitSecond}>
                    {second}
                </div>
            </div>
        );
    }

    setSplitterPos(event: MouseEvent): void {
        this.setSplitterPageY(event.pageY);
    }

    setSplitterPageY(pageY: number) {
        const parentRect = this.splitFirst.current?.parentElement?.getBoundingClientRect();
        if (parentRect) {
            const parentY = Math.max(0, pageY - parentRect.top);
            const percentage = (parentY / parentRect.height) * 100;
            this.setSplitterPercentage(percentage);
            // this.rightPanel.current?.layout();
            // this.editor.current?.layout();
        }
    }

    setSplitterPercentage(percentage: number) {
        this.splitFirst.current!.style.height = "calc(" + percentage + "% - 0.5px)";
        this.splitSecond.current!.style.height = "calc(" + (100 - percentage) + "% - 1.0px)";
    }
}
