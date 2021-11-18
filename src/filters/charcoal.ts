import { FilterShader, fitToAspect, RenderTexture, TargetDimensions } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const CHARCOAL_FILTER_NAME = "Charcoal";

export class CharcoalShader extends FilterShader {
    width: number;
    height: number;
    intensity: number;
    inverse: number;

    protected uInvWidth: WebGLUniformLocation | null;
    protected uInvHeight: WebGLUniformLocation | null;
    protected uIntensity: WebGLUniformLocation | null;
    protected uInverse: WebGLUniformLocation | null;

    constructor(gl: WebGL2RenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform float uIntensity;
            uniform float uInvWidth;
            uniform float uInvHeight;
            uniform int uInverse;


            // According to: https://en.wikipedia.org/wiki/Relative_luminance
            float luminance(vec3 c) {
                vec3 lin = sqrt(c);
                return lin.r * 0.2126 + lin.g * 0.7152 + lin.b * 0.0722;
            }

            float edgeStrengthWithDelta(vec2 start, vec2 delta) {
                // Direction perpendicular to the step delta
                vec2 perp = vec2(delta.y, -delta.x);
                float before = 0.0;
                for (int i = -1; i <= 1; i++) {
                    vec2 pos = start - delta + float(i) * perp;
                    vec3 c = texture2D(uSampler, pos).rgb;
                    before += luminance(c);
                }
                float after = 0.0;
                for (int i = -1; i <= 1; i++) {
                    vec2 pos = start + delta + float(i) * perp;
                    vec3 c = texture2D(uSampler, pos).rgb;
                    after += luminance(c);
                }
                // Multiply by a third because we took three samples form
                // both before and after
                return (after - before) * 0.3333;
            }
            float edgeStrength(vec2 coords) {
                float aspect = uInvHeight / uInvWidth;
                float xStep = 0.00162;
                float yStep = xStep * aspect;
                float hor = edgeStrengthWithDelta(coords, vec2(xStep, 0.0));
                float ver = edgeStrengthWithDelta(coords, vec2(0.0, yStep));
                return (abs(hor) + abs(ver)) * 0.2;
            }
            
            void main()
            {
                vec4 tex = texture2D(uSampler, vTexCoord);
                const float PI = 3.1415926535;

                vec3 outRgb = tex.rgb;
                outRgb = (outRgb.r + outRgb.g + outRgb.b) * vec3(0.333);
                
                float edge = edgeStrength(vTexCoord) * uIntensity * 5.5;
                
                vec2 vals = vec2(0.04, 0.11);
                float x = 0.0;
                
                if(uInverse == 1){
                    x = vals.x;
                }
                else {
                    x = vals.y;
                }

                outRgb *= 1.0 - smoothstep(x, 0.1, edge);
                
                if(outRgb.rgb != vec3(0.0)) {
                    outRgb.rgb = vec3(1.0);
                }
                gl_FragColor = vec4(outRgb.rgb, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);

        this.width = 1280.0;
        this.height = 720.0;
        this.intensity = 1.0;
        this.inverse = 0;

        if (this.shaderProgram) {
            this.uInvWidth = gl.getUniformLocation(this.shaderProgram, "uInvWidth");
            this.uInvHeight = gl.getUniformLocation(this.shaderProgram, "uInvHeight");
            this.uIntensity = gl.getUniformLocation(this.shaderProgram, "uIntensity");
            this.uInverse = gl.getUniformLocation(this.shaderProgram, "uInverse");
        } else {
            this.uInvWidth = null;
            this.uInvHeight = null;
            this.uIntensity = null;
            this.uInverse = null;
        }
    }

    protected updateUniforms(gl: WebGL2RenderingContext): void {
        gl.uniform1f(this.uInvWidth, 1 / this.width);
        gl.uniform1f(this.uInvHeight, 1 / this.height);
        gl.uniform1f(this.uIntensity, this.intensity);
        gl.uniform1i(this.uInverse, this.inverse);

    }
}

export class CharcoalFilter extends FilterBase {
    protected shader: CharcoalShader;
    protected rt: RenderTexture;

    constructor(gl: WebGL2RenderingContext) {
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

    get intensity(): number {
        return this.shader.intensity;
    }
    set intensity(value: number) {
        this.shader.intensity = value;
    }

    get inverse(): number {
        return this.shader.inverse;
    }
    set inverse(value: number) {
        this.shader.inverse = value;
    }
}
