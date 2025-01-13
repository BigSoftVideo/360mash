import * as React from "react";

import "./aspect-ratio-fitter.css";

export interface AspectRatioFitterProps extends React.PropsWithChildren {
    aspectRatio: number;
}

export class AspectRatioFitter extends React.Component<
    AspectRatioFitterProps,
    { horizPadding: number }
> {
    protected outterRef: React.RefObject<HTMLDivElement>;

    constructor(props: any) {
        super(props);
        this.outterRef = React.createRef();

        this.state = {
            horizPadding: 0,
        };
    }

    render() {
        let paddingTopRatio = 1 / this.props.aspectRatio;
        let horizPaddingCss = this.state.horizPadding + "%";
        return (
            <div
                ref={this.outterRef}
                className="aspect-ratio-outter"
                style={{
                    paddingLeft: horizPaddingCss,
                    paddingRight: horizPaddingCss,
                }}
            >
                <div
                    className="aspect-ratio-middle"
                    style={{ paddingTop: 100 * paddingTopRatio + "%" }}
                >
                    <div className="aspect-ratio-inner">{this.props.children}</div>
                </div>
            </div>
        );
    }
    resized() {
        if (!this.outterRef.current) {
            return;
        }
        let outterAspectRatio =
            this.outterRef.current.clientWidth / this.outterRef.current.clientHeight;
        let relativeRatio = outterAspectRatio / this.props.aspectRatio;
        let paddingRatio = Math.max(0, relativeRatio - 1) / relativeRatio;
        this.setState({ horizPadding: paddingRatio * 50 });
    }
}
