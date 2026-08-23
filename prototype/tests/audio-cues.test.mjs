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
