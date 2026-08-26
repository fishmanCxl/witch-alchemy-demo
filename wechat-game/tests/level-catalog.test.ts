import test from 'node:test';
import assert from 'node:assert/strict';

import { createDemoState } from '../assets/scripts/core/demo-level.ts';
import { levelId, validateLevelConfig } from '../assets/scripts/core/level-config.ts';
import {
  FIRST_CHAPTER_LEVELS,
  getLevelConfig,
  nextLevelConfig,
} from '../assets/scripts/core/level-catalog.ts';

test('first chapter publishes exactly thirty consecutive validated levels', () => {
  assert.deepEqual(
    FIRST_CHAPTER_LEVELS.map((level) => level.id),
    Array.from({ length: 30 }, (_, index) => levelId(index + 1)),
  );
  for (const level of FIRST_CHAPTER_LEVELS) {
    assert.deepEqual(validateLevelConfig(level), [], level.id);
  }
});

test('only level one is tutorial and level two starts at seven to ten optimal moves', () => {
  assert.deepEqual(getLevelConfig('level-001')?.completionRule, { type: 'first-valid-pour' });
  for (let number = 2; number <= 30; number += 1) {
    const level = getLevelConfig(levelId(number));
    assert.equal(level?.completionRule.type, 'all-colors');
    if (level?.completionRule.type === 'all-colors') {
      assert.equal(level.completionRule.targetCount, level.metrics.colorCount);
    }
  }
  assert.ok((getLevelConfig('level-002')?.metrics.optimalMoves ?? 0) >= 7);
  assert.ok((getLevelConfig('level-002')?.metrics.optimalMoves ?? 99) <= 10);
});

test('difficulty reaches a level 25 to 27 peak before easing through level 30', () => {
  const ratings = FIRST_CHAPTER_LEVELS.map((level) => level.metrics.difficultyRating);
  const peak = ratings.slice(24, 27);
  const easing = ratings.slice(27, 30);
  const average = (values: readonly number[]): number => (
    values.reduce((sum, value) => sum + value, 0) / values.length
  );

  assert.ok(average(peak) > average(ratings.slice(19, 24)));
  assert.ok(average(peak) > average(easing));
  assert.ok(easing[0] >= easing[1]);
  assert.ok(easing[1] >= easing[2]);
  assert.deepEqual(getLevelConfig('level-012')?.initialState, createDemoState());
});

test('published boards are unique across the first chapter', () => {
  const boardKeys = FIRST_CHAPTER_LEVELS.map((level) => JSON.stringify(
    level.initialState.bottles.map((bottle) => ({
      layers: bottle.layers,
      status: bottle.status,
    })),
  ));
  assert.equal(new Set(boardKeys).size, FIRST_CHAPTER_LEVELS.length);
});

test('catalog lookup rejects unpublished ids and next-level lookup stops after level 30', () => {
  assert.equal(getLevelConfig('level-000'), null);
  assert.equal(getLevelConfig('level-031'), null);
  assert.equal(nextLevelConfig('level-001')?.id, 'level-002');
  assert.equal(nextLevelConfig('level-029')?.id, 'level-030');
  assert.equal(nextLevelConfig('level-030'), null);
  assert.equal(nextLevelConfig('not-a-level'), null);
});
