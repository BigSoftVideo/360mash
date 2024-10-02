import * as glm from "gl-matrix";

import {
    FilterShader,
    fitToAspect,
    getTargetAspect,
    RenderTexture,
    TargetDimensions,
} from "../video/core";
import { FilterBase } from "../video/filter-base";

export const CONV360T02D_FILTER_NAME = "Convert 360 to 2D";

// TODO: make this so that it dynamically adjusts to fill the most space
const PREVIEW_CANVAS_WIDTH = 600;

/**
 * A shader that projects from 360 equirectangular input to a custom projection that's similar to
 * "Lambert azimuthal equal area projection"
 *
 * This shader is suitable for producing a regular 16:9 aspect ratio video from an equirectangular
 * input.
 */
export class MashProjectionShader extends FilterShader {
    public fovY: number;
    public rotRight: number;
    public rotUp: number;
    // public inAspect: number;
    public outAspect: number;

    protected uRotate: WebGLUniformLocation | null;
    protected uFov: WebGLUniformLocation | null;
    // protected uInAspect: WebGLUniformLocation | null;
    // protected uOutOverInAspect: WebGLUniformLocation | null;
    protected uOutAspect: WebGLUniformLocation | null;
    protected rotationMat: glm.mat4;
    constructor(gl: WebGL2RenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform mat4 uRotate;
            uniform float uFov;
            uniform float uOutAspect;
            void main() {
                const float PI = 3.1415926535;
                vec4 red = vec4(1.0, 0.1, 0.1, 1.0);
                vec4 purple = vec4(0.8, 0.1, 1.0, 1.0);
                
                float fov = uFov / PI;
                vec2 offsetPos = vec2(vTexCoord.x - 0.5, vTexCoord.y - 0.5);

                // See https://en.wikipedia.org/wiki/Lambert_azimuthal_equal-area_projection
                float X = offsetPos.x * uOutAspect * fov * 2.0;
                float Y = offsetPos.y * fov * 2.0;

                float maxDist = sqrt(uOutAspect*uOutAspect + 1.0);
                float dist = sqrt(X*X + Y*Y);
                float distNormalized = dist/maxDist;
                float magic = sin(PI * 0.5 * distNormalized);
                X /= dist;
                Y /= dist;
                X *= magic * 2.0;
                Y *= magic * 2.0;

                // 'a' is just a value we introduce to make the formulas more compact.
                float a = (X*X + Y*Y) * 0.5;
                float y = sqrt(1.0 - a * 0.5) * X;
                float x = sqrt(1.0 - a * 0.5) * Y;
                float z = -1.0 + a;

                vec4 direction = vec4(x, y, z, 0);
                direction = uRotate * direction;

                float atan_yx = atan(direction.y / direction.x);
                float azimuth = direction.x > 0.0 ? atan_yx : PI + atan_yx;
                float elevation = asin(direction.z);
                
                float outU = azimuth / (2.0*PI);
                float outV = elevation / PI + 0.5;
                gl_FragColor = texture2D(uSampler, vec2(outU, outV));
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);

        super(gl, fragmentShader);

        this.fovY = Math.PI;
        this.rotRight = 0;
        this.rotUp = 0;
        // this.inAspect = 0;
        this.outAspect = 1;

        this.rotationMat = glm.mat4.create();
        glm.mat4.identity(this.rotationMat);
        if (this.shaderProgram) {
            this.uRotate = gl.getUniformLocation(this.shaderProgram, "uRotate");
            this.uFov = gl.getUniformLocation(this.shaderProgram, "uFov");
            this.uOutAspect = gl.getUniformLocation(this.shaderProgram, "uOutAspect");
            // this.uInAspect = gl.getUniformLocation(this.shaderProgram, "uInAspect");
            // this.uOutOverInAspect = gl.getUniformLocation(this.shaderProgram, "uOutOverInAspect");
        } else {
            this.uFov = null;
            this.uRotate = null;
            this.uOutAspect = null;
            // this.uInAspect = null;
            // this.uOutOverInAspect = null;
        }
    }

    protected updateUniforms(gl: WebGL2RenderingContext): void {
        // Apply constraints on zoom and rotation
        this.fovY = Math.min(Math.max(this.fovY, 0), Math.PI);
        this.rotRight = Math.min(Math.max(this.rotRight, -Math.PI * 0.5), Math.PI * 0.5);

        let rotRightMat = glm.mat4.create();
        glm.mat4.fromRotation(
            rotRightMat,
            -this.rotRight - Math.PI * 0.5,
            glm.vec3.fromValues(0, 1, 0)
        );
        let rotUpMat = glm.mat4.create();
        glm.mat4.fromRotation(rotUpMat, this.rotUp + Math.PI, glm.vec3.fromValues(0, 0, 1));

        glm.mat4.mul(this.rotationMat, rotUpMat, rotRightMat);
        glm.mat4.invert(this.rotationMat, this.rotationMat);
        glm.mat4.transpose(this.rotationMat, this.rotationMat);

        gl.uniformMatrix4fv(this.uRotate, false, this.rotationMat);
        gl.uniform1f(this.uFov, this.fovY);
        gl.uniform1f(this.uOutAspect, this.outAspect);
        // gl.uniform1f(this.uInAspect, this.inAspect);
        // gl.uniform1f(this.uOutOverInAspect, this.outAspect / this.inAspect);
    }
}

/**
 * Designed for converting a 180 video to a regular 2D
 */
export class Project180FisheyeShader extends FilterShader {
    public fovY: number;
    public rotRight: number;
    public rotUp: number;
    // public inAspect: number;
    public outAspect: number;

    protected uRotate: WebGLUniformLocation | null;
    protected uFov: WebGLUniformLocation | null;
    // protected uInAspect: WebGLUniformLocation | null;
    // protected uOutOverInAspect: WebGLUniformLocation | null;
    protected uOutAspect: WebGLUniformLocation | null;
    protected rotationMat: glm.mat4;
    constructor(gl: WebGL2RenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform mat4 uRotate;
            uniform float uFov;
            uniform float uOutAspect;
            void main() {
                const float PI = 3.1415926535;
                vec4 red = vec4(1.0, 0.1, 0.1, 1.0);
                vec4 purple = vec4(0.8, 0.1, 1.0, 1.0);
                
                float fov = uFov / PI;
                vec2 offsetPos = vec2(vTexCoord.x - 0.5, vTexCoord.y - 0.5);

                // See https://en.wikipedia.org/wiki/Lambert_azimuthal_equal-area_projection
                float X = offsetPos.x * uOutAspect * fov * 2.0;
                float Y = offsetPos.y * fov * 2.0;

                float maxDist = sqrt(uOutAspect*uOutAspect + 1.0);
                float dist = sqrt(X*X + Y*Y);
                float distNormalized = dist/maxDist;
                float magic = sin(PI * 0.5 * distNormalized);
                X /= dist;
                Y /= dist;
                X *= magic * 2.0;
                Y *= magic * 2.0;

                // 'a' is just a value we introduce to make the formulas more compact.
                float a = (X*X + Y*Y) * 0.5;
                float y = sqrt(1.0 - a * 0.5) * X;
                float x = sqrt(1.0 - a * 0.5) * Y;
                float z = -1.0 + a;

                vec4 direction = vec4(x, y, z, 0);
                direction = uRotate * direction;

                // The fisheye projection is simple in the sense that we don't have to do
                // trigonometry to convert the 3D direction vector into the 2D texture coordinates.
                //
                // For example if the camera was looking along the Z axis then we simply ignore the
                // Z coordinate of our 3D vector and use the X coordinate to determine the horizontal
                // pixel position and use the Y coordinate to determine the vertical pixel position
                
                vec2 outUV = direction.xy * vec2(0.5) + vec2(0.5);

                // Make everything black that's towards the other direction
                // (otherwise it would appear as if the image is mirrored)
                float mask = step(direction.z, 0.0);

                gl_FragColor = vec4(texture2D(uSampler, outUV).rgb * mask, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);

        super(gl, fragmentShader);

        this.fovY = Math.PI;
        this.rotRight = 0;
        this.rotUp = 0;
        // this.inAspect = 0;
        this.outAspect = 1;

        this.rotationMat = glm.mat4.create();
        glm.mat4.identity(this.rotationMat);
        if (this.shaderProgram) {
            this.uRotate = gl.getUniformLocation(this.shaderProgram, "uRotate");
            this.uFov = gl.getUniformLocation(this.shaderProgram, "uFov");
            this.uOutAspect = gl.getUniformLocation(this.shaderProgram, "uOutAspect");
            // this.uInAspect = gl.getUniformLocation(this.shaderProgram, "uInAspect");
            // this.uOutOverInAspect = gl.getUniformLocation(this.shaderProgram, "uOutOverInAspect");
        } else {
            this.uFov = null;
            this.uRotate = null;
            this.uOutAspect = null;
            // this.uInAspect = null;
            // this.uOutOverInAspect = null;
        }
    }

    protected updateUniforms(gl: WebGL2RenderingContext): void {
        let rotRightMat = glm.mat4.create();
        glm.mat4.fromRotation(
            rotRightMat,
            -this.rotRight - Math.PI * 0.5,
            glm.vec3.fromValues(0, 1, 0)
        );
        let rotUpMat = glm.mat4.create();
        glm.mat4.fromRotation(rotUpMat, this.rotUp + Math.PI, glm.vec3.fromValues(0, 0, 1));

        glm.mat4.mul(this.rotationMat, rotUpMat, rotRightMat);
        glm.mat4.invert(this.rotationMat, this.rotationMat);
        glm.mat4.transpose(this.rotationMat, this.rotationMat);

        gl.uniformMatrix4fv(this.uRotate, false, this.rotationMat);
        gl.uniform1f(this.uFov, this.fovY);
        gl.uniform1f(this.uOutAspect, this.outAspect);
    }
}

export enum Conv360ShaderKind {
    Equirect360,
    Fisheye180,
}

export class Conv360To2DFilter extends FilterBase {
    protected shaderEquirect: MashProjectionShader;
    protected shader180: Project180FisheyeShader;
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
        this.shaderEquirect = new MashProjectionShader(gl);
        this.shader180 = new Project180FisheyeShader(gl);
        this.selectedShader = Conv360ShaderKind.Equirect360;
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
            this.shaderEquirect.outAspect = this.targetAspect;
            this.shader180.outAspect = this.targetAspect;
        } else {
            this.shaderEquirect.outAspect = this.inputAspect;
            this.shader180.outAspect = this.inputAspect;
            outputAspect = this.shaderEquirect.outAspect;
        }
        let [outW, outH] = fitToAspect(targetDimensions, outputAspect);
        this.rt.ensureDimensions(outW, outH);
        this.previewPixelArray = new Uint8Array(outW * outH * 4);
        return [outW, outH];
    }

    dispose(): void {
        this.rt.dispose();
        this.shaderEquirect.dispose();
        this.shader180.dispose();
    }
    execute(source: WebGLTexture): RenderTexture {
        let gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rt.framebuffer);
        gl.viewport(0, 0, this.rt.width, this.rt.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source);
        switch (this.selectedShader) {
            case Conv360ShaderKind.Equirect360:
                this.shaderEquirect.draw(gl);
                break;
            case Conv360ShaderKind.Fisheye180:
                this.shader180.draw(gl);
                break;
            default:
                console.error(
                    "This should be unreachable. Please call the draw function of the correct shader here"
                );
                break;
        }
        this.copyResultToPreview();
        return this.rt;
    }

    public get fovY(): number {
        return this.shaderEquirect.fovY;
    }
    public set fovY(val: number) {
        this.shaderEquirect.fovY = val;
        this.shader180.fovY = val;
    }
    public get rotRight(): number {
        return this.shaderEquirect.rotRight;
    }
    public set rotRight(val: number) {
        this.shaderEquirect.rotRight = val;
        this.shader180.rotRight = val;
    }
    public get rotUp(): number {
        return this.shaderEquirect.rotUp;
    }
    public set rotUp(val: number) {
        this.shaderEquirect.rotUp = val;
        this.shader180.rotUp = val;
    }
    public get useTargetAspect(): boolean {
        return this._useTargetAspect;
    }
    public set useTargetAspect(val: boolean) {
        this._useTargetAspect = val;
        if (val) {
            this.shaderEquirect.outAspect = this.targetAspect;
            this.shader180.outAspect = this.targetAspect;
        } else {
            this.shaderEquirect.outAspect = this.inputAspect;
            this.shader180.outAspect = this.inputAspect;
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
