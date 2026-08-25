import test from 'node:test';
import assert from 'node:assert/strict';

import { validateLevelConfig, type LevelConfig } from '../assets/scripts/core/level-config.ts';
import { isCompleteBottle } from '../assets/scripts/core/water-sort.ts';
import {
  generateCandidate,
  generatedOutputMatches,
  type GenerationSpec,
} from '../tools/level-generator.ts';
import { applyMoveAndVanish } from '../tools/level-solver.ts';

const SPEC: GenerationSpec = {
  number: 4,
  colorCount: 4,
  emptyBottleCount: 2,
  reverseMoves: 9,
  targetDifficulty: 0.5,
  minimumOptimalMoves: 0,
  maximumOptimalMoves: 100,
  minimumSegments: 0,
  minimumExploredStates: 0,
  minimumOpeningMoves: 0,
  maximumOpeningMoves: 100,
  minimumMisleadingBranchRatio: 0,
  maxAttempts: 20,
};

test('candidate generation is identical for one seed and diverse across seeds', () => {
  const first = generateCandidate(SPEC, 41);
  const repeated = generateCandidate(SPEC, 41);
  const different = generateCandidate(SPEC, 42);

  assert.deepEqual(repeated, first);
  assert.notDeepEqual(different.initialState, first.initialState);
});

test('accepted candidates are ranked by distance to target difficulty', () => {
  const candidate = generateCandidate({
    ...SPEC,
    targetDifficulty: 1,
    maxAttempts: 50,
  }, 41);

  assert.equal(candidate.attempt, 41);
  assert.equal(candidate.metrics.difficultyRating, 0.356);
  assert.equal(candidate.metrics.difficultyScore, 3_560);
});

test('recorded inverse moves replay through completion-and-vanish semantics', () => {
  const candidate = generateCandidate(SPEC, 9);
  const solved = candidate.inverseMoves.reduce(applyMoveAndVanish, candidate.initialState);

  assert.equal(solved.bottles.filter((bottle) => bottle.status === 'vanished').length, 4);
  assert.equal(candidate.inverseMoves.length, SPEC.reverseMoves);
  assert.equal(candidate.metrics.optimalMoves <= candidate.inverseMoves.length, true);
});

test('generated candidates preserve color totals, reserved slot, and valid openings', () => {
  const candidate = generateCandidate(SPEC, 99);
  const config: LevelConfig = {
    id: 'level-004',
    number: 4,
    configVersion: 'test-generated-v1',
    presentationSeed: 99,
    capacity: 4,
    slotCount: 15,
    rewardSlotIndex: 14,
    completionRule: { type: 'all-colors', targetCount: SPEC.colorCount },
    metrics: candidate.metrics,
    initialState: candidate.initialState,
  };

  assert.deepEqual(validateLevelConfig(config), []);
  assert.equal(config.initialState.bottles[14].status, 'reserved');
  assert.equal(config.initialState.bottles.some(isCompleteBottle), false);
  assert.equal(config.metrics.colorCount, SPEC.colorCount);
  assert.ok(config.metrics.openingMoves >= 2);
});

test('candidate generation fails after maxAttempts with a stable diagnostic', () => {
  assert.throws(
    () => generateCandidate({
      ...SPEC,
      minimumOptimalMoves: 1_000_000,
      maxAttempts: 2,
    }, 7),
    new Error('Unable to generate level 4 from seed 7 after 2 attempts'),
  );
});

test('candidate generation enforces every metric window independently', () => {
  const impossibleSpecs: readonly Partial<GenerationSpec>[] = [
    { minimumOptimalMoves: 1_000_000 },
    { maximumOptimalMoves: 0 },
    { minimumSegments: 1_000_000 },
    { minimumExploredStates: 1_000_000 },
    { minimumOpeningMoves: 1_000_000 },
    { maximumOpeningMoves: 0 },
    { minimumMisleadingBranchRatio: 1.1 },
  ];

  for (const impossible of impossibleSpecs) {
    assert.throws(
      () => generateCandidate({ ...SPEC, ...impossible, maxAttempts: 1 }, 41),
      /Unable to generate level 4/,
    );
  }
});

test('generated output comparison normalizes line endings without hiding content changes', () => {
  assert.equal(generatedOutputMatches('alpha\r\nbeta\r\n', 'alpha\nbeta\n'), true);
  assert.equal(generatedOutputMatches('alpha\r\nwrong\r\n', 'alpha\nbeta\n'), false);
});
