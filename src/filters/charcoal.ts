import { FilterShader, fitToAspect, RenderTexture, TargetDimensions } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const CHARCOAL_FILTER_NAME = "Charcoal";

export class CharcoalShader extends FilterShader {
    width: number;
    height: number;
    scale: number;
    angle: number;

    protected uInvWidth: WebGLUniformLocation | null;
    protected uInvHeight: WebGLUniformLocation | null;
    protected uScale: WebGLUniformLocation | null;
    protected uAngle: WebGLUniformLocation | null;

    constructor(gl: WebGLRenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;

            uniform float uInvWidth;
            uniform float uInvHeight;
        
            void main()
            {
                const float PI = 3.1415926535;
                vec4 tex = texture2D(uSampler, vTexCoord);                
                vec3 outRgb = vec3(tex.r, tex.g, tex.b);
                
                gl_FragColor = vec4(outRgb, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);

        this.width = 1280.0;
        this.height = 720.0;

        if (this.shaderProgram) {
            this.uInvWidth = gl.getUniformLocation(this.shaderProgram, "uInvWidth");
            this.uInvHeight = gl.getUniformLocation(this.shaderProgram, "uInvHeight");
        } else {
            this.uInvWidth = null;
            this.uInvHeight = null;
        }
    }

    protected updateUniforms(gl: WebGLRenderingContext): void {
        gl.uniform1f(this.uInvWidth, 1 / this.width);
        gl.uniform1f(this.uInvHeight, 1 / this.height);
    }
}

export class CharcoalFilter extends FilterBase {
    protected shader: CharcoalShader;
    protected rt: RenderTexture;

    constructor(gl: WebGLRenderingContext) {
        super(gl);
        this.gl = gl;
        this.shader = new CharcoalShader(gl);
        this.rt = new RenderTexture(gl, gl.RGBA);
    }

    updateDimensions(
        inW: number,
        inH: number,
        targetDimensions: TargetDimensions
    ): [number, number] {
        this.shader.width = inW;
        this.shader.height = inH;
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
}
