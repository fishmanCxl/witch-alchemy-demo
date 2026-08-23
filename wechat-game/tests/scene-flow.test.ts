import test from 'node:test';
import assert from 'node:assert/strict';

import {
  continueFromLevelComplete,
  createSceneFlow,
  enterSelectedLevel,
  openLevelSelect,
  returnHome,
  showLevelComplete,
  toggleSettings,
  toggleSound,
} from '../assets/scripts/core/scene-flow.ts';

test('scene flow starts on home without an implicit selected level', () => {
  assert.deepEqual(createSceneFlow(), {
    scene: 'home',
    selectedLevelId: null,
    nextLevelId: null,
    soundEnabled: true,
    settingsOpen: false,
  });
});

test('home, selector, unlocked level, completion, and next level form a legal flow', () => {
  const muted = toggleSound(createSceneFlow());
  const selector = openLevelSelect(muted);
  const playing = enterSelectedLevel(selector, 'level-004', true);
  const completed = showLevelComplete(playing, 'level-005');
  const next = continueFromLevelComplete(completed);

  assert.equal(selector.scene, 'levelSelect');
  assert.equal(playing.scene, 'level');
  assert.equal(playing.selectedLevelId, 'level-004');
  assert.equal(completed.scene, 'levelComplete');
  assert.equal(completed.nextLevelId, 'level-005');
  assert.equal(next.scene, 'level');
  assert.equal(next.selectedLevelId, 'level-005');
  assert.equal(next.soundEnabled, false);
});

test('selector rejects locked and unpublished level ids without changing state', () => {
  const selector = openLevelSelect(createSceneFlow());

  assert.equal(enterSelectedLevel(selector, 'level-004', false), selector);
  assert.equal(enterSelectedLevel(selector, 'level-016', true), selector);
  assert.equal(enterSelectedLevel(selector, 'not-a-level', true), selector);
});

test('level 15 completion returns to selector when the chapter has no next level', () => {
  const playing = enterSelectedLevel(openLevelSelect(createSceneFlow()), 'level-015', true);
  const completed = showLevelComplete(playing, null);
  const selector = continueFromLevelComplete(completed);

  assert.equal(completed.scene, 'levelComplete');
  assert.equal(completed.nextLevelId, null);
  assert.equal(selector.scene, 'levelSelect');
  assert.equal(selector.selectedLevelId, 'level-015');
});

test('settings and sound state are preserved and settings close across navigation', () => {
  const open = toggleSettings(toggleSound(createSceneFlow()));
  const selector = openLevelSelect(open);
  const level = enterSelectedLevel(toggleSettings(selector), 'level-001', true);
  const home = returnHome(toggleSettings(level));

  assert.equal(selector.settingsOpen, false);
  assert.equal(level.settingsOpen, false);
  assert.equal(home.settingsOpen, false);
  assert.equal(home.soundEnabled, false);
});
