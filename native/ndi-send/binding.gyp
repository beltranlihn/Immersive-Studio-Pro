{
  "targets": [
    {
      "target_name": "dsp_ndi",
      "sources": [ "ndi.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include"
      ],
      "defines": [ "NAPI_VERSION=8" ],
      "cflags_cc": [ "-fexceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "msvs_settings": {
        "VCCLCompilerTool": { "ExceptionHandling": 1, "AdditionalOptions": [ "/std:c++17" ] }
      },
      "conditions": [
        [ "OS=='win'", { "libraries": [ "-lUser32" ] } ]
      ]
    }
  ]
}
