
import * as glm from "gl-matrix";

import { FilterShader, RenderTexture } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const CONV360T02D_FILTER_NAME = "360 to 2D";

export class MashProjectionShader extends FilterShader {
    public fovY: number;
    public rotRight: number;
    public rotUp: number;
    public aspect: number;

    protected uRotate: WebGLUniformLocation | null;
    protected uFov: WebGLUniformLocation | null;
    protected uAspect: WebGLUniformLocation | null;
    protected rotationMat: glm.mat4;
    constructor(gl: WebGLRenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform mat4 uRotate;
            uniform float uFov;
            uniform float uAspect;
            void main() {
                const float PI = 3.1415926535;
                vec4 red = vec4(1.0, 0.1, 0.1, 1.0);
                vec4 purple = vec4(0.8, 0.1, 1.0, 1.0);
                
                float fov = uFov / PI;
                vec2 offsetPos = vec2(vTexCoord.x - 0.5, vTexCoord.y - 0.5);

                // See https://en.wikipedia.org/wiki/Lambert_azimuthal_equal-area_projection
                float X = offsetPos.x * uAspect * fov * 2.0;
                float Y = offsetPos.y * fov * 2.0;

                float maxDist = sqrt(uAspect*uAspect + 1.0);
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
                
                gl_FragColor = texture2D(uSampler, vec2(azimuth / (2.0*PI), elevation / PI + 0.5));
            }`;
        let fragmentShader = FilterShader.createShader(
            gl,
            gl.FRAGMENT_SHADER,
            fragmentSrc
        );

        super(gl, fragmentShader);

        this.fovY = Math.PI;
        this.rotRight = 0;
        this.rotUp = 0;
        this.aspect = 0;

        this.rotationMat = glm.mat4.create();
        glm.mat4.identity(this.rotationMat);
        if (this.shaderProgram) {
            this.uRotate = gl.getUniformLocation(this.shaderProgram, "uRotate");
            this.uFov = gl.getUniformLocation(this.shaderProgram, "uFov");
            this.uAspect = gl.getUniformLocation(this.shaderProgram, "uAspect");
        } else {
            this.uFov = null;
            this.uRotate = null;
            this.uAspect = null;
        }
    }

    protected updateUniforms(gl: WebGLRenderingContext): void {
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
        gl.uniform1f(this.uAspect, this.aspect);
    }
}

export class Conv360To2DFilter extends FilterBase {
    protected shader: MashProjectionShader;
    protected rt: RenderTexture;

    constructor(gl: WebGLRenderingContext, outw: number, outh: number) {
        super(gl);
        this.gl = gl;
        this.shader = new MashProjectionShader(gl);
        this.rt = new RenderTexture(gl);

        this.setOutputDimensions(outw, outh);
    }

    setOutputDimensions(width: number, height: number): void {
        this.shader.aspect = width / height;
        this.rt.ensureDimensions(width, height);
    }
    dispose(): void {
        this.rt.dispose();
        this.shader.dispose();
    }
    execute(source: WebGLTexture): RenderTexture {
        let gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rt.framebuffer);
        gl.viewport(0, 0, this.rt.width, this.rt.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source);
        this.shader.draw(gl);
        return this.rt;
    }

    public get fovY(): number {
        return this.shader.fovY;
    }
    public set fovY(val: number) {
        this.shader.fovY = val;
    }
    public get rotRight(): number {
        return this.shader.rotRight;
    }
    public set rotRight(val: number) {
        this.shader.rotRight = val;
    }
    public get rotUp(): number {
        return this.shader.rotUp;
    }
    public set rotUp(val: number) {
        this.shader.rotUp = val;
    }
}
