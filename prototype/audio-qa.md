# Audio QA Checkpoints

## Checkpoint 1 — contracts

- Focused command: `C:\\Users\\cxl\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe --test tests/audio-cues.test.mjs` — 3 tests, 3 passed, 0 failed.
- Presentation regression: `C:\\Users\\cxl\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe --test tests/presentation.test.mjs` — 20 tests, 20 passed, 0 failed.
- Game regression: `C:\\Users\\cxl\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe --test tests/game-engine.test.mjs` — 8 tests, 8 passed, 0 failed.
- `pnpm run test:presentation` was also attempted; the workspace shell has no `node` on PATH, so the script exited 1 before running tests. Bundled Node commands above provide the verified results.

## Checkpoint 2 — portable director policy

- Initial RED: `C:\\Users\\cxl\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe --test tests/audio-director.test.mjs` — expected `ERR_MODULE_NOT_FOUND` for `src/audio/audio-director.mjs`; 0 tests passed, 1 file failed.
- Mutation RED — global cap `4 → 3`: focused test run — 6 passed, 2 failed. Named assertion `the policy admits four simultaneous SFX before evicting` reported `3 !== 4` (the equality-cap assertion also failed after the premature eviction).
- Mutation RED — priority comparison `> → >=`: focused test run — 7 passed, 1 failed. Named assertion `equal priority must not evict the lowest active voice` reported `1 !== 0`.
- Mutation RED — music restore duration `300 → 250`: focused test run — 7 passed, 1 failed. The completion-duck assertion reported a restore `durationMs` of `250` instead of `300`.
- Final GREEN: `C:\\Users\\cxl\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe --test tests/audio-director.test.mjs` — 8 tests, 8 passed, 0 failed.
- Task 1 regression: `C:\\Users\\cxl\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe --test tests/audio-cues.test.mjs` — 3 tests, 3 passed, 0 failed.
- Runtime regression: `C:\\Users\\cxl\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe scripts/check-mobile-runtime.mjs` — passed (28 protected files).
- TypeScript executable check could not run because the existing local TypeScript installation is missing `@typescript/typescript-win32-x64`; no package files were changed to remedy this environment issue.

### Checkpoint 2 — review fix round 1

- Focused RED: `C:\\Users\\cxl\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe --test tests/audio-director.test.mjs` — 8 passed, 4 failed. Named failures: default gains expected the two track ramps but observed `[]`; `the one-voice reward cue must not start a second simultaneous voice` reported `2 !== 1`; music re-enable during a duck observed `0.36` instead of `0.252`; deferred BGM resume could not find the replacement pending BGM playback.
- Focused GREEN: the same AudioDirector command — 12 tests, 12 passed, 0 failed.
- Task 1 regression: `C:\\Users\\cxl\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe --test tests/audio-cues.test.mjs` — 3 tests, 3 passed, 0 failed.
- Runtime regression: `C:\\Users\\cxl\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe scripts/check-mobile-runtime.mjs` — passed (28 protected files).

## Checkpoint 3 — deterministic original audio pack

- Initial RED: `node --test tests/audio-assets.test.mjs` failed because `public/assets/game/audio/audio-manifest.json` did not exist before generation.
- Path-mapping regression RED: the focused source assertion required runtime cue URLs to resolve through `path.join(root, 'public', relativePath)`; generation and validation now share that Vite-public-root convention.
- First authorized generation: `node scripts/generate-audio-assets.mjs` — generated 11 original cues totaling 536,504 runtime bytes.
- Second authorized generation: the same command — generated the same 11 cues and 536,504 runtime bytes.
- Determinism proof: all 11 first-run MP3 SHA-256 values matched the second-run manifest; changed hashes: 0.
- Package-script validation: `pnpm run validate:audio-assets` with bundled Node on the command-local PATH — `11 cues, 1 BGM, 10 SFX; 536504 runtime bytes; zero mismatches`.
- Focused audio verification: bundled Node `--test tests/audio-assets.test.mjs tests/audio-cues.test.mjs tests/audio-director.test.mjs` — 17 passed, 0 failed.
- Game/presentation/integration regression: bundled Node `--test tests/game-engine.test.mjs tests/presentation.test.mjs tests/prototype-integration.test.mjs` — 33 passed, 0 failed.
- Runtime regression: bundled Node `scripts/check-mobile-runtime.mjs` — passed (28 protected files).
- Encoder provenance: generator-only `@breezystack/lamejs@1.2.7`, registry integrity `sha512-6wc7ck65ctA75Hq7FYHTtTvGnYs6msgdxiSUICQ+A01nVOWg6rqouZB8IdyteRlfpYYiFovkf67dIeOgWIUzTA==`; no application dependency or lockfile entry was added.

| Cue | Duration (ms) | Runtime bytes | MP3 SHA-256 |
| --- | ---: | ---: | --- |
| `bgm.alchemy_room` | 48000 | 480392 | `8b7c8d0941c3e9e12bc8236b6b8ce50138a0179c43b3b220062f0201102c0cbe` |
| `bottle.deselect` | 140 | 2194 | `bdf73453f0c508de3c1e2aa9d7fdff685b40b9cdb609159e53404fbc0415186f` |
| `bottle.select` | 160 | 2508 | `f7dab9a58d9212ce49afaf2be9106cc4d4bbc4d70bb84258eff430d55fd2c558` |
| `history.undo` | 230 | 3135 | `764991b21a3ce2d374a00e82a8e9157eafcd2844cbd144b6f2f355aa2671fc9c` |
| `level.restart` | 410 | 5329 | `097f96cd87f0cb3ce9be793adc57ac7ce366fb85125f287e3347351abc1a1ee7` |
| `potion.complete` | 1000 | 12539 | `b505833bd5d23d311114de7060da92ab612e4a3ec2caa10f2656c43c5275bb0e` |
| `potion.vanish` | 620 | 7837 | `a36de064f44fbd2ab65d25b8ab641e67517d1985bc58bd3174a49baf513d99d5` |
| `pour.invalid` | 310 | 4075 | `ae8209ca846fe6255334fad7d5b6d906a8a04912d9c24a6b5b18ce07f0a45373` |
| `pour.valid` | 500 | 6583 | `f49e2617380f82e6ba09235a124ad7d57c8021e7ec1cf40f936b51b053659544` |
| `reward.empty_bottle` | 850 | 10658 | `0f5844c51e2f3fa56582b3c505008ceaa2ae7990186fc84d3735457c97919799` |
| `ui.tap` | 70 | 1254 | `7aa7152bfdf81d6f5c0eefb80849e6e398512f4a21025360ac6004660f55ac82` |

### Checkpoint 3 — review fix round 1

- Published-directory RED: fixture tests added an undeclared MP3 and an undeclared 2,500,001-byte MP3; the old validator returned success for both (1 passed / 2 failed). GREEN: it recursively inventories published MP3 files, rejects undeclared paths, and budgets the actual directory bytes (3/3 passed).
- MP3-duration RED: a fixture replaced the 48-second BGM with the valid 104.490ms `ui.tap` MP3 and synchronized manifest size/hash; the old validator returned success (3 passed / 1 failed). GREEN: MPEG Layer III frame headers now determine duration and enforce manifest/range agreement with a 55ms encoder-frame tolerance (4/4 passed).
- WAV/report RED: independent fixtures removed a master, changed its channel header, shortened its PCM data chunk, and changed a PCM byte without updating the report; the old validator returned success in all four cases (4 passed / 4 failed). GREEN: all 11 masters must exist, parse as RIFF/WAVE 16-bit PCM mono 44.1kHz with matching duration, and match the generation report's authoritative hash (8/8 passed).
- Loop-contract RED: a fixture changed BGM `loopStartMs` and `loopEndMs`; the old validator returned success (8 passed / 1 failed). GREEN: both fields are compared with the cue contract, including normalized `null` values for non-looping cues (9/9 passed).
- Fresh package validation: `pnpm run validate:audio-assets` with bundled Node on the command-local PATH — `11 cues, 1 BGM, 10 SFX; 536504 runtime bytes; zero mismatches`.
- Fresh focused audio verification: bundled Node `--test tests/audio-assets.test.mjs tests/audio-cues.test.mjs tests/audio-director.test.mjs` — 24 passed, 0 failed.
- Fresh game/presentation/integration regression: bundled Node `--test tests/game-engine.test.mjs tests/presentation.test.mjs tests/prototype-integration.test.mjs` — 33 passed, 0 failed.
- Fresh runtime regression: bundled Node `scripts/check-mobile-runtime.mjs` — passed (28 protected files).
- Generator and all real MP3/WAV assets remained unchanged during this review fix.

## Checkpoint 4 — Web Audio adapter and React lifecycle

- Initial driver RED: bundled Node `--test tests/web-audio-driver.test.mjs` failed with the expected `ERR_MODULE_NOT_FOUND` for `src/audio/web-audio-driver.mjs` (0 passed, 1 test file failed).
- Initial hook transform RED: Vite transform setup failed with the expected `ENOENT` for the absent `src/audio/useGameAudio.ts`.
- Loop conversion mutation RED: changing `loopStartMs / 1000` to `/ 100` produced 10 passed / 1 failed; the exact loop test observed `0.26 !== 0.026`. The production divisor was restored.
- Playback-start cleanup RED: a fake `BufferSource.start()` rejection exposed an unstarted live-source registration because disposal called `stop(0)` on it (11 passed / 1 failed). GREEN removes the failed record before returning `null` (12/12 focused passed).
- Fresh focused and related regression: bundled Node `--test tests/web-audio-driver.test.mjs tests/audio-director.test.mjs tests/audio-cues.test.mjs tests/audio-assets.test.mjs tests/presentation.test.mjs tests/game-engine.test.mjs tests/prototype-integration.test.mjs` — 69 passed, 0 failed.
- Hook transform: Vite `transformWithOxc` compiled `src/audio/useGameAudio.ts` successfully and emitted 3,291 bytes.
- Protected runtime: bundled Node `scripts/check-mobile-runtime.mjs` — passed for all 28 protected files.
- Production bundle: fresh controller run after the final playback-cleanup fix, using the narrowly scoped out-of-sandbox Vite command — 517 modules transformed, built in 477ms.
- Aggregate build concern: `pnpm run build` still stops at the recorded baseline TypeScript installation defect (`@typescript/typescript-win32-x64` missing). A normal sandboxed direct Vite build also receives `EPERM` when writing `node_modules/.vite-temp`; the authorized controller build proves the app bundle itself succeeds.

## Checkpoint 5 — image-backed sound settings

- Initial RED: bundled Node `--test tests/audio-settings.test.mjs` — 0 passed / 5 failed because the component, safe-area CSS, and six fitted runtime PNGs did not yet exist.
- Component/CSS GREEN before assets: 3 passed / 2 failed, isolating the missing asset pack and one test assumption that required a literal timeout instead of the equivalent named 160ms constant.
- Final focused GREEN: bundled Node `--test tests/audio-settings.test.mjs` — 5 passed, 0 failed.
- Asset dimensions: `audio-settings-panel.png` is 248×96; trigger/music-on/music-off/SFX-on/SFX-off icons are each 96×96.
- Alpha gate: all six runtime images are RGBA with alpha extrema `0..255`, transparent outer edges, centered non-empty subjects, and no aspect-ratio stretching.
- Determinism gate: two consecutive successful normalizer runs produced the same SHA-256 hash for each of the six runtime assets.
- Visual gate: `artifacts/audio-ui-raw/audio-settings-supporting-sheet.png` was inspected and approved for complete subjects, distinct on/off states, panel fidelity, and cohesive deep-purple/warm-gold Q-style rendering.
- Fresh focused plus related regression: bundled Node `--test tests/audio-settings.test.mjs tests/presentation.test.mjs tests/web-audio-driver.test.mjs tests/audio-director.test.mjs tests/audio-cues.test.mjs tests/audio-assets.test.mjs tests/game-engine.test.mjs tests/prototype-integration.test.mjs` — 74 passed, 0 failed.
- Protected runtime: bundled Node `scripts/check-mobile-runtime.mjs` — passed for all 28 protected files.
- Component transform: Vite `transformWithOxc` compiled `src/components/AudioSettings.tsx` successfully and emitted 4,646 bytes.
- Production bundle: fresh narrowly scoped Vite build passed with 517 modules transformed in 425ms.
- Aggregate build concern remains the baseline missing `@typescript/typescript-win32-x64`; the focused OXC transform and Vite production bundle both passed.

## Checkpoint 1 — atomic master sound controller

- RED: bundled Node `--test tests/game-audio-controller.test.mjs` — 0 passed / 1 failed; the new contract correctly reported missing `soundEnabled` before implementation.
- GREEN and audio regression: bundled Node `--test tests/game-audio-controller.test.mjs tests/audio-cues.test.mjs tests/audio-director.test.mjs tests/audio-assets.test.mjs tests/web-audio-driver.test.mjs` — 38 passed, 0 failed.
- Contract: `setSoundEnabled` creates one `{ musicEnabled, sfxEnabled }` preference object, persists it once under `witch-water-sort.audio.v1`, then updates both director tracks; `soundEnabled` is true only when both tracks are enabled.
- Web Audio regression includes independent track-gain coverage; underlying music/SFX tracks remain available to the director with default gains `0.36/0.78`.
- Concern: the full TypeScript build remains subject to the pre-existing missing `@typescript/typescript-win32-x64` installation; focused Node contract and audio tests are green.

## Checkpoint 2 — home scene and unified settings dialog

- Initial RED: bundled Node `--test tests/home-settings.test.mjs` — 0 passed / 4 failed because `HomeScene`, `GameSettings`, their CSS contract, and `icon-settings-gear.png` did not exist.
- Focused GREEN: bundled Node `--test tests/home-settings.test.mjs` — 4 passed, 0 failed. Presentation regression — 20 passed, 0 failed. Protected runtime — all 28 files passed integrity validation. Fresh Vite production bundle — 517 modules transformed and built successfully.
- Raw ImageGen sources are preserved under `artifacts/game-settings-ui-raw/*-raw.png`; deterministic processing is implemented by `scripts/prepare-game-settings-assets.py`, and the inspected composite is `artifacts/game-settings-ui-raw/supporting-sheet.png`.
- Raw SHA-256: gear `99abe47947f5f76bb9ed718a58f21c3580b60580b4723215c3e0ac684f8ba678`; dialog `c5a92f256344df93d58902d6a39de6a0a3e66931a7c280529fec63c074e1d7a2`; close `6c86ecb36f79ebe1bea11d4535f2246abbcc25b4c5cdab7a299a28b435c8b4c0`; home `67fc79382857983778a04ac9630f80aff4a3c63ea43ca956703a0811f069888d`.
- Runtime asset dimensions and SHA-256: `icon-settings-gear.png` 96×96 RGBA, `7aea4afedcccf4337c68ea885f9d999671ff0c885a5924d0c0441f6a968f9de0`; `settings-dialog-panel.png` 600×720 RGBA, `8f9b4c1edfd8b19583e5461ac3695fa8b487c9e07e4438dce5ff5f94f6dea324`; `icon-settings-close.png` 96×96 RGBA, `c2a0338dbe4956e7e8eb91a811d5fd768d07cc6d9f0dcc134fa49a26fd3e8396`; `icon-settings-home.png` 96×96 RGBA, `d3df792d721459a108b6b86faba7a6e582db3c947333002b63732f8e3efcaba7`.
- Determinism gate: a second complete normalizer run changed 0 of 5 hashes (four runtime assets plus supporting sheet); supporting sheet SHA-256 is `946dc17d151b95c82673342ba9cbe4708dbe9c44d5eb1f4b3cddbe770f00bf79`.
- Visual gate: all four runtime PNGs and the supporting sheet were inspected locally. Edge-connected neutral checkerboards were removed, true transparent margins remain on all four sides, subjects are centered and uncropped, and the deep-eggplant/warm-gold Q-style treatment is cohesive with the existing button and message assets.
- Interaction contract: one `aria-pressed` master switch only; Escape, mask, and close restore focus; exit-stage controls are disabled while the full-screen mask remains `pointer-events: auto`; the home action is omitted when already home.
- Aggregate TypeScript build concern remains the recorded baseline missing `@typescript/typescript-win32-x64`; the scoped Vite production bundle and component contract tests passed without modifying package files.

## Checkpoint 3 — retained scenes and complete gameplay audio routing

- Initial integration RED: bundled Node `--test tests/prototype-integration.test.mjs` preserved the original 5 passes and produced 6 expected failures for the missing scene state, state-only return-home path, atomic settings wiring, bottle result cues, 300ms vanish cue, and successful control cues.
- Focused GREEN: the same integration command passed 11/11. `Prototype` owns the sole `game`, `history`, `selected`, transient-state, and timer lifecycles above the `home | level` render branch; continuing and returning home only change `scene`, so bottle contents/seeded positions, moves, completion count, reward bottle, and undo history remain intact.
- Settings/audio contract: both scenes render `GameSettings` with `audio.soundEnabled` and `audio.setSoundEnabled`. Settings gestures unlock audio and exclusively emit `ui-pressed`; the home continue gesture unlocks audio without adding a gameplay cue. The zero-reference legacy `AudioSettings.tsx` was removed, and its two-switch test was replaced by the single accessible master-switch/raster-state contract (2/2 passed).
- Gameplay cue routing: active bottle gestures unlock first; empty start and zero-move pours emit `pour-invalid`; selection and cancellation emit `bottle-selected` / `bottle-deselected`; successful pours emit `pour-valid`; completion emits `potion-completed` immediately and registry-schedules `potion-vanish` at 300ms while the established state disappearance remains at 1080ms; successful undo, restart, and reward actions emit their dedicated cues without an extra `ui.tap`.
- Timer safety: the delayed 300ms vanish cue and 1080ms disappearance share the existing transient registry, so restart and unmount cancel both. Existing 520ms invalid/pouring feedback, seed `12`, reward slot `14`, fixed engine behavior, and director policies were unchanged.
- Mutation proof: `scene` initial value `home → level` failed `scene starts on home and continue enters the retained level` (0/1); vanish cue delay `300 → 0` failed `completed potion plays immediately then schedules vanish audio at 300ms` (0/1); adding `handleRestart()` to return-home failed `returning home only changes scene and preserves all level state owners` (0/1). Each mutation was restored before final verification.
- Fresh non-browser regression: the brief's ten-file bundled Node command passed 82/82; the replacement master-switch test separately passed 2/2. Audio asset validation passed for 11 cues (1 BGM, 10 SFX), 536,504 runtime bytes, zero mismatches. Protected runtime validation passed all 28 files.
- Compile/build gates: Vite `transformWithOxc` compiled `src/Prototype.tsx` and emitted 10,212 bytes. The first sandboxed Vite attempt hit the recorded `node_modules/.vite-temp` `EPERM`; the controlling agent reran the exact build outside that restriction and passed with 523 modules transformed in 414ms.
- Remaining verification: browser interaction, responsive screenshots, console/network inspection, and human listening are intentionally assigned to the following QA task. The aggregate TypeScript CLI still has the recorded missing `@typescript/typescript-win32-x64` optional-package defect; no dependency or protected runtime file was changed to mask it.

### Checkpoint 3 — review fix round 1: real browser state and audio persistence proof

- Root cause: the three reviewed assertions only scanned source text. They could not observe a scene-triggered reset outside `onReturnHome`, distinguish the two rendered `GameSettings` instances, or prove that the controller/director/storage calls actually executed.
- Added `tests/home-settings-runtime.spec.ts`, exercised through the real React app in system Chrome at `http://127.0.0.1:4174/` because the Browser plugin was unavailable and Playwright's bundled Chromium was not installed. The test boundary keeps the real `Prototype`, `GameSettings`, `useGameAudio`, AudioDirector, Web Audio driver, and browser `localStorage` in place.
- False-pass mutation A: temporarily added a `[scene]` effect that called `setGame(createDemoState())` and `setHistory([])` on home. The old named source test still passed 1/1; the browser test failed after continuing because `步数 1` was gone. Restored implementation: focused browser test passed 1/1 and also verified bottle 0 retained three layers plus enabled undo history.
- False-pass mutation B: temporarily enabled home `canReturnHome` and disabled it on the level. The old settings source test still passed 1/1; the browser test failed with one unexpected home `返回主页` button. Restored implementation: focused browser test passed 1/1, proving home omission, level presence, the enabled sound state in each scene, and the working level return handler.
- False-pass mutation C: temporarily placed persistence and both AudioDirector setter calls under `if (false)` while leaving every scanned string present. The old controller source test still passed 1/1; the browser test failed because `witch-water-sort.audio.v1` remained `null` instead of `false/false`. Restored implementation: focused browser test passed 1/1, proving `false/false` persistence, reload restoration, `true/true` re-enable, and exactly one BGM asset request on the reloaded lifecycle.
- Source guards were retained and strengthened: scene-owned effects are checked for reset setters; home and level render slices independently assert their exact `canReturnHome`/handler props; the audio source guard explicitly identifies itself as wiring-only and requires adjacent state, persistence, and director operations. Runtime proof remains authoritative.
- Fresh focused browser suite: 3/3 passed in 6.9s. Fresh non-browser regression: 84/84 passed. Audio assets remained 11 cues / 536,504 bytes / zero mismatches, and all 28 protected runtime files passed.
- Environment evidence: the first default Playwright attempt could not find `npm` and could not create the workspace `test-results` directory; direct sandboxed Vite startup then hit the recorded `.vite-temp` `EPERM`. The approved direct Vite command started in 201ms; a temporary configuration outside the repo selected installed Chrome and a writable result directory.
- Broader fallback-browser probe: the full 11-case Playwright set yielded 9 passes and 2 unrelated existing mobile-runtime failures (`BottomSheet` overlay pointer interception and keyboard footer drag dismissal), reproducible serially under system Chrome. No mobile-runtime/protected file was changed in this review fix; the three new home/settings tests remain 3/3 green.

### Checkpoint 3 — review fix round 2: selected state and director track observation

- Re-review gap A: the earlier round-trip browser case proved `game` and `history`, but its successful pour cleared `selected` before leaving the level. Added an independent single-selection case that clicks only bottle 1, observes both `aria-pressed="true"` on the bottle button and `is-selected` on the rendered bottle, returns home, continues, and observes both states again.
- Selected-state mutation RED: temporarily added `setSelected(null)` to the home continue handler. The focused browser case failed with retained bottle 1 `aria-pressed` expected `true` but received `false`. After restoring the handler to scene-only transition, the same case passed 1/1.
- Re-review gap C: localStorage and one BGM asset request did not prove that the master switch invoked the two AudioDirector track setters; BGM preloading could satisfy that request independently.
- Director observation: before the first navigation, `addInitScript` wraps the real browser `AudioContext.prototype.createGain`. Only the first two gain nodes—the real Web Audio driver's music and SFX track nodes—have their AudioParam cancel/ramp methods instrumented. The React UI, controller, AudioDirector, Web Audio driver, storage, native AudioContext, and all other gain nodes remain real.
- Director-setter mutation RED: temporarily commented only `director.setMusicEnabled(...)` and `director.setSfxEnabled(...)`, leaving state updates and persistence active. The focused browser case still stored `false/false` but failed because the expected music/SFX ramp records were an empty array. After restoring both calls, the case passed 1/1.
- Actual observed track behavior: disabling produced music target `0` over `300ms` and SFX target `0` over `80ms`; re-enabling produced music target `0.36` and SFX target `0.78`, each with immediate `0ms` ramps. Reload persistence remains asserted as `false/false` before re-enable and `true/true` afterward. The prior BGM request assertion was removed as director-setter proof.
- Fresh focused browser file: 4/4 passed in 7.3s against the maintained Vite server at `http://127.0.0.1:4175/` using system Chrome. Fresh non-browser regression: 84/84 passed; audio asset validation remained zero-mismatch and all 28 protected runtime files passed.
- Mutation restoration proof: final SHA-256 for `Prototype.tsx` is `555bb713bb40a372a72b2275859a77bc06395f16103af84784252054a38faa77`; final SHA-256 for `useGameAudio.ts` is `6261e82df86c489f4570822fe9039b2767fc2a820fac69db49bcda3527e2245d`; both exactly match the task-302 snapshot.
