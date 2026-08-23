import test from 'node:test';
import assert from 'node:assert/strict';

import { createSceneFlow, enterLevel, returnHome, toggleSound } from '../assets/scripts/core/scene-flow.ts';

test('scene flow starts on the home scene with sound enabled', () => {
  assert.deepEqual(createSceneFlow(), {
    scene: 'home',
    soundEnabled: true,
    settingsOpen: false,
  });
});

test('home and level transitions preserve the shared settings preference', () => {
  const muted = toggleSound(createSceneFlow());
  const playing = enterLevel(muted);
  const home = returnHome(playing);

  assert.equal(playing.scene, 'level');
  assert.equal(home.scene, 'home');
  assert.equal(home.soundEnabled, false);
});
