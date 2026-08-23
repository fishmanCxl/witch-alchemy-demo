import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAPACITY,
  addRewardBottle,
  canPour,
  isCompleteBottle,
  pour,
  vanishBottle,
} from '../assets/scripts/core/water-sort.ts';
import { createDemoState, stateOf } from '../assets/scripts/core/demo-level.ts';

test('pours only the contiguous matching top run without mutating the source state', () => {
  const state = stateOf([
    ['violet', 'rose', 'rose'],
    ['rose'],
  ]);
  const before = structuredClone(state);
  const result = pour(state, 0, 1);

  assert.equal(CAPACITY, 4);
  assert.equal(result.moved, 2);
  assert.deepEqual(result.state.bottles[0].layers, ['violet']);
  assert.deepEqual(result.state.bottles[1].layers, ['rose', 'rose', 'rose']);
  assert.deepEqual(state, before);
});

test('rejects a different target color and keeps the same state identity', () => {
  const state = stateOf([['rose'], ['amber']]);

  assert.equal(canPour(state, 0, 1), false);
  assert.deepEqual(pour(state, 0, 1), { state, moved: 0, completed: [] });
});

test('reports a four-layer single-color completed potion', () => {
  const result = pour(stateOf([['rose'], ['rose', 'rose', 'rose']]), 0, 1);

  assert.deepEqual(result.completed, [1]);
  assert.equal(isCompleteBottle(result.state.bottles[1]), true);
  assert.equal(result.state.moves, 1);
});

test('vanishing a completed potion preserves its fixed slot as non-reusable', () => {
  const state = stateOf([[], ['rose', 'rose', 'rose', 'rose']]);
  const next = vanishBottle(state, 1);

  assert.equal(next.bottles[1].status, 'vanished');
  assert.deepEqual(next.bottles[1].layers, []);
  assert.equal(next.bottles.length, state.bottles.length);
});

test('the rewarded empty bottle activates slot fifteen once and is idempotent', () => {
  const state = createDemoState();
  const first = addRewardBottle(state);
  const second = addRewardBottle(first);

  assert.equal(state.bottles.length, 15);
  assert.equal(state.bottles[14].status, 'reserved');
  assert.equal(first.bottles[14].status, 'active');
  assert.equal(first.rewardBottleUsed, true);
  assert.equal(second, first);
});

test('demo level matches the approved one-move completion tutorial', () => {
  const state = createDemoState();
  const result = pour(state, 0, 1);

  assert.equal(state.bottles.length, 15);
  assert.equal(result.moved, 1);
  assert.deepEqual(result.completed, [1]);
});
