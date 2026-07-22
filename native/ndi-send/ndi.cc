// Dome Studio Pro — minimal NDI® sender (N-API).
// Dynamically loads the NDI runtime DLL via NDI_RUNTIME_DIR_V6 (no import-lib linking) so the addon
// builds without the SDK's .lib and degrades gracefully when the free NDI runtime is not installed.
#define NDILIB_CPP_DEFAULT_CONSTRUCTORS 0
#include <napi.h>
#include <string>
#include <cstring>
#include <map>
#include <thread>
#include <mutex>
#include <atomic>
#include <vector>
#include <memory>
#ifdef _WIN32
#include <windows.h>
#endif
#include "Processing.NDI.Lib.h"

static const NDIlib_v6*        g_ndi  = nullptr;
static NDIlib_send_instance_t  g_send = nullptr;
static std::string             g_name;
static int g_frN = 60000, g_frD = 1000;
// Live NDI input: one background capture thread per receiver. The thread blocks in recv_capture_v3,
// swizzles into a double buffer under a mutex; recvRead on the JS thread just memcpys the newest frame.
struct RecvCtx {
	NDIlib_recv_instance_t recv = nullptr;
	std::thread th;
	std::mutex mx;
	std::vector<uint8_t> buf;   // latest frame, tightly-packed RGBA top-down (already swizzled)
	int w = 0, h = 0;
	uint64_t gen = 0;           // frame counter (JS skips work when unchanged)
	std::atomic<bool> run{false};
};
static std::map<std::string, std::unique_ptr<RecvCtx>> g_recv; // keyed by source name
static NDIlib_find_instance_t g_find = nullptr; // persistent finder (discovers sources in the background over time)

static void recvLoop(RecvCtx* c, const NDIlib_v6* p) {
	std::vector<uint8_t> staging; // swap()ed with c->buf each frame → storage is recycled, no per-frame realloc
	while (c->run.load(std::memory_order_relaxed)) {
		NDIlib_video_frame_v2_t vf; NDIlib_audio_frame_v3_t af; NDIlib_metadata_frame_t mf;
		memset(&vf, 0, sizeof(vf)); memset(&af, 0, sizeof(af)); memset(&mf, 0, sizeof(mf));
		NDIlib_frame_type_e ty = p->recv_capture_v3(c->recv, &vf, &af, &mf, 100); // 100ms timeout bounds shutdown latency
		if (ty == NDIlib_frame_type_video) {
			int w = vf.xres, h = vf.yres, stride = vf.line_stride_in_bytes; size_t row = (size_t)w * 4;
			if (vf.p_data && w > 0 && h > 0) {
				staging.resize(row * (size_t)h);
				// NDIlib_recv_color_format_RGBX_RGBA delivers [B,A,R,G] — reorder to RGBA via a 16-bit rotate
				// of the 32-bit LE pixel word. Rows are written BOTTOM-UP (vertical flip) so the GL upload can
				// skip UNPACK_FLIP_Y_WEBGL — Chrome's flip path copies the whole 4K frame on the CPU (~27ms).
				// All of it runs HERE (background thread), off the render thread.
				for (int y = 0; y < h; y++) {
					const uint32_t* s = (const uint32_t*)(vf.p_data + (size_t)y * stride);
					uint32_t* d = (uint32_t*)(staging.data() + (size_t)(h - 1 - y) * row);
					for (int x = 0; x < w; x++) { uint32_t px = s[x]; d[x] = (px << 16) | (px >> 16); }
				}
				{ std::lock_guard<std::mutex> lk(c->mx); c->buf.swap(staging); c->w = w; c->h = h; c->gen++; }
			}
			p->recv_free_video_v2(c->recv, &vf);
		}
		else if (ty == NDIlib_frame_type_audio)    p->recv_free_audio_v3(c->recv, &af);
		else if (ty == NDIlib_frame_type_metadata) p->recv_free_metadata(c->recv, &mf);
		// none / error: the capture timeout paces the idle loop
	}
}
static void recvStop(RecvCtx* c) {
	if (!c) return;
	c->run.store(false);
	if (c->th.joinable()) c->th.join();
	if (c->recv && g_ndi) g_ndi->recv_destroy(c->recv);
	c->recv = nullptr;
}

// Load the NDI runtime dynamically and cache the API struct.
static const NDIlib_v6* loadNDI() {
	if (g_ndi) return g_ndi;
#ifdef _WIN32
	HMODULE h = NULL;
	char dir[1024] = { 0 };
	DWORD n = GetEnvironmentVariableA(NDILIB_REDIST_FOLDER, dir, sizeof(dir));
	if (n > 0 && n < sizeof(dir)) {
		std::string dll = std::string(dir) + "\\" + NDILIB_LIBRARY_NAME;
		h = LoadLibraryA(dll.c_str());
	}
	if (!h) h = LoadLibraryA(NDILIB_LIBRARY_NAME); // fall back to PATH / app dir
	if (!h) return nullptr;
	typedef const NDIlib_v6* (*load_t)(void);
	load_t fn = (load_t)GetProcAddress(h, "NDIlib_v6_load");
	if (!fn) return nullptr;
	const NDIlib_v6* p = fn();
	if (!p) return nullptr;
	if (!p->initialize()) return nullptr;
	g_ndi = p;
	return p;
#else
	return nullptr;
#endif
}

// available() -> boolean : is the NDI runtime loadable on this machine?
Napi::Value Available(const Napi::CallbackInfo& info) {
	return Napi::Boolean::New(info.Env(), loadNDI() != nullptr);
}

// runtimeUrl() -> string : where to download the free NDI runtime if missing
Napi::Value RuntimeUrl(const Napi::CallbackInfo& info) {
	return Napi::String::New(info.Env(), NDILIB_REDIST_URL);
}

// start(name, frameRateN, frameRateD) -> boolean
Napi::Value Start(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	const NDIlib_v6* p = loadNDI();
	if (!p) return Napi::Boolean::New(env, false);
	if (g_send) { p->send_destroy(g_send); g_send = nullptr; }
	g_name = info[0].As<Napi::String>().Utf8Value();
	if (info.Length() > 1 && info[1].IsNumber()) g_frN = info[1].As<Napi::Number>().Int32Value();
	if (info.Length() > 2 && info[2].IsNumber()) g_frD = info[2].As<Napi::Number>().Int32Value();
	NDIlib_send_create_t cfg; memset(&cfg, 0, sizeof(cfg));
	cfg.p_ndi_name = g_name.c_str();
	cfg.p_groups   = nullptr;
	cfg.clock_video = false; // JS paces the frames itself
	cfg.clock_audio = false;
	g_send = p->send_create(&cfg);
	return Napi::Boolean::New(env, g_send != nullptr);
}

// sendFrame(buffer, width, height, flipY) -> boolean : RGBA, top-to-bottom (flipY uses a negative stride, zero copy)
Napi::Value SendFrame(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	if (!g_ndi || !g_send) return Napi::Boolean::New(env, false);
	if (info.Length() < 3 || !info[0].IsBuffer()) return Napi::Boolean::New(env, false);
	Napi::Buffer<uint8_t> buf = info[0].As<Napi::Buffer<uint8_t>>();
	int  w = info[1].As<Napi::Number>().Int32Value();
	int  h = info[2].As<Napi::Number>().Int32Value();
	bool flipY = info.Length() > 3 && info[3].IsBoolean() ? info[3].As<Napi::Boolean>().Value() : false;
	if (w <= 0 || h <= 0) return Napi::Boolean::New(env, false);
	size_t need = (size_t)w * (size_t)h * 4u;
	if (buf.Length() < need) return Napi::Boolean::New(env, false);
	uint8_t* data = buf.Data();
	int stride = w * 4;
	NDIlib_video_frame_v2_t f; memset(&f, 0, sizeof(f));
	f.xres = w; f.yres = h;
	f.FourCC = NDIlib_FourCC_video_type_RGBA;
	f.frame_rate_N = g_frN; f.frame_rate_D = g_frD;
	f.picture_aspect_ratio = (float)w / (float)h;
	f.frame_format_type = NDIlib_frame_format_type_progressive;
	f.timecode = NDIlib_send_timecode_synthesize;
	if (flipY) { f.p_data = data + (size_t)(h - 1) * (size_t)stride; f.line_stride_in_bytes = -stride; }
	else       { f.p_data = data; f.line_stride_in_bytes = stride; }
	g_ndi->send_send_video_v2(g_send, &f); // synchronous — buffer stays valid for the duration of the call
	return Napi::Boolean::New(env, true);
}

// connections() -> number of receivers currently connected (0 if idle / not sending)
Napi::Value Connections(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	if (!g_ndi || !g_send) return Napi::Number::New(env, 0);
	int c = g_ndi->send_get_no_connections(g_send, 0);
	return Napi::Number::New(env, c);
}

// stop()
Napi::Value Stop(const Napi::CallbackInfo& info) {
	if (g_ndi && g_send) { g_ndi->send_destroy(g_send); g_send = nullptr; }
	return info.Env().Undefined();
}

// probe(nameSubstr, timeoutMs) -> {xres,yres,fourcc} | null : find our own source + receive one frame (verification only)
Napi::Value Probe(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	const NDIlib_v6* p = loadNDI(); if (!p) return env.Null();
	std::string sub = info[0].As<Napi::String>().Utf8Value();
	int timeout = (info.Length() > 1 && info[1].IsNumber()) ? info[1].As<Napi::Number>().Int32Value() : 5000;
	NDIlib_find_create_t fc; memset(&fc, 0, sizeof(fc)); fc.show_local_sources = true;
	NDIlib_find_instance_t finder = p->find_create_v2(&fc);
	if (!finder) return env.Null();
	std::string foundName;
#ifdef _WIN32
	DWORD t0 = GetTickCount();
	while ((GetTickCount() - t0) < (DWORD)timeout && foundName.empty()) {
#else
	for (int guard = 0; guard < 20 && foundName.empty(); guard++) {
#endif
		p->find_wait_for_sources(finder, 500);
		uint32_t no = 0; const NDIlib_source_t* srcs = p->find_get_current_sources(finder, &no);
		for (uint32_t i = 0; i < no; i++) {
			if (srcs[i].p_ndi_name && strstr(srcs[i].p_ndi_name, sub.c_str())) { foundName = srcs[i].p_ndi_name; break; }
		}
	}
	if (foundName.empty()) { p->find_destroy(finder); return env.Null(); }
	NDIlib_recv_create_v3_t rc; memset(&rc, 0, sizeof(rc));
	NDIlib_source_t src; memset(&src, 0, sizeof(src)); src.p_ndi_name = foundName.c_str();
	rc.source_to_connect_to = src;
	rc.color_format = NDIlib_recv_color_format_RGBX_RGBA;
	rc.bandwidth = NDIlib_recv_bandwidth_highest;
	NDIlib_recv_instance_t recv = p->recv_create_v3(&rc);
	p->find_destroy(finder);
	if (!recv) return env.Null();
	Napi::Value result = env.Null();
#ifdef _WIN32
	DWORD t1 = GetTickCount();
	while ((GetTickCount() - t1) < (DWORD)timeout) {
#else
	for (int guard = 0; guard < 40; guard++) {
#endif
		NDIlib_video_frame_v2_t vf; NDIlib_audio_frame_v3_t af; NDIlib_metadata_frame_t mf;
		memset(&vf, 0, sizeof(vf)); memset(&af, 0, sizeof(af)); memset(&mf, 0, sizeof(mf));
		NDIlib_frame_type_e ty = p->recv_capture_v3(recv, &vf, &af, &mf, 500);
		if (ty == NDIlib_frame_type_video) {
			Napi::Object o = Napi::Object::New(env);
			o.Set("xres", Napi::Number::New(env, vf.xres));
			o.Set("yres", Napi::Number::New(env, vf.yres));
			o.Set("fourcc", Napi::Number::New(env, (double)vf.FourCC));
			// sample top-row-center and bottom-row-center luma (RGBA) to verify vertical orientation
			if (vf.p_data && vf.xres > 0 && vf.yres > 0) {
				int cx = vf.xres / 2, stride = vf.line_stride_in_bytes;
				const uint8_t* top = vf.p_data + (size_t)0 * stride + (size_t)cx * 4;
				const uint8_t* bot = vf.p_data + (size_t)(vf.yres - 1) * stride + (size_t)cx * 4;
				o.Set("topLuma", Napi::Number::New(env, (double)(top[0] + top[1] + top[2]) / 3.0));
				o.Set("botLuma", Napi::Number::New(env, (double)(bot[0] + bot[1] + bot[2]) / 3.0));
			}
			result = o;
			p->recv_free_video_v2(recv, &vf);
			break;
		} else if (ty == NDIlib_frame_type_audio) {
			p->recv_free_audio_v3(recv, &af);
		} else if (ty == NDIlib_frame_type_metadata) {
			p->recv_free_metadata(recv, &mf);
		}
	}
	p->recv_destroy(recv);
	return result;
}

// ---- NDI INPUT (receive) ----

// findSources(timeoutMs) -> [names] : discover NDI sources (persistent finder — accumulates local + network sources over time)
Napi::Value FindSources(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	const NDIlib_v6* p = loadNDI(); if (!p) return Napi::Array::New(env);
	int timeout = (info.Length() > 0 && info[0].IsNumber()) ? info[0].As<Napi::Number>().Int32Value() : 800;
	if (!g_find) { NDIlib_find_create_t fc; memset(&fc, 0, sizeof(fc)); fc.show_local_sources = true; g_find = p->find_create_v2(&fc); }
	if (!g_find) return Napi::Array::New(env);
	if (timeout > 0) p->find_wait_for_sources(g_find, (uint32_t)timeout);
	uint32_t no = 0; const NDIlib_source_t* srcs = p->find_get_current_sources(g_find, &no);
	Napi::Array arr = Napi::Array::New(env, no);
	for (uint32_t i = 0; i < no; i++) arr.Set(i, Napi::String::New(env, srcs[i].p_ndi_name ? srcs[i].p_ndi_name : ""));
	return arr;
}

// recvOpen(sourceName) -> boolean : connect a receiver + start its capture thread (reused if already open)
Napi::Value RecvOpen(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	const NDIlib_v6* p = loadNDI(); if (!p) return Napi::Boolean::New(env, false);
	std::string name = info[0].As<Napi::String>().Utf8Value();
	auto it = g_recv.find(name); if (it != g_recv.end() && it->second && it->second->recv) return Napi::Boolean::New(env, true);
	// Look up the FULL source (name + url_address) from the persistent finder and connect directly. Connecting by
	// name alone makes NDI re-resolve the address, which fails for some senders (e.g. TouchDesigner on a specific NIC).
	if (!g_find) { NDIlib_find_create_t fc; memset(&fc, 0, sizeof(fc)); fc.show_local_sources = true; g_find = p->find_create_v2(&fc); }
	std::string url;
	if (g_find) {
		p->find_wait_for_sources(g_find, 300);
		uint32_t no = 0; const NDIlib_source_t* srcs = p->find_get_current_sources(g_find, &no);
		for (uint32_t i = 0; i < no; i++) { if (srcs[i].p_ndi_name && name == srcs[i].p_ndi_name) { if (srcs[i].p_url_address) url = srcs[i].p_url_address; break; } }
	}
	NDIlib_recv_create_v3_t rc; memset(&rc, 0, sizeof(rc));
	NDIlib_source_t src; memset(&src, 0, sizeof(src)); src.p_ndi_name = name.c_str(); if (!url.empty()) src.p_url_address = url.c_str();
	rc.source_to_connect_to = src;
	rc.color_format = NDIlib_recv_color_format_RGBX_RGBA; // deliver RGBA (with alpha) ready for GL upload
	rc.bandwidth = NDIlib_recv_bandwidth_highest;
	rc.allow_video_fields = false;
	NDIlib_recv_instance_t r = p->recv_create_v3(&rc);
	if (!r) return Napi::Boolean::New(env, false);
	auto ctx = std::make_unique<RecvCtx>();
	ctx->recv = r;
	ctx->run.store(true);
	ctx->th = std::thread(recvLoop, ctx.get(), p);
	g_recv[name] = std::move(ctx);
	return Napi::Boolean::New(env, true);
}

// recvRead(sourceName, lastGen, dst?) -> {w,h,gen,copied?}|{w,h,gen,data:Buffer}|null
// Returns null when there is no frame newer than lastGen (cheap poll — no copy at all).
// If dst (a Uint8Array, typically a SharedArrayBuffer view shared with the page) is large enough,
// the newest frame is memcpy'd into it and {copied:true}; otherwise a fresh Buffer is returned.
Napi::Value RecvRead(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	if (!g_ndi) return env.Null();
	std::string name = info[0].As<Napi::String>().Utf8Value();
	auto it = g_recv.find(name); if (it == g_recv.end() || !it->second) return env.Null();
	RecvCtx* c = it->second.get();
	double lastGen = (info.Length() > 1 && info[1].IsNumber()) ? info[1].As<Napi::Number>().DoubleValue() : 0.0;
	std::lock_guard<std::mutex> lk(c->mx);
	if (c->gen == 0 || c->buf.empty() || (double)c->gen == lastGen) return env.Null();
	size_t need = (size_t)c->w * (size_t)c->h * 4u;
	Napi::Object o = Napi::Object::New(env);
	o.Set("w",   Napi::Number::New(env, c->w));
	o.Set("h",   Napi::Number::New(env, c->h));
	o.Set("gen", Napi::Number::New(env, (double)c->gen));
	bool copied = false;
	if (info.Length() > 2 && info[2].IsTypedArray()) {
		Napi::TypedArray ta = info[2].As<Napi::TypedArray>();
		if (ta.TypedArrayType() == napi_uint8_array) {
			Napi::Uint8Array u8 = ta.As<Napi::Uint8Array>();
			if (u8.ByteLength() >= need && u8.Data()) { memcpy(u8.Data(), c->buf.data(), need); copied = true; o.Set("copied", Napi::Boolean::New(env, true)); }
		}
	}
	if (!copied) o.Set("data", Napi::Buffer<uint8_t>::Copy(env, c->buf.data(), need));
	return o;
}

// recvStats(sourceName, ms) -> diagnostic: frames received over a blocking window (counted via the
// capture thread's gen — recv_capture is never called from two threads).
Napi::Value RecvStats(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	const NDIlib_v6* p = loadNDI(); if (!p) return env.Null();
	std::string name = info[0].As<Napi::String>().Utf8Value();
	int ms = (info.Length() > 1 && info[1].IsNumber()) ? info[1].As<Napi::Number>().Int32Value() : 2000;
	auto it = g_recv.find(name); if (it == g_recv.end() || !it->second) { if (!RecvOpen(info).As<Napi::Boolean>().Value()) return env.Null(); it = g_recv.find(name); }
	RecvCtx* c = it->second.get();
	uint64_t gen0; { std::lock_guard<std::mutex> lk(c->mx); gen0 = c->gen; }
#ifdef _WIN32
	Sleep((DWORD)ms);
#endif
	uint64_t gen1; int vw, vh; { std::lock_guard<std::mutex> lk(c->mx); gen1 = c->gen; vw = c->w; vh = c->h; }
	Napi::Object o = Napi::Object::New(env);
	o.Set("video", Napi::Number::New(env, (double)(gen1 - gen0)));
	o.Set("vw", vw); o.Set("vh", vh); o.Set("connections", p->recv_get_no_connections(c->recv));
	return o;
}

// recvClose(sourceName) — stops the capture thread, then destroys the receiver
Napi::Value RecvClose(const Napi::CallbackInfo& info) {
	std::string name = info[0].As<Napi::String>().Utf8Value();
	auto it = g_recv.find(name); if (it != g_recv.end()) { recvStop(it->second.get()); g_recv.erase(it); }
	return info.Env().Undefined();
}

// recvCloseAll()
Napi::Value RecvCloseAll(const Napi::CallbackInfo& info) {
	for (auto& kv : g_recv) recvStop(kv.second.get());
	g_recv.clear();
	return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
	exports.Set("available",  Napi::Function::New(env, Available));
	exports.Set("runtimeUrl", Napi::Function::New(env, RuntimeUrl));
	exports.Set("start",      Napi::Function::New(env, Start));
	exports.Set("sendFrame",  Napi::Function::New(env, SendFrame));
	exports.Set("connections",Napi::Function::New(env, Connections));
	exports.Set("stop",       Napi::Function::New(env, Stop));
	exports.Set("probe",      Napi::Function::New(env, Probe));
	exports.Set("findSources",Napi::Function::New(env, FindSources));
	exports.Set("recvOpen",   Napi::Function::New(env, RecvOpen));
	exports.Set("recvRead",   Napi::Function::New(env, RecvRead));
	exports.Set("recvClose",  Napi::Function::New(env, RecvClose));
	exports.Set("recvStats",  Napi::Function::New(env, RecvStats));
	exports.Set("recvCloseAll",Napi::Function::New(env, RecvCloseAll));
	return exports;
}
NODE_API_MODULE(dsp_ndi, Init)
