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

const defaultPreferences = () => ({
  musicEnabled: DEFAULT_AUDIO_PREFERENCES.musicEnabled,
  sfxEnabled: DEFAULT_AUDIO_PREFERENCES.sfxEnabled,
});

const isAudioPreferences = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && typeof value.musicEnabled === 'boolean'
  && typeof value.sfxEnabled === 'boolean'
);

export function gameAudioCue(event) {
  if (!Object.prototype.hasOwnProperty.call(GAME_AUDIO_EVENT_TO_CUE, event)) {
    throw new Error(`Unknown game audio event: ${String(event)}`);
  }
  return GAME_AUDIO_EVENT_TO_CUE[event];
}

export function parseAudioPreferences(raw) {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return defaultPreferences();
    }
  }

  if (!isAudioPreferences(value)) {
    return defaultPreferences();
  }

  return {
    musicEnabled: value.musicEnabled,
    sfxEnabled: value.sfxEnabled,
  };
}

export function serializeAudioPreferences(value) {
  return JSON.stringify(parseAudioPreferences(value));
}
