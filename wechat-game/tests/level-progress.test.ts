import test from 'node:test';
import assert from 'node:assert/strict';

import {
  completeLevel,
  createDefaultProgress,
  encodePlayerProgress,
  decodePlayerProgress,
  isLevelUnlocked,
  mergePlayerProgress,
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
    highestUnlockedLevel: level,
  };
}

const oldFifteenLevelProgress: PlayerProgress = {
  ...createDefaultProgress(),
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
    schemaVersion: 2,
    revision: 0,
    currentLevel: 'level-001',
    highestUnlockedLevel: 'level-001',
    completedLevels: [],
    bestMoves: {},
    configVersion: 'chapters-1-2.2026-08-29.1',
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
    configVersion: 'chapters-1-2.2026-08-29.1',
  });
});

test('level 30 unlocks chapter two while level 60 caps published progression', () => {
  const afterThirty = completeLevel(progressAt('level-030'), 'level-030', 28)!;
  assert.equal(afterThirty.currentLevel, 'level-031');
  assert.equal(afterThirty.highestUnlockedLevel, 'level-031');
  assert.equal(isLevelUnlocked(afterThirty, 'level-031'), true);

  const afterSixty = completeLevel(progressAt('level-060'), 'level-060', 41)!;
  assert.equal(afterSixty.currentLevel, 'level-060');
  assert.equal(afterSixty.highestUnlockedLevel, 'level-060');
  assert.deepEqual(afterSixty.completedLevels, ['level-060']);
  assert.equal(isLevelUnlocked(afterSixty, 'level-061'), false);
});

test('old v2 progress is normalized to the new config without losing completions', () => {
  const decoded = decodePlayerProgress(JSON.stringify(oldFifteenLevelProgress));

  assert.deepEqual(decoded?.completedLevels, oldFifteenLevelProgress.completedLevels);
  assert.deepEqual(decoded?.bestMoves, oldFifteenLevelProgress.bestMoves);
  assert.equal(decoded?.configVersion, 'chapters-1-2.2026-08-29.1');
});

test('a high legacy unlock does not invent missing earlier completions', () => {
  const sparseLegacy: PlayerProgress = {
    ...oldFifteenLevelProgress,
    currentLevel: 'level-030',
    highestUnlockedLevel: 'level-030',
    completedLevels: ['level-002', 'level-016', 'level-030'],
  };

  assert.deepEqual(
    decodePlayerProgress(JSON.stringify(sparseLegacy))?.completedLevels,
    ['level-002', 'level-016', 'level-030'],
  );
});

test('progress encoding strips derived and unknown top-level fields', () => {
  const polluted = {
    schemaVersion: 2,
    revision: 4,
    currentLevel: 'level-003',
    highestUnlockedLevel: 'level-004',
    completedLevels: ['level-001', 'level-003'],
    bestMoves: { 'level-001': 5, 'level-003': 9 },
    configVersion: 'chapter-1.2026-08-23.1',
    collection: { revealedPieces: 2 },
    title: '不应持久化',
    arbitraryUnknown: ['also', 'strip'],
  } as unknown as PlayerProgress;

  assert.deepEqual(JSON.parse(encodePlayerProgress(polluted)), {
    schemaVersion: 2,
    revision: 4,
    currentLevel: 'level-003',
    highestUnlockedLevel: 'level-004',
    completedLevels: ['level-001', 'level-003'],
    bestMoves: { 'level-001': 5, 'level-003': 9 },
    configVersion: 'chapters-1-2.2026-08-29.1',
  });
});

test('progress decoding strips derived and unknown top-level fields', () => {
  const decoded = decodePlayerProgress(JSON.stringify({
    schemaVersion: 2,
    revision: 6,
    currentLevel: 'level-003',
    highestUnlockedLevel: 'level-004',
    completedLevels: ['level-003', 'level-001'],
    bestMoves: { 'level-003': 9, 'level-001': 5 },
    configVersion: 'chapter-1.2026-08-23.1',
    collection: { revealedPieces: 2 },
    title: '不应恢复',
    arbitraryUnknown: { nested: true },
  }));

  assert.deepEqual(decoded, {
    schemaVersion: 2,
    revision: 6,
    currentLevel: 'level-003',
    highestUnlockedLevel: 'level-004',
    completedLevels: ['level-001', 'level-003'],
    bestMoves: { 'level-001': 5, 'level-003': 9 },
    configVersion: 'chapters-1-2.2026-08-29.1',
  });
});
