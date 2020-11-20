
import * as React from "react";
import { FilterPipeline } from "../../video/filter-pipeline";

export interface ExportPanelProps {
    pipeline: FilterPipeline;
}

export class ExportPanel extends React.Component<ExportPanelProps> {
    canvasRef: React.RefObject<HTMLCanvasElement>;

    constructor(params: any) {
        super(params);
        this.canvasRef = React.createRef();
    }

    render() {
        return (<div>
            <button onClick={this.fetchFrame.bind(this)}>
                Get current frame
            </button>
            <canvas ref={this.canvasRef} width={400} height={400}></canvas>
        </div>);
    }

    fetchFrame() {
        if (this.canvasRef.current) {
            let ctx = this.canvasRef.current.getContext('2d');
            if (!ctx) {
                console.error("Could not get 2d context");
                return;
            }
            let pixelData = this.props.pipeline.pixelData;
            if (!pixelData) {
                console.error("Could not get pixel data");
                return;
            }
            console.log("Received pixel data of size " + pixelData.w + ", " + pixelData.h);
            let imgData = ctx.createImageData(pixelData.w, pixelData.h);
            for (let y = 0; y < pixelData.h; y++) {
                for (let x = 0; x < pixelData.w; x++) {
                    let index = y*pixelData.w + x;
                    imgData.data[index*4 + 0] = pixelData.data[index*4 + 0];
                    imgData.data[index*4 + 1] = pixelData.data[index*4 + 1];
                    imgData.data[index*4 + 2] = pixelData.data[index*4 + 2];
                    imgData.data[index*4 + 3] = 255;
                }
            }
            createImageBitmap(imgData, {resizeWidth: 800, resizeHeight: 400}).then(img => {
                ctx?.drawImage(img, 0, 0);
            });
        }
    }
}
