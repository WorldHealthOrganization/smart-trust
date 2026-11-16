# hcert live demo

Built from [litlfred/smart-trust-tools](https://github.com/litlfred/smart-trust-tools)
at commit `90bd76e278016e2e4fdf78c4650f9b8a34386a27` by `tools/hcert-rust/bundle-demo.sh`. Do not edit
these files here; change them there and rebuild.

| File | sha256 |
|---|---|
| hcert.wasm | `27f1c68143131d9d31e26f71e53f6fb10015f00a899d3e0de6e4c050161e0da9` |
| hcert.js | `232c7709f9cd34a642514be927c31b74a7ce7dcc5bf53365008b080b33e10cb2` |
| hcert-demo.js | `981903180350d1b14d7210ed9d50d38e98f68051435eabee50cb0573ac988434` |
| hcert-demo.css | `f671101ae2d406a610c0245cebc9a7e5a140561e829167fe6e1a08e590319f6a` |
| dvc-qr-example-XXR.json | `43131a23adf01d9393cbcc4322296de242e5607893004dde02358c4ff64a2e5c` |
| XXR-DSC-did.json | `3f661f7d9f010c362c586324c5e52750c012d90f628889a6697e5f15e623bad2` |
| WHO-signing-did.json | `393d8c7c7fefcbe66f325933412117b6499d1dfc36f6a548f4d462e9d57416ff` |

The WebAssembly module imports nothing. Keys are generated and used by
WebCrypto in the reader's browser, and everything issued is TEST ONLY.
