import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultProgress } from '../assets/scripts/core/level-progress.ts';
import { chapterStarTotal, levelStarRating } from '../assets/scripts/core/level-rating.ts';

test('level stars apply the optimal and fifteen-percent boundaries', () => {
  assert.equal(levelStarRating(false, undefined, 20), 0);
  assert.equal(levelStarRating(true, undefined, 20), 1);
  assert.equal(levelStarRating(true, 20, 20), 3);
  assert.equal(levelStarRating(true, 21, 20), 2);
  assert.equal(levelStarRating(true, 23, 20), 2);
  assert.equal(levelStarRating(true, 24, 20), 1);
  assert.equal(levelStarRating(true, 11, 9), 2);
  assert.equal(levelStarRating(true, 12, 9), 1);
});

test('chapter star total derives legacy and recorded results without star storage', () => {
  const progress = {
    ...createDefaultProgress(),
    completedThrough: 3,
    bestMoves: { 'level-001': 1, 'level-002': 11 },
  };

  assert.equal(chapterStarTotal(progress, 1), 6);
  assert.equal(chapterStarTotal(progress, 2), 0);
});
