import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closeCollection,
  closeCollectionDetail,
  closeExitConfirm,
  closeStaminaDialog,
  continueFromLevelComplete,
  createSceneFlow,
  enterSelectedLevel,
  openCollection,
  openCollectionDetail,
  openExitConfirm,
  openStaminaDialog,
  openLevelSelect,
  returnHome,
  selectLevelChapter,
  showLevelComplete,
  toggleSettings,
  toggleSound,
} from '../assets/scripts/core/scene-flow.ts';

test('scene flow starts on home without an implicit selected level', () => {
  assert.deepEqual(createSceneFlow(), {
    scene: 'home',
    staminaDialogOpen: false,
    exitConfirmOpen: false,
    selectedLevelId: null,
    nextLevelId: null,
    soundEnabled: true,
    settingsOpen: false,
    collectionReturnScene: 'home',
    selectedLevelChapterId: 1,
    selectedCollectionChapterId: null,
  });
});


test('stamina and exit overlays are mutually exclusive and navigation closes both', () => {
  const home = openStaminaDialog(createSceneFlow());
  assert.equal(home.staminaDialogOpen, true);
  const level = enterSelectedLevel(closeStaminaDialog(home), 'level-001', true);
  const exit = openExitConfirm(level);
  assert.equal(exit.exitConfirmOpen, true);
  assert.equal(exit.settingsOpen, false);
  const homeState = createSceneFlow();
  assert.equal(openExitConfirm(homeState), homeState);
  assert.equal(returnHome(exit).exitConfirmOpen, false);
});
test('selector changes only to a published chapter that the player has unlocked', () => {
  const selector = openLevelSelect(createSceneFlow(), 1);

  assert.equal(selector.selectedLevelChapterId, 1);
  assert.equal(selectLevelChapter(selector, 2, false), selector);
  assert.equal(selectLevelChapter(selector, 2, true).selectedLevelChapterId, 2);
  assert.equal(selectLevelChapter(selector, 3, true), selector);
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
  assert.equal(enterSelectedLevel(selector, 'level-061', true), selector);
  assert.equal(enterSelectedLevel(selector, 'not-a-level', true), selector);
});

test('level 30 completion returns to selector when the chapter has no next level', () => {
  const playing = enterSelectedLevel(openLevelSelect(createSceneFlow()), 'level-030', true);
  const completed = showLevelComplete(playing, null);
  const selector = continueFromLevelComplete(completed);

  assert.equal(completed.scene, 'levelComplete');
  assert.equal(completed.nextLevelId, null);
  assert.equal(selector.scene, 'levelSelect');
  assert.equal(selector.selectedLevelId, 'level-030');
});

test('collection returns to the scene that opened it', () => {
  const fromHome = openCollection(createSceneFlow());
  assert.equal(closeCollection(fromHome).scene, 'home');

  const fromSelect = openCollection(openLevelSelect(createSceneFlow()));
  assert.equal(closeCollection(fromSelect).scene, 'levelSelect');
});

test('available collection detail returns to the overview before leaving collection', () => {
  const overview = openCollection(createSceneFlow());
  const detail = openCollectionDetail(overview, 1, true);
  const returned = closeCollectionDetail(detail);

  assert.equal(overview.selectedCollectionChapterId, null);
  assert.equal(detail.selectedCollectionChapterId, 1);
  assert.equal(returned.scene, 'collection');
  assert.equal(returned.selectedCollectionChapterId, null);
  assert.equal(closeCollection(detail), detail);
});

test('collection detail requires a published chapter that the player has unlocked', () => {
  const overview = openCollection(createSceneFlow());
  assert.equal(openCollectionDetail(overview, 2, false), overview);
  assert.equal(openCollectionDetail(overview, 2, true).selectedCollectionChapterId, 2);
  assert.equal(openCollectionDetail(overview, 3, true), overview);
  assert.equal(openCollectionDetail(overview, 11, true), overview);
});

test('collection navigation closes settings and clears pending next levels', () => {
  const opened = openCollection({
    ...toggleSettings(createSceneFlow()),
    nextLevelId: 'level-002',
  });
  const closed = closeCollection({
    ...toggleSettings(opened),
    nextLevelId: 'level-003',
  });

  assert.equal(opened.settingsOpen, false);
  assert.equal(opened.nextLevelId, null);
  assert.equal(closed.settingsOpen, false);
  assert.equal(closed.nextLevelId, null);
});

test('level and completion scenes cannot open collection', () => {
  const level = enterSelectedLevel(openLevelSelect(createSceneFlow()), 'level-001', true);
  const complete = showLevelComplete(level, 'level-002');
  const collection = openCollection(createSceneFlow());

  assert.equal(openCollection(level), level);
  assert.equal(openCollection(complete), complete);
  assert.equal(openCollection(collection), collection);
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
