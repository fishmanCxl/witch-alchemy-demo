import test from 'node:test';
import assert from 'node:assert/strict';

import { createDemoState } from '../assets/scripts/core/demo-level.ts';
import { levelId, validateLevelConfig } from '../assets/scripts/core/level-config.ts';
import {
  FIRST_CHAPTER_LEVELS,
  getLevelConfig,
  nextLevelConfig,
} from '../assets/scripts/core/level-catalog.ts';

test('first chapter publishes exactly fifteen consecutive validated levels', () => {
  assert.deepEqual(
    FIRST_CHAPTER_LEVELS.map((level) => level.id),
    Array.from({ length: 15 }, (_, index) => levelId(index + 1)),
  );
  for (const level of FIRST_CHAPTER_LEVELS) {
    assert.deepEqual(validateLevelConfig(level), [], level.id);
  }
});

test('tutorial rules are explicit and ordinary levels require every target color', () => {
  assert.deepEqual(getLevelConfig('level-001')?.completionRule, { type: 'first-valid-pour' });
  assert.deepEqual(getLevelConfig('level-002')?.completionRule, { type: 'first-bottle-complete' });
  for (let number = 3; number <= 15; number += 1) {
    const level = getLevelConfig(levelId(number));
    assert.deepEqual(level?.completionRule, {
      type: 'all-colors',
      targetCount: level?.metrics.colorCount,
    });
  }
});

test('difficulty never decreases and level 12 remains the frozen compatibility board', () => {
  const scores = FIRST_CHAPTER_LEVELS.map((level) => level.metrics.difficultyScore);
  assert.deepEqual(scores, [...scores].sort((left, right) => left - right));
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

test('catalog lookup rejects unpublished ids and next-level lookup stops after level 15', () => {
  assert.equal(getLevelConfig('level-000'), null);
  assert.equal(getLevelConfig('level-016'), null);
  assert.equal(nextLevelConfig('level-001')?.id, 'level-002');
  assert.equal(nextLevelConfig('level-015'), null);
  assert.equal(nextLevelConfig('not-a-level'), null);
});
