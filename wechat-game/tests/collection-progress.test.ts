import test from 'node:test';
import assert from 'node:assert/strict';

import { levelId } from '../assets/scripts/core/level-config.ts';
import {
  completeLevel,
  createDefaultProgress,
  selectCurrentLevel,
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
    completedThrough: count,
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
  const after = { ...before, completedThrough: 30 };
  assert.equal(deriveHighestTitle(before).title, '见习魔女');
  assert.equal(deriveHighestTitle(after).title, '初级魔女');
  assert.deepEqual(deriveCompletionReward(after, after, 'level-030'), {
    puzzlePiece: null, collectionCompleted: false, titleChanged: false,
  });
});

test('collection derivation clamps continuous progress to the selected chapter', () => {
  const progress: PlayerProgress = {
    ...createDefaultProgress(),
    completedThrough: 35,
  };

  assert.deepEqual(deriveCollectionProgress(progress, 1), {
    chapterId: 1,
    completedLevels: 30,
    revealedPieces: 6,
    totalPieces: 6,
    collected: true,
    nextMilestone: null,
  });
});

test('the highest title follows the last fully completed chapter', () => {
  const progress: PlayerProgress = {
    ...createDefaultProgress(),
    completedThrough: 35,
  };

  assert.deepEqual(deriveHighestTitle(progress), {
    chapterId: 2,
    title: '初级魔女',
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

test('chapter two reveals one forest potion piece for every five completions', () => {
  const chapterOneComplete = progressWithCompleted(30);
  assert.deepEqual(deriveHighestTitle(chapterOneComplete), {
    chapterId: 2,
    title: '初级魔女',
  });

  const fiveForestLevels = progressWithCompleted(35);
  assert.equal(deriveCollectionProgress(fiveForestLevels, 2).revealedPieces, 1);
});

test('chapter two completion collects forest potion and promotes the title', () => {
  const before = progressWithCompleted(59);
  const after = progressWithCompleted(60);

  assert.equal(deriveCollectionProgress(after, 2).collected, true);
  assert.deepEqual(deriveCompletionReward(before, after, 'level-060'), {
    puzzlePiece: 6,
    collectionCompleted: true,
    titleChanged: true,
  });
});

test('chapter three reveals moon glow pieces and starts with the skilled witch title', () => {
  const chapterTwoComplete = progressWithCompleted(60);
  assert.deepEqual(deriveHighestTitle(chapterTwoComplete), {
    chapterId: 3,
    title: '熟练魔女',
  });
  assert.equal(deriveCollectionProgress(progressWithCompleted(65), 3).revealedPieces, 1);
  assert.deepEqual(
    deriveCompletionReward(progressWithCompleted(64), progressWithCompleted(65), 'level-065'),
    { puzzlePiece: 1, collectionCompleted: false, titleChanged: false },
  );
});

test('chapter three completion collects moon glow potion and promotes the next title', () => {
  const before = progressWithCompleted(89);
  const after = progressWithCompleted(90);

  assert.equal(deriveCollectionProgress(after, 3).collected, true);
  assert.deepEqual(deriveCompletionReward(before, after, 'level-090'), {
    puzzlePiece: 6,
    collectionCompleted: true,
    titleChanged: true,
  });
  assert.deepEqual(deriveHighestTitle(after), { chapterId: 4, title: '高级魔女' });
});

test('chapter four reveals one flame potion piece after five completions', () => {
  const chapterThreeComplete = progressWithCompleted(90);
  assert.deepEqual(deriveHighestTitle(chapterThreeComplete), {
    chapterId: 4,
    title: '高级魔女',
  });
  assert.equal(deriveCollectionProgress(progressWithCompleted(95), 4).revealedPieces, 1);
  assert.deepEqual(
    deriveCompletionReward(progressWithCompleted(94), progressWithCompleted(95), 'level-095'),
    { puzzlePiece: 1, collectionCompleted: false, titleChanged: false },
  );
});

test('chapter four completion collects flame potion and promotes to alchemy master', () => {
  const before = progressWithCompleted(119);
  const after = progressWithCompleted(120);

  assert.equal(deriveCollectionProgress(after, 4).collected, true);
  assert.deepEqual(deriveCompletionReward(before, after, 'level-120'), {
    puzzlePiece: 6,
    collectionCompleted: true,
    titleChanged: true,
  });
  assert.deepEqual(deriveHighestTitle(after), { chapterId: 5, title: '炼金大师' });
});

test('five sequential completions reveal one piece even after selecting level 1 again', () => {
  let progress = createDefaultProgress();
  for (let number = 1; number <= 5; number += 1) {
    progress = completeLevel(progress, levelId(number), 8)!;
  }
  progress = selectCurrentLevel(progress, 'level-001')!;

  assert.equal(progress.currentLevel, 'level-001');
  assert.equal(deriveCollectionProgress(progress, 1).revealedPieces, 1);
});
