import { FilterShader, fitToAspect, RenderTexture, TargetDimensions } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const CARTOON_FILTER_NAME = "Cartoon";

export class CartoonShader extends FilterShader {
    width: number;
    height: number;

    edgeIntensity: number;

    protected uInvWidth: WebGLUniformLocation | null;
    protected uInvHeight: WebGLUniformLocation | null;
    protected uEdgeIntensity: WebGLUniformLocation | null;

    constructor(gl: WebGLRenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;

            uniform float uInvWidth;
            uniform float uInvHeight;
            uniform float uEdgeIntensity;
            uniform sampler2D uSampler;

            // Assuming a gamma of 2.2, convert from the display gamma to linear color space
            vec3 displayToLinear(vec3 color) {
                return pow(color, vec3(0.455));
            }
            // Assuming a gamma of 2.2, convert from linear color space to the display color space
            vec3 linearToDisplay(vec3 color) {
                return pow(color, vec3(2.2));
            }

            // From: https://en.wikipedia.org/wiki/HSL_and_HSV
            vec3 toHsv(vec3 color) {
                color = displayToLinear(color);
                float r = color.r;
                float g = color.g;
                float b = color.b;

                float V = max(max(r, g), b);
                float Xmax = V;
                float Xmin = min(min(r, g), b);
                float C = Xmax - Xmin;
                float H;
                if (C == 0.0) {
                    H = 0.0;
                } else if (V == r) {
                    H = 60.0 * (0.0 + (g - b)/C);
                } else if (V == g) {
                    H = 60.0 * (2.0 + (b - r)/C);
                } else {
                    H = 60.0 * (4.0 + (r - g)/C);
                }
                float S;
                if (V == 0.0) {
                    S = 0.0;
                } else {
                    S = C / V;
                }
                return vec3(H, S, V);
            }

            // This is called 'f(n)' in the "HSV to RGB alternative" section
            // at https://en.wikipedia.org/wiki/HSL_and_HSV
            float fromHsvHelper(float n, vec3 hsv) {
                float H = hsv.x;
                float S = hsv.y;
                float V = hsv.z;

                float k = mod(n + H / 60.0, 6.0);
                return V - V*S*max(0.0, min(min(k, 4.0 - k), 1.0));
            }

            vec3 fromHsv(vec3 hsv) {
                float R = fromHsvHelper(5.0, hsv);
                float G = fromHsvHelper(3.0, hsv);
                float B = fromHsvHelper(1.0, hsv);
                return linearToDisplay(vec3(R, G, B));
            }

            // v has to be in [0, 1]
            float quantize(float v, float levels) {
                return floor(v * levels) / levels;
            }

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
                float hor = edgeStrengthWithDelta(coords, vec2(uInvWidth*1.75, 0.0));
                float ver = edgeStrengthWithDelta(coords, vec2(0.0, uInvHeight*1.75));
                return (abs(hor) + abs(ver)) * 0.5;
            }
            void main() {
                const float PI = 3.1415926535;
                vec4 c = texture2D(uSampler, vTexCoord);

                vec3 hsv = toHsv(c.rgb);

                //hsv.x = quantize(hsv.x / 360.0, 8.0) * 360.0;
                hsv.y = quantize(hsv.y, 8.0);
                hsv.z = quantize(hsv.z, 6.0);
                vec3 outRgb = fromHsv(hsv);

                float edge = edgeStrength(vTexCoord) * uEdgeIntensity;

                outRgb *= 1.0 - smoothstep(0.04, 0.1, edge);

                gl_FragColor = vec4(outRgb, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);

        this.width = 1280;
        this.height = 720;

        this.edgeIntensity = 1;

        if (this.shaderProgram) {
            this.uInvWidth = gl.getUniformLocation(this.shaderProgram, "uInvWidth");
            this.uInvHeight = gl.getUniformLocation(this.shaderProgram, "uInvHeight");
            this.uEdgeIntensity = gl.getUniformLocation(this.shaderProgram, "uEdgeIntensity");
        } else {
            this.uInvWidth = null;
            this.uInvHeight = null;
            this.uEdgeIntensity = null;
        }
    }

    protected updateUniforms(gl: WebGLRenderingContext): void {
        gl.uniform1f(this.uInvWidth, 1 / this.width);
        gl.uniform1f(this.uInvHeight, 1 / this.height);
        gl.uniform1f(this.uEdgeIntensity, this.edgeIntensity);
    }
}

export class CartoonFilter extends FilterBase {
    protected shader: CartoonShader;
    protected rt: RenderTexture;

    constructor(gl: WebGLRenderingContext) {
        super(gl);
        this.gl = gl;
        this.shader = new CartoonShader(gl);
        this.rt = new RenderTexture(gl);
    }

    updateDimensions(inW: number, inH: number, targetDimensions: TargetDimensions): [number, number] {
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

    get edgeIntensity(): number {
        return this.shader.edgeIntensity;
    }
    set edgeIntensity(value: number) {
        this.shader.edgeIntensity = value;
    }
}
