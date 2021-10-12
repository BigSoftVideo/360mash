import { FilterShader, fitToAspect, RenderTexture, TargetDimensions } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const COMIC_FILTER_NAME = "Comic";

export class ComicShader extends FilterShader {
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
            uniform float uScale;
            uniform float uAngle;
            
            mat2 rotate2d(float uAngle){
                return mat2(cos(uAngle), -sin(uAngle), sin(uAngle),cos(uAngle));
            }
                       
            float dotScreen(float scale, float PI) {                
                float s = sin(uAngle);
                float c = cos(uAngle);

                vec2 p = vec2(0.5, 0.5) * (vTexCoord.xy / vec2(uInvWidth, uInvHeight));    //
                vec2 q = rotate2d(uAngle) * p * scale;

                return (sin(q.x) * sin(q.y)) * 4.0;
            }
        
            void main()
            {
                const float PI = 3.1415926535;
                //vec2 uv = fragCoord.xy / iResolution.xy;
                vec4 tex = texture2D(uSampler, vTexCoord);
                
                vec3 outRgb = vec3(tex.r, tex.g, tex.b);
                
                float scale = 1.0 + 0.3 * sin(uScale); 
                outRgb = vec3(outRgb * 10.0 - 5.0 + dotScreen(scale, PI));

                gl_FragColor = vec4(outRgb, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);

        this.width = 1280.0;
        this.height = 720.0;
        this.scale = 0.1;
        this.angle = 0.001;

        if (this.shaderProgram) {
            this.uInvWidth = gl.getUniformLocation(this.shaderProgram, "uInvWidth");
            this.uInvHeight = gl.getUniformLocation(this.shaderProgram, "uInvHeight");
            this.uScale = gl.getUniformLocation(this.shaderProgram, "uScale");
            this.uAngle = gl.getUniformLocation(this.shaderProgram, "uAngle");
        } else {
            this.uInvWidth = null;
            this.uInvHeight = null;
            this.uScale = null;
            this.uAngle = null;
        }
    }

    protected updateUniforms(gl: WebGLRenderingContext): void {
        gl.uniform1f(this.uInvWidth, 1 / this.width);
        gl.uniform1f(this.uInvHeight, 1 / this.height);
        gl.uniform1f(this.uScale, this.scale);
        gl.uniform1f(this.uAngle, this.angle);
    }
}

export class ComicFilter extends FilterBase {
    protected shader: ComicShader;
    protected rt: RenderTexture;

    constructor(gl: WebGLRenderingContext) {
        super(gl);
        this.gl = gl;
        this.shader = new ComicShader(gl);
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

    get scale(): number {
        return this.shader.scale;
    }
    set scale(value: number) {
        this.shader.scale = value;
    }
    get angle(): number {
        return this.shader.angle;
    }
    set angle(value: number) {
        this.shader.angle = value;
    }
}
