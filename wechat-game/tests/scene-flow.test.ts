import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closeCollection,
  closeCollectionDetail,
  closeExitConfirm,
  closeDailyDialog,
  closeStaminaDialog,
  continueFromLevelComplete,
  createSceneFlow,
  enterSelectedLevel,
  openEndlessEndConfirm,
  openEndlessFailureDialog,
  openEndlessLockedDialog,
  restoreEndlessFailureDialog,
  openCollection,
  openCollectionDetail,
  openExitConfirm,
  openDailyDialog,
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
    dailyDialogOpen: false,
    exitConfirmOpen: false,
    selectedLevelId: null,
    nextLevelId: null,
    soundEnabled: true,
    settingsOpen: false,
    collectionReturnScene: 'home',
    selectedLevelChapterId: 1,
    selectedCollectionChapterId: null,
    endlessDialog: null,
  });
});

test('endless dialogs stay scene-specific and mutually exclusive with settings', () => {
  const home = createSceneFlow();
  const locked = openEndlessLockedDialog(home);
  assert.equal(locked.endlessDialog, 'locked');
  assert.equal(locked.settingsOpen, false);
  assert.equal(toggleSettings(locked).endlessDialog, null);

  const level = enterSelectedLevel(home, 'level-002', true);
  const failed = openEndlessFailureDialog(level);
  assert.equal(failed.endlessDialog, 'failed');
  const confirm = openEndlessEndConfirm(failed);
  assert.equal(confirm.endlessDialog, 'end-confirm');
  assert.equal(restoreEndlessFailureDialog(confirm).endlessDialog, 'failed');
  assert.equal(openEndlessFailureDialog(home), home);
});

test('daily dialog is home-only and mutually exclusive with other overlays', () => {
  const settings = toggleSettings(createSceneFlow());
  const daily = openDailyDialog(settings);
  assert.equal(daily.dailyDialogOpen, true);
  assert.equal(daily.settingsOpen, false);
  assert.equal(daily.staminaDialogOpen, false);
  const selector = openLevelSelect(createSceneFlow());
  assert.equal(openDailyDialog(selector), selector);
  assert.equal(openStaminaDialog(daily).dailyDialogOpen, false);
  assert.equal(closeDailyDialog(daily).dailyDialogOpen, false);
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
  assert.equal(selectLevelChapter(selector, 3, true).selectedLevelChapterId, 3);
  assert.equal(selectLevelChapter(selector, 4, true).selectedLevelChapterId, 4);
  assert.equal(selectLevelChapter(selector, 5, true).selectedLevelChapterId, 5);
  assert.equal(selectLevelChapter(selector, 6, true).selectedLevelChapterId, 6);
  assert.equal(selectLevelChapter(selector, 7, true).selectedLevelChapterId, 7);
  assert.equal(selectLevelChapter(selector, 8, true).selectedLevelChapterId, 8);
  assert.equal(selectLevelChapter(selector, 9, true).selectedLevelChapterId, 9);
  assert.equal(selectLevelChapter(selector, 10, true).selectedLevelChapterId, 10);
  assert.equal(selectLevelChapter(selector, 11, true), selector);
});

test('selecting an unlocked chapter closes the stamina dialog', () => {
  const selector = openStaminaDialog(openLevelSelect(createSceneFlow(), 1));
  const selected = selectLevelChapter(selector, 2, true);

  assert.equal(selected.selectedLevelChapterId, 2);
  assert.equal(selected.staminaDialogOpen, false);
  assert.equal(selected.exitConfirmOpen, false);
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
  assert.equal(enterSelectedLevel(selector, 'level-091', true).selectedLevelId, 'level-091');
  assert.equal(enterSelectedLevel(selector, 'level-121', true).selectedLevelId, 'level-121');
  assert.equal(enterSelectedLevel(selector, 'level-151', true).selectedLevelId, 'level-151');
  assert.equal(enterSelectedLevel(selector, 'level-180', true).selectedLevelId, 'level-180');
  assert.equal(enterSelectedLevel(selector, 'level-181', true).selectedLevelId, 'level-181');
  assert.equal(enterSelectedLevel(selector, 'level-210', true).selectedLevelId, 'level-210');
  assert.equal(enterSelectedLevel(selector, 'level-211', true).selectedLevelId, 'level-211');
  assert.equal(enterSelectedLevel(selector, 'level-240', true).selectedLevelId, 'level-240');
  assert.equal(enterSelectedLevel(selector, 'level-241', true).selectedLevelId, 'level-241');
  assert.equal(enterSelectedLevel(selector, 'level-270', true).selectedLevelId, 'level-270');
  assert.equal(enterSelectedLevel(selector, 'level-271', true).selectedLevelId, 'level-271');
  assert.equal(enterSelectedLevel(selector, 'level-300', true).selectedLevelId, 'level-300');
  assert.equal(enterSelectedLevel(selector, 'level-301', true), selector);
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

test('level 150 completion returns to the fifth chapter selector', () => {
  const playing = enterSelectedLevel(openLevelSelect(createSceneFlow(), 5), 'level-150', true);
  const completed = showLevelComplete(playing, null);
  const selector = continueFromLevelComplete(completed);

  assert.equal(selector.scene, 'levelSelect');
  assert.equal(selector.selectedLevelChapterId, 5);
  assert.equal(selector.selectedLevelId, 'level-150');
});

test('level 180 completion returns to the sixth chapter selector', () => {
  const playing = enterSelectedLevel(openLevelSelect(createSceneFlow(), 6), 'level-180', true);
  const completed = showLevelComplete(playing, null);
  const selector = continueFromLevelComplete(completed);

  assert.equal(selector.scene, 'levelSelect');
  assert.equal(selector.selectedLevelChapterId, 6);
  assert.equal(selector.selectedLevelId, 'level-180');
});

test('level 210 completion returns to the seventh chapter selector', () => {
  const playing = enterSelectedLevel(openLevelSelect(createSceneFlow(), 7), 'level-210', true);
  const completed = showLevelComplete(playing, null);
  const selector = continueFromLevelComplete(completed);

  assert.equal(selector.scene, 'levelSelect');
  assert.equal(selector.selectedLevelChapterId, 7);
  assert.equal(selector.selectedLevelId, 'level-210');
});

test('level 270 completion advances to level 271', () => {
  const playing = enterSelectedLevel(openLevelSelect(createSceneFlow(), 9), 'level-270', true);
  const completed = showLevelComplete(playing, 'level-271');
  const next = continueFromLevelComplete(completed);

  assert.equal(next.scene, 'level');
  assert.equal(next.selectedLevelId, 'level-271');
});

test('level 300 completion returns to the tenth chapter selector and rejects 301', () => {
  const playing = enterSelectedLevel(openLevelSelect(createSceneFlow(), 10), 'level-300', true);
  assert.equal(showLevelComplete(playing, 'level-301'), playing);
  const completed = showLevelComplete(playing, null);
  const selector = continueFromLevelComplete(completed);

  assert.equal(selector.scene, 'levelSelect');
  assert.equal(selector.selectedLevelChapterId, 10);
  assert.equal(selector.selectedLevelId, 'level-300');
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
  assert.equal(openCollectionDetail(overview, 3, true).selectedCollectionChapterId, 3);
  assert.equal(openCollectionDetail(overview, 4, true).selectedCollectionChapterId, 4);
  assert.equal(openCollectionDetail(overview, 5, true).selectedCollectionChapterId, 5);
  assert.equal(openCollectionDetail(overview, 6, true).selectedCollectionChapterId, 6);
  assert.equal(openCollectionDetail(overview, 7, true).selectedCollectionChapterId, 7);
  assert.equal(openCollectionDetail(overview, 8, true).selectedCollectionChapterId, 8);
  assert.equal(openCollectionDetail(overview, 9, true).selectedCollectionChapterId, 9);
  assert.equal(openCollectionDetail(overview, 10, true).selectedCollectionChapterId, 10);
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
