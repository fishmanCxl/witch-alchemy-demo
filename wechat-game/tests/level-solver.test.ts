import test from 'node:test';
import assert from 'node:assert/strict';

import { createDemoState, stateOf } from '../assets/scripts/core/demo-level.ts';
import type { BottleState, GameState } from '../assets/scripts/core/types.ts';
import {
  applyMoveAndVanish,
  analyzeOpeningBranches,
  canonicalStateKey,
  legalMoves,
  solveLevel,
  type Move,
} from '../tools/level-solver.ts';

const twoColorState = stateOf([
  ['rose'], ['rose', 'rose', 'rose'], ['amber'], ['amber', 'amber', 'amber'],
]);
const equalOpeningState = stateOf([
  ['rose', 'amber', 'violet', 'rose'],
  ['violet', 'rose', 'amber', 'violet'],
  ['amber', 'violet', 'rose', 'amber'],
  [],
  [],
]);
const misleadingOpeningState = stateOf([
  [],
  ['violet', 'violet', 'violet', 'rose'],
  ['cyan', 'amber', 'cyan', 'rose'],
  [],
  ['violet', 'cyan', 'rose', 'rose'],
  ['amber', 'amber', 'amber', 'cyan'],
]);

function withStatuses(
  state: GameState,
  statuses: readonly BottleState['status'][],
): GameState {
  return {
    ...state,
    bottles: state.bottles.map((bottle, index) => ({
      ...bottle,
      status: statuses[index] ?? bottle.status,
    })),
  };
}

function replay(state: GameState, moves: readonly Move[]): GameState {
  return moves.reduce(applyMoveAndVanish, state);
}

test('canonical keys ignore equivalent ordinary bottle permutations but preserve the reward slot', () => {
  const left = withStatuses(stateOf([['rose'], [], ['amber'], []]), [
    'active',
    'active',
    'active',
    'reserved',
  ]);
  const permuted = withStatuses(stateOf([[], ['amber'], ['rose'], []]), [
    'active',
    'active',
    'active',
    'reserved',
  ]);
  const activeLastSlot = withStatuses(permuted, [
    'active',
    'active',
    'active',
    'active',
  ]);

  assert.equal(canonicalStateKey(left), canonicalStateKey(permuted));
  assert.notEqual(canonicalStateKey(left), canonicalStateKey(activeLastSlot));
});

test('legal moves are deterministic and completed targets vanish automatically', () => {
  const state = stateOf([['rose'], ['rose', 'rose', 'rose'], []]);

  assert.deepEqual(legalMoves(state), [
    { from: 0, to: 1 },
    { from: 0, to: 2 },
    { from: 1, to: 0 },
    { from: 1, to: 2 },
  ]);
  const next = applyMoveAndVanish(state, { from: 0, to: 1 });
  assert.equal(next.bottles[1].status, 'vanished');
  assert.deepEqual(next.bottles[1].layers, []);
  assert.equal(next.moves, 1);
});

test('solver finds a shortest two-move solution and leaves its input unchanged', () => {
  const state = twoColorState;
  const before = structuredClone(state);
  const result = solveLevel(state, {
    completionRule: { type: 'all-colors', targetCount: 2 },
    maxExploredStates: 100,
  });

  assert.equal(result.solved, true);
  assert.equal(result.moves.length, 2);
  assert.equal(replay(state, result.moves).bottles.filter((bottle) => (
    bottle.status === 'vanished'
  )).length, 2);
  assert.deepEqual(state, before);
});

test('A star keeps the known two-move solution shortest and deterministic', () => {
  const options = {
    completionRule: { type: 'all-colors', targetCount: 2 } as const,
    maxExploredStates: 50_000,
  };
  const first = solveLevel(twoColorState, options);
  const second = solveLevel(twoColorState, options);

  assert.equal(first.moves.length, 2);
  assert.deepEqual(second, first);
});

test('opening analysis does not penalize branches with equal optimal length', () => {
  const rule = { type: 'all-colors', targetCount: 3 } as const;
  const solved = solveLevel(equalOpeningState, {
    completionRule: rule,
    maxExploredStates: 50_000,
  });
  const analysis = analyzeOpeningBranches(
    equalOpeningState,
    rule,
    solved.moves.length,
    50_000,
  );

  assert.equal(solved.moves.length, 10);
  assert.deepEqual(analysis, {
    totalBranches: 6,
    misleadingBranches: 0,
    ratio: 0,
  });
});

test('opening analysis marks branches longer than the optimum as misleading', () => {
  const rule = { type: 'all-colors', targetCount: 4 } as const;
  const solved = solveLevel(misleadingOpeningState, {
    completionRule: rule,
    maxExploredStates: 50_000,
  });
  const analysis = analyzeOpeningBranches(
    misleadingOpeningState,
    rule,
    solved.moves.length,
    50_000,
  );

  assert.equal(solved.moves.length, 8);
  assert.deepEqual(analysis, {
    totalBranches: 8,
    misleadingBranches: 2,
    ratio: 0.25,
  });
});

test('solver reports a stable unsolved result when the exploration budget is exhausted', () => {
  const state = stateOf([
    ['rose'],
    ['rose', 'rose', 'rose'],
    ['amber'],
    ['amber', 'amber', 'amber'],
  ]);
  const result = solveLevel(state, {
    completionRule: { type: 'all-colors', targetCount: 2 },
    maxExploredStates: 1,
  });

  assert.deepEqual(result, {
    solved: false,
    moves: [],
    exploredStates: 1,
    openingMoves: 4,
  });
});

test('solver returns a replayable path under vanish semantics', () => {
  const state = stateOf([['rose'], ['rose', 'rose', 'rose'], []]);
  const result = solveLevel(state, {
    completionRule: { type: 'all-colors', targetCount: 1 },
    maxExploredStates: 100,
  });

  assert.equal(result.solved, true);
  assert.deepEqual(result.moves, [{ from: 0, to: 1 }]);
  assert.equal(applyMoveAndVanish(state, result.moves[0]).bottles[1].status, 'vanished');
});

test('level 12 is solvable within the offline generation search budget', () => {
  const result = solveLevel(createDemoState(), {
    completionRule: { type: 'all-colors', targetCount: 8 },
    maxExploredStates: 250_000,
  });

  assert.equal(result.solved, true);
  assert.ok(result.moves.length > 0);
  assert.ok(result.exploredStates <= 250_000);
  assert.equal(result.openingMoves, 20);
  assert.equal(
    replay(createDemoState(), result.moves).bottles.filter((bottle) => (
      bottle.status === 'vanished'
    )).length,
    8,
  );
});
