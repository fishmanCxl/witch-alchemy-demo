import test from 'node:test';
import assert from 'node:assert/strict';

import {
  completeLevel,
  createDefaultProgress,
  encodePlayerProgress,
  decodePlayerProgress,
  isLevelUnlocked,
  mergePlayerProgress,
  recordBestMoves,
  selectCurrentLevel,
  type PlayerProgress,
} from '../assets/scripts/core/level-progress.ts';

function levelId(number: number): string {
  return `level-${String(number).padStart(3, '0')}`;
}

function progressAt(level: string): PlayerProgress {
  return {
    ...createDefaultProgress(),
    currentLevel: level,
    completedThrough: Number(level.slice(-3)) - 1,
  };
}

const oldFifteenLevelProgress = {
  schemaVersion: 2,
  revision: 15,
  currentLevel: 'level-015',
  highestUnlockedLevel: 'level-015',
  completedLevels: Array.from({ length: 14 }, (_, index) => levelId(index + 1)),
  bestMoves: { 'level-001': 5, 'level-015': 23 },
  configVersion: 'chapter-1.2026-08-23.1',
};

test('new players start at level 1 with only level 1 unlocked', () => {
  const progress = createDefaultProgress();

  assert.deepEqual(progress, {
    schemaVersion: 3,
    revision: 0,
    currentLevel: 'level-001',
    completedThrough: 0,
    bestMoves: {},
    configVersion: 'chapters-1-10.2026-09-24.1',
  });
  assert.equal(isLevelUnlocked(progress, 'level-001'), true);
  assert.equal(isLevelUnlocked(progress, 'level-002'), false);
  assert.equal(isLevelUnlocked(progress, 'level-016'), false);
});

test('completion unlocks only the next published level and rejects locked or unknown levels', () => {
  const initial = createDefaultProgress();
  assert.equal(completeLevel(initial, 'level-002', 4), null);
  assert.equal(completeLevel(initial, 'level-031', 4), null);

  const afterFirst = completeLevel(initial, 'level-001', 5)!;
  assert.equal(afterFirst.revision, 1);
  assert.equal(afterFirst.currentLevel, 'level-002');
  assert.equal(afterFirst.completedThrough, 1);
  assert.deepEqual(afterFirst.bestMoves, { 'level-001': 5 });
  assert.equal(isLevelUnlocked(afterFirst, 'level-003'), false);
});

test('replaying a level keeps continuous progress idempotent and only lowers best moves', () => {
  const first = completeLevel(createDefaultProgress(), 'level-001', 5)!;
  const slowerReplay = completeLevel(first, 'level-001', 8)!;
  const fasterReplay = completeLevel(slowerReplay, 'level-001', 3)!;

  assert.equal(slowerReplay.revision, 2);
  assert.equal(slowerReplay.completedThrough, 1);
  assert.equal(slowerReplay.bestMoves['level-001'], 5);
  assert.equal(fasterReplay.revision, 3);
  assert.equal(fasterReplay.bestMoves['level-001'], 3);
  assert.equal(completeLevel(first, 'level-001', 0), null);
});

test('daily replay only lowers best moves without advancing formal progress', () => {
  const progress: PlayerProgress = {
    ...createDefaultProgress(),
    revision: 8,
    currentLevel: 'level-006',
    completedThrough: 5,
    bestMoves: { 'level-003': 18 },
  };

  const slower = recordBestMoves(progress, 'level-003', 20)!;
  const faster = recordBestMoves(progress, 'level-003', 14)!;

  assert.equal(slower, progress);
  assert.equal(faster.revision, 9);
  assert.equal(faster.currentLevel, 'level-006');
  assert.equal(faster.completedThrough, 5);
  assert.equal(faster.bestMoves['level-003'], 14);
  assert.equal(recordBestMoves(progress, 'level-006', 10), null);
  assert.equal(recordBestMoves(progress, 'level-003', 0), null);
});

test('selecting an old unlocked level never lowers the highest unlock boundary', () => {
  const first = completeLevel(createDefaultProgress(), 'level-001', 5)!;
  const second = completeLevel(first, 'level-002', 6)!;

  assert.equal(selectCurrentLevel(second, 'level-004'), null);
  const selected = selectCurrentLevel(second, 'level-001')!;
  assert.equal(selected.currentLevel, 'level-001');
  assert.equal(selected.completedThrough, 2);
  assert.equal(selected.revision, second.revision + 1);
  assert.equal(selectCurrentLevel(selected, 'level-001'), selected);
});

test('merging progress keeps the furthest boundary, minimizes best moves, and keeps a legal current level', () => {
  const local: PlayerProgress = {
    schemaVersion: 3,
    revision: 4,
    currentLevel: 'level-002',
    completedThrough: 3,
    bestMoves: { 'level-001': 8, 'level-003': 12 },
    configVersion: 'chapter-1.2026-08-23.1',
  };
  const remote: PlayerProgress = {
    schemaVersion: 3,
    revision: 7,
    currentLevel: 'level-005',
    completedThrough: 5,
    bestMoves: { 'level-002': 9, 'level-003': 10 },
    configVersion: 'chapter-1.2026-08-23.1',
  };

  assert.deepEqual(mergePlayerProgress(local, remote), {
    schemaVersion: 3,
    revision: 8,
    currentLevel: 'level-005',
    completedThrough: 5,
    bestMoves: { 'level-001': 8, 'level-002': 9, 'level-003': 10 },
    configVersion: 'chapters-1-10.2026-09-24.1',
  });
});

test('chapter boundaries unlock through level 271 while level 300 caps published progression', () => {
  const afterThirty = completeLevel(progressAt('level-030'), 'level-030', 28)!;
  assert.equal(afterThirty.currentLevel, 'level-031');
  assert.equal(afterThirty.completedThrough, 30);
  assert.equal(isLevelUnlocked(afterThirty, 'level-031'), true);

  const afterSixty = completeLevel(progressAt('level-060'), 'level-060', 41)!;
  assert.equal(afterSixty.currentLevel, 'level-061');
  assert.equal(afterSixty.completedThrough, 60);
  assert.equal(isLevelUnlocked(afterSixty, 'level-061'), true);

  const afterNinety = completeLevel(progressAt('level-090'), 'level-090', 52)!;
  assert.equal(afterNinety.currentLevel, 'level-091');
  assert.equal(afterNinety.completedThrough, 90);
  assert.equal(isLevelUnlocked(afterNinety, 'level-091'), true);

  const afterOneTwenty = completeLevel(progressAt('level-120'), 'level-120', 61)!;
  assert.equal(afterOneTwenty.currentLevel, 'level-121');
  assert.equal(afterOneTwenty.completedThrough, 120);
  assert.equal(isLevelUnlocked(afterOneTwenty, 'level-121'), true);

  const afterOneFifty = completeLevel(progressAt('level-150'), 'level-150', 72)!;
  assert.equal(afterOneFifty.currentLevel, 'level-151');
  assert.equal(afterOneFifty.completedThrough, 150);
  assert.equal(isLevelUnlocked(afterOneFifty, 'level-151'), true);

  const afterOneEighty = completeLevel(progressAt('level-180'), 'level-180', 80)!;
  assert.equal(afterOneEighty.currentLevel, 'level-181');
  assert.equal(afterOneEighty.completedThrough, 180);
  assert.equal(isLevelUnlocked(afterOneEighty, 'level-181'), true);
  assert.equal(isLevelUnlocked(afterOneEighty, 'level-182'), false);

  const afterTwoTen = completeLevel(progressAt('level-210'), 'level-210', 86)!;
  assert.equal(afterTwoTen.currentLevel, 'level-211');
  assert.equal(afterTwoTen.completedThrough, 210);
  assert.equal(isLevelUnlocked(afterTwoTen, 'level-211'), true);
  assert.equal(isLevelUnlocked(afterTwoTen, 'level-212'), false);

  const afterTwoForty = completeLevel(progressAt('level-240'), 'level-240', 92)!;
  assert.equal(afterTwoForty.currentLevel, 'level-241');
  assert.equal(afterTwoForty.completedThrough, 240);
  assert.equal(isLevelUnlocked(afterTwoForty, 'level-241'), true);
  assert.equal(isLevelUnlocked(afterTwoForty, 'level-242'), false);

  const afterTwoSeventy = completeLevel(progressAt('level-270'), 'level-270', 98)!;
  assert.equal(afterTwoSeventy.currentLevel, 'level-271');
  assert.equal(afterTwoSeventy.completedThrough, 270);
  assert.equal(isLevelUnlocked(afterTwoSeventy, 'level-271'), true);
  assert.equal(selectCurrentLevel(afterTwoSeventy, 'level-271')?.currentLevel, 'level-271');

  const afterThreeHundred = completeLevel(progressAt('level-300'), 'level-300', 98)!;
  assert.equal(afterThreeHundred.currentLevel, 'level-300');
  assert.equal(afterThreeHundred.completedThrough, 300);
  assert.equal(isLevelUnlocked(afterThreeHundred, 'level-301'), false);
  assert.equal(selectCurrentLevel(afterThreeHundred, 'level-301'), null);
});

test('old v2 progress is normalized to v3 continuous progress', () => {
  const decoded = decodePlayerProgress(JSON.stringify(oldFifteenLevelProgress));

  assert.equal(decoded?.completedThrough, 14);
  assert.deepEqual(decoded?.bestMoves, oldFifteenLevelProgress.bestMoves);
  assert.equal(decoded?.configVersion, 'chapters-1-10.2026-09-24.1');
});

test('an existing sixty-level v3 save keeps its boundary and unlocks chapter three', () => {
  const decoded = decodePlayerProgress(JSON.stringify({
    schemaVersion: 3,
    revision: 60,
    currentLevel: 'level-060',
    completedThrough: 60,
    bestMoves: { 'level-001': 5, 'level-060': 41 },
    configVersion: 'chapters-1-2.2026-08-29.1',
  }));

  assert.equal(decoded?.currentLevel, 'level-060');
  assert.equal(decoded?.completedThrough, 60);
  assert.deepEqual(decoded?.bestMoves, { 'level-001': 5, 'level-060': 41 });
  assert.equal(decoded?.configVersion, 'chapters-1-10.2026-09-24.1');
  assert.equal(decoded && isLevelUnlocked(decoded, 'level-061'), true);
});

test('an existing ninety-level v3 save keeps its boundary and unlocks chapter four', () => {
  const decoded = decodePlayerProgress(JSON.stringify({
    schemaVersion: 3,
    revision: 90,
    currentLevel: 'level-090',
    completedThrough: 90,
    bestMoves: { 'level-090': 52 },
    configVersion: 'chapters-1-3.2026-09-05.1',
  }));

  assert.equal(decoded?.currentLevel, 'level-090');
  assert.equal(decoded?.completedThrough, 90);
  assert.deepEqual(decoded?.bestMoves, { 'level-090': 52 });
  assert.equal(decoded?.configVersion, 'chapters-1-10.2026-09-24.1');
  assert.equal(decoded && isLevelUnlocked(decoded, 'level-091'), true);
});

test('an existing level-120 save unlocks chapter five without expanding the save shape', () => {
  const decoded = decodePlayerProgress(JSON.stringify({
    schemaVersion: 3,
    revision: 120,
    currentLevel: 'level-120',
    completedThrough: 120,
    bestMoves: { 'level-120': 61 },
    configVersion: 'chapters-1-4.2026-09-05.1',
  }));

  assert.equal(decoded?.currentLevel, 'level-120');
  assert.equal(decoded?.completedThrough, 120);
  assert.equal(decoded?.configVersion, 'chapters-1-10.2026-09-24.1');
  assert.equal(decoded && isLevelUnlocked(decoded, 'level-121'), true);
});

test('a high v2 unlock migrates to the equivalent continuous completion boundary', () => {
  const sparseLegacy = {
    ...oldFifteenLevelProgress,
    currentLevel: 'level-030',
    highestUnlockedLevel: 'level-030',
    completedLevels: ['level-002', 'level-016', 'level-030'],
  };

  assert.equal(decodePlayerProgress(JSON.stringify(sparseLegacy))?.completedThrough, 30);
});

test('a completed level 60 in legacy v2 progress remains completed after chapter three ships', () => {
  const legacy = {
    ...oldFifteenLevelProgress,
    currentLevel: 'level-060',
    highestUnlockedLevel: 'level-060',
    completedLevels: ['level-060'],
    bestMoves: { 'level-060': 41 },
    configVersion: 'chapters-1-2.2026-08-29.1',
  };

  const decoded = decodePlayerProgress(JSON.stringify(legacy));
  assert.equal(decoded?.completedThrough, 60);
  assert.equal(decoded && isLevelUnlocked(decoded, 'level-061'), true);
});

test('an existing level-150 save keeps its boundary and unlocks chapter six', () => {
  const decoded = decodePlayerProgress(JSON.stringify({
    schemaVersion: 3,
    revision: 150,
    currentLevel: 'level-150',
    completedThrough: 150,
    bestMoves: { 'level-150': 72 },
    configVersion: 'chapters-1-5.2026-09-06.1',
  }));

  assert.equal(decoded?.currentLevel, 'level-150');
  assert.equal(decoded?.completedThrough, 150);
  assert.deepEqual(decoded?.bestMoves, { 'level-150': 72 });
  assert.equal(decoded?.configVersion, 'chapters-1-10.2026-09-24.1');
  assert.equal(decoded && isLevelUnlocked(decoded, 'level-151'), true);
});

test('an existing level-180 save unlocks chapter seven', () => {
  const decoded = decodePlayerProgress(JSON.stringify({
    schemaVersion: 3,
    revision: 180,
    currentLevel: 'level-180',
    completedThrough: 180,
    bestMoves: { 'level-180': 80 },
    configVersion: 'chapters-1-6.2026-09-19.1',
  }));

  assert.equal(decoded?.currentLevel, 'level-180');
  assert.equal(decoded?.completedThrough, 180);
  assert.equal(decoded?.configVersion, 'chapters-1-10.2026-09-24.1');
  assert.equal(decoded && isLevelUnlocked(decoded, 'level-181'), true);
});

test('an existing level-240 save unlocks chapter nine while level 301 remains invalid', () => {
  const decoded = decodePlayerProgress(JSON.stringify({
    schemaVersion: 3,
    revision: 240,
    currentLevel: 'level-240',
    completedThrough: 240,
    bestMoves: { 'level-240': 92 },
    configVersion: 'chapters-1-8.2026-09-22.1',
  }));

  assert.equal(decoded?.currentLevel, 'level-240');
  assert.equal(decoded?.completedThrough, 240);
  assert.equal(decoded?.configVersion, 'chapters-1-10.2026-09-24.1');
  assert.equal(decoded && isLevelUnlocked(decoded, 'level-241'), true);
  assert.equal(decodePlayerProgress(JSON.stringify({
    schemaVersion: 3,
    revision: 301,
    currentLevel: 'level-301',
    completedThrough: 301,
    bestMoves: {},
    configVersion: 'chapters-1-9.2026-09-23.1',
  })), null);
});

test('an existing level-270 save keeps best moves and unlocks chapter ten', () => {
  const decoded = decodePlayerProgress(JSON.stringify({
    schemaVersion: 3,
    revision: 270,
    currentLevel: 'level-270',
    completedThrough: 270,
    bestMoves: { 'level-270': 44 },
    configVersion: 'chapters-1-9.2026-09-23.1',
  }));
  assert.equal(decoded?.completedThrough, 270);
  assert.equal(decoded?.bestMoves['level-270'], 44);
  assert.equal(decoded?.configVersion, 'chapters-1-10.2026-09-24.1');
  assert.equal(decoded && isLevelUnlocked(decoded, 'level-271'), true);
});

test('progress encoding strips derived and unknown top-level fields', () => {
  const polluted = {
    schemaVersion: 3,
    revision: 4,
    currentLevel: 'level-003',
    completedThrough: 3,
    bestMoves: { 'level-001': 5, 'level-003': 9 },
    configVersion: 'chapter-1.2026-08-23.1',
    collection: { revealedPieces: 2 },
    title: '不应持久化',
    arbitraryUnknown: ['also', 'strip'],
  } as unknown as PlayerProgress;

  assert.deepEqual(JSON.parse(encodePlayerProgress(polluted)), {
    schemaVersion: 3,
    revision: 4,
    currentLevel: 'level-003',
    completedThrough: 3,
    bestMoves: { 'level-001': 5, 'level-003': 9 },
    configVersion: 'chapters-1-10.2026-09-24.1',
  });
});

test('progress decoding strips derived and unknown top-level fields', () => {
  const decoded = decodePlayerProgress(JSON.stringify({
    schemaVersion: 3,
    revision: 6,
    currentLevel: 'level-003',
    completedThrough: 3,
    bestMoves: { 'level-003': 9, 'level-001': 5 },
    configVersion: 'chapter-1.2026-08-23.1',
    collection: { revealedPieces: 2 },
    title: '不应恢复',
    arbitraryUnknown: { nested: true },
  }));

  assert.deepEqual(decoded, {
    schemaVersion: 3,
    revision: 6,
    currentLevel: 'level-003',
    completedThrough: 3,
    bestMoves: { 'level-001': 5, 'level-003': 9 },
    configVersion: 'chapters-1-10.2026-09-24.1',
  });
});

test('progress stores one completed-through number instead of one ID per completed level', () => {
  let progress = createDefaultProgress();
  for (let number = 1; number <= 5; number += 1) {
    progress = completeLevel(progress, levelId(number), 8)!;
  }

  assert.equal(progress.completedThrough, 5);
  assert.equal('completedLevels' in progress, false);
});

test('buggy v2 progress at level 6 migrates to five completed levels', () => {
  const migrated = decodePlayerProgress(JSON.stringify({
    schemaVersion: 2,
    revision: 5,
    currentLevel: 'level-006',
    highestUnlockedLevel: 'level-006',
    completedLevels: [],
    bestMoves: {},
    configVersion: 'chapters-1-2.2026-08-29.1',
  }));

  assert.equal(migrated?.schemaVersion, 3);
  assert.equal(migrated?.completedThrough, 5);
  assert.equal(migrated && 'completedLevels' in migrated, false);
});
