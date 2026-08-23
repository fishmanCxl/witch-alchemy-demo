import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addRewardBottle,
  canPour,
  createDemoState,
  isCompleteBottle,
  pour,
  vanishBottle,
} from '../src/game/engine.mjs';

function stateOf(layerSets) {
  return {
    bottles: layerSets.map((layers) => ({ layers: [...layers], status: 'active' })),
    rewardBottleUsed: false,
    moves: 0,
  };
}

test('pours only the contiguous matching top run', () => {
  const state = stateOf([['violet', 'rose', 'rose'], ['rose']]);

  const result = pour(state, 0, 1);

  assert.deepEqual(result.state.bottles[0].layers, ['violet']);
  assert.deepEqual(result.state.bottles[1].layers, ['rose', 'rose', 'rose']);
  assert.equal(result.moved, 2);
  assert.equal(result.state.moves, 1);
});

test('rejects a target with a different top color without mutating state', () => {
  const state = stateOf([['rose'], ['amber']]);

  assert.equal(canPour(state, 0, 1), false);
  const result = pour(state, 0, 1);

  assert.equal(result.moved, 0);
  assert.equal(result.state, state);
});

test('moves only what fits in the target', () => {
  const state = stateOf([['violet', 'rose', 'rose'], ['amber', 'rose', 'rose']]);

  const result = pour(state, 0, 1);

  assert.deepEqual(result.state.bottles[0].layers, ['violet', 'rose']);
  assert.deepEqual(result.state.bottles[1].layers, ['amber', 'rose', 'rose', 'rose']);
  assert.equal(result.moved, 1);
});

test('reports a target that becomes a four-layer single-color potion', () => {
  const state = stateOf([['violet', 'rose'], ['rose', 'rose', 'rose']]);

  const result = pour(state, 0, 1);

  assert.deepEqual(result.completed, [1]);
  assert.equal(isCompleteBottle(result.state.bottles[1]), true);
});

test('does not complete a mixed four-layer bottle', () => {
  const mixed = { layers: ['rose', 'amber', 'rose', 'rose'], status: 'active' };

  assert.equal(isCompleteBottle(mixed), false);
});

test('vanishing a completed bottle makes its slot inactive and empty', () => {
  const state = stateOf([[], ['rose', 'rose', 'rose', 'rose']]);

  const vanished = vanishBottle(state, 1);

  assert.equal(vanished.bottles[1].status, 'vanished');
  assert.deepEqual(vanished.bottles[1].layers, []);
  assert.equal(canPour(vanished, 0, 1), false);
});

test('reward bottle activates slot fifteen only once', () => {
  const initial = createDemoState();

  const first = addRewardBottle(initial);
  const second = addRewardBottle(first);

  assert.equal(initial.bottles[14].status, 'reserved');
  assert.equal(first.bottles[14].status, 'active');
  assert.deepEqual(first.bottles[14].layers, []);
  assert.equal(first.rewardBottleUsed, true);
  assert.equal(second, first);
});

test('demo state offers a one-move completion tutorial', () => {
  const state = createDemoState();

  const result = pour(state, 0, 1);

  assert.deepEqual(result.completed, [1]);
});
