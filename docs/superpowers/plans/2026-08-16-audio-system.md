# Witch Alchemy Audio System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an original, local BGM/SFX system to the playable React prototype with portable cue contracts, independent music/effects settings, image-backed controls, and a documented Cocos Creator handoff.

**Architecture:** Pure `.mjs` modules define cue metadata, preference parsing, and the `AudioDirector` policy. A Web Audio driver owns browser decoding/playback, while a small React hook binds lifecycle and persistence; `Prototype.tsx` only emits cues after the game result is known. Deterministically generated MP3 runtime assets and WAV masters are validated against a manifest, so the cue contract and files can move to a later Cocos Creator 3.x adapter without moving React code.

**Tech Stack:** React 19, TypeScript 7, Vite 8, browser Web Audio API, Node.js test runner, deterministic JavaScript synthesis, pinned LAME MP3 encoder used only by the asset-generation tool, Playwright 1.61.

## Global Constraints

- Preserve the pure game engine and level data; do not import audio, React, browser, Cocos, or WeChat APIs into `src/game/engine.mjs`.
- Keep the existing fixed 5 × 3 board, deterministic seed `12`, reward slot index `14`, 520ms feedback windows, and 300ms burst + 780ms departure/1080ms vanish timing.
- Provide the approved 45–60 second warm, mysterious alchemy-room BGM with soft celesta, glass overtones, light night ambience, and no obvious drums.
- Provide cue IDs for `ui.tap`, `bottle.select`, `bottle.deselect`, `pour.valid`, `pour.invalid`, `potion.complete`, `potion.vanish`, `history.undo`, `level.restart`, and `reward.empty_bottle`.
- All audio content is original, deterministic, stored locally, and independent of external commercial sound libraries.
- Default track gains are music `0.36` and SFX `0.78`; completion/reward cues duck music by 30% and restore over 300ms.
- Allow at most 4 simultaneous short SFX voices, with per-cue cooldown and priority eviction.
- Music and SFX have independent switches, both default on, persisted under `witch-water-sort.audio.v1`.
- The first bottle or UI click unlocks audio even if the game operation itself is invalid.
- Background/lock interruptions suspend audio; foreground resumes one BGM instance only when music remains enabled.
- A failed audio file or rejected playback never blocks or changes game state.
- Runtime audio assets total no more than 2.5MB; WAV masters are never referenced by runtime code.
- The sound settings trigger and popover use real raster assets matching the existing gold/deep-purple Q-style UI; do not use emoji, text symbols, CSS drawings, inline SVG, or stretched screenshots as visible assets.
- Preserve protected mobile runtime files and run `pnpm run check:runtime` before browser QA and handoff.
- Current workspace root is not a Git repository. Replace each normal commit boundary with a verification checkpoint recorded in `prototype/audio-qa.md`; if execution occurs in a restored Git worktree, use the listed commit message at that boundary.

---

## File Map

### New source files

- `prototype/src/audio/audio-cues.mjs` — stable cue metadata, gameplay-event mapping, preference defaults/parser/serializer.
- `prototype/src/audio/audio-cues.d.mts` — TypeScript declarations for the cue and preference contract.
- `prototype/src/audio/audio-director.mjs` — platform-neutral playback policy: unlock, BGM state, voice limits, cooldown, priority, ducking, suspend/resume, dispose.
- `prototype/src/audio/audio-director.d.mts` — driver, voice, scheduler, and director type declarations.
- `prototype/src/audio/web-audio-driver.mjs` — browser `AudioContext` resource loading, buffer playback, gain ramps, suspend/resume, and disposal.
- `prototype/src/audio/web-audio-driver.d.mts` — TypeScript declarations for the Web Audio driver factory.
- `prototype/src/audio/useGameAudio.ts` — one stable director per prototype lifecycle, localStorage binding, visibility binding, and React-facing controller.
- `prototype/src/components/AudioSettings.tsx` — image-backed sound trigger and two independent switches.

### New asset/tool files

- `prototype/scripts/generate-audio-assets.mjs` — deterministic PCM synthesis, WAV master writing, MP3 runtime encoding, manifest/report generation.
- `prototype/scripts/validate-audio-assets.mjs` — manifest, hash, duration, size, cue coverage, and runtime-reference validation.
- `prototype/scripts/vendor/lamejs/` — pinned generator-only encoder files and upstream license; never imported by application source.
- `prototype/public/assets/game/audio/bgm/alchemy-room-loop.mp3` — runtime BGM.
- `prototype/public/assets/game/audio/sfx/*.mp3` — ten runtime SFX files.
- `prototype/public/assets/game/audio/audio-manifest.json` — generated runtime manifest.
- `prototype/artifacts/audio-masters/*.wav` — eleven lossless generated masters.
- `prototype/artifacts/audio-masters/generation-report.md` — seeds, synthesis parameters, durations, sizes, hashes, and encoder provenance.
- `prototype/artifacts/audio-ui-raw/` — retained raw ImageGen outputs for the sound UI.
- `prototype/public/assets/game/chibi/ui/audio-settings-panel.png` — fitted popover background.
- `prototype/public/assets/game/chibi/ui/icon-audio-settings.png` — trigger icon.
- `prototype/public/assets/game/chibi/ui/icon-music-on.png`, `icon-music-off.png`, `icon-sfx-on.png`, `icon-sfx-off.png` — switch-state icons.

### New tests and evidence

- `prototype/tests/audio-cues.test.mjs` — exact cue/preferences contract tests.
- `prototype/tests/audio-director.test.mjs` — fake-driver policy tests.
- `prototype/tests/audio-assets.test.mjs` — manifest/runtime asset integrity tests.
- `prototype/tests/web-audio-driver.test.mjs` — fake-`AudioContext` driver tests.
- `prototype/tests/audio-settings.test.mjs` — component/source/asset contract tests.
- `prototype/tests/audio-runtime.spec.ts` — real prototype browser interaction and persistence checks.
- `prototype/audio-qa.md` — final test, asset, browser, listening, and Cocos handoff evidence.
- `prototype/artifacts/audio-settings-{closed,open}-393x852.png` and `audio-settings-open-427x952.png` — exact app-screen captures.
- `prototype/artifacts/audio-settings-reference-comparison.png` — aspect-preserved visual comparison against the approved chibi prototype baseline.

### Existing files to modify

- `prototype/AGENTS.md` — record the durable approved audio decisions.
- `prototype/package.json` — add `prepare:audio-assets`, `validate:audio-assets`, and `test:audio` scripts; do not add a runtime dependency.
- `prototype/src/Prototype.tsx` — emit cues from existing confirmed result branches and render the settings control.
- `prototype/src/prototype.css` — place/style the image-backed trigger and horizontal popover inside the safe top-right strip.
- `prototype/tests/prototype-integration.test.mjs` — guard gameplay-to-audio mapping and the completion/vanish timing.

---

### Task 1: Lock the cue, preference, and gameplay-event contract

**Files:**
- Create: `prototype/src/audio/audio-cues.mjs`
- Create: `prototype/src/audio/audio-cues.d.mts`
- Create: `prototype/tests/audio-cues.test.mjs`
- Modify: `prototype/AGENTS.md`
- Modify: `prototype/package.json`

**Interfaces:**
- Consumes: no earlier task.
- Produces: `AUDIO_CUES`, `GAME_AUDIO_EVENT_TO_CUE`, `gameAudioCue(event)`, `DEFAULT_AUDIO_PREFERENCES`, `AUDIO_PREFERENCES_KEY`, `parseAudioPreferences(raw)`, and `serializeAudioPreferences(value)`.

- [ ] **Step 1: Add the failing cue and preference tests**

Create `tests/audio-cues.test.mjs` with exact mapping and fallback assertions:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_CUES,
  AUDIO_PREFERENCES_KEY,
  DEFAULT_AUDIO_PREFERENCES,
  gameAudioCue,
  parseAudioPreferences,
  serializeAudioPreferences,
} from '../src/audio/audio-cues.mjs';

test('game results map to the approved stable cue ids', () => {
  assert.deepEqual([
    'ui-pressed', 'bottle-selected', 'bottle-deselected', 'pour-valid',
    'pour-invalid', 'potion-completed', 'potion-vanish', 'undo-succeeded',
    'restart-succeeded', 'reward-bottle-granted',
  ].map(gameAudioCue), [
    'ui.tap', 'bottle.select', 'bottle.deselect', 'pour.valid',
    'pour.invalid', 'potion.complete', 'potion.vanish', 'history.undo',
    'level.restart', 'reward.empty_bottle',
  ]);
});

test('cue table has exact tracks, urls, gains, limits, and completion ducking', () => {
  assert.equal(Object.keys(AUDIO_CUES).length, 11);
  assert.equal(AUDIO_CUES['bgm.alchemy_room'].url, '/assets/game/audio/bgm/alchemy-room-loop.mp3');
  assert.equal(AUDIO_CUES['bgm.alchemy_room'].track, 'music');
  assert.equal(AUDIO_CUES['bgm.alchemy_room'].loop, true);
  assert.equal(AUDIO_CUES['bgm.alchemy_room'].loopStartMs, 26);
  assert.equal(AUDIO_CUES['bgm.alchemy_room'].loopEndMs, 47_974);
  assert.equal(AUDIO_CUES['potion.complete'].duckMusic, true);
  assert.equal(AUDIO_CUES['reward.empty_bottle'].duckMusic, true);
  assert.equal(AUDIO_CUES['ui.tap'].cooldownMs, 60);
  assert.equal(AUDIO_CUES['pour.valid'].cooldownMs, 100);
});

test('audio preferences default on, round-trip, and reject corrupt data', () => {
  assert.equal(AUDIO_PREFERENCES_KEY, 'witch-water-sort.audio.v1');
  assert.deepEqual(DEFAULT_AUDIO_PREFERENCES, { musicEnabled: true, sfxEnabled: true });
  assert.deepEqual(parseAudioPreferences(null), DEFAULT_AUDIO_PREFERENCES);
  assert.deepEqual(parseAudioPreferences('{"musicEnabled":false,"sfxEnabled":true}'), {
    musicEnabled: false,
    sfxEnabled: true,
  });
  assert.deepEqual(parseAudioPreferences('{"musicEnabled":"no"}'), DEFAULT_AUDIO_PREFERENCES);
  assert.deepEqual(parseAudioPreferences('{broken'), DEFAULT_AUDIO_PREFERENCES);
  assert.equal(
    serializeAudioPreferences({ musicEnabled: false, sfxEnabled: true }),
    '{"musicEnabled":false,"sfxEnabled":true}',
  );
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run from `prototype`:

```powershell
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/audio-cues.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/audio/audio-cues.mjs`.

- [ ] **Step 3: Implement the exact contract**

Create an immutable cue table using these values:

```js
export const AUDIO_PREFERENCES_KEY = 'witch-water-sort.audio.v1';
export const DEFAULT_TRACK_GAINS = Object.freeze({ music: 0.36, sfx: 0.78 });
export const DEFAULT_AUDIO_PREFERENCES = Object.freeze({ musicEnabled: true, sfxEnabled: true });

const cue = (id, track, file, gain, cooldownMs, maxVoices, priority, options = {}) => Object.freeze({
  id,
  track,
  url: `/assets/game/audio/${track === 'music' ? 'bgm' : 'sfx'}/${file}.mp3`,
  gain,
  cooldownMs,
  maxVoices,
  priority,
  loop: false,
  duckMusic: false,
  ...options,
});

export const AUDIO_CUES = Object.freeze({
  'bgm.alchemy_room': cue('bgm.alchemy_room', 'music', 'alchemy-room-loop', 1, 0, 1, 100, {
    loop: true,
    loopStartMs: 26,
    loopEndMs: 47_974,
  }),
  'ui.tap': cue('ui.tap', 'sfx', 'ui-tap', 0.35, 60, 2, 10),
  'bottle.select': cue('bottle.select', 'sfx', 'bottle-select', 0.55, 80, 2, 20),
  'bottle.deselect': cue('bottle.deselect', 'sfx', 'bottle-deselect', 0.42, 80, 1, 20),
  'pour.valid': cue('pour.valid', 'sfx', 'pour-valid', 0.65, 100, 2, 40),
  'pour.invalid': cue('pour.invalid', 'sfx', 'pour-invalid', 0.52, 120, 1, 45),
  'potion.complete': cue('potion.complete', 'sfx', 'potion-complete', 0.90, 0, 2, 90, { duckMusic: true }),
  'potion.vanish': cue('potion.vanish', 'sfx', 'potion-vanish', 0.68, 0, 2, 80),
  'history.undo': cue('history.undo', 'sfx', 'undo', 0.55, 100, 1, 40),
  'level.restart': cue('level.restart', 'sfx', 'restart', 0.65, 0, 1, 60),
  'reward.empty_bottle': cue('reward.empty_bottle', 'sfx', 'reward-empty-bottle', 0.90, 0, 1, 100, { duckMusic: true }),
});

export const GAME_AUDIO_EVENT_TO_CUE = Object.freeze({
  'ui-pressed': 'ui.tap',
  'bottle-selected': 'bottle.select',
  'bottle-deselected': 'bottle.deselect',
  'pour-valid': 'pour.valid',
  'pour-invalid': 'pour.invalid',
  'potion-completed': 'potion.complete',
  'potion-vanish': 'potion.vanish',
  'undo-succeeded': 'history.undo',
  'restart-succeeded': 'level.restart',
  'reward-bottle-granted': 'reward.empty_bottle',
});
```

Implement `gameAudioCue` as a strict lookup that throws for an unknown development-time event. Implement preference parsing by accepting only an object whose two fields are booleans; catch JSON errors and return a fresh copy of the defaults. Declare exact literal unions and readonly fields in `audio-cues.d.mts`.

- [ ] **Step 4: Record the durable decisions and package test command**

Append four bullets to the confirmed decisions in `AGENTS.md`: local original BGM/SFX, the stable cue/driver boundary, independent persisted switches, and first-gesture/background lifecycle behavior. Add this script without changing protected build scripts:

```json
"test:audio": "node --test tests/audio-cues.test.mjs tests/audio-director.test.mjs tests/audio-assets.test.mjs tests/web-audio-driver.test.mjs tests/audio-settings.test.mjs"
```

- [ ] **Step 5: Run GREEN and save checkpoint 1**

Run the focused test, then `pnpm run test:presentation` and `pnpm run test:game`. Expected: all pass. Record counts in `audio-qa.md` under `Checkpoint 1 — contracts`. Commit message if Git is available: `feat(audio): define portable cue contract`.

---

### Task 2: Implement AudioDirector policy with a fake driver

**Files:**
- Create: `prototype/src/audio/audio-director.mjs`
- Create: `prototype/src/audio/audio-director.d.mts`
- Create: `prototype/tests/audio-director.test.mjs`

**Interfaces:**
- Consumes: `AUDIO_CUES`, `DEFAULT_TRACK_GAINS`, and cue/preference types from Task 1.
- Produces: `createAudioDirector(options)` returning `unlock`, `preload`, `play`, `startBgm`, `setMusicEnabled`, `setSfxEnabled`, `suspend`, `resume`, `getPreferences`, and `dispose`.

- [ ] **Step 1: Write failing fake-driver tests**

The fake driver records `unlock`, `preload`, `play`, `setTrackGain`, voice `setGain`, `suspend`, `resume`, `stop`, and `dispose`. Inject `now`, `setTimer`, and `clearTimer` so tests advance time without sleeping. Cover these exact cases:

```js
test('unlock is idempotent and starts exactly one enabled bgm voice', async () => {
  const fixture = createFixture();
  await Promise.all([fixture.director.unlock(), fixture.director.unlock()]);
  fixture.director.startBgm();
  fixture.director.startBgm();
  await fixture.flush();
  assert.equal(fixture.driver.calls.unlock, 1);
  assert.equal(fixture.driver.played.filter((entry) => entry.id === 'bgm.alchemy_room').length, 1);
});

test('sfx cooldown, per-cue voices, and global four-voice cap are enforced', async () => {
  const fixture = createFixture();
  await fixture.director.unlock();
  fixture.director.play('ui.tap');
  fixture.director.play('ui.tap');
  await fixture.flush();
  assert.equal(fixture.driver.played.filter((entry) => entry.id === 'ui.tap').length, 1);
  fixture.advance(60);
  for (const id of ['bottle.select', 'pour.valid', 'pour.invalid', 'history.undo', 'ui.tap']) {
    fixture.director.play(id);
    fixture.advance(120);
  }
  await fixture.flush();
  assert.ok(fixture.driver.activeSfx.length <= 4);
});

test('high priority completion evicts the oldest lowest-priority voice and ducks bgm', async () => {
  const fixture = createFixture();
  await fixture.director.unlock();
  fixture.director.startBgm();
  for (const id of ['ui.tap', 'bottle.select', 'pour.valid', 'history.undo']) {
    fixture.director.play(id);
    fixture.advance(120);
  }
  fixture.director.play('potion.complete');
  await fixture.flush();
  assert.equal(fixture.driver.stopped[0].id, 'ui.tap');
  assert.deepEqual(fixture.driver.trackGainRamps.at(-1), {
    track: 'music', gain: 0.252, durationMs: 120,
  });
  fixture.finish('potion.complete');
  fixture.runTimers();
  assert.deepEqual(fixture.driver.trackGainRamps.at(-1), {
    track: 'music', gain: 0.36, durationMs: 300,
  });
});
```

Also assert: music/SFX switches are independent; disabled SFX never starts; disabled music fades out over 300ms; suspend/resume calls the driver once; missing/rejected play resolves without throwing; dispose stops voices, clears timers, and rejects stale async completions.

- [ ] **Step 2: Run RED**

Run `node --test tests/audio-director.test.mjs`. Expected: missing `audio-director.mjs`.

- [ ] **Step 3: Implement policy and declarations**

Use these exact internal records:

```js
const state = {
  disposed: false,
  unlocked: false,
  unlockPromise: null,
  suspended: false,
  musicEnabled: initialPreferences.musicEnabled,
  sfxEnabled: initialPreferences.sfxEnabled,
  bgmVoice: null,
  activeSfx: [],
  lastPlayedAt: new Map(),
  duckCount: 0,
  generation: 0,
};
```

Rules:

1. `unlock()` memoizes one driver promise and calls `startBgm()` after success if music is enabled.
2. `startBgm()` is idempotent, verifies generation after every await, and fades the music voice from 0 to full cue gain over 300ms.
3. `play(id)` returns immediately. It applies enabled/cooldown checks before async loading and reserves a pending slot so simultaneous promises cannot exceed limits.
4. When the global cap is full, evict only if the incoming priority is greater than the lowest active priority; among ties evict the oldest.
5. A ducking cue increments `duckCount`, ramps the music track from `0.36` to `0.252` over 120ms, then decrements on end; restore the track to `0.36` over 300ms only when the count reaches zero.
6. `setMusicEnabled(false)` ramps the music track to `0` and stops BGM over 300ms. Re-enable restores the track to `0.36` and calls `startBgm()` only after unlock.
7. `setSfxEnabled(false)` prevents new SFX, ramps the SFX track toward `0`, and fades all current SFX over 80ms; re-enable restores the track to `0.78`.
8. `suspend()`/`resume()` are idempotent and delegate to the driver; `resume()` does not override disabled music.
9. `dispose()` increments generation, clears scheduled restores, stops all voices, and calls driver disposal once.

Declare the driver contract in `audio-director.d.mts`:

```ts
export interface AudioVoice {
  readonly id: string;
  setGain(gain: number, durationMs: number): void;
  stop(durationMs: number): void;
}

export interface AudioDriver {
  unlock(): Promise<void>;
  preload(cueIds: readonly AudioCueId[]): Promise<void>;
  play(cue: AudioCueDefinition, onEnded: () => void): Promise<AudioVoice | null>;
  setTrackGain(track: 'music' | 'sfx', gain: number, durationMs: number): void;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  dispose(): void;
}
```

- [ ] **Step 4: Run policy mutation checks and GREEN**

Temporarily change the global cap `4 → 3`, priority comparison `> → >=`, and restore duration `300 → 250` one at a time; each mutation must fail a named assertion. Restore each value, rerun `tests/audio-director.test.mjs`, then run Task 1 tests. Record RED/GREEN evidence in checkpoint 2. Commit message if Git is available: `feat(audio): add portable director policy`.

---

### Task 3: Generate and validate original audio assets

**Files:**
- Create: `prototype/scripts/generate-audio-assets.mjs`
- Create: `prototype/scripts/validate-audio-assets.mjs`
- Create: `prototype/scripts/vendor/lamejs/**`
- Create: `prototype/tests/audio-assets.test.mjs`
- Create: `prototype/public/assets/game/audio/**`
- Create: `prototype/artifacts/audio-masters/**`
- Modify: `prototype/package.json`

**Interfaces:**
- Consumes: exact cue IDs and URLs from Task 1.
- Produces: eleven runtime MP3 files, eleven WAV masters, `audio-manifest.json`, and `generation-report.md` whose hashes are authoritative for later tasks.

- [ ] **Step 1: Vendor the pinned generator-only encoder**

Use `pnpm pack @breezystack/lamejs@1.2.7` in a temporary directory, extract the package into `scripts/vendor/lamejs/`, retain its `LICENSE`, `package.json`, and CommonJS encoder sources, and record version `1.2.7` plus the tarball integrity in the generation report. Do not add it to application dependencies or either lockfile. The generator loads it with `createRequire(import.meta.url)`; application source must contain no `lamejs` import.

- [ ] **Step 2: Write the failing asset test and validator**

`audio-assets.test.mjs` imports a `validateAudioAssets(root)` function and expects:

```js
assert.equal(result.cueCount, 11);
assert.equal(result.bgmCount, 1);
assert.equal(result.sfxCount, 10);
assert.ok(result.runtimeBytes <= 2_500_000);
assert.deepEqual(result.missingCueIds, []);
assert.deepEqual(result.hashMismatches, []);
assert.deepEqual(result.runtimeMasterReferences, []);
assert.ok(result.bgmDurationSeconds >= 45 && result.bgmDurationSeconds <= 60);
```

The validator must reject a missing file, an extra/missing cue, a hash mismatch, a runtime reference containing `artifacts/audio-masters`, a BGM outside 45–60 seconds, any SFX outside its specified range, and a runtime total above 2.5MB.

- [ ] **Step 3: Run RED before generation**

Run `node --test tests/audio-assets.test.mjs`. Expected: FAIL naming the missing manifest or first missing runtime file.

- [ ] **Step 4: Implement deterministic synthesis primitives**

In `generate-audio-assets.mjs`, use `44_100Hz`, mono, `Float64Array` accumulation, a seeded xorshift32 PRNG, peak normalization to `0.86`, and 12ms attack/release safety fades. Implement named primitives `sine`, `triangle`, `noise`, `adsr`, `lowPass`, `delay`, `mixAt`, `writeWav`, and `encodeMp3`.

Use these exact musical/synthesis recipes:

- BGM: 48 seconds at 72 BPM, four 12-second phrases, chord roots `[D4, Bb3, F4, C4]`, celesta arpeggio degrees `[0, 7, 12, 15, 12, 7]`, glass partials `1.0/2.76/5.4`, soft pad fifths, seeded candle/nocturnal noise, and a 2-second equal-power wrap crossfade.
- `ui.tap`: 70ms filtered wood click at 220/330Hz.
- `bottle.select`: 160ms glass partials rooted at 880Hz plus 24ms shimmer delay.
- `bottle.deselect`: 140ms descending 740→554Hz glass partials.
- `pour.valid`: 500ms band-limited liquid noise with five seeded bubble chirps and a quiet 1320Hz magic trail.
- `pour.invalid`: 310ms 180→120Hz cork thump plus detuned 310/296Hz wobble.
- `potion.complete`: 1000ms D5–F5–A5 celesta rise plus glass tail.
- `potion.vanish`: 620ms high-passed noise sweep with descending resonance.
- `history.undo`: 230ms reversed shimmer contour, 1100→660Hz.
- `level.restart`: 410ms circular stir noise plus 392Hz settling tone.
- `reward.empty_bottle`: 850ms D5–A5–D6 warm bell triad with longer tail.

Write WAV masters first, encode BGM at 80kbps and SFX at 96kbps, then hash the final bytes with SHA-256. Generation uses fixed global seed `0xA1C4E57` plus a stable per-cue string hash.

- [ ] **Step 5: Generate manifest and report**

Each manifest entry contains `id`, `path`, `sha256`, `durationMs`, `sampleRate`, `channels`, `runtimeBytes`, `track`, `gain`, `cooldownMs`, `maxVoices`, `priority`, `loop`, `loopStartMs`, `loopEndMs`, `duckMusic`, `generatorVersion`, and `seed`. Sort entries by cue ID and serialize with two-space indentation plus a trailing newline for deterministic diffs.

Add package scripts:

```json
"prepare:audio-assets": "node scripts/generate-audio-assets.mjs",
"validate:audio-assets": "node scripts/validate-audio-assets.mjs"
```

- [ ] **Step 6: Run generation twice and prove determinism**

Run `pnpm run prepare:audio-assets`, store the eleven runtime hashes, run it again, and assert every hash is unchanged. Then run `pnpm run validate:audio-assets` and `node --test tests/audio-assets.test.mjs`. Expected validator summary: `11 cues, 1 BGM, 10 SFX`, zero mismatches, total runtime bytes at or below 2,500,000. Record per-file duration/size/hash in checkpoint 3. Commit message if Git is available: `feat(audio): generate original alchemy sound pack`.

---

### Task 4: Add the Web Audio driver and React lifecycle controller

**Files:**
- Create: `prototype/src/audio/web-audio-driver.mjs`
- Create: `prototype/src/audio/web-audio-driver.d.mts`
- Create: `prototype/src/audio/useGameAudio.ts`
- Create: `prototype/tests/web-audio-driver.test.mjs`

**Interfaces:**
- Consumes: `AudioDriver` from Task 2 and cue/preferences contracts from Task 1.
- Produces: `createWebAudioDriver()` and `useGameAudio()`.

- [ ] **Step 1: Write fake-AudioContext RED tests**

Stub `fetch`, `decodeAudioData`, `createBufferSource`, `createGain`, `resume`, `suspend`, and `close`. Assert:

- concurrent `preload` calls fetch each URL once;
- `unlock()` resumes one context and is idempotent;
- `play()` connects `BufferSource → voice GainNode → track GainNode → destination`;
- loop plus `loopStart=0.026` and `loopEnd=47.974` come from cue metadata;
- `setTrackGain('music', 0.252, 120)` schedules a linear ramp on the music track node at the context clock;
- voice `setGain(0.7, 120)` schedules an independent per-voice ramp;
- `stop(80)` ramps to zero and stops after 80ms;
- an HTTP 404 or decode rejection resolves to `null` and is cached as unavailable;
- `dispose()` stops sources, clears caches, and closes the context once.

Run and confirm the missing-module RED.

- [ ] **Step 2: Implement `createWebAudioDriver`**

Create one lazy `AudioContext`, music and SFX track gain nodes initialized to `0.36` and `0.78`, an `AudioBuffer` promise cache keyed by cue ID, and a live source set. Use `fetch(cue.url)`, require `response.ok`, and call `decodeAudioData` on a copied array buffer. Copy `loop`, `loopStartMs / 1000`, and `loopEndMs / 1000` to the buffer source. Track and voice gain ramps must cancel scheduled values, set the current value, then linearly ramp to the target. Catch load/play errors inside the driver and return `null`; do not log expected autoplay failures in production.

- [ ] **Step 3: Implement `useGameAudio` with stable ownership**

The hook returns this stable shape:

```ts
interface GameAudioController {
  readonly preferences: AudioPreferences;
  unlockFromGesture(): void;
  play(cueId: AudioCueId): void;
  setMusicEnabled(enabled: boolean): void;
  setSfxEnabled(enabled: boolean): void;
}
```

Required lifecycle:

- lazy-create driver/director once via `useRef`;
- initialize preferences from `localStorage.getItem(AUDIO_PREFERENCES_KEY)` with the Task 1 parser;
- preload `ui.tap`, `bottle.select`, `pour.valid`, and `pour.invalid` after mount, while BGM loads asynchronously;
- on every setter, update React state, persist serialized preferences, and call the director setter;
- on `visibilitychange`, call `suspend` when hidden and `resume` when visible;
- on unmount, remove the listener and call `dispose` exactly once;
- React Strict Mode mount/unmount must not leave an orphan context or duplicate BGM.

- [ ] **Step 4: Run driver, OXC/Vite transform, and regression GREEN**

Run `tests/web-audio-driver.test.mjs`, `tests/audio-director.test.mjs`, the existing presentation/game tests, and `pnpm run build`. Expected: all pass and Vite transforms `useGameAudio.ts`. Record checkpoint 4. Commit message if Git is available: `feat(audio): add web audio adapter`.

---

### Task 5: Build the image-backed sound settings control

**Files:**
- Create: `prototype/src/components/AudioSettings.tsx`
- Create: `prototype/tests/audio-settings.test.mjs`
- Create: `prototype/artifacts/audio-ui-raw/**`
- Create: `prototype/public/assets/game/chibi/ui/audio-settings-panel.png`
- Create: `prototype/public/assets/game/chibi/ui/icon-audio-settings.png`
- Create: `prototype/public/assets/game/chibi/ui/icon-music-on.png`
- Create: `prototype/public/assets/game/chibi/ui/icon-music-off.png`
- Create: `prototype/public/assets/game/chibi/ui/icon-sfx-on.png`
- Create: `prototype/public/assets/game/chibi/ui/icon-sfx-off.png`
- Modify: `prototype/src/prototype.css`

**Interfaces:**
- Consumes: `AudioPreferences` and setter callbacks from Task 4.
- Produces: `<AudioSettings preferences onMusicChange onSfxChange onUiPress />`.

- [ ] **Step 1: Measure the approved slot and generate fitted raster assets**

Target CSS sizes are a 48×48 trigger and a 124×48 horizontal popover opening to its left. Generate at 2× resolution: 96×96 transparent icons and a 248×96 panel. Use the existing room, `button-purple-normal.png`, and `message-panel.png` as visual references. ImageGen prompt:

```text
Create a cohesive Q-style witch-alchemy mobile-game sound-settings asset set matching the supplied deep-purple and warm-gold storybook UI. Thick clean rounded outlines, violet enamel, warm candle highlights, tiny glass sparkle details, no text, no letters, no emoji. Deliver separate transparent speaker/music/effects on and muted icons centered with generous padding, plus one 248×96 dark-purple rounded popover panel with a gold-violet ornamental border and quiet transparent-looking center. Front-facing UI, no perspective, no drop shadow beyond the component bounds.
```

Normalize each asset to the exact target dimensions without stretching, preserve true alpha around icons, and retain the raw generations under `artifacts/audio-ui-raw`.

- [ ] **Step 2: Write the component contract RED test**

Assert source contains one trigger with `aria-expanded`, `aria-controls="audio-settings-popover"`, a two-switch `role="group"`, buttons named `背景音乐：已开启/已关闭` and `游戏音效：已开启/已关闭`, Escape handling, outside-click dismissal, and the five approved raster URLs. Assert no emoji, inline SVG, or Radix icon import. Assert every asset exists and has the expected PNG dimensions.

- [ ] **Step 3: Implement `AudioSettings.tsx`**

Behavior:

- trigger calls `onUiPress()` and toggles one popover;
- popover remains mounted during a 160ms exit phase, then unmounts;
- each switch calls `onUiPress()` followed by its own setter and remains open;
- outside pointer-down and Escape close it;
- trigger receives focus after Escape close;
- all document listeners are removed on close/unmount;
- no click passes through the popover to bottles.

Use visually hidden text for full labels and visible short labels `音乐` and `音效`. On/off state is conveyed by both icon and `aria-pressed`, never color alone.

- [ ] **Step 4: Add safe-area CSS without covering header, witch, or board**

Use these layout constants:

```css
.audio-settings { position: absolute; z-index: 8; top: 62px; right: 18px; }
.audio-settings-trigger { width: 48px; height: 48px; }
.audio-settings-popover { position: absolute; top: 0; right: 50px; width: 124px; height: 48px; }
```

The panel occupies the existing top strip from approximately `x=201..325`, to the right of the header ending near `x=198` and above the witch beginning at `top:122px`. Two switch hit areas are each at least 44px high. Add 160ms opacity/translate enter/exit and disable those animations under `prefers-reduced-motion`.

- [ ] **Step 5: Run tests and asset visual gate**

Run `audio-settings.test.mjs`, presentation tests, runtime integrity, and build. Open each raster locally and inspect true alpha, centering, legibility at CSS size, and consistency with the existing button/message assets. Record checkpoint 5. Commit message if Git is available: `feat(audio): add sound settings controls`.

---

### Task 6: Integrate cues with confirmed game outcomes

**Files:**
- Modify: `prototype/src/Prototype.tsx`
- Modify: `prototype/tests/prototype-integration.test.mjs`

**Interfaces:**
- Consumes: `useGameAudio`, `gameAudioCue`, and `AudioSettings` from Tasks 1, 4, and 5.
- Produces: complete audible gameplay with unchanged game-state semantics.

- [ ] **Step 1: Add failing integration assertions**

Extend the source contract test to require these branches:

```text
first active bottle/UI handler call -> audio.unlockFromGesture()
empty start or moved === 0 -> pour-invalid
valid first selection -> bottle-selected
selected === index -> bottle-deselected
moved > 0 -> pour-valid
completed.length > 0 -> potion-completed immediately
completed.length > 0 -> potion-vanish after 300ms
successful undo -> undo-succeeded
successful restart -> restart-succeeded
granted reward -> reward-bottle-granted
disabled/early-return branches -> no cue after the return
```

Assert `AudioSettings` receives both preference fields and setters. Keep all existing message, timer-registry, reward-slot, and animation-duration assertions.

- [ ] **Step 2: Run RED against the current silent prototype**

Run `node --test tests/prototype-integration.test.mjs`. Expected: new audio integration assertions fail while existing assertions pass.

- [ ] **Step 3: Wire the stable controller without changing engine results**

At component start:

```ts
const audio = useGameAudio();
const playGameAudio = useCallback((event: GameAudioEvent) => {
  audio.play(gameAudioCue(event));
}, [audio]);
```

At the beginning of every enabled bottle/control/settings action call `audio.unlockFromGesture()`. Emit each event only after its corresponding branch has passed existing early-return conditions and state updates have been scheduled.

For completion, preserve the current 1080ms vanish callback and add a separate registered timer:

```ts
playGameAudio('potion-completed');
scheduleTransient(() => playGameAudio('potion-vanish'), 300);
```

Because both timers use the existing registry, restart/unmount clears the delayed vanish cue. Do not play `ui.tap` on undo, restart, reward, bottle, or invalid operations because each has a dedicated result cue; reserve `ui.tap` for opening/toggling the audio settings control.

- [ ] **Step 4: Render the sound settings group**

Place it as a sibling immediately after `level-header`, before `WitchAnimator`, with props from `audio.preferences` and controller setters. Do not move the header, witch, board, message, or bottom controls.

- [ ] **Step 5: Run mutation RED/GREEN and full non-browser regression**

Temporarily move vanish cue timing `300 → 0`, map invalid pour to `pour.valid`, and place reward cue before the reward guard one at a time. Each mutation must fail a named integration assertion. Restore the code, then run:

```powershell
pnpm run test:audio
pnpm run test:game
pnpm run test:presentation
pnpm run test:integration
pnpm run validate:audio-assets
pnpm run check:runtime
pnpm run build
```

Expected: every command passes. Record exact counts and build module count in checkpoint 6. Commit message if Git is available: `feat(audio): connect game events to sound`.

---

### Task 7: Browser QA, listening gate, and Cocos handoff

**Files:**
- Create: `prototype/tests/audio-runtime.spec.ts`
- Create: `prototype/audio-qa.md`
- Modify only if a confirmed product defect is found: files from Tasks 1–6 and their focused tests.

**Interfaces:**
- Consumes: the complete Web prototype and generated assets.
- Produces: reproducible browser evidence and a precise production migration boundary.

- [ ] **Step 1: Add browser tests for settings and lifecycle**

Navigate to `/`, use the existing iPhone viewport, and assert:

- trigger is inside the device safe bounds and popover does not overlap `.level-header`, `.witch-stage`, or `.board-shell`;
- click opens one popover, both switches expose correct `aria-pressed`, Escape closes and restores focus;
- toggles persist through reload under `witch-water-sort.audio.v1`;
- first empty-bottle click causes no uncaught autoplay error;
- BGM URL is requested at most once per mount;
- all ten SFX URLs return HTTP 200 when their deterministic gameplay paths or a driver preload request exercise them;
- visibility hide/show leaves one BGM request/instance path;
- reduced motion removes popover animation but does not disable sound preferences;
- console has no application warnings/errors and generated audio/UI requests have no failures.

Capture exact app-screen clips at 393×852 with settings closed/open and at 427×952 with settings open; assert PNG header dimensions before accepting them.

- [ ] **Step 2: Run automated browser flow in the user-approved browser path**

Use the in-app browser for inspection. If its automation interface is unavailable, use the already approved project Playwright fallback. Run `pnpm run test:runtime`; expected: existing mobile-runtime tests plus `audio-runtime.spec.ts` pass.

- [ ] **Step 3: Perform the auditory acceptance pass**

Listen through this fixed flow at normal device volume: open settings, toggle both tracks, select/cancel, empty start invalid, incompatible target invalid, valid pour, deterministic completion burst→300ms whoosh→1080ms vanish, undo, restart, reward bottle, 3 minutes of BGM looping, background/foreground. Confirm no obvious seam, clipping, harsh invalid sound, duplicate BGM, excessive overlap, or audio/animation mismatch. Record pass/fail per cue and any gain-only tuning in `audio-qa.md`.

Build an aspect-preserved comparison using the approved `artifacts/chibi-initial-393x852.png` baseline beside the new closed/open 393×852 captures. Inspect the combined image for layout shifts, mismatched button treatment, stretched panel art, unsafe edges, header/witch overlap, and bottle/control crop; fix only confirmed differences and recapture both sides after a fix.

- [ ] **Step 4: Verify package evidence and Cocos boundary**

In `audio-qa.md`, record:

- all runtime file paths, durations, byte sizes, and SHA-256 hashes;
- total runtime audio bytes and 2.5MB budget result;
- BGM/SFX default gains and final tuning deltas;
- exact browser/device/viewport used;
- Web adapter files that must not be copied to Cocos;
- reusable cue, manifest, preference, and asset files;
- Cocos implementation target: one looping `AudioSource` for BGM and `playOneShot`/pooled sources for SFX, with a WeChat storage adapter and first-input unlock behavior;
- real ad success alone emits `reward.empty_bottle`.

- [ ] **Step 5: Run final fresh verification**

Run all commands from Task 6 again, followed by `pnpm run test:runtime`. Re-run the audio validator after the build to prove the build did not alter assets. The final line of `audio-qa.md` must be `final result: passed` only when every command and listening item is green. Commit message if Git is available: `test(audio): verify playable sound experience`.

---

## Plan Self-Review Checklist

- Every approved cue has one generation recipe, one manifest entry, one event mapping, and one integration assertion.
- BGM style, duration, loop behavior, default gain, ducking, and package budget are covered by Tasks 1–3 and 7.
- Autoplay unlock, independent switches, persistence, foreground/background lifecycle, single BGM, failure degradation, concurrency, cleanup, and stale async protection are covered by Tasks 2, 4, 6, and 7.
- The settings UI has measured slots, real raster assets, accessible state, reduced-motion behavior, and overlap checks in Tasks 5 and 7.
- React/browser code remains outside the engine; the Cocos/WeChat migration boundary is explicitly documented.
- Protected runtime files remain untouched and the existing full regression/build commands remain mandatory.
- All named types, cue IDs, events, paths, durations, gains, limits, and storage keys match the approved design specification.

## Primary Technical References

- Cocos Creator supported audio formats: https://docs.cocos.com/creator3d/manual/en/asset/audio.html
- Cocos Creator 3.8 `AudioSource`, `playOneShot`, and autoplay behavior: https://docs.cocos.com/creator/3.8/manual/zh/audio-system/audiosource.html
- Cocos audio platform differences, including WeChat Mini Game support: https://docs.cocos.com/creator3d/manual/en/audio-system/overview.html
- Pinned generator-only MP3 encoder package: https://www.npmjs.com/package/@breezystack/lamejs
