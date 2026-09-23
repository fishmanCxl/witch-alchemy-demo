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
  assert.deepEqual(getLevelConfig('level-001')?.completionRule, { type: 'first-bottle-complete' });
  for (let number = 2; number <= 180; number += 1) {
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

test('all published boards are unique across all six chapters', async () => {
  const catalog = await import('../assets/scripts/core/level-catalog.ts');
  assert.equal(Array.isArray(catalog.PUBLISHED_LEVELS), true);
  const boardKeys = catalog.PUBLISHED_LEVELS.map((level) => JSON.stringify(
    level.initialState.bottles.map((bottle) => ({
      layers: bottle.layers,
      status: bottle.status,
    })),
  ));
  assert.equal(new Set(boardKeys).size, 180);
});

test('chapters two through six publish levels 31 to 180 and next-level lookup crosses every published boundary', async () => {
  const catalog = await import('../assets/scripts/core/level-catalog.ts');
  assert.equal(catalog.GAME_CONFIG_VERSION, 'chapters-1-6.2026-09-19.1');
  assert.equal(catalog.PUBLISHED_LEVELS?.length, 180);
  assert.deepEqual(
    catalog.levelsForChapter?.(2).map((level) => level.number),
    Array.from({ length: 30 }, (_, index) => index + 31),
  );
  assert.deepEqual(
    catalog.levelsForChapter?.(3).map((level) => level.number),
    Array.from({ length: 30 }, (_, index) => index + 61),
  );
  assert.deepEqual(
    catalog.levelsForChapter?.(4).map((level) => level.number),
    Array.from({ length: 30 }, (_, index) => index + 91),
  );
  assert.deepEqual(
    catalog.levelsForChapter?.(5).map((level) => level.number),
    Array.from({ length: 30 }, (_, index) => index + 121),
  );
  assert.deepEqual(
    catalog.levelsForChapter?.(6).map((level) => level.number),
    Array.from({ length: 30 }, (_, index) => index + 151),
  );
  assert.equal(getLevelConfig('level-031')?.completionRule.type, 'all-colors');
  assert.equal(getLevelConfig('level-060')?.number, 60);
  assert.equal(getLevelConfig('level-061')?.completionRule.type, 'all-colors');
  assert.equal(getLevelConfig('level-090')?.number, 90);
  assert.equal(getLevelConfig('level-091')?.completionRule.type, 'all-colors');
  assert.equal(getLevelConfig('level-120')?.number, 120);
  assert.equal(getLevelConfig('level-121')?.completionRule.type, 'all-colors');
  assert.equal(getLevelConfig('level-150')?.number, 150);
  assert.equal(getLevelConfig('level-151')?.completionRule.type, 'all-colors');
  assert.equal(getLevelConfig('level-180')?.number, 180);
  assert.equal(nextLevelConfig('level-030')?.id, 'level-031');
  assert.equal(nextLevelConfig('level-060')?.id, 'level-061');
  assert.equal(nextLevelConfig('level-090')?.id, 'level-091');
  assert.equal(nextLevelConfig('level-120')?.id, 'level-121');
  assert.equal(nextLevelConfig('level-150')?.id, 'level-151');
  assert.equal(nextLevelConfig('level-180'), null);
});

test('catalog lookup rejects unpublished ids after chapter six', () => {
  assert.equal(getLevelConfig('level-000'), null);
  assert.equal(getLevelConfig('level-121')?.number, 121);
  assert.equal(getLevelConfig('level-151')?.number, 151);
  assert.equal(getLevelConfig('level-181'), null);
  assert.equal(nextLevelConfig('level-001')?.id, 'level-002');
  assert.equal(nextLevelConfig('level-029')?.id, 'level-030');
  assert.equal(nextLevelConfig('level-030')?.id, 'level-031');
  assert.equal(nextLevelConfig('level-060')?.id, 'level-061');
  assert.equal(nextLevelConfig('level-090')?.id, 'level-091');
  assert.equal(nextLevelConfig('level-120')?.id, 'level-121');
  assert.equal(nextLevelConfig('level-150')?.id, 'level-151');
  assert.equal(nextLevelConfig('level-180'), null);
  assert.equal(nextLevelConfig('not-a-level'), null);
});

test('chapter six publishes eleven colors with exactly two initial active empty bottles', () => {
  for (let number = 151; number <= 180; number += 1) {
    const level = getLevelConfig(levelId(number));
    assert.ok(level, levelId(number));
    assert.equal(level.metrics.colorCount, 11, level.id);
    assert.equal(level.initialState.bottles.filter((bottle) => (
      bottle.status === 'active' && bottle.layers.length === 0
    )).length, 2, level.id);
    assert.equal(new Set(level.initialState.bottles.flatMap((bottle) => bottle.layers)).size, 11, level.id);
  }
});
