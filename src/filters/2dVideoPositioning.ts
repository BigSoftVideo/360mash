import * as glm from "gl-matrix";

import {
    FilterShader,
    fitToAspect,
    getTargetAspect,
    RenderTexture,
    TargetDimensions,
} from "../video/core";
import { FilterBase } from "../video/filter-base";

export const POSITION_2D_FILTER_NAME = "Zoom & Pan 2D Video";

// TODO: make this so that it dynamically adjusts to fill the most space
const PREVIEW_CANVAS_WIDTH = 600;

export class Flat2DShader extends FilterShader {
    protected uYaw: WebGLUniformLocation | null;
    protected uPitch: WebGLUniformLocation | null;
    protected uFov: WebGLUniformLocation | null;

    public fovY: number;
    public rotRight: number;
    public rotUp: number;
    // public inAspect: number;
    public outAspect: number;

    // protected uRotate: WebGLUniformLocation | null;
    // protected uFov: WebGLUniformLocation | null;
    // // protected uInAspect: WebGLUniformLocation | null;
    // // protected uOutOverInAspect: WebGLUniformLocation | null;
    // protected uOutAspect: WebGLUniformLocation | null;
    // protected rotationMat: glm.mat4;
    constructor(gl: WebGL2RenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform float uYaw;
            uniform float uPitch;
            uniform float uFov;
            void main() {
                const float PI = 3.1415926535;
                float scaling = uFov / PI;
                vec2 center = vec2(uYaw / (PI*2.0) + 0.5, uPitch / PI + 0.5);
                gl_FragColor = texture2D(uSampler, center + (vTexCoord - vec2(0.5)) * scaling);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);

        super(gl, fragmentShader);

        this.fovY = Math.PI;
        this.rotRight = 0;
        this.rotUp = 0;
        // // this.inAspect = 0;
        this.outAspect = 1;
        if (this.shaderProgram) {
            this.uYaw = gl.getUniformLocation(this.shaderProgram, "uYaw");
            this.uPitch = gl.getUniformLocation(this.shaderProgram, "uPitch");
            this.uFov = gl.getUniformLocation(this.shaderProgram, "uFov");
        } else {
            this.uYaw = null;
            this.uPitch = null;
            this.uFov = null;
        }
    }

    protected updateUniforms(gl: WebGLRenderingContext) {
        //mapping
        const [fov, rRight, rUp] = this.mapParameters(this.fovY, this.rotRight, this.rotUp);
        this.fovY = fov;
        this.rotRight = rRight;
        this.rotUp = rUp;
        gl.uniform1f(this.uYaw, this.rotUp);
        gl.uniform1f(this.uPitch, this.rotRight);
        gl.uniform1f(this.uFov, this.fovY);
    }

    mapParameters(fovY: number, rotRight: number, rotUp: number): [number, number, number] {
        let yaw = rotUp;
        let pitch = rotRight;
        let scaling = fovY / Math.PI;
        let x = yaw / (Math.PI * 2.0) + 0.5;
        x = Math.max(scaling * 0.5, Math.min(1.0 - scaling * 0.5, x));
        let y = pitch / Math.PI + 0.5;
        y = Math.max(scaling * 0.5, Math.min(1.0 - scaling * 0.5, y));
        return [fovY, (y - 0.5) * Math.PI, (x - 0.5) * (Math.PI * 2.0)];
    }
}

export enum Conv360ShaderKind {
    Flat2DShader,
    Equirect360,
    Fisheye180,
}

export class Flat2DPositionerFilter extends FilterBase {
    protected shader2DVideo: Flat2DShader;
    protected rt: RenderTexture;

    protected inputAspect: number;
    protected targetAspect: number;
    protected _useTargetAspect: boolean;

    public selectedShader: Conv360ShaderKind;

    previewCanvas: HTMLCanvasElement | null;
    // protected previewTexture: WebGLTexture;
    previewPixelArray: Uint8Array;

    constructor(gl: WebGL2RenderingContext) {
        super(gl);
        this.gl = gl;
        this.shader2DVideo = new Flat2DShader(gl);
        this.selectedShader = Conv360ShaderKind.Flat2DShader;
        this.rt = new RenderTexture(gl, gl.RGBA);
        this.previewPixelArray = new Uint8Array();
        this.targetAspect = 1;
        this.inputAspect = 1;
        this._useTargetAspect = true;

        this.previewCanvas = null;
    }

    updateDimensions(
        inW: number,
        inH: number,
        targetDimensions: TargetDimensions
    ): [number, number] {
        this.inputAspect = inW / inH;
        this.targetAspect = getTargetAspect(targetDimensions);
        let outputAspect;
        if (this._useTargetAspect) {
            outputAspect = this.targetAspect;
            this.shader2DVideo.outAspect = this.targetAspect;
        } else {
            this.shader2DVideo.outAspect = this.inputAspect;
            outputAspect = this.shader2DVideo.outAspect;
        }
        let [outW, outH] = fitToAspect(targetDimensions, outputAspect);
        this.rt.ensureDimensions(outW, outH);
        this.previewPixelArray = new Uint8Array(outW * outH * 4);
        return [outW, outH];
    }

    dispose(): void {
        this.rt.dispose();
        this.shader2DVideo.dispose();
    }
    execute(source: WebGLTexture): RenderTexture {
        let gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rt.framebuffer);
        gl.viewport(0, 0, this.rt.width, this.rt.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source);
        this.shader2DVideo.draw(gl);

        this.copyResultToPreview();
        return this.rt;
    }

    public get fovY(): number {
        return this.shader2DVideo.fovY;
    }
    public set fovY(val: number) {
        this.shader2DVideo.fovY = Math.min(Math.PI, Math.max(0.2, val));
    }
    public get rotRight(): number {
        return this.shader2DVideo.rotRight;
    }
    public set rotRight(val: number) {
        this.shader2DVideo.rotRight = val;
    }
    public get rotUp(): number {
        return this.shader2DVideo.rotUp;
    }
    public set rotUp(val: number) {
        this.shader2DVideo.rotUp = val;
    }
    public get useTargetAspect(): boolean {
        return this._useTargetAspect;
    }
    public set useTargetAspect(val: boolean) {
        this._useTargetAspect = val;
        if (val) {
            this.shader2DVideo.outAspect = this.targetAspect;
        } else {
            this.shader2DVideo.outAspect = this.inputAspect;
        }
    }

    protected copyResultToPreview() {
        if (!this.previewCanvas) {
            return;
        }

        // At this point we expect that the `this.gl.canvas` framebuffer has this filter's output
        // rendered to it.
        this.gl.readPixels(
            0,
            0,
            this.rt.width,
            this.rt.height,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            this.previewPixelArray
        );

        let ctx = this.previewCanvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get preview canvas context");
        }
        let clamped = new Uint8ClampedArray(this.previewPixelArray.buffer);
        let imgData = new ImageData(clamped, this.rt.width, this.rt.height);

        createImageBitmap(imgData).then((previewBitmap) => {
            if (!this.previewCanvas) {
                console.warn(
                    "Tried copying the filter output but a preview canvas was not available."
                );
                return;
            }
            // console.log("Received preview bitmap");
            let aspect = previewBitmap.width / previewBitmap.height;
            let previewWidth = PREVIEW_CANVAS_WIDTH;
            let previewHeight = previewWidth / aspect;
            this.previewCanvas.width = previewWidth;
            this.previewCanvas.height = previewHeight;
            let ctx = this.previewCanvas.getContext("2d");
            if (!ctx) {
                throw new Error("Could not get 2d context for the preview canvas");
            }
            ctx.drawImage(previewBitmap, 0, 0, previewWidth, previewHeight);
            // console.log("finished drawing the preview bitmap");
        });
    }
}