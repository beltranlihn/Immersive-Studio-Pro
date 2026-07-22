// Immersive Studio Pro — minimal Spout sender (N-API), via the SpoutDX (DirectX 11) SDK.
// Unlike SpoutLibrary (which needs an active OpenGL context), SpoutDX creates its OWN D3D11 device, so this
// addon works headless in the Electron process: we hand it the CPU pixels read back from WebGL (same as the
// NDI path) and it shares them as a GPU texture that Resolume / TouchDesigner / OBS etc. receive with zero copy.
#include <napi.h>
#include <string>
#include <vector>
#include <cstring>
#include <windows.h>
#include "SpoutDX.h"

static spoutDX*             g_spout = nullptr;
static std::string          g_name;
static std::vector<uint8_t> g_flip; // reused vertical-flip staging (WebGL is bottom-up; Spout wants top-down)

// available() -> bool : Spout has no separate runtime (it's compiled in); available = we could create a sender.
Napi::Value Available(const Napi::CallbackInfo& info) {
	return Napi::Boolean::New(info.Env(), true);
}

// start(name) -> bool : open a D3D11 device and register the sender name.
Napi::Value Start(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	if (info.Length() < 1 || !info[0].IsString()) return Napi::Boolean::New(env, false);
	g_name = info[0].As<Napi::String>().Utf8Value();
	if (!g_spout) g_spout = new spoutDX();
	if (!g_spout->OpenDirectX11()) { delete g_spout; g_spout = nullptr; return Napi::Boolean::New(env, false); }
	g_spout->SetSenderName(g_name.c_str());
	g_spout->SetSenderFormat(DXGI_FORMAT_R8G8B8A8_UNORM);
	return Napi::Boolean::New(env, true);
}

// send(buffer, w, h, flipY) -> bool : share one RGBA frame. flipY vertically mirrors (WebGL bottom-up → top-down).
Napi::Value Send(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	if (!g_spout) return Napi::Boolean::New(env, false);
	if (info.Length() < 3 || !info[0].IsBuffer()) return Napi::Boolean::New(env, false);
	Napi::Buffer<uint8_t> buf = info[0].As<Napi::Buffer<uint8_t>>();
	int  w = info[1].As<Napi::Number>().Int32Value();
	int  h = info[2].As<Napi::Number>().Int32Value();
	bool flipY = info.Length() > 3 && info[3].IsBoolean() ? info[3].As<Napi::Boolean>().Value() : false;
	if (w <= 0 || h <= 0) return Napi::Boolean::New(env, false);
	size_t row = (size_t)w * 4, need = row * (size_t)h;
	if (buf.Length() < need) return Napi::Boolean::New(env, false);
	const uint8_t* src = buf.Data();
	if (flipY) {
		if (g_flip.size() < need) g_flip.resize(need);
		for (int y = 0; y < h; y++) memcpy(g_flip.data() + (size_t)y * row, src + (size_t)(h - 1 - y) * row, row);
		src = g_flip.data();
	}
	bool ok = g_spout->SendImage(src, (unsigned)w, (unsigned)h);
	return Napi::Boolean::New(env, ok);
}

// stop() : release the sender + device.
Napi::Value Stop(const Napi::CallbackInfo& info) {
	if (g_spout) { g_spout->ReleaseSender(); g_spout->CloseDirectX11(); delete g_spout; g_spout = nullptr; }
	return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
	exports.Set("available", Napi::Function::New(env, Available));
	exports.Set("start",     Napi::Function::New(env, Start));
	exports.Set("send",      Napi::Function::New(env, Send));
	exports.Set("stop",      Napi::Function::New(env, Stop));
	return exports;
}
NODE_API_MODULE(dsp_spout, Init)
