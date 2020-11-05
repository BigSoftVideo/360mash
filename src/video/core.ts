import { read } from "fs";

export interface GlTexture {
    readonly width: number;
    readonly height: number;
    readonly texture: WebGLTexture;
}

export interface MappedParameters {
    fovY: number;
    rotRight: number;
    rotUp: number;
}

export abstract class ProjectionShader {
    protected shaderProgram: WebGLProgram | null;
    protected outTexture: WebGLTexture | null;
    protected vertexBuffer: WebGLBuffer | null;
    protected indexBuffer: WebGLBuffer | null;
    constructor(
        gl: WebGLRenderingContext,
        vertexShader: WebGLShader,
        fragmentShader: WebGLShader
    ) {
        this.shaderProgram = gl.createProgram();
        this.outTexture = gl.createTexture();
        this.vertexBuffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();
        if (!this.shaderProgram || !this.outTexture) {
            console.error("Cannot create shader program.");
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
            1.0, // tex coords

            1.0,
            -1.0,
            1.0,
            1.0,

            1.0,
            1.0,
            1.0,
            0.0,

            -1.0,
            1.0,
            0.0,
            0.0,
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

        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(uSampler, 0);
        gl.bindTexture(gl.TEXTURE_2D, this.outTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            2,
            2,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            defaultTexture
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        // On webgl1, if the wrap is not set to CLAMP_TO_EDGE then non-power-of-two textures
        // are not allowed. Otherwise it won't give an error, it'll just give all black pixels.
        // but we are using webgl2 so this doesn't affect this code.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    }

    // Implementors should store apply their mapping (usually limiting to range)
    // and then store the mapped parameters. The parameters should be sent to the
    // uniforms of the shader at the render function
    abstract updateParameters(mappedParameters: MappedParameters, aspect: number): void;

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
