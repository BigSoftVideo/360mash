import { read } from "fs";

/** Once the user specifies the output dimension the final resolution might slightly differ
 * from the specified resolution.
 *
 * For example if the user specifies 720p (1280*720) but the output video is an equirectangular
 * video, then the output must have an aspect ratio of 2. But the standard 720p aspect ratio is
 * 16:9.
 *
 * The exact contents of this interface might change in the future.
 */
export interface TargetDimensions {
    width: number;
    height: number;
}

export function getTargetAspect(dimensions: TargetDimensions): number {
    return dimensions.width / dimensions.height;
}

/** Returns a pair of width and height, that closely match the resolution of `dimensions`
 * but prioritizes to match the aspect ratio specified by `targetAspect`.
 *
 * The aspect ratio of the output dimensions will be practically identical to `targetAspect` but the
 * resolution might be different from `dimensions`.
 *
 * The resulting dimensions will both be an even number. This is to ensure that we can produce
 * a yuv420p output where U and V channels have a size that exactly half along both dimensions.
 *
 * The exact method of how the resulting resolution is found, may change in the future.
 */
export function fitToAspect(
    dimensions: TargetDimensions,
    targetAspect: number
): [number, number] {
    // In this current implementation, let's just try to maximize the output resolution
    let originalAspect = dimensions.width / dimensions.height;
    if (originalAspect > targetAspect) {
        // The original is wider than the target, so in order to maximize the resolution,
        // we should match to the width of the original

        let outW = Math.trunc(dimensions.width);
        // We make sure that the output dimensions are even numbers. See doc comment above for why.
        if (outW % 2 != 0) {
            outW += 1;
        }
        let outH = Math.floor(outW / targetAspect);
        if (outH % 2 != 0) {
            outH += 1;
        }
        return [outW, outH];
    } else {
        // The original is taller than the target
        let outH = Math.trunc(dimensions.height);
        // We make sure that the output dimensions are even numbers. See doc comment above for why.
        if (outH % 2 != 0) {
            outH += 1;
        }
        let outW = Math.floor(outH * targetAspect);
        if (outW % 2 != 0) {
            outW += 1;
        }
        return [outW, outH];
    }
}

export interface GlTexture {
    readonly width: number;
    readonly height: number;
    readonly texture: WebGLTexture;
}

function fbStatusToText(gl: WebGLRenderingContext, status: number): string {
    if (status == gl.FRAMEBUFFER_COMPLETE) {
        return "FRAMEBUFFER_COMPLETE";
    }
    if (status == gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT) {
        return "FRAMEBUFFER_INCOMPLETE_ATTACHMENT";
    }
    if (status == gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS) {
        return "FRAMEBUFFER_INCOMPLETE_DIMENSIONS";
    }
    if (status == gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT) {
        return "FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";
    }
    if (status == gl.FRAMEBUFFER_UNSUPPORTED) {
        return "FRAMEBUFFER_UNSUPPORTED";
    }
    return "UNKNOWN framebuffer status 0x" + status.toString(16);
}

export class RenderTexture {
    gl: WebGLRenderingContext;
    color: WebGLTexture;
    width: number;
    height: number;
    framebuffer: WebGLFramebuffer;

    /** The value passed to `texImage2D` `internalFormat` */
    readonly internalFormat: number;

    /** The value passed to `texImage2D` `format` */
    readonly format: number;

    /**
     * @param internalFormat Passed into `texImage2D` `internalFormat` when allocating the image.
     * Can be for example RGBA or R8.
     */
    constructor(gl: WebGL2RenderingContext, internalFormat: number) {
        this.gl = gl;
        this.width = 2;
        this.height = 2;
        let color = gl.createTexture();
        if (!color) {
            throw new Error("Could not create texture." + gl.getError());
        }
        let framebuffer = gl.createFramebuffer();
        if (!framebuffer) {
            throw new Error("Could not create framebuffer: " + gl.getError());
        }
        this.color = color;

        let format = gl.RGBA;
        if (internalFormat === gl.RGBA) {
            format = internalFormat;
        } else if (internalFormat === gl.R8) {
            // According to: https://www.khronos.org/registry/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
            format = gl.RED;
        } else {
            throw new Error("Framebuffer format not supported: " + internalFormat);
        }
        this.format = format;
        this.internalFormat = internalFormat;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.color);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            internalFormat,
            this.width,
            this.height,
            0,
            format,
            gl.UNSIGNED_BYTE,
            null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        this.framebuffer = framebuffer;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
        let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (gl.FRAMEBUFFER_COMPLETE !== status) {
            console.warn(
                "Failed creating the framebuffer. Status was: " + fbStatusToText(gl, status)
            );
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    dispose() {
        this.gl.deleteFramebuffer(this.framebuffer);
        this.gl.deleteTexture(this.color);
    }

    ensureDimensions(w: number, h: number) {
        let gl = this.gl;
        w = Math.trunc(w);
        h = Math.trunc(h);
        if (w !== this.width || h !== this.height) {
            this.width = w;
            this.height = h;
            gl.bindTexture(gl.TEXTURE_2D, this.color);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                this.internalFormat,
                this.width,
                this.height,
                0,
                this.format,
                gl.UNSIGNED_BYTE,
                null
            );
        }
    }
}

export abstract class FilterShader {
    protected gl: WebGLRenderingContext;
    protected shaderProgram: WebGLProgram | null;
    //protected outTexture: WebGLTexture | null;
    protected vertexBuffer: WebGLBuffer | null;
    protected indexBuffer: WebGLBuffer | null;
    constructor(gl: WebGLRenderingContext, fragmentShader: WebGLShader) {
        this.gl = gl;
        let vertexSrc = `
            attribute vec4 position;
            attribute vec2 texCoord;
            varying vec2 vTexCoord;
            void main() {
                vTexCoord = texCoord;
                gl_Position = position;
            }
        `;
        let vertexShader = FilterShader.createShader(gl, gl.VERTEX_SHADER, vertexSrc);
        this.shaderProgram = gl.createProgram();
        //this.outTexture = gl.createTexture();
        this.vertexBuffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();
        if (!this.shaderProgram) {
            console.error("Cannot create shader program or texture.");
            return;
        }
        gl.attachShader(this.shaderProgram, fragmentShader);
        gl.attachShader(this.shaderProgram, vertexShader);
        gl.linkProgram(this.shaderProgram);
        let success = gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS);
        if (!success) {
            console.error("ERROR linking shader: " + gl.getProgramInfoLog(this.shaderProgram));
            return;
        }
        gl.useProgram(this.shaderProgram);
        let positionAttrib = gl.getAttribLocation(this.shaderProgram, "position");
        let texCoordAttrib = gl.getAttribLocation(this.shaderProgram, "texCoord");
        let uSampler = gl.getUniformLocation(this.shaderProgram, "uSampler");

        let textureData = [0, 0, 0, 255, 250, 10, 10, 255, 10, 250, 10, 255, 10, 10, 250, 255];
        let defaultTexture = new Uint8Array(textureData);

        let vertices = [
            -1.0,
            -1.0, // position
            0.0,
            0.0, // tex coords

            1.0,
            -1.0,
            1.0,
            0.0,

            1.0,
            1.0,
            1.0,
            1.0,

            -1.0,
            1.0,
            0.0,
            1.0,
        ];
        let floatSize = 4; // size of a 32bit float in bytes

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(positionAttrib);
        gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, 4 * floatSize, 0);
        gl.enableVertexAttribArray(texCoordAttrib);
        gl.vertexAttribPointer(
            texCoordAttrib,
            2,
            gl.FLOAT,
            false,
            4 * floatSize,
            2 * floatSize
        );

        let indices = [0, 1, 2, 0, 2, 3];
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        //gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(uSampler, 0);
    }

    /**
     * Releases all webgl resources owned by this instance.
     */
    dispose() {
        let gl = this.gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.deleteBuffer(gl.ELEMENT_ARRAY_BUFFER);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.deleteBuffer(gl.ARRAY_BUFFER);
        gl.deleteProgram(this.shaderProgram);
    }

    protected abstract updateUniforms(gl: WebGLRenderingContext): void;

    protected useProgram(gl: WebGLRenderingContext) {
        gl.useProgram(this.shaderProgram);
        //gl.bindTexture(gl.TEXTURE_2D, this.outTexture);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    }

    public draw(gl: WebGLRenderingContext) {
        this.useProgram(gl);
        this.updateUniforms(gl);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    public static createShader(
        gl: WebGLRenderingContext,
        type: number,
        source: string
    ): WebGLShader {
        let shader = gl.createShader(type);
        if (!shader) {
            throw "Cannot create shader.";
        }
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (success) {
            return shader;
        }
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        throw "Failed to compile shader source.";
    }
}
