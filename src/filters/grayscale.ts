import { FilterShader, fitToAspect, RenderTexture, TargetDimensions } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const GRAYSCALE_FILTER_NAME = "Grayscale";

export class GrayscaleShader extends FilterShader {
    
    greyMultiplier: number;

    protected uGreyMultiplier: WebGLUniformLocation | null;

    constructor(gl: WebGLRenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            uniform float uGreyMultiplier;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            void main() {
                const float PI = 3.1415926535;
                vec4 c = texture2D(uSampler, vTexCoord);
                gl_FragColor = vec4(vec3(0.666 * (1./uGreyMultiplier)) * (c.r + c.g + c.b), 1.0);
                //gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);

        this.greyMultiplier = 2.0;

        if (this.shaderProgram) {
            this.uGreyMultiplier = gl.getUniformLocation(this.shaderProgram, "uGreyMultiplier");
        } else {
            this.uGreyMultiplier = null;
        }
    }

    protected updateUniforms(gl: WebGLRenderingContext): void {
        //throw new Error("Method not implemented.");
        gl.uniform1f(this.uGreyMultiplier, this.greyMultiplier);
    }
}

export class GrayscaleFilter extends FilterBase {
    //protected gl: WebGLRenderingContext;
    protected shader: GrayscaleShader;
    protected rt: RenderTexture;

    constructor(gl: WebGLRenderingContext) {
        super(gl);
        this.gl = gl;
        this.shader = new GrayscaleShader(gl);
        this.rt = new RenderTexture(gl, gl.RGBA);
    }

    updateDimensions(
        inW: number,
        inH: number,
        targetDimensions: TargetDimensions
    ): [number, number] {
        // The output aspect matches the input aspect
        let outputAspect = inW / inH;
        let [outW, outH] = fitToAspect(targetDimensions, outputAspect);
        this.rt.ensureDimensions(outW, outH);
        return [outW, outH];
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

    get greyMultiplier(): number {
        return this.shader.greyMultiplier;
    }
    set greyMultiplier(value: number) {
        this.shader.greyMultiplier = value;
    }
}
