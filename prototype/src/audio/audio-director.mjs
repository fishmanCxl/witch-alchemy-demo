import { AUDIO_CUES, DEFAULT_AUDIO_PREFERENCES, DEFAULT_TRACK_GAINS } from './audio-cues.mjs';

const BGM_CUE_ID = 'bgm.alchemy_room';
const MAX_SIMULTANEOUS_SFX = 4;

export function createAudioDirector({
  driver,
  now = () => Date.now(),
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = (timer) => clearTimeout(timer),
  initialPreferences = DEFAULT_AUDIO_PREFERENCES,
} = {}) {
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
  const restoreTimers = new Set();
  let driverDisposed = false;

  driver.setTrackGain('music', state.musicEnabled ? DEFAULT_TRACK_GAINS.music : 0, 0);
  driver.setTrackGain('sfx', state.sfxEnabled ? DEFAULT_TRACK_GAINS.sfx : 0, 0);

  const isCurrent = (generation) => !state.disposed && state.generation === generation;
  const stopVoice = (voice, durationMs) => {
    if (voice?.stop) voice.stop(durationMs);
  };
  const clearRestoreTimers = () => {
    for (const timer of restoreTimers) clearTimer(timer);
    restoreTimers.clear();
  };
  const scheduleMusicRestore = () => {
    if (state.disposed || !state.musicEnabled) return;
    const timer = setTimer(() => {
      restoreTimers.delete(timer);
      if (!state.disposed && state.duckCount === 0 && state.musicEnabled) {
        driver.setTrackGain('music', DEFAULT_TRACK_GAINS.music, 300);
      }
    }, 0);
    restoreTimers.add(timer);
  };
  const releaseDuck = (record) => {
    if (!record.ducked) return;
    record.ducked = false;
    state.duckCount = Math.max(0, state.duckCount - 1);
    if (state.duckCount === 0) scheduleMusicRestore();
  };
  const removeSfx = (record) => {
    const index = state.activeSfx.indexOf(record);
    if (index !== -1) state.activeSfx.splice(index, 1);
    releaseDuck(record);
  };
  const stopSfx = (record, durationMs) => {
    removeSfx(record);
    stopVoice(record.voice, durationMs);
  };
  const endSfx = (record) => {
    if (!state.activeSfx.includes(record)) return;
    removeSfx(record);
  };
  const beginDuck = (record) => {
    if (!record.cue.duckMusic || record.ducked) return;
    clearRestoreTimers();
    record.ducked = true;
    state.duckCount += 1;
    if (state.musicEnabled) {
      driver.setTrackGain('music', DEFAULT_TRACK_GAINS.music * 0.7, 120);
    }
  };
  const findEviction = (incomingCue) => {
    if (state.activeSfx.length < MAX_SIMULTANEOUS_SFX) return null;
    const lowestPriority = Math.min(...state.activeSfx.map((record) => record.cue.priority));
    if (!(incomingCue.priority > lowestPriority)) return false;
    return state.activeSfx
      .filter((record) => record.cue.priority === lowestPriority)
      .sort((first, second) => first.startedAt - second.startedAt)[0];
  };

  const startBgm = () => {
    if (state.disposed || state.suspended || !state.musicEnabled) return;
    if (!state.unlocked) {
      unlock();
      return;
    }
    if (state.bgmVoice) return;

    const generation = state.generation;
    const record = { voice: null };
    state.bgmVoice = record;
    Promise.resolve(driver.play(AUDIO_CUES[BGM_CUE_ID], () => {
      if (state.bgmVoice === record) state.bgmVoice = null;
    })).then((voice) => {
      if (!voice) {
        if (state.bgmVoice === record) state.bgmVoice = null;
        return;
      }
      if (!isCurrent(generation) || state.bgmVoice !== record || !state.musicEnabled || state.suspended) {
        if (state.bgmVoice === record) state.bgmVoice = null;
        stopVoice(voice, 0);
        return;
      }
      record.voice = voice;
      voice.setGain(0, 0);
      voice.setGain(AUDIO_CUES[BGM_CUE_ID].gain, 300);
    }).catch(() => {
      if (state.bgmVoice === record) state.bgmVoice = null;
    });
  };

  const unlock = () => {
    if (state.disposed) return Promise.resolve();
    if (!state.unlockPromise) {
      state.unlockPromise = Promise.resolve()
        .then(() => driver.unlock())
        .then(() => {
          if (state.disposed) return;
          state.unlocked = true;
          if (state.musicEnabled) startBgm();
        })
        .catch(() => undefined);
    }
    return state.unlockPromise;
  };

  const play = (id) => {
    const cue = AUDIO_CUES[id];
    if (state.disposed || !cue || cue.track !== 'sfx' || !state.sfxEnabled) return;
    const previous = state.lastPlayedAt.get(id);
    if (previous !== undefined && now() - previous < cue.cooldownMs) return;
    if (state.activeSfx.filter((record) => record.cue.id === id).length >= cue.maxVoices) return;
    const eviction = findEviction(cue);
    if (eviction === false) return;
    if (eviction) stopSfx(eviction, 0);

    const generation = state.generation;
    const record = { cue, voice: null, startedAt: now(), ducked: false };
    state.activeSfx.push(record);
    state.lastPlayedAt.set(id, record.startedAt);
    const beginPlayback = () => Promise.resolve(driver.play(cue, () => endSfx(record)))
      .then((voice) => {
        if (!voice) {
          removeSfx(record);
          return;
        }
        if (!isCurrent(generation) || !state.activeSfx.includes(record) || !state.sfxEnabled) {
          stopVoice(voice, 0);
          return;
        }
        record.voice = voice;
        beginDuck(record);
      })
      .catch(() => removeSfx(record));

    if (state.unlocked) {
      beginPlayback();
    } else {
      unlock().then(() => {
        if (isCurrent(generation) && state.activeSfx.includes(record) && state.sfxEnabled && state.unlocked) {
          beginPlayback();
        } else {
          removeSfx(record);
        }
      });
    }
  };

  const preload = (cueIds = Object.keys(AUDIO_CUES)) => {
    if (state.disposed) return Promise.resolve();
    return Promise.resolve(driver.preload(cueIds)).catch(() => undefined);
  };

  const setMusicEnabled = (enabled) => {
    const nextEnabled = Boolean(enabled);
    if (state.musicEnabled === nextEnabled) return;
    state.musicEnabled = nextEnabled;
    if (!nextEnabled) {
      clearRestoreTimers();
      driver.setTrackGain('music', 0, 300);
      const record = state.bgmVoice;
      state.bgmVoice = null;
      stopVoice(record?.voice, 300);
      return;
    }
    driver.setTrackGain('music', state.duckCount > 0 ? DEFAULT_TRACK_GAINS.music * 0.7 : DEFAULT_TRACK_GAINS.music, 0);
    if (state.unlocked && !state.suspended) startBgm();
  };

  const setSfxEnabled = (enabled) => {
    const nextEnabled = Boolean(enabled);
    if (state.sfxEnabled === nextEnabled) return;
    state.sfxEnabled = nextEnabled;
    if (!nextEnabled) {
      driver.setTrackGain('sfx', 0, 80);
      for (const record of [...state.activeSfx]) stopSfx(record, 80);
      return;
    }
    driver.setTrackGain('sfx', DEFAULT_TRACK_GAINS.sfx, 0);
  };

  const suspend = () => {
    if (state.disposed || state.suspended) return Promise.resolve();
    state.suspended = true;
    return Promise.resolve(driver.suspend()).catch(() => undefined);
  };
  const resume = () => {
    if (state.disposed || !state.suspended) return Promise.resolve();
    state.suspended = false;
    return Promise.resolve(driver.resume()).catch(() => undefined).then(() => {
      if (!state.disposed && state.musicEnabled) startBgm();
    });
  };
  const getPreferences = () => ({ musicEnabled: state.musicEnabled, sfxEnabled: state.sfxEnabled });
  const dispose = () => {
    if (state.disposed) return;
    state.disposed = true;
    state.generation += 1;
    clearRestoreTimers();
    const bgm = state.bgmVoice;
    state.bgmVoice = null;
    stopVoice(bgm?.voice, 0);
    for (const record of [...state.activeSfx]) stopSfx(record, 0);
    if (!driverDisposed) {
      driverDisposed = true;
      driver.dispose();
    }
  };

  return { unlock, preload, play, startBgm, setMusicEnabled, setSfxEnabled, suspend, resume, getPreferences, dispose };
}
