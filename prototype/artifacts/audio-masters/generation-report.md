# Deterministic Audio Generation Report

- Generator: `witch-water-sort-audio-v1`
- Global seed: `0xA1C4E57`
- Synthesis: original local synthesis, 44100 Hz mono, Float64 accumulation, xorshift32 cue seeds, 0.86 peak normalization, 12ms safety fades
- Encoder: `@breezystack/lamejs@1.2.7` (LGPL-3.0), vendored for generation only
- Registry tarball integrity: `sha512-6wc7ck65ctA75Hq7FYHTtTvGnYs6msgdxiSUICQ+A01nVOWg6rqouZB8IdyteRlfpYYiFovkf67dIeOgWIUzTA==`
- Repacked tarball SHA-256: `ab48c59fe29b7bfbd72dcc3515b04393dbe11459d165ecb85dd0547f3abd223c`
- Encoding: BGM 80kbps; SFX 96kbps
- BGM seam: four 12-second phrases are rendered with a 2-second continuation and equal-power wrap crossfade; the exported 48-second loop starts after the two-second pre-roll so its final head blend meets the same musical position at loop start.
- Runtime total: 536504 bytes

| Cue | Duration (ms) | MP3 bytes | MP3 SHA-256 | WAV SHA-256 |
| --- | ---: | ---: | --- | --- |
| `bgm.alchemy_room` | 48000 | 480392 | `8b7c8d0941c3e9e12bc8236b6b8ce50138a0179c43b3b220062f0201102c0cbe` | `1806c2e829c200bb7e6c00e23307d95c0f06e6db56261c41014286e9f9f19151` |
| `bottle.deselect` | 140 | 2194 | `bdf73453f0c508de3c1e2aa9d7fdff685b40b9cdb609159e53404fbc0415186f` | `b446532afb25cad106178ede8ccbc933b6a65a10d0b2756d757789e73f4b19fe` |
| `bottle.select` | 160 | 2508 | `f7dab9a58d9212ce49afaf2be9106cc4d4bbc4d70bb84258eff430d55fd2c558` | `762337d6bc26438881e0ecda56636d01c925610ed7fc5bb9ec2d3f3362d89a5c` |
| `history.undo` | 230 | 3135 | `764991b21a3ce2d374a00e82a8e9157eafcd2844cbd144b6f2f355aa2671fc9c` | `9f3b507d7d11a8deed503c4fdf3af578371ffcf1c553bd7d99f80a90f6d58f71` |
| `level.restart` | 410 | 5329 | `097f96cd87f0cb3ce9be793adc57ac7ce366fb85125f287e3347351abc1a1ee7` | `d44b0d253a5c693674825775bc5149bb3fd92deb399b65ffbe2d55bb66cf409a` |
| `potion.complete` | 1000 | 12539 | `b505833bd5d23d311114de7060da92ab612e4a3ec2caa10f2656c43c5275bb0e` | `edec2cfc9702c576baeea5ca6a703fae0041b2d43d24bd5d87cb012835d5aa4b` |
| `potion.vanish` | 620 | 7837 | `a36de064f44fbd2ab65d25b8ab641e67517d1985bc58bd3174a49baf513d99d5` | `7b4beb5840258e5727791b71117f3d596385e853a7f6750d2e6ae454e1e7f2ae` |
| `pour.invalid` | 310 | 4075 | `ae8209ca846fe6255334fad7d5b6d906a8a04912d9c24a6b5b18ce07f0a45373` | `c16e8fcd2ca866ccd6d7ddc5c6eafebc0d3178cab6054283668d3ce0ff618cab` |
| `pour.valid` | 500 | 6583 | `f49e2617380f82e6ba09235a124ad7d57c8021e7ec1cf40f936b51b053659544` | `d18ed04a651165ad5c3c2af2bed4e00b69b22555ab0aa7423672d80234226d09` |
| `reward.empty_bottle` | 850 | 10658 | `0f5844c51e2f3fa56582b3c505008ceaa2ae7990186fc84d3735457c97919799` | `96e5241bb3f15ca01488682b37e676cfcdc1e6427e8a3ac7cff8ee6338f3084f` |
| `ui.tap` | 70 | 1254 | `7aa7152bfdf81d6f5c0eefb80849e6e398512f4a21025360ac6004660f55ac82` | `686e305d5baa8401d874c7ef082e6688e8c1079720e3c2d14a1a46b392b8de4f` |
