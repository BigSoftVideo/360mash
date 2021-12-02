import { FilterShader, fitToAspect, RenderTexture, TargetDimensions } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const BANDC_FILTER_NAME = "Brightness and Contrast";

export class BAndCShader extends FilterShader {
    //b: brightness    c: contrast    e: exposure
    bright: number;
    contrast: number;
    saturation: number;

    protected uBright: WebGLUniformLocation | null;
    protected uContrast: WebGLUniformLocation | null;
    protected uSaturation: WebGLUniformLocation | null;

    constructor(gl: WebGL2RenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform float uBright;
            uniform float uContrast;
            uniform float uSaturation;

            mat4 brightMat(float brightness) {
                return mat4( 1, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                brightness, brightness, brightness, 1 );
            }

            mat4 contMat(float contrast) {
                float t = (1.0 - contrast) / 2.0;

                return mat4(contrast, 0, 0, 0,
                            0, contrast, 0, 0,
                            0, 0, contrast, 0,
                            t, t, t, 1 );

            }

            mat4 satuMat(float saturation) {
                vec3 luminance = vec3(0.3086, 0.6094, 0.0820);

                float oneMinusSat = 1.0 - saturation;

                vec3 red = vec3(luminance.x * oneMinusSat);
                red+= vec3( saturation, 0, 0 );

                vec3 green = vec3(luminance.y * oneMinusSat);
                green += vec3(0, saturation, 0);

                vec3 blue = vec3(luminance.z * oneMinusSat);
                blue += vec3(0, 0, saturation);

                return mat4(red,     0,
                            green,   0,
                            blue,    0,
                            0, 0, 0, 1 );
            }

            void main() {
                vec4 tex = texture2D(uSampler, vTexCoord);
                /*outRgb.rgb /= outRgb.a;
                
                //Apply contrast
                outRgb.rgb = (outRgb.rgb - 0.5) * uC + 0.5;

                //Apply brightness
                outRgb.rgb += uB;

                // Return final pixel color.
                outRgb.rgb *= outRgb.a;*/

                //outRgb *= brightMat(uBright) * contMat(uContrast) * satuMat(uSaturation);
                vec3 col = vec3(0);
                col.r = (pow(tex.r, uSaturation) - 0.5)*uContrast + uBright + 0.5;
                col.g = (pow(tex.g, uSaturation) - 0.5)*uContrast + uBright + 0.5;
                col.b = (pow(tex.b, uSaturation) - 0.5)*uContrast + uBright + 0.5;
                
                gl_FragColor = vec4(col.rgb, 1);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);

        this.bright = -0.1;
        this.contrast = 1.9;
        this.saturation = 1.4;

        if (this.shaderProgram) {
            this.uBright = gl.getUniformLocation(this.shaderProgram, "uBright");
            this.uContrast = gl.getUniformLocation(this.shaderProgram, "uContrast");
            this.uSaturation = gl.getUniformLocation(this.shaderProgram, "uSaturation");
        } else {
            this.uBright = null;
            this.uContrast = null;
            this.uSaturation = null;
        }
    }

    protected updateUniforms(gl: WebGL2RenderingContext): void {
        gl.uniform1f(this.uBright, this.bright);
        gl.uniform1f(this.uContrast, this.contrast);
        gl.uniform1f(this.uSaturation, this.saturation);
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
}
