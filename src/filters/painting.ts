import { FilterShader, fitToAspect, RenderTexture, TargetDimensions } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const PAINTING_FILTER_NAME = "Painting";

export class PaintingShader extends FilterShader {
    width: number;
    height: number;
    edgeIntensity: number;
    colorCount: number;
    colorBright: number;

    protected uInvWidth: WebGLUniformLocation | null;
    protected uInvHeight: WebGLUniformLocation | null;
    protected uEdgeIntensity: WebGLUniformLocation | null;
    protected uColorCount: WebGLUniformLocation | null;
    protected uColorBright: WebGLUniformLocation | null;

    constructor(gl: WebGL2RenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;

            uniform float uInvWidth;
            uniform float uInvHeight;
            uniform float uEdgeIntensity;
            uniform float uColorCount;
            uniform float uColorBright;
            uniform sampler2D uSampler;
            uniform float uCsMax;
            uniform float uCsMin;

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

            vec3 dirBlur(vec2 coords, vec2 direction){
                vec3 outC = vec3(0.0);
                const int radius = 8;
                const float count = float(2*radius + 1);             
                float weightSum = 0.0;

                for(int i = -radius; i <= radius; i++){
                    vec2 pos = coords + direction * float(i);
                    vec3 c = texture2D(uSampler, pos).rgb;
                    float weight = 1.0 - abs(float(i)) / float(radius);
                    outC += c * weight;
                    weightSum += weight;
                }
                return outC / weightSum;
            }       
            
            vec2 edgeDirection(vec2 coords){
                float hor = edgeStrengthWithDelta(coords, vec2(uInvWidth*1.75, 0.0));
                float ver = edgeStrengthWithDelta(coords, vec2(0.0, uInvHeight*1.75));
                return vec2(ver, -hor);
            }

            void main() {
                const float PI = 3.1415926535;
                vec4 c = texture2D(uSampler, vTexCoord);
                
                const int rad = 10;
                vec2 aggregate = vec2(0.0);
                for(int x = -rad; x <= rad; x++){
                    for (int y = -rad; y <= rad; y++){
                        vec2 edge = edgeDirection(vTexCoord + vec2(float(x), float(y)) * 0.002);
                        aggregate += edge;
                        //float d = dot(normalize(aggregate), normalize(edge));
                        //if(d < 0.0) {
                        //    aggregate += edge * -1.0;
                        //}
                        //else {
                        //    aggregate += edge;
                        //}                       
                    }
                }
                const int count = (2 * rad + 1) * (2 * rad + 1);
                aggregate = aggregate / float(count);

                //vec3 outRgb = c.rgb;
                //if (vTexCoord.x > 0.5) {
                //    vec2 edge = edgeDirection(vTexCoord);
                //    outRgb = vec3(aggregate.y * 20.0);
                //}
                vec3 outRgb = dirBlur(vTexCoord, aggregate * 0.1);
                //float edge = edgeStrength(vTexCoord) * uEdgeIntensity;
                //vec3 outRgb *= 1.0 - smoothstep(0.04, 0.1, edge);

                gl_FragColor = vec4(outRgb, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);

        this.width = 1280;
        this.height = 720;
        this.colorCount = 6.0;
        this.edgeIntensity = 1;
        this.colorBright = 10;

        if (this.shaderProgram) {
            this.uInvWidth = gl.getUniformLocation(this.shaderProgram, "uInvWidth");
            this.uInvHeight = gl.getUniformLocation(this.shaderProgram, "uInvHeight");
            this.uEdgeIntensity = gl.getUniformLocation(this.shaderProgram, "uEdgeIntensity");
            this.uColorCount = gl.getUniformLocation(this.shaderProgram, "uColorCount");
            this.uColorBright = gl.getUniformLocation(this.shaderProgram, "uColorBright");
        } else {
            this.uInvWidth = null;
            this.uInvHeight = null;
            this.uEdgeIntensity = null;
            this.uColorCount = null;
            this.uColorBright = null;
        }
    }

    protected updateUniforms(gl: WebGL2RenderingContext): void {
        gl.uniform1f(this.uInvWidth, 1 / this.width);
        gl.uniform1f(this.uInvHeight, 1 / this.height);
        gl.uniform1f(this.uEdgeIntensity, this.edgeIntensity);
        gl.uniform1f(this.uColorCount, this.colorCount);
        gl.uniform1f(this.uColorBright, this.colorBright);
    }
}

export class PaintingFilter extends FilterBase {
    protected shader: PaintingShader;
    protected rt: RenderTexture;

    constructor(gl: WebGL2RenderingContext) {
        super(gl);
        this.gl = gl;
        this.shader = new PaintingShader(gl);
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

    get edgeIntensity(): number {
        return this.shader.edgeIntensity;
    }
    set edgeIntensity(value: number) {
        this.shader.edgeIntensity = value;
    }

    get colorCount(): number {
        return this.shader.colorCount;
    }
    set colorCount(value: number) {
        this.shader.colorCount = value;
    }
    
    get colorBright(): number {
        return this.shader.colorBright;
    }
    set colorBright(value: number) {
        this.shader.colorBright = value;
    }
}
