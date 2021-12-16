import { FilterShader, fitToAspect, RenderTexture, TargetDimensions } from "../video/core";
import { FilterBase } from "../video/filter-base";

export const NEWSPRINT_FILTER_NAME = "News Print";

//Could be used with the cartoon shader to get interesting result
export class NewsPrintShader extends FilterShader {
    width: number;
    height: number;
    scale: number;
    angle: number;
    brightness: number;

    protected uInvWidth: WebGLUniformLocation | null;
    protected uInvHeight: WebGLUniformLocation | null;
    protected uScale: WebGLUniformLocation | null;
    protected uAngle: WebGLUniformLocation | null;
    protected uBrightness: WebGLUniformLocation | null;

    constructor(gl: WebGL2RenderingContext) {
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;

            uniform float uInvWidth;
            uniform float uInvHeight;
            uniform float uScale;
            uniform float uAngle;
            uniform float uBrightness;
            
            float degToRad(float degree){
                float PI = 3.1415926535;
                return degree * (PI / 180.0);
            }

            mat2 rotate2d(){
                return mat2(cos(uAngle), -sin(uAngle), sin(uAngle), cos(uAngle));
            }
                       
            float dotScreen(float scale, vec2 uv) {                
                vec2 p = vec2(0.7, 0.7) * vTexCoord / vec2(uInvWidth, uInvHeight);
                vec2 q = rotate2d() * p * scale;

                return (sin(q.x) * sin(q.y)) * 5.0;
            }
        
            void main()
            {
                vec4 tex = texture2D(uSampler, vTexCoord);          
                vec2 uv = vTexCoord / vec2(uInvWidth, uInvHeight);
                vec3 outRgb = tex.rgb;
                
                float scale = 0.3 + 0.8 * uScale; 
                outRgb = outRgb * uBrightness - vec3(5.0 + dotScreen(scale, uv));

                gl_FragColor = vec4(outRgb, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);

        this.width = 1280.0;
        this.height = 720.0;
        this.scale = 0.43;
        this.angle = 2.5;
        this.brightness = 9.5;

        if (this.shaderProgram) {
            this.uInvWidth = gl.getUniformLocation(this.shaderProgram, "uInvWidth");
            this.uInvHeight = gl.getUniformLocation(this.shaderProgram, "uInvHeight");
            this.uScale = gl.getUniformLocation(this.shaderProgram, "uScale");
            this.uAngle = gl.getUniformLocation(this.shaderProgram, "uAngle");
            this.uBrightness = gl.getUniformLocation(this.shaderProgram, "uBrightness");
        } else {
            this.uInvWidth = null;
            this.uInvHeight = null;
            this.uScale = null;
            this.uAngle = null;
            this.uBrightness = null;
        }
    }

    protected updateUniforms(gl: WebGL2RenderingContext): void {
        gl.uniform1f(this.uInvWidth, 1 / this.width);
        gl.uniform1f(this.uInvHeight, 1 / this.height);
        gl.uniform1f(this.uScale, this.scale);
        gl.uniform1f(this.uAngle, this.degToRad(this.angle));
        gl.uniform1f(this.uBrightness, this.brightness);
    }

    degToRad(deg: number) {
        return deg * (Math.PI / 180.0);
    }
}

export class NewsPrintFilter extends FilterBase {
    protected shader: NewsPrintShader;
    protected rt: RenderTexture;

    constructor(gl: WebGL2RenderingContext) {
        super(gl);
        this.gl = gl;
        this.shader = new NewsPrintShader(gl);
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
    get brightness(): number {
        return this.shader.brightness;
    }
    set brightness(value: number) {
        this.shader.brightness = value;
    }
}
