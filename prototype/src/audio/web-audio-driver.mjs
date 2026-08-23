import { AUDIO_CUES, DEFAULT_TRACK_GAINS } from './audio-cues.mjs';

const TRACKS = ['music', 'sfx'];

function defaultContextFactory() {
  const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Web Audio is unavailable');
  return new AudioContextConstructor();
}

function rampAudioParam(param, context, target, durationMs) {
  const now = context.currentTime;
  const currentValue = param.value;
  const durationSeconds = Math.max(0, Number(durationMs) || 0) / 1000;
  param.cancelScheduledValues(now);
  param.setValueAtTime(currentValue, now);
  param.linearRampToValueAtTime(target, now + durationSeconds);
}

export function createWebAudioDriver({
  createAudioContext = defaultContextFactory,
  fetchAudio = (...args) => globalThis.fetch(...args),
} = {}) {
  let context = null;
  let unlockPromise = null;
  let closeStarted = false;
  let disposed = false;
  const buffers = new Map();
  const liveSources = new Set();
  const trackNodes = new Map();
  const trackGains = new Map([
    ['music', DEFAULT_TRACK_GAINS.music],
    ['sfx', DEFAULT_TRACK_GAINS.sfx],
  ]);

  const ensureContext = () => {
    if (disposed) return null;
    if (context) return context;
    try {
      context = createAudioContext();
      for (const track of TRACKS) {
        const node = context.createGain();
        node.gain.value = trackGains.get(track);
        node.connect(context.destination);
        trackNodes.set(track, node);
      }
      return context;
    } catch {
      return null;
    }
  };

  const loadCue = (cue) => {
    if (disposed) return Promise.resolve(null);
    if (buffers.has(cue.id)) return buffers.get(cue.id);

    const pending = Promise.resolve().then(async () => {
      const audioContext = ensureContext();
      if (!audioContext || disposed) return null;
      try {
        const response = await fetchAudio(cue.url);
        if (!response?.ok) return null;
        const encoded = await response.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(encoded.slice(0));
        return disposed ? null : decoded;
      } catch {
        return null;
      }
    });
    buffers.set(cue.id, pending);
    return pending;
  };

  const unlock = () => {
    if (disposed) return Promise.resolve();
    if (!unlockPromise) {
      unlockPromise = Promise.resolve().then(async () => {
        const audioContext = ensureContext();
        if (!audioContext || audioContext.state === 'running') return;
        try {
          await audioContext.resume();
        } catch {
          // Autoplay rejection is expected until a valid user gesture reaches the browser.
        }
      });
    }
    return unlockPromise;
  };

  const preload = async (cueIds) => {
    if (disposed) return;
    const loads = [];
    for (const id of cueIds) {
      const cue = AUDIO_CUES[id];
      if (cue) loads.push(loadCue(cue));
    }
    await Promise.all(loads);
  };

  const play = async (cue, onEnded) => {
    if (disposed || !cue) return null;
    const buffer = await loadCue(cue);
    const audioContext = ensureContext();
    const trackNode = trackNodes.get(cue.track);
    if (!buffer || !audioContext || !trackNode || disposed) return null;

    let liveRecord = null;
    try {
      const source = audioContext.createBufferSource();
      const voiceNode = audioContext.createGain();
      source.buffer = buffer;
      source.loop = Boolean(cue.loop);
      if (cue.loopStartMs !== undefined) source.loopStart = cue.loopStartMs / 1000;
      if (cue.loopEndMs !== undefined) source.loopEnd = cue.loopEndMs / 1000;
      voiceNode.gain.value = cue.gain;
      source.connect(voiceNode);
      voiceNode.connect(trackNode);

      let ended = false;
      let stopping = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        liveSources.delete(liveRecord);
        try {
          onEnded();
        } catch {
          // Playback completion must not let a consumer callback disrupt audio cleanup.
        }
      };
      liveRecord = { source, finish };
      liveSources.add(liveRecord);
      source.onended = finish;
      source.start(0);

      return {
        id: cue.id,
        setGain(gain, durationMs) {
          if (ended || disposed) return;
          rampAudioParam(voiceNode.gain, audioContext, gain, durationMs);
        },
        stop(durationMs) {
          if (ended || stopping) return;
          stopping = true;
          const duration = Math.max(0, Number(durationMs) || 0);
          rampAudioParam(voiceNode.gain, audioContext, 0, duration);
          try {
            source.stop(audioContext.currentTime + duration / 1000);
          } catch {
            finish();
          }
        },
      };
    } catch {
      if (liveRecord) liveSources.delete(liveRecord);
      return null;
    }
  };

  const setTrackGain = (track, gain, durationMs) => {
    if (disposed || !trackGains.has(track)) return;
    trackGains.set(track, gain);
    const node = trackNodes.get(track);
    if (!node || !context) return;
    rampAudioParam(node.gain, context, gain, durationMs);
  };

  const suspend = async () => {
    if (disposed || !context || context.state === 'closed' || context.state === 'suspended') return;
    try {
      await context.suspend();
    } catch {
      // Browser lifecycle failures are isolated from game state.
    }
  };

  const resume = async () => {
    if (disposed || !context || context.state === 'closed' || context.state === 'running') return;
    try {
      await context.resume();
    } catch {
      // Browser lifecycle failures are isolated from game state.
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const record of liveSources) {
      try {
        record.source.stop(0);
      } catch {
        // An already-ended source requires no further cleanup.
      }
    }
    liveSources.clear();
    buffers.clear();
    trackNodes.clear();
    unlockPromise = null;
    if (context && !closeStarted) {
      closeStarted = true;
      try {
        Promise.resolve(context.close()).catch(() => undefined);
      } catch {
        // Closing an already-closed context is harmless for disposal.
      }
    }
  };

  return { unlock, preload, play, setTrackGain, suspend, resume, dispose };
}
