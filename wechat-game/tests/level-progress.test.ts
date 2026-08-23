import test from 'node:test';
import assert from 'node:assert/strict';

import {
  completeLevel,
  createDefaultProgress,
  isLevelUnlocked,
  mergePlayerProgress,
  selectCurrentLevel,
  type PlayerProgress,
} from '../assets/scripts/core/level-progress.ts';

test('new players start at level 1 with only level 1 unlocked', () => {
  const progress = createDefaultProgress();

  assert.deepEqual(progress, {
    schemaVersion: 2,
    revision: 0,
    currentLevel: 'level-001',
    highestUnlockedLevel: 'level-001',
    completedLevels: [],
    bestMoves: {},
    configVersion: 'chapter-1.2026-08-23.1',
  });
  assert.equal(isLevelUnlocked(progress, 'level-001'), true);
  assert.equal(isLevelUnlocked(progress, 'level-002'), false);
  assert.equal(isLevelUnlocked(progress, 'level-016'), false);
});

test('completion unlocks only the next published level and rejects locked or unknown levels', () => {
  const initial = createDefaultProgress();
  assert.equal(completeLevel(initial, 'level-002', 4), null);
  assert.equal(completeLevel(initial, 'level-016', 4), null);

  const afterFirst = completeLevel(initial, 'level-001', 5)!;
  assert.equal(afterFirst.revision, 1);
  assert.equal(afterFirst.currentLevel, 'level-002');
  assert.equal(afterFirst.highestUnlockedLevel, 'level-002');
  assert.deepEqual(afterFirst.completedLevels, ['level-001']);
  assert.deepEqual(afterFirst.bestMoves, { 'level-001': 5 });
  assert.equal(isLevelUnlocked(afterFirst, 'level-003'), false);
});

test('replaying a level stays set-idempotent and keeps only the lower positive best move', () => {
  const first = completeLevel(createDefaultProgress(), 'level-001', 5)!;
  const slowerReplay = completeLevel(first, 'level-001', 8)!;
  const fasterReplay = completeLevel(slowerReplay, 'level-001', 3)!;

  assert.equal(slowerReplay.revision, 2);
  assert.deepEqual(slowerReplay.completedLevels, ['level-001']);
  assert.equal(slowerReplay.highestUnlockedLevel, 'level-002');
  assert.equal(slowerReplay.bestMoves['level-001'], 5);
  assert.equal(fasterReplay.revision, 3);
  assert.equal(fasterReplay.bestMoves['level-001'], 3);
  assert.equal(completeLevel(first, 'level-001', 0), null);
});

test('selecting an old unlocked level never lowers the highest unlock boundary', () => {
  const first = completeLevel(createDefaultProgress(), 'level-001', 5)!;
  const second = completeLevel(first, 'level-002', 6)!;

  assert.equal(selectCurrentLevel(second, 'level-004'), null);
  const selected = selectCurrentLevel(second, 'level-001')!;
  assert.equal(selected.currentLevel, 'level-001');
  assert.equal(selected.highestUnlockedLevel, 'level-003');
  assert.equal(selected.revision, second.revision + 1);
  assert.equal(selectCurrentLevel(selected, 'level-001'), selected);
});

test('merging progress unions completion, minimizes best moves, and keeps legal maxima', () => {
  const local: PlayerProgress = {
    schemaVersion: 2,
    revision: 4,
    currentLevel: 'level-002',
    highestUnlockedLevel: 'level-004',
    completedLevels: ['level-001', 'level-003'],
    bestMoves: { 'level-001': 8, 'level-003': 12 },
    configVersion: 'chapter-1.2026-08-23.1',
  };
  const remote: PlayerProgress = {
    schemaVersion: 2,
    revision: 7,
    currentLevel: 'level-005',
    highestUnlockedLevel: 'level-006',
    completedLevels: ['level-002', 'level-003'],
    bestMoves: { 'level-002': 9, 'level-003': 10 },
    configVersion: 'chapter-1.2026-08-23.1',
  };

  assert.deepEqual(mergePlayerProgress(local, remote), {
    schemaVersion: 2,
    revision: 8,
    currentLevel: 'level-005',
    highestUnlockedLevel: 'level-006',
    completedLevels: ['level-001', 'level-002', 'level-003'],
    bestMoves: { 'level-001': 8, 'level-002': 9, 'level-003': 10 },
    configVersion: 'chapter-1.2026-08-23.1',
  });
});

test('completing level 15 caps progression at the final published level', () => {
  const progress: PlayerProgress = {
    ...createDefaultProgress(),
    revision: 20,
    currentLevel: 'level-015',
    highestUnlockedLevel: 'level-015',
  };
  const completed = completeLevel(progress, 'level-015', 42)!;

  assert.equal(completed.currentLevel, 'level-015');
  assert.equal(completed.highestUnlockedLevel, 'level-015');
  assert.deepEqual(completed.completedLevels, ['level-015']);
});

