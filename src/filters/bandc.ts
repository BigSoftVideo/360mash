import { FilterShader, fitToAspect, RenderTexture, TargetDimensions } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const BANDC_FILTER_NAME = "Brightness and Contrast";

export class BAndCShader extends FilterShader {
    //b: brightness    c: contrast    e: exposure
    bright: number;
    contrast: number;
    saturation: number;
    temp: number;
    tint: number;

    protected uBright: WebGLUniformLocation | null;
    protected uContrast: WebGLUniformLocation | null;
    protected uSaturation: WebGLUniformLocation | null;
    protected uTemp: WebGLUniformLocation | null;
    protected uTint: WebGLUniformLocation | null;

    constructor(gl: WebGL2RenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;

            uniform float uBright;
            uniform float uContrast;
            uniform float uSaturation;
            uniform float uTemp;
            uniform float uTint;

            void main() {
                vec4 tex = texture2D(uSampler, vTexCoord);
                tex.r = (pow(tex.r, uSaturation) - 0.5)*uContrast + uBright + 0.5 + (uTemp*0.1);
                tex.g = (pow(tex.g, uSaturation) - 0.5)*uContrast + uBright + 0.5 + (uTint*0.1);
                tex.b = (pow(tex.b, uSaturation) - 0.5)*uContrast + uBright + 0.5 - (uTemp*0.1);  
                
                // tex.r += uTemp;
                // tex.       
                // tex.b -= uTemp;

                gl_FragColor = vec4(tex.rgb, 1);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);

        this.bright = 0.15;
        this.contrast = 1.3;
        this.saturation = 0.95;
        this.temp = 0;
        this.tint = 0;

        if (this.shaderProgram) {
            this.uBright = gl.getUniformLocation(this.shaderProgram, "uBright");
            this.uContrast = gl.getUniformLocation(this.shaderProgram, "uContrast");
            this.uSaturation = gl.getUniformLocation(this.shaderProgram, "uSaturation");
            this.uTemp = gl.getUniformLocation(this.shaderProgram, "uTemp");
            this.uTint = gl.getUniformLocation(this.shaderProgram, "uTint");
        } else {
            this.uBright = null;
            this.uContrast = null;
            this.uSaturation = null;
            this.uTemp = null;
            this.uTint = null;
        }
    }

    protected updateUniforms(gl: WebGL2RenderingContext): void {
        gl.uniform1f(this.uBright, this.bright);
        gl.uniform1f(this.uContrast, this.contrast);
        gl.uniform1f(this.uSaturation, this.saturation);
        gl.uniform1f(this.uTemp, this.temp);
        gl.uniform1f(this.uTint, this.tint);
    }
}

export class BAndCFilter extends FilterBase {
    protected shader: BAndCShader;
    protected rt: RenderTexture;

    constructor(gl: WebGL2RenderingContext) {
        super(gl);
        this.gl = gl;
        this.shader = new BAndCShader(gl);
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

    get brightness(): number {
        return this.shader.bright;
    }
    set brightness(value: number) {
        this.shader.bright = value;
    }
    get contrast(): number {
        return this.shader.contrast;
    }
    set contrast(value: number) {
        this.shader.contrast = value;
    }
    get saturation(): number {
        return this.shader.saturation;
    }
    set saturation(value: number) {
        this.shader.saturation = value;
    }
    get temperature(): number {
        return this.shader.temp;
    }
    set temperature(value: number) {
        this.shader.temp = value;
    }
    get tint(): number {
        return this.shader.tint;
    }
    set tint(value: number) {
        this.shader.tint = value;
    }
}
