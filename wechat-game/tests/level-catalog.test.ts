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

test('levels 25 to 27 satisfy peak metric envelopes and actual ratings ease from 28 to 30', () => {
  const ratings = FIRST_CHAPTER_LEVELS.map((level) => level.metrics.difficultyRating);
  const easing = ratings.slice(27, 30);
  for (const number of [25, 26, 27]) {
    const level = getLevelConfig(levelId(number));
    assert.ok(level, levelId(number));
    assert.ok(level.metrics.optimalMoves >= 22, level.id);
    assert.ok(level.metrics.optimalMoves <= 40, level.id);
    assert.ok(level.metrics.segmentCount >= (number === 25 ? 32 : 34), level.id);
    assert.ok(level.metrics.exploredStates >= 5_000, level.id);
    assert.ok(level.metrics.openingMoves >= 2, level.id);
    assert.ok(level.metrics.openingMoves <= (number === 26 ? 20 : number === 27 ? 24 : 18), level.id);
    assert.ok(level.metrics.misleadingBranchRatio >= 0.3, level.id);
  }
  // difficultyRating ranks candidates within envelopes; only the authored easing tail must converge.
  assert.ok(easing[0] > easing[1]);
  assert.ok(easing[1] > easing[2]);
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
