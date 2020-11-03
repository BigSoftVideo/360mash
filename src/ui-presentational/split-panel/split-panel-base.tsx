import * as React from "react";

export interface SplitPanelProps {
    defaultPercentage?: number;
    onResize?: () => void;
}

export abstract class SplitPanelBase extends React.Component<SplitPanelProps> {
    draggingSplit: boolean;

    protected splitFirst: React.RefObject<HTMLDivElement>;
    protected splitSecond: React.RefObject<HTMLDivElement>;
    mouseMoveListener: (event: any) => void;
    mouseUpListener: (event: any) => void;

    constructor(params: any) {
        super(params);

        this.draggingSplit = false;
        this.splitFirst = React.createRef();
        this.splitSecond = React.createRef();

        this.mouseMoveListener = (event: any) => {
            this.globalMouseMove(event);
        };
        this.mouseUpListener = () => {
            this.splitMouseUp();
        };
    }

    componentDidMount() {
        let percentage = 50;
        if (this.props.defaultPercentage) {
            percentage = this.props.defaultPercentage;
        }
        this.setSplitterPercentage(percentage);
    }

    render() {
        let children = this.props.children as React.ReactNodeArray;
        let first = children[0];
        let second = children[1];
        return this.renderWithChildren(first, second);
    }

    abstract renderWithChildren(first: React.ReactNode, second: React.ReactNode): JSX.Element;

    globalMouseMove(event: MouseEvent) {
        if (this.draggingSplit) {
            this.setSplitterPos(event);
            if (this.props.onResize) {
                this.props.onResize();
            }
        }
    }

    abstract setSplitterPos(event: MouseEvent): void;
    abstract setSplitterPercentage(percentage: number): void;

    splitMouseDown() {
        this.draggingSplit = true;
        const first = this.splitFirst.current;
        const right = this.splitSecond.current;
        if (first && right) {
            first.style.userSelect = "none";
            first.style.pointerEvents = "none";
            right.style.userSelect = "none";
            right.style.pointerEvents = "none";
            document.addEventListener("mousemove", this.mouseMoveListener);
            document.addEventListener("mouseup", this.mouseUpListener);
        }
    }

    splitMouseUp() {
        this.draggingSplit = false;
        const first = this.splitFirst.current;
        const right = this.splitSecond.current;
        if (first && right) {
            first.style.userSelect = "initial";
            first.style.pointerEvents = "initial";
            right.style.userSelect = "initial";
            right.style.pointerEvents = "initial";
            document.removeEventListener("mousemove", this.mouseMoveListener);
            document.removeEventListener("mouseup", this.mouseUpListener);
        }
    }
}
