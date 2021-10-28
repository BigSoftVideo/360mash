import { TargetDimensions, RenderTexture, FilterShader } from "../video/core";
import { FilterBase } from "../video/filter-base";

/** Takes an input of three textures: the Y, the U, and the V channel each in a separate texture.
 *
 * To be pedantic, this is actually a YCbCr to RGB conversion (because the input values are unsigned)
 *
 * Render an RGB image
 *
 */
export class PlanarYuvToRgbShader extends FilterShader {
    protected uTexY: WebGLUniformLocation | null;
    protected uTexU: WebGLUniformLocation | null;
    protected uTexV: WebGLUniformLocation | null;

    constructor(gl: WebGL2RenderingContext) {
        // THE SOURCE OF THIS FORMULA IS: https://en.wikipedia.org/wiki/YCbCr
        // I decided to find a forumla that contains the offset by 16 (FOOTROOM)
        // because I found that ffmpeg provides the values with the footroom
        // when specifying the yuv420p as the pixel format

        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uTexY;
            uniform sampler2D uTexU;
            uniform sampler2D uTexV;

            void main() {
                const float PI = 3.1415926535;
                const float FOOTROOM = 16.0 / 255.0;
                const float HEADROOM_SCALE = 255.0 / 219.0;

                const float K_R = 1.59602678571429;
                const float K_B = 2.01723214285714;
                const float K_Gr = 0.299 / 0.587;
                const float K_Gb = 0.114 / 0.587;

                float Y = texture2D(uTexY, vTexCoord).x;
                float U = texture2D(uTexU, vTexCoord).x;
                float V = texture2D(uTexV, vTexCoord).x;

                // Full swing Y value
                float Y_full = (Y - FOOTROOM) * HEADROOM_SCALE;

                float r_0 = K_R * (V - 0.5);
                float b_0 = K_B * (U - 0.5);

                float r = Y_full + r_0;
                float g = Y_full - K_Gb * b_0 - K_Gr * r_0;
                float b = Y_full + b_0;

                gl_FragColor = vec4(vec3(r, g, b), 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);

        if (this.shaderProgram) {
            this.uTexY = gl.getUniformLocation(this.shaderProgram, "uTexY");
            this.uTexU = gl.getUniformLocation(this.shaderProgram, "uTexU");
            this.uTexV = gl.getUniformLocation(this.shaderProgram, "uTexV");
        } else {
            this.uTexY = null;
            this.uTexU = null;
            this.uTexV = null;
        }
    }
    protected updateUniforms(gl: WebGL2RenderingContext): void {
        gl.uniform1i(this.uTexY, 0);
        gl.uniform1i(this.uTexU, 1);
        gl.uniform1i(this.uTexV, 2);
    }
}

/**
 * Produces the Y channel image of a YUV image.
 */
export class RgbToYShader extends FilterShader {
    constructor(gl: WebGL2RenderingContext) {
        // For more info, see the PlanarYuvToRgbShader

        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uRgbTex;

            void main() {
                const float FOOTROOM = 16.0 / 255.0;

                const float HEADROOM_SHRINK = 219.0 / 255.0;
                const float K_R = 0.299 * HEADROOM_SHRINK;
                const float K_G = 0.587 * HEADROOM_SHRINK;
                const float K_B = 0.114 * HEADROOM_SHRINK;
                
                vec3 rgb = texture2D(uRgbTex, vTexCoord).rgb;
                float Y = rgb.r * K_R + rgb.g * K_G + rgb.b * K_B + FOOTROOM;

                gl_FragColor = vec4(Y, 1.0, 1.0, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);
    }
    protected updateUniforms(gl: WebGL2RenderingContext): void {}
}

/**
 * Produces the U channel image of a YUV image. AKA the Cb channel
 */
export class RgbToUShader extends FilterShader {
    constructor(gl: WebGL2RenderingContext) {
        // For more info, see the PlanarYuvToRgbShader

        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uRgbTex;

            void main() {
                const float K_R = -0.148;
                const float K_G = -0.290992;
                const float K_B = 0.4392;

                vec3 rgb = texture2D(uRgbTex, vTexCoord).rgb;
                float U = 0.5 + K_R * rgb.r + K_G * rgb.g + K_B * rgb.b;

                gl_FragColor = vec4(U, 1.0, 1.0, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);
    }
    protected updateUniforms(gl: WebGL2RenderingContext): void {}
}

/**
 * Produces the V channel image of a YUV image. AKA the Cr channel
 */
export class RgbToVShader extends FilterShader {
    constructor(gl: WebGL2RenderingContext) {
        // For more info, see the PlanarYuvToRgbShader

        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uRgbTex;

            void main() {
                const float K_R = 0.4392;
                const float K_G = -0.367788;
                const float K_B = -0.0714;

                vec3 rgb = texture2D(uRgbTex, vTexCoord).rgb;
                float V = 0.5 + K_R * rgb.r + K_G * rgb.g + K_B * rgb.b;

                gl_FragColor = vec4(V, 1.0, 1.0, 1.0);
            }`;
        let fragmentShader = FilterShader.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        super(gl, fragmentShader);
    }
    protected updateUniforms(gl: WebGL2RenderingContext): void {}
}
