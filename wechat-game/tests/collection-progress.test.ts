import test from 'node:test';
import assert from 'node:assert/strict';

import { levelId } from '../assets/scripts/core/level-config.ts';
import {
  createDefaultProgress,
  type PlayerProgress,
} from '../assets/scripts/core/level-progress.ts';
import {
  deriveCollectionProgress,
  deriveCompletionReward,
  deriveHighestTitle,
} from '../assets/scripts/core/collection-progress.ts';

function progressWithCompleted(count: number): PlayerProgress {
  return {
    ...createDefaultProgress(),
    completedLevels: Array.from({ length: count }, (_, index) => levelId(index + 1)),
  };
}

for (const [completed, pieces] of [[0, 0], [4, 0], [5, 1], [9, 1], [10, 2], [29, 5], [30, 6]]) {
  test(`${completed} unique completions derive ${pieces} puzzle pieces`, () => {
    const progress = progressWithCompleted(completed);
    assert.equal(deriveCollectionProgress(progress, 1).revealedPieces, pieces);
  });
}

test('chapter completion promotes automatically and replay gives no reward', () => {
  const before = progressWithCompleted(29);
  const after = { ...before, completedLevels: [...before.completedLevels, 'level-030'] };
  assert.equal(deriveHighestTitle(before).title, '见习魔女');
  assert.equal(deriveHighestTitle(after).title, '初级魔女');
  assert.deepEqual(deriveCompletionReward(after, after, 'level-030'), {
    puzzlePiece: null, collectionCompleted: false, titleChanged: false,
  });
});

test('collection derivation ignores duplicate, malformed, and out-of-chapter levels', () => {
  const progress: PlayerProgress = {
    ...createDefaultProgress(),
    completedLevels: ['level-001', 'level-001', 'level-005', 'level-031', 'not-a-level'],
  };

  assert.deepEqual(deriveCollectionProgress(progress, 1), {
    chapterId: 1,
    completedLevels: 2,
    revealedPieces: 0,
    totalPieces: 6,
    collected: false,
    nextMilestone: 5,
  });
});

test('higher chapter completions do not skip the current title', () => {
  const progress: PlayerProgress = {
    ...createDefaultProgress(),
    completedLevels: Array.from({ length: 30 }, (_, index) => levelId(index + 31)),
  };

  assert.deepEqual(deriveHighestTitle(progress), {
    chapterId: 1,
    title: '见习魔女',
  });
});

test('completion reward grants only the newly reached piece and collection completion', () => {
  const before = progressWithCompleted(4);
  const after = progressWithCompleted(5);

  assert.deepEqual(deriveCompletionReward(before, after, 'level-005'), {
    puzzlePiece: 1,
    collectionCompleted: false,
    titleChanged: false,
  });
  assert.deepEqual(deriveCompletionReward(progressWithCompleted(29), progressWithCompleted(30), 'level-030'), {
    puzzlePiece: 6,
    collectionCompleted: true,
    titleChanged: true,
  });
});
