import { FilterShader, RenderTexture } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const GRAYSCALE_FILTER_NAME = "Grayscale";

export class GrayscaleShader extends FilterShader {
    constructor(gl: WebGLRenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            void main() {
                const float PI = 3.1415926535;
                vec4 c = texture2D(uSampler, vTexCoord);
                gl_FragColor = vec4(vec3(0.333) * (c.r + c.g + c.b), 1.0);
                //gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(
            gl,
            gl.FRAGMENT_SHADER,
            fragmentSrc
        );
        super(gl, fragmentShader);
    }

    protected updateUniforms(gl: WebGLRenderingContext): void {
        //throw new Error("Method not implemented.");
    }
}

export class GrayscaleFilter extends FilterBase {
    //protected gl: WebGLRenderingContext;
    protected shader: GrayscaleShader;
    protected rt: RenderTexture;

    constructor(gl: WebGLRenderingContext, outw: number, outh: number) {
        super(gl);
        this.gl = gl;
        this.shader = new GrayscaleShader(gl);
        this.rt = new RenderTexture(gl);
        this.rt.ensureDimensions(outw, outh);
    }

    setOutputDimensions(width: number, height: number): void {
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
}
