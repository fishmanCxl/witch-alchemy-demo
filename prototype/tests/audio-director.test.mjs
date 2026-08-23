import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioDirector } from '../src/audio/audio-director.mjs';

function createFixture(options = {}) {
  let now = 0;
  let timerId = 0;
  const timers = new Map();
  const pendingPlays = [];
  const driver = {
    calls: { unlock: 0, preload: 0, suspend: 0, resume: 0, dispose: 0 },
    played: [],
    stopped: [],
    trackGainRamps: [],
    voiceGainRamps: [],
    rejectedIds: new Set(options.rejectedIds),
    missingIds: new Set(options.missingIds),
    get activeSfx() {
      return this.played.filter((entry) => entry.id !== 'bgm.alchemy_room' && !entry.voice.stopped);
    },
    async unlock() {
      this.calls.unlock += 1;
    },
    async preload(cueIds) {
      this.calls.preload += 1;
      this.preloaded = [...cueIds];
    },
    async play(cue, onEnded) {
      if (this.rejectedIds.has(cue.id)) throw new Error(`Rejected: ${cue.id}`);
      if (this.missingIds.has(cue.id)) return null;
      if (options.deferPlayIds?.has(cue.id)) {
        return new Promise((resolve) => pendingPlays.push({ cue, onEnded, resolve }));
      }
      return this.createVoice(cue, onEnded);
    },
    createVoice(cue, onEnded) {
      const voice = {
        id: cue.id,
        stopped: false,
        setGain: (gain, durationMs) => {
          driver.voiceGainRamps.push({ id: cue.id, gain, durationMs });
        },
        stop: (durationMs) => {
          if (!voice.stopped) driver.stopped.push({ id: cue.id, durationMs });
          voice.stopped = true;
        },
      };
      this.played.push({ id: cue.id, voice, onEnded });
      return voice;
    },
    setTrackGain(track, gain, durationMs) {
      this.trackGainRamps.push({ track, gain, durationMs });
    },
    async suspend() {
      this.calls.suspend += 1;
    },
    async resume() {
      this.calls.resume += 1;
    },
    dispose() {
      this.calls.dispose += 1;
    },
  };

  const director = createAudioDirector({
    driver,
    now: () => now,
    setTimer: (callback, delay) => {
      timerId += 1;
      timers.set(timerId, { callback, at: now + delay });
      return timerId;
    },
    clearTimer: (id) => timers.delete(id),
    initialPreferences: options.initialPreferences,
  });

  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };
  const runTimers = () => {
    while (timers.size) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      timers.delete(next[0]);
      now = next[1].at;
      next[1].callback();
    }
  };

  return {
    director,
    driver,
    flush,
    advance: (milliseconds) => { now += milliseconds; },
    runTimers,
    finish: (id) => {
      const entry = [...driver.played].reverse().find((item) => item.id === id && !item.voice.stopped);
      assert.ok(entry, `expected an active ${id} voice`);
      entry.voice.stopped = true;
      entry.onEnded();
    },
    resolveDeferred: (id) => {
      const pendingIndex = pendingPlays.findIndex((entry) => entry.cue.id === id);
      const pending = pendingPlays[pendingIndex];
      assert.ok(pending, `expected a pending ${id} playback`);
      pendingPlays.splice(pendingIndex, 1);
      pending.resolve(driver.createVoice(pending.cue, pending.onEnded));
    },
    timerCount: () => timers.size,
  };
}

test('unlock is idempotent and starts exactly one enabled bgm voice', async () => {
  const fixture = createFixture();
  await Promise.all([fixture.director.unlock(), fixture.director.unlock()]);
  fixture.director.startBgm();
  fixture.director.startBgm();
  await fixture.flush();
  assert.equal(fixture.driver.calls.unlock, 1);
  assert.equal(fixture.driver.played.filter((entry) => entry.id === 'bgm.alchemy_room').length, 1);
});

test('construction establishes the enabled default gains for both tracks', () => {
  const fixture = createFixture();
  assert.deepEqual(fixture.driver.trackGainRamps, [
    { track: 'music', gain: 0.36, durationMs: 0 },
    { track: 'sfx', gain: 0.78, durationMs: 0 },
  ]);
});

test('sfx cooldown, per-cue voices, and global four-voice cap are enforced', async () => {
  const fixture = createFixture();
  await fixture.director.unlock();
  fixture.director.play('ui.tap');
  fixture.director.play('ui.tap');
  await fixture.flush();
  assert.equal(fixture.driver.played.filter((entry) => entry.id === 'ui.tap').length, 1);
  fixture.advance(60);
  fixture.director.play('ui.tap');
  fixture.director.play('ui.tap');
  await fixture.flush();
  assert.equal(fixture.driver.played.filter((entry) => entry.id === 'ui.tap').length, 2);
  fixture.advance(60);
  for (const id of ['bottle.select', 'pour.valid', 'pour.invalid', 'history.undo', 'ui.tap']) {
    fixture.director.play(id);
    fixture.advance(120);
  }
  await fixture.flush();
  assert.ok(fixture.driver.activeSfx.length <= 4);
});

test('per-cue maxVoices rejects simultaneous zero-cooldown reward voices', async () => {
  const fixture = createFixture();
  await fixture.director.unlock();
  fixture.director.play('reward.empty_bottle');
  fixture.director.play('reward.empty_bottle');
  await fixture.flush();
  assert.equal(
    fixture.driver.played.filter((entry) => entry.id === 'reward.empty_bottle').length,
    1,
    'the one-voice reward cue must not start a second simultaneous voice',
  );
});

test('high priority completion evicts the oldest lowest-priority voice and ducks bgm', async () => {
  const fixture = createFixture();
  await fixture.director.unlock();
  fixture.director.startBgm();
  for (const id of ['ui.tap', 'bottle.select', 'pour.valid', 'history.undo']) {
    fixture.director.play(id);
    fixture.advance(120);
  }
  await fixture.flush();
  assert.equal(fixture.driver.activeSfx.length, 4, 'the policy admits four simultaneous SFX before evicting');
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

test('equal priority SFX does not evict a voice at the global cap', async () => {
  const fixture = createFixture();
  await fixture.director.unlock();
  for (const id of ['ui.tap', 'bottle.select', 'pour.valid', 'history.undo']) {
    fixture.director.play(id);
    fixture.advance(120);
  }
  await fixture.flush();
  fixture.director.play('ui.tap');
  await fixture.flush();
  assert.equal(fixture.driver.stopped.length, 0, 'equal priority must not evict the lowest active voice');
  assert.equal(fixture.driver.activeSfx.length, 4);
});

test('music and sfx switches act independently and disabled tracks do not start voices', async () => {
  const fixture = createFixture();
  await fixture.director.unlock();
  fixture.director.setSfxEnabled(false);
  fixture.director.play('ui.tap');
  await fixture.flush();
  assert.equal(fixture.driver.played.some((entry) => entry.id === 'ui.tap'), false);
  assert.deepEqual(fixture.director.getPreferences(), { musicEnabled: true, sfxEnabled: false });
  fixture.director.setMusicEnabled(false);
  assert.deepEqual(fixture.driver.trackGainRamps.at(-1), { track: 'music', gain: 0, durationMs: 300 });
  assert.deepEqual(fixture.director.getPreferences(), { musicEnabled: false, sfxEnabled: false });
  fixture.director.setSfxEnabled(true);
  assert.deepEqual(fixture.director.getPreferences(), { musicEnabled: false, sfxEnabled: true });
  assert.deepEqual(fixture.driver.trackGainRamps.at(-1), { track: 'sfx', gain: 0.78, durationMs: 0 });
});

test('re-enabling music during a duck keeps the completion duck gain active', async () => {
  const fixture = createFixture();
  await fixture.director.unlock();
  fixture.director.play('potion.complete');
  await fixture.flush();
  fixture.director.setMusicEnabled(false);
  fixture.director.setMusicEnabled(true);
  assert.deepEqual(fixture.driver.trackGainRamps.at(-1), {
    track: 'music', gain: 0.252, durationMs: 0,
  });
});

test('suspend and resume delegate once each without reviving disabled music', async () => {
  const fixture = createFixture();
  await fixture.director.unlock();
  fixture.director.setMusicEnabled(false);
  await fixture.director.suspend();
  await fixture.director.suspend();
  await fixture.director.resume();
  await fixture.director.resume();
  await fixture.flush();
  assert.equal(fixture.driver.calls.suspend, 1);
  assert.equal(fixture.driver.calls.resume, 1);
  assert.equal(fixture.driver.played.filter((entry) => entry.id === 'bgm.alchemy_room').length, 1);
});

test('resume starts bgm after a deferred creation resolves while suspended', async () => {
  const fixture = createFixture({ deferPlayIds: new Set(['bgm.alchemy_room']) });
  await fixture.director.unlock();
  await fixture.flush();
  await fixture.director.suspend();
  fixture.resolveDeferred('bgm.alchemy_room');
  await fixture.flush();
  await fixture.director.resume();
  fixture.resolveDeferred('bgm.alchemy_room');
  await fixture.flush();
  assert.equal(
    fixture.driver.played.filter((entry) => entry.id === 'bgm.alchemy_room' && !entry.voice.stopped).length,
    1,
    'resume must replace a BGM reservation invalidated by suspension',
  );
});

test('missing and rejected playback resolve without throwing', async () => {
  const fixture = createFixture({ missingIds: ['ui.tap'], rejectedIds: ['pour.invalid'] });
  await fixture.director.unlock();
  assert.doesNotThrow(() => fixture.director.play('ui.tap'));
  assert.doesNotThrow(() => fixture.director.play('pour.invalid'));
  await fixture.flush();
  assert.equal(fixture.driver.played.some((entry) => entry.id === 'ui.tap'), false);
  assert.equal(fixture.driver.played.some((entry) => entry.id === 'pour.invalid'), false);
});

test('dispose stops voices, clears timers, and rejects stale async completions', async () => {
  const fixture = createFixture({ deferPlayIds: new Set(['potion.complete']) });
  await fixture.director.unlock();
  fixture.director.play('reward.empty_bottle');
  await fixture.flush();
  fixture.finish('reward.empty_bottle');
  assert.equal(fixture.timerCount(), 1);
  fixture.director.play('potion.complete');
  await fixture.flush();
  fixture.director.dispose();
  fixture.resolveDeferred('potion.complete');
  await fixture.flush();
  assert.equal(fixture.driver.calls.dispose, 1);
  assert.ok(fixture.driver.stopped.some((entry) => entry.id === 'potion.complete'));
  assert.equal(fixture.driver.activeSfx.length, 0);
  assert.equal(fixture.timerCount(), 0);
});
