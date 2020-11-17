
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>
#include <stdatomic.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

typedef void callback_with_heap_type(int* ptr, int length);

int EMSCRIPTEN_KEEPALIVE just_return_test() {
    return 13;
}

int EMSCRIPTEN_KEEPALIVE heap_test(callback_with_heap_type* cb) {
    int num_elements = 8;
    int* data = malloc(num_elements * sizeof(int));
    for (int i = 0; i < num_elements; i++) {
        data[i] = i;
    }
    cb(data, num_elements);
    int retval = data[3];
    free(data);
    return retval;
}

#ifdef HAVE_AV_CONFIG_H
#undef HAVE_AV_CONFIG_H
#endif

#include <libavformat/avformat.h>
#include <libavformat/avio.h>
#include <libavcodec/avcodec.h>
#include <libavutil/channel_layout.h>
#include <libavutil/common.h>
#include <libavutil/imgutils.h>
#include <libavutil/mathematics.h>
#include <libavutil/samplefmt.h>

// #define AUDIO_INBUF_SIZE 20480
// #define AUDIO_REFILL_THRESH 4096
#define SAMPLE_STEP 512
#define AVIO_READ_BUFFER_SIZE (4096 * 4)


#define DEBUG_PRINT printf("DEBUG %d\n", __LINE__);

char err_str[1024];
#define CHECK_AV_RETVAL(exp) { int macro_retval = exp; if (macro_retval < 0) { av_strerror(macro_retval, err_str, sizeof(err_str)); printf("Error occured (line %d) in an AV function: '%s'\n", __LINE__, err_str); goto cleanup; } }

//typedef int data_read_callback_type(uint8_t* data, int length);
//typedef void decoded_audio_callback_type(float* samples, int num_samples, int num_channels);

/// This function informs the user about some properties of the stream.
/// It is called once for each stream before any of the decoded media callbacks.
///
/// `duration` is the length of the stream in seconds (may be a fraction)
/// `sample_rate` is the number of samples per second in the first audio track.
/// 
/// Note: An estimate for the total sample count may be caluclated by 
/// `duration * sample_rate`. The total number of samples is not provided due to the
/// fear that a precise value cannot be guaranteed. (Essently I'm not sure if the
/// sample rate can change during the stream and how rounding errors might affect
/// the caluclation). 
//typedef void decoded_metadata_callback_type(double duration, int sample_rate);

EM_JS(int, call_js_reader, (int callback_id, uint8_t* buffer, int length), {
    //const callback = Module.userJsCallbacks[callback_id];
    //const retval = callback(buffer, length);
    //return retval;
    return Asyncify.handleSleep(function(wakeUp) {
        const callback = Module.userJsCallbacks[callback_id];
        callback(buffer, length).then(bytesRead => {
            wakeUp(bytesRead);
        });
    });
})

EM_JS(void, call_js_metadata_handler, (int callback_id, double duration, int sample_rate), {
    const callback = Module.userJsCallbacks[callback_id];
    callback(duration, sample_rate);
})

EM_JS(void, call_js_decoded_audio_handler, (int callback_id, float* samples, int num_samples, int num_channels), {
    const callback = Module.userJsCallbacks[callback_id];
    callback(samples, num_samples, num_channels);
})

EM_JS(void, call_js_finished_handler, (int callback_id), {
    const callback = Module.userJsCallbacks[callback_id];
    callback();
})

typedef struct AvReadUserData {
    /// An async callback function defined by the user, that provides encoded stream data to be decoded.
    /// This is called repeatedly to get a new chunk of encoded data every time when it's ready to process more.
    /// Must return 0 on end of file (or end of stream) and a negative number on error.
    int reader_callback_id;
    uint8_t* buffer;
    int buffer_size;
} AvReadUserData;

static int my_decode_func(AVCodecContext *dec_ctx, AVPacket *packet, AVFrame *frame, int audio_handler_id) {
    int ret;
    /* send the packet with the compressed data to the decoder */
    ret = avcodec_send_packet(dec_ctx, packet);
    if (ret < 0) {
        fprintf(stderr, "Error submitting the packet to the decoder\n");
        exit(1);
    }

    /* read all the output frames (in general there may be any number of them */
    while (ret >= 0) {
        ret = avcodec_receive_frame(dec_ctx, frame);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF)
            return ret;
        else if (ret < 0) {
            fprintf(stderr, "Error during decoding\n");
            return ret;
        }
        // So here's the thing: The format `AV_SAMPLE_FMT_S32` and
        // `AV_SAMPLE_FMT_S32P` are actually 24 bits per sample but
        // of course there's no 24 bit wide datatype in C so `libav`
        // chose to call the format S32 to communicate that the proper C
        // type for the array is int32_t. But we have to keep in mind that 
        // the maximum value for such a sample is different from the maximum
        // value of an int32_t. In binary the maximum value of a signed 24 bit
        // integer is 23 ones. (23, because the topmost bit is the sign)
        const int32_t all_ones_32 = ~0;
        const float int24_max = (all_ones_32 >> 9);

        int num_channels = av_get_channel_layout_nb_channels(frame->channel_layout);
        float *samples = malloc(frame->nb_samples * num_channels * sizeof(float));
        switch (frame->format) {
        case AV_SAMPLE_FMT_S16:
            for(int i = 0; i < frame->nb_samples; i++) {
                for (int channel_id = 0; channel_id < num_channels; channel_id++) {
                    float sample = ((int16_t*)frame->data[0])[i * num_channels + channel_id];
                    sample /= INT16_MAX;
                    samples[i * num_channels + channel_id] = sample;
                }
            }
            break;
        case AV_SAMPLE_FMT_S32:
            for(int i = 0; i < frame->nb_samples; i++) {
                for (int channel_id = 0; channel_id < num_channels; channel_id++) {
                    float sample = ((int32_t*)frame->data[0])[i * num_channels + channel_id];
                    sample /= int24_max;
                    samples[i * num_channels + channel_id] = sample;
                }
            }
            break;
        case AV_SAMPLE_FMT_FLT:
            for(int i = 0; i < frame->nb_samples; i++) {
                for (int channel_id = 0; channel_id < num_channels; channel_id++) {
                    float sample = ((float*)frame->data[0])[i * num_channels + channel_id];
                    samples[i * num_channels + channel_id] = sample;
                }
            }
            break;
        case AV_SAMPLE_FMT_S16P:
            for (int channel_id = 0; channel_id < num_channels; channel_id++) {
                for(int i = 0; i < frame->nb_samples; i++) {
                    float sample = ((int16_t*)frame->data[channel_id])[i];
                    sample /= INT16_MAX;
                    samples[i * num_channels + channel_id] = sample;
                }
            }
            break;
        case AV_SAMPLE_FMT_S32P:
            for (int channel_id = 0; channel_id < num_channels; channel_id++) {
                for(int i = 0; i < frame->nb_samples; i++) {
                    float sample = ((int32_t*)frame->data[channel_id])[i];
                    sample /= int24_max; 
                    samples[i * num_channels + channel_id] = sample;
                }
            }
            break;
        case AV_SAMPLE_FMT_FLTP:
            for (int channel_id = 0; channel_id < num_channels; channel_id++) {
                for(int i = 0; i < frame->nb_samples; i++) {
                    float sample = ((float*)frame->data[channel_id])[i];
                    samples[i * num_channels + channel_id] = sample;
                }
            }
            break;
        default:
            printf("Unexpected audio format %d\n", frame->format);
            return INT32_MIN;
            break;
        }
        call_js_decoded_audio_handler(audio_handler_id, samples, frame->nb_samples, num_channels);
        //audio_handler(samples, frame->nb_samples, num_channels);
        free(samples);
    }
    return 0;
}

static int avio_read_packet(void* user_data, uint8_t* target_buf, int buf_size) {
    AvReadUserData *avread_user_data = user_data;
    int availabe_bytes = FFMIN(buf_size, avread_user_data->buffer_size);
    int bytes_read = call_js_reader(avread_user_data->reader_callback_id, avread_user_data->buffer, availabe_bytes);
    //int bytes_read = avread_user_data->reader(avread_user_data->buffer, availabe_bytes);
    if (bytes_read == 0) {
        return AVERROR_EOF;
    }
    if (bytes_read < 0) {
        return AVERROR_UNKNOWN;
    }
    memcpy(target_buf, avread_user_data->buffer, bytes_read);
    return bytes_read;
}


AVFormatContext* format_ctx = NULL;
AVIOContext* io_ctx = NULL;
uint8_t* avio_ctx_buffer = NULL;
AVCodec* codec = NULL;
AVCodecContext* codec_ctx = NULL;
AVPacket* avpacket = NULL;
AVFrame* frame = NULL;
AvReadUserData avread_user_data = {0};
volatile int g_initialized = 0;
volatile int g_event_loop_started = 0;
volatile int g_requested_decode = 0;
volatile int g_reader_id = -1;
volatile int g_metadata_handler_id = -1;
volatile int g_audio_handler_id = -1;
volatile int g_finished_handler_id = -1;
volatile int g_requested_stop = 0;

void decode_main(
    int reader_id,
    int metadata_handler_id,
    int audio_handler_id,
    int finished_handler_id
) {
    if (!g_initialized) {
        fprintf(stderr, "ERROR: chunky boy hasn't finished initializing yet.");
        return;
    }
    // IMPORTANT Reallocating the buffer because it gets freed with the `io_ctx`.
    // Fun fact: without this `avformat_open_input` just hangs without an error message.
    avio_ctx_buffer = av_malloc(AVIO_READ_BUFFER_SIZE);
    if (!avio_ctx_buffer) {
        printf("Could not allocate context\n");
        exit(1);
    }
    avread_user_data.reader_callback_id = reader_id;
    format_ctx = avformat_alloc_context();
    io_ctx = avio_alloc_context(avio_ctx_buffer, AVIO_READ_BUFFER_SIZE, 0, &avread_user_data, &avio_read_packet, NULL, NULL);
    format_ctx->pb = io_ctx;

    emscripten_sleep(1);
    if (g_requested_stop) { printf("reqested_stop was true at line %d. Stopping\n", __LINE__); goto cleanup; }
    CHECK_AV_RETVAL(avformat_open_input(&format_ctx, NULL, NULL, NULL))
    if (g_requested_stop) { printf("reqested_stop was true at line %d. Stopping\n", __LINE__); goto cleanup; }
    CHECK_AV_RETVAL(avformat_find_stream_info(format_ctx, NULL))

    int target_stream_index = -1;
    
    av_init_packet(avpacket);
    avpacket->data = NULL;
    avpacket->size = 0;
    for (;;) {
        if (g_requested_stop) { printf("reqested_stop was true at line %d. Stopping\n", __LINE__); break; }
        int retval = av_read_frame(format_ctx, avpacket);
        if (retval == AVERROR_EOF) break;
        else CHECK_AV_RETVAL(retval)
        AVStream* stream = format_ctx->streams[avpacket->stream_index];
        AVCodecParameters* codecpar = stream->codecpar;
        // if (codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
        //     printf("-- VIDEO METADATA --\n");
        //     AVDictionaryEntry* entry = NULL;
        //     while ((entry = av_dict_get(stream->metadata, "", entry, AV_DICT_IGNORE_SUFFIX))) {
        //         printf("%s = %s\n", entry->key, entry->value);
        //     }
        //     printf("--------------------\n");
        //     
        // }
        if (target_stream_index == -1) {
            if (codecpar->codec_type == AVMEDIA_TYPE_AUDIO) {
                codec = avcodec_find_decoder(codecpar->codec_id);
                codec_ctx = avcodec_alloc_context3(codec);
                CHECK_AV_RETVAL(avcodec_parameters_to_context(codec_ctx, codecpar))
                CHECK_AV_RETVAL(avcodec_open2(codec_ctx, codec, NULL))
                int sample_rate = codecpar->sample_rate;
                double duration = format_ctx->duration / (double)AV_TIME_BASE;
                //metadata_handler(duration, sample_rate);
                call_js_metadata_handler(metadata_handler_id, duration, sample_rate);
                target_stream_index = avpacket->stream_index;
            }
        }
        if (target_stream_index == avpacket->stream_index) {
            int retval = my_decode_func(codec_ctx, avpacket, frame, audio_handler_id);
            if (retval == AVERROR_EOF) {
                break;
            } else if (retval != AVERROR(EAGAIN)) {
                CHECK_AV_RETVAL(retval)
            }
        }
        av_packet_unref(avpacket); // because we use `av_read_frame`
    }

    cleanup:
    // if (frame) av_frame_free(&frame);
    // if (avpacket) av_packet_free(&avpacket);
    if (codec_ctx) {
        avcodec_free_context(&codec_ctx);
        codec_ctx = NULL;
    }
    // // if (avio_ctx_buffer) av_free(avio_ctx_buffer);
    if (io_ctx) { 
        // This frees the avio_ctx_buffer
        av_free(io_ctx);
        io_ctx = NULL;
    }
    if (format_ctx) {
        avformat_free_context(format_ctx);
        format_ctx = NULL;
    }
    // if (avread_user_data.buffer) free(avread_user_data.buffer);
    call_js_finished_handler(finished_handler_id);
}

/// Decodes a stream of bytes containing multimedia content provided by the `reader` callback.
/// 
/// `reader` is a pointer to a callback function defined by the user, that provides encoded stream data to be decoded.
/// This is called repeatedly to get a new chunk of encoded data every time when it's ready to process more.
/// Must return 0 on end of file (or end of stream) and a negative number on error.
/// 
/// `audio_handler`is a pointer to a callback function defined by the user, that handles
/// raw samples of audio data that were decoded from the stream.
void EMSCRIPTEN_KEEPALIVE decode_from_callback(
    int reader_id,
    int metadata_handler_id,
    int audio_handler_id,
    int finished_handler_id
) {
    if (!g_event_loop_started) {
        fprintf(stderr, "`start_event_loop` must be incoked before this function");
    }
    if (g_requested_decode) {
        fprintf(stderr, "Another decoding process is already running. Wait for that to finish before requesting a new decode");
    }

    g_reader_id = reader_id;
    g_metadata_handler_id = metadata_handler_id;
    g_audio_handler_id = audio_handler_id;
    g_finished_handler_id = finished_handler_id;
    g_requested_decode = 1;
}

void EMSCRIPTEN_KEEPALIVE stop_decoding() {
    g_requested_stop = 1;
}

/// Start this function right after initialization.
/// I must be running before any call to decode_from_callback
void EMSCRIPTEN_KEEPALIVE start_event_loop() {
    g_event_loop_started = 1;
    while (1) {
        if (g_requested_decode) {
            printf("setting reqested_stop to false\n");
            g_requested_stop = 0;
            decode_main(
                g_reader_id,
                g_metadata_handler_id,
                g_audio_handler_id,
                g_finished_handler_id
            );
            g_requested_decode = 0;
        }
        emscripten_sleep(50);
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Test things
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

#ifndef __EMSCRIPTEN__

FILE* input_file = NULL;
FILE* svg_file = NULL;

int img_y = 50;
int img_x = 0;

static void add_svg_line(FILE* svg_file, float sample) {
    int y_offset = sample * 50;
    int min_y = img_y - y_offset;
    int max_y = img_y + y_offset;
    fprintf(svg_file, "<line x1='%d' y1='%d' x2='%d' y2='%d' />\n", img_x, min_y, img_x, max_y);
    img_x += 1;
}

// Reads at most `length` number of bytes into the data array which MUST be allocated before this function call.
// Returns the number of bytes read.
static int test_file_read_callback(uint8_t* data, int length) {
    uint8_t bytes_read = fread(data, 1, length, input_file);
    if (bytes_read > 0) return bytes_read;
    if (feof(input_file)) return 0;
    if (ferror(input_file)) {
        perror("Error occured while trying to read the file");
        return -1;
    }
    // Don't ask me why but fread seems to return zero on the first read even though it clearly fills the data array with proper bytes.
    return length;
}

// The number of elemnets in the samples array is exactly `num_samples * num_channels`.
// Channels are interleaved so extracting samples from data with at least two channels would look like the following
// ```
// assert(num_channels >= 2);
// for (int sample_id = 0; sample_id < num_samples; sample_id++) {
//     float sample_ch0 = samples[sample_id * num_channels + 0];
//     float sample_ch1 = samples[sample_id * num_channels + 1];
// }
// ```
static void test_audio_decoded_callback(float* samples, int num_samples, int num_channels) {
    float max_sample = 0;
    for(int i = 0; i < num_samples; i++) {
        float sample = samples[i * num_channels];
        max_sample = fmaxf(fabsf(sample), max_sample);
        if (i % SAMPLE_STEP == 0) {
            add_svg_line(svg_file, max_sample);
            max_sample = 0;
        }
    }
}

static void test_metadata_callback(double duration, int sample_rate) {
    printf("Duration is: %f\n", duration);
    printf("Sample rate is: %d\n", sample_rate);
}

static void my_decoding_test() {
    const char* in_filename = "/home/artur/software/DOTE/additional/chunky-boy/GoPro-Back.mp4";
    const char* svg_filename = "img.svg";
    
    char wd[1024];
    getcwd(wd, 1024);
    printf("Current working dir: '%s'\n", wd);

    svg_file = fopen(svg_filename, "w");
    if (!svg_file) goto cleanup;
    fprintf(svg_file, "<svg width='1280' height='100' style='stroke:rgb(0,0,0);stroke-width:1'>\n");

    input_file = fopen(in_filename, "rb");
    if (!input_file) goto cleanup;

    decode_from_callback(&test_file_read_callback, &test_metadata_callback, &test_audio_decoded_callback);

    fprintf(svg_file, "</svg>\n");

    cleanup:
    if (input_file) fclose(input_file);
    if (svg_file) fclose(svg_file);
}
#endif

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

int main() {
    /* register demuxers */
    av_register_all();
    /* register all the codecs */
    avcodec_register_all();

    avread_user_data.buffer_size = AVIO_READ_BUFFER_SIZE;
    avread_user_data.buffer = malloc(AVIO_READ_BUFFER_SIZE);
    if (!avread_user_data.buffer) {
        printf("Could not allocate avio buffer (at line %d)\n", __LINE__);
        exit(1);
    }
    avpacket = av_packet_alloc();
    frame = av_frame_alloc();

    g_initialized = 1;
    EM_ASM(Module.onChunkyBoyInitialized(););

    return 0;
}
