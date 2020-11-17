## chunky-boy

A wasm targeted library for decoding and encoding multimedia in chunks.


When using the library only the `chunky-boy.js`, `chunky-boy.worker.js`, and `chunky-boy.wasm` files are needed however be careful to conform to the license. (License.md)

## Building

The library depends on libav and was compiled to WebAssembly with emscripten `v2.0.8`. Note that this library is intended to be compiled on Linux.

To build the library make sure the terminal is in an emscripten environment (see https://emscripten.org/docs/getting_started/downloads.html). At the time of writing this can be achieved by executing the following in the emscripten folder.
```
source ./emsdk_env.sh
```
Once that's done, navigate to the `chunky-boy` folder using the same terminal and execute
```
./build.sh
```
This might return with "Permission denied" in this case run `chmod +x build.sh` and then try again.

If libav is needed to be rebuilt then read `building libav for wasm.txt`.

## License

Refer to `License.md`.

