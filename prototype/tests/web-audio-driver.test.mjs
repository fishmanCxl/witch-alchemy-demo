import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_CUES } from '../src/audio/audio-cues.mjs';
import { createWebAudioDriver } from '../src/audio/web-audio-driver.mjs';

class FakeAudioParam {
  constructor(value = 1) {
    this.value = value;
    this.events = [];
  }

  cancelScheduledValues(time) {
    this.events.push({ type: 'cancel', time });
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'set', value, time });
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'ramp', value, time });
  }
}

class FakeGainNode {
  constructor() {
    this.gain = new FakeAudioParam();
    this.connections = [];
  }

  connect(destination) {
    this.connections.push(destination);
    return destination;
  }
}

class FakeBufferSource {
  constructor() {
    this.connections = [];
    this.startCalls = [];
    this.stopCalls = [];
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.buffer = null;
    this.onended = null;
  }

  connect(destination) {
    this.connections.push(destination);
    return destination;
  }

  start(time = 0) {
    this.startCalls.push(time);
  }

  stop(time = 0) {
    this.stopCalls.push(time);
  }
}

class FakeAudioContext {
  constructor({ decodeReject = false, sourceStartReject = false } = {}) {
    this.currentTime = 5;
    this.state = 'suspended';
    this.destination = { kind: 'destination' };
    this.decodeReject = decodeReject;
    this.sourceStartReject = sourceStartReject;
    this.createdGains = [];
    this.createdSources = [];
    this.resumeCalls = 0;
    this.suspendCalls = 0;
    this.closeCalls = 0;
    this.decodeCalls = [];
  }

  createGain() {
    const gain = new FakeGainNode();
    this.createdGains.push(gain);
    return gain;
  }

  createBufferSource() {
    const source = new FakeBufferSource();
    if (this.sourceStartReject) {
      source.start = () => {
        throw new Error('start failed');
      };
    }
    this.createdSources.push(source);
    return source;
  }

  async decodeAudioData(data) {
    this.decodeCalls.push(data);
    if (this.decodeReject) throw new Error('decode failed');
    return { duration: 48 };
  }

  async resume() {
    this.resumeCalls += 1;
    this.state = 'running';
  }

  async suspend() {
    this.suspendCalls += 1;
    this.state = 'suspended';
  }

  async close() {
    this.closeCalls += 1;
    this.state = 'closed';
  }
}

function createFixture(options = {}) {
  const context = options.context ?? new FakeAudioContext(options);
  const fetchCalls = [];
  const fetchAudio = async (url) => {
    fetchCalls.push(url);
    return {
      ok: !options.missingUrls?.has(url),
      status: options.missingUrls?.has(url) ? 404 : 200,
      async arrayBuffer() {
        return new Uint8Array([1, 2, 3, 4]).buffer;
      },
    };
  };
  let contextCreations = 0;
  const driver = createWebAudioDriver({
    createAudioContext: () => {
      contextCreations += 1;
      return context;
    },
    fetchAudio,
  });
  return { driver, context, fetchCalls, contextCreations: () => contextCreations };
}

test('concurrent preload calls share one fetch and decode per cue URL', async () => {
  const fixture = createFixture();
  await Promise.all([
    fixture.driver.preload(['ui.tap', 'bottle.select']),
    fixture.driver.preload(['ui.tap']),
    fixture.driver.preload(['bottle.select']),
  ]);
  assert.deepEqual(fixture.fetchCalls, [AUDIO_CUES['ui.tap'].url, AUDIO_CUES['bottle.select'].url]);
  assert.equal(fixture.context.decodeCalls.length, 2);
});

test('unlock lazily creates one context and resumes it once', async () => {
  const fixture = createFixture();
  assert.equal(fixture.contextCreations(), 0);
  await Promise.all([fixture.driver.unlock(), fixture.driver.unlock(), fixture.driver.unlock()]);
  await fixture.driver.unlock();
  assert.equal(fixture.contextCreations(), 1);
  assert.equal(fixture.context.resumeCalls, 1);
});

test('visibility lifecycle suspension and resume reuse the existing context', async () => {
  const fixture = createFixture();
  await fixture.driver.unlock();
  await fixture.driver.suspend();
  await fixture.driver.resume();
  assert.equal(fixture.contextCreations(), 1);
  assert.equal(fixture.context.suspendCalls, 1);
  assert.equal(fixture.context.resumeCalls, 2);
});

test('play connects source through voice and track gains to destination', async () => {
  const fixture = createFixture();
  const voice = await fixture.driver.play(AUDIO_CUES['ui.tap'], () => {});
  assert.ok(voice);
  const [musicTrack, sfxTrack, voiceGain] = fixture.context.createdGains;
  const source = fixture.context.createdSources[0];
  assert.equal(musicTrack.gain.value, 0.36);
  assert.equal(sfxTrack.gain.value, 0.78);
  assert.equal(source.connections[0], voiceGain);
  assert.equal(voiceGain.connections[0], sfxTrack);
  assert.equal(sfxTrack.connections[0], fixture.context.destination);
  assert.equal(musicTrack.connections[0], fixture.context.destination);
  assert.deepEqual(source.startCalls, [0]);
});

test('loop points are copied from cue milliseconds to source seconds', async () => {
  const fixture = createFixture();
  await fixture.driver.play(AUDIO_CUES['bgm.alchemy_room'], () => {});
  const source = fixture.context.createdSources[0];
  assert.equal(source.loop, true);
  assert.equal(source.loopStart, 0.026);
  assert.equal(source.loopEnd, 47.974);
});

test('track gain changes cancel from the context clock and linearly ramp independently', async () => {
  const fixture = createFixture();
  await fixture.driver.unlock();
  fixture.driver.setTrackGain('music', 0.252, 120);
  const musicTrack = fixture.context.createdGains[0];
  assert.deepEqual(musicTrack.gain.events, [
    { type: 'cancel', time: 5 },
    { type: 'set', value: 0.36, time: 5 },
    { type: 'ramp', value: 0.252, time: 5.12 },
  ]);
});

test('music and sfx track gains remain independently addressable', async () => {
  const fixture = createFixture();
  await fixture.driver.unlock();
  fixture.driver.setTrackGain('music', 0, 120);
  fixture.driver.setTrackGain('sfx', 0.42, 120);
  const [musicTrack, sfxTrack] = fixture.context.createdGains;
  assert.equal(musicTrack.gain.value, 0);
  assert.equal(sfxTrack.gain.value, 0.42);
});

test('voice gain changes use an independent per-voice ramp', async () => {
  const fixture = createFixture();
  const voice = await fixture.driver.play(AUDIO_CUES['pour.valid'], () => {});
  voice.setGain(0.7, 120);
  const voiceGain = fixture.context.createdGains[2];
  assert.deepEqual(voiceGain.gain.events, [
    { type: 'cancel', time: 5 },
    { type: 'set', value: 0.65, time: 5 },
    { type: 'ramp', value: 0.7, time: 5.12 },
  ]);
});

test('voice stop fades to zero and schedules source stop after the fade', async () => {
  const fixture = createFixture();
  const voice = await fixture.driver.play(AUDIO_CUES['pour.valid'], () => {});
  voice.stop(80);
  voice.stop(80);
  const source = fixture.context.createdSources[0];
  const voiceGain = fixture.context.createdGains[2];
  assert.deepEqual(voiceGain.gain.events, [
    { type: 'cancel', time: 5 },
    { type: 'set', value: 0.65, time: 5 },
    { type: 'ramp', value: 0, time: 5.08 },
  ]);
  assert.deepEqual(source.stopCalls, [5.08]);
});

test('HTTP failures resolve to null and remain cached as unavailable', async () => {
  const cue = AUDIO_CUES['pour.invalid'];
  const fixture = createFixture({ missingUrls: new Set([cue.url]) });
  await fixture.driver.preload([cue.id]);
  assert.equal(await fixture.driver.play(cue, () => {}), null);
  await fixture.driver.preload([cue.id]);
  assert.deepEqual(fixture.fetchCalls, [cue.url]);
  assert.equal(fixture.context.decodeCalls.length, 0);
});

test('decode failures resolve to null and remain cached as unavailable', async () => {
  const cue = AUDIO_CUES['bottle.deselect'];
  const fixture = createFixture({ decodeReject: true });
  assert.equal(await fixture.driver.play(cue, () => {}), null);
  assert.equal(await fixture.driver.play(cue, () => {}), null);
  assert.deepEqual(fixture.fetchCalls, [cue.url]);
  assert.equal(fixture.context.decodeCalls.length, 1);
});

test('a rejected source start is removed from the live-source registry', async () => {
  const fixture = createFixture({ sourceStartReject: true });
  assert.equal(await fixture.driver.play(AUDIO_CUES['ui.tap'], () => {}), null);
  fixture.driver.dispose();
  assert.deepEqual(fixture.context.createdSources[0].stopCalls, []);
});

test('dispose stops all live sources, prevents reuse, and closes one context once', async () => {
  const fixture = createFixture();
  await fixture.driver.play(AUDIO_CUES['ui.tap'], () => {});
  await fixture.driver.play(AUDIO_CUES['pour.valid'], () => {});
  fixture.driver.dispose();
  fixture.driver.dispose();
  await Promise.resolve();
  assert.deepEqual(fixture.context.createdSources.map((source) => source.stopCalls), [[0], [0]]);
  assert.equal(fixture.context.closeCalls, 1);
  assert.equal(await fixture.driver.play(AUDIO_CUES['ui.tap'], () => {}), null);
  assert.equal(fixture.fetchCalls.length, 2, 'disposed driver must not reuse or reload cleared buffers');
});
