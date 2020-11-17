
.DEFAULT_GOAL := default

CFLAGS := -Wno-gnu-zero-variadic-macro-arguments -Wno-deprecated-declarations -Wall -Wextra -Werror -pedantic
LDFLAGS := $(shell PKG_CONFIG_PATH=$(EM_PKG_CONFIG_PATH):$(PKG_CONFIG_PATH) pkg-config --cflags --libs --static libavformat libavcodec)
default:
	gcc -g $(CFLAGS) -o chunky-boy.bin src/*.c $(LDFLAGS)

wasm:
	emcc -v -g -O2 $(CFLAGS) -L./dep -o chunky-boy.js \
		--pre-js src/pre.js \
		-s EXPORT_NAME='"chunky_boy"' \
		-s EXPORTED_FUNCTIONS='["_main", "_just_return_test", "_heap_test", "_decode_from_callback", "_stop_decoding", "_start_event_loop"]' \
		-s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "addFunction", "removeFunction"]' \
		-s RESERVED_FUNCTION_POINTERS=10 \
		-s TOTAL_MEMORY=209715200 \
		-s ABORTING_MALLOC=0 \
		-s ASYNCIFY=1 \
		-s ASYNCIFY_IMPORTS='["call_js_reader", "emscripten_sleep", "emscripten_yield"]' \
		-s ASSERTIONS=2 \
		src/*.c $(LDFLAGS)
