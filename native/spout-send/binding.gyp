{
  "targets": [
    {
      "target_name": "dsp_spout",
      "sources": [
        "spout.cc",
        "SpoutDX.cpp",
        "SpoutDirectX.cpp",
        "SpoutSenderNames.cpp",
        "SpoutSharedMemory.cpp",
        "SpoutFrameCount.cpp",
        "SpoutCopy.cpp",
        "SpoutUtils.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "."
      ],
      "defines": [ "NAPI_VERSION=8" ],
      "cflags_cc": [ "-fexceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "msvs_settings": {
        "VCCLCompilerTool": { "ExceptionHandling": 1, "AdditionalOptions": [ "/std:c++17" ] }
      },
      "conditions": [
        [ "OS=='win'", { "libraries": [ "d3d11.lib", "dxgi.lib", "winmm.lib" ] } ]
      ]
    }
  ]
}
