import { FilterShader, fitToAspect, RenderTexture, TargetDimensions } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const PAINTING_FILTER_NAME = "Painting";

export class PaintingShaderEdge extends FilterShader {

    constructor(gl: WebGL2RenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;

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

            vec3 dirBlur(vec2 coords, vec2 direction){
                vec3 outC = vec3(0.0);
                const int radius = 12;
                const float count = float(2*radius + 1);             
                float weightSum = 0.0;

                for(int i = -radius; i <= radius; i++){
                    vec2 pos = coords + direction * float(i);
                    vec3 c = texture2D(uSampler, pos).rgb;
                    float weight = 1.0 - abs(float(i)) / float(radius + 1);
                    outC += c * weight;
                    weightSum += weight;
                }
                return outC / weightSum;
            }       
            
            vec2 edgeDirection(vec2 coords){
                float hor = edgeStrengthWithDelta(coords, vec2(0.001, 0.0));
                float ver = edgeStrengthWithDelta(coords, vec2(0.0, 0.001));
                return vec2(ver, -hor);
            }

            void main() {
                const float PI = 3.1415926535;
                vec4 c = texture2D(uSampler, vTexCoord);
               
                vec2 edge = (edgeDirection(vTexCoord) + vec2(1.0)) * 0.5;

                gl_FragColor = vec4(edge, 1.0, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);
    }

    protected updateUniforms(gl: WebGL2RenderingContext): void {}
}

export class PaintingFilter extends FilterBase {
    protected shader: PaintingShader;
    protected edgeShader: PaintingShaderEdge;
    protected edgeRt: RenderTexture;
    protected rt: RenderTexture;

    
    constructor(gl: WebGL2RenderingContext) {
        super(gl);
        this.gl = gl;

        this.shader = new PaintingShader(gl);
        this.rt = new RenderTexture(gl, gl.RGBA);

        this.edgeShader = new PaintingShaderEdge(gl);
        this.edgeRt = new RenderTexture(gl, gl.RGBA);
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
        this.edgeRt.ensureDimensions(outW, outH);
        return [outW, outH];
    }

    dispose(): void {
        this.rt.dispose();
        this.shader.dispose();
    }
    execute(source: WebGLTexture): RenderTexture {
        let gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeRt.framebuffer);
        gl.viewport(0, 0, this.edgeRt.width, this.edgeRt.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source);
        this.edgeShader.draw(gl);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rt.framebuffer);
        gl.viewport(0, 0, this.rt.width, this.rt.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.edgeRt.color);
        this.shader.draw(gl);
        return this.rt;
    }

    get intensity(): number {
        return this.shader.intensity;
    }
    set intensity(value: number) {
        this.shader.intensity = value;
    }
    
    get radius(): number {
        return this.shader.radius;
    }
    set radius(value: number) {
        this.shader.radius = value;
    }
}


export class PaintingShader extends FilterShader {
    intensity: number;
    radius: number;

    protected uIntensity: WebGLUniformLocation | null;
    protected uRadius: WebGLUniformLocation | null;

    constructor(gl: WebGL2RenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform sampler2D uEdgeSampler;

            uniform float uIntensity;
            uniform float uRadius;

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

            vec3 dirBlur(vec2 coords, vec2 direction){
                vec3 outC = vec3(0.0);
                const int radius = 12;
                const float count = float(2*radius + 1);             
                float weightSum = 0.0;

                for(int i = -radius; i <= radius; i++){
                    vec2 pos = coords + direction * float(i);
                    vec3 c = texture2D(uSampler, pos).rgb;
                    float weight = 1.0 - abs(float(i)) / float(radius + 1);
                    outC += c * weight;
                    weightSum += weight;
                }
                return outC / weightSum;
            }       
            
            vec2 edgeDirection(vec2 coords){
                float hor = edgeStrengthWithDelta(coords, vec2(0.001, 0.0));
                float ver = edgeStrengthWithDelta(coords, vec2(0.0, 0.001));
                return vec2(ver, -hor);
            }

            void main() {
                const float PI = 3.1415926535;
                vec4 c = texture2D(uSampler, vTexCoord);
        
                const int rad = 8;
                vec2 aggregate = vec2(0.0);
                float weightSum = 0.0;
                for(int x = -rad; x <= rad; x++){
                    for (int y = -rad; y <= rad; y++){
                        vec2 edgeTex = texture2D(uEdgeSampler, vTexCoord + vec2(float(x), float(y)) * (0.002 * uRadius)).xy;
                        vec2 edge = (edgeTex * 2.0) - vec2(1.0);
        
                        float weight = 1.0 - sqrt(float(x*x + y*y)) / sqrt(float(rad*rad + rad*rad + 1));
                        aggregate += edge * weight;
                        weightSum += weight;                   
                    }
                }
                aggregate = aggregate / weightSum;

                //vec3 outC;
                //if (vTexCoord.x < 0.5) {
                //    outC = c.rgb;
                //} else {
                //    outC = vec3(texture2D(uEdgeSampler, vTexCoord).r);
                //}

                vec3 outRgb = dirBlur(vTexCoord, aggregate * uIntensity * 0.1);

                gl_FragColor = vec4(outRgb, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);

        this.radius = 10;
        this.intensity = 1;

        if (this.shaderProgram) {
            this.uRadius = gl.getUniformLocation(this.shaderProgram, "uRadius");
            this.uIntensity = gl.getUniformLocation(this.shaderProgram, "uIntensity");

            const uSampler = gl.getUniformLocation(this.shaderProgram, "uSampler");
            gl.uniform1i(uSampler, 0);
            const uEdgeSampler = gl.getUniformLocation(this.shaderProgram, "uEdgeSampler");
            gl.uniform1i(uEdgeSampler, 1);
            
        } else {
            this.uIntensity = null;
            this.uRadius = null;
        }
    }

    protected updateUniforms(gl: WebGL2RenderingContext): void {
        gl.uniform1f(this.uRadius, this.radius);
        gl.uniform1f(this.uIntensity, this.intensity);
    }
}