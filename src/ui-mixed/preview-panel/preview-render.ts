import { MappedParameters, ProjectionShader } from "../../video/core";

export class Regular2DProjectionShader extends ProjectionShader {
    protected uYaw: WebGLUniformLocation | null;
    protected uPitch: WebGLUniformLocation | null;
    protected uFov: WebGLUniformLocation | null;
    protected parameters: MappedParameters;
    constructor(gl: WebGLRenderingContext) {
        let vertexSrc = `
            attribute vec4 position;
            attribute vec2 texCoord;
            varying vec2 vTexCoord;
            void main() {
                vTexCoord = texCoord;
                gl_Position = position;
            }`;
        let fragmentSrc = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform float uYaw;
            uniform float uPitch;
            uniform float uFov;
            void main() {
                const float PI = 3.1415926535;
                float scaling = uFov / PI;
                vec2 center = vec2(uYaw / (PI*2.0) + 0.5, uPitch / PI + 0.5);
                gl_FragColor = texture2D(uSampler, center + (vTexCoord - vec2(0.5)) * scaling);
            }`;
        let vertexShader = ProjectionShader.createShader(gl, gl.VERTEX_SHADER, vertexSrc);
        let fragmentShader = ProjectionShader.createShader(
            gl,
            gl.FRAGMENT_SHADER,
            fragmentSrc
        );
        super(gl, vertexShader, fragmentShader);
        if (this.shaderProgram) {
            this.uYaw = gl.getUniformLocation(this.shaderProgram, "uYaw");
            this.uPitch = gl.getUniformLocation(this.shaderProgram, "uPitch");
            this.uFov = gl.getUniformLocation(this.shaderProgram, "uFov");
        } else {
            this.uYaw = null;
            this.uPitch = null;
            this.uFov = null;
        }
        this.parameters = {
            fovY: Math.PI,
            rotUp: 0,
            rotRight: 0,
        };
    }

    updateParameters(mappedParameters: MappedParameters, aspect: number) {
        let yaw = mappedParameters.rotUp;
        let pitch = mappedParameters.rotRight;
        let scaling = mappedParameters.fovY / Math.PI;
        let x = yaw / (Math.PI * 2.0) + 0.5;
        x = Math.max(scaling * 0.5, Math.min(1.0 - scaling * 0.5, x));
        let y = pitch / Math.PI + 0.5;
        y = Math.max(scaling * 0.5, Math.min(1.0 - scaling * 0.5, y));

        this.parameters.fovY = mappedParameters.fovY;
        this.parameters.rotRight = (y - 0.5) * Math.PI;
        this.parameters.rotUp = (x - 0.5) * (Math.PI * 2.0);
        return { ...this.parameters };
    }

    updateUniforms(gl: WebGLRenderingContext) {
        gl.uniform1f(this.uYaw, this.parameters.rotUp);
        gl.uniform1f(this.uPitch, this.parameters.rotRight);
        gl.uniform1f(this.uFov, this.parameters.fovY);
    }

    mapParameters(fovY: number, rotRight: number, rotUp: number): [number, number, number] {
        let yaw = rotUp;
        let pitch = rotRight;
        let scaling = fovY / Math.PI;
        let x = yaw / (Math.PI * 2.0) + 0.5;
        x = Math.max(scaling * 0.5, Math.min(1.0 - scaling * 0.5, x));
        let y = pitch / Math.PI + 0.5;
        y = Math.max(scaling * 0.5, Math.min(1.0 - scaling * 0.5, y));
        return [fovY, (y - 0.5) * Math.PI, (x - 0.5) * (Math.PI * 2.0)];
    }
}
