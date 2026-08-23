import test from 'node:test';
import assert from 'node:assert/strict';

import { validateLevelConfig, type LevelConfig } from '../assets/scripts/core/level-config.ts';
import { isCompleteBottle } from '../assets/scripts/core/water-sort.ts';
import {
  generateCandidate,
  type GenerationSpec,
} from '../tools/level-generator.ts';
import { applyMoveAndVanish } from '../tools/level-solver.ts';

const SPEC: GenerationSpec = {
  number: 4,
  colorCount: 4,
  emptyBottleCount: 2,
  reverseMoves: 9,
  minimumDifficulty: 0,
  maximumDifficulty: 100_000,
  maxAttempts: 20,
};

test('candidate generation is identical for one seed and diverse across seeds', () => {
  const first = generateCandidate(SPEC, 41);
  const repeated = generateCandidate(SPEC, 41);
  const different = generateCandidate(SPEC, 42);

  assert.deepEqual(repeated, first);
  assert.notDeepEqual(different.initialState, first.initialState);
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
      minimumDifficulty: 1_000_000,
      maximumDifficulty: 1_000_001,
      maxAttempts: 2,
    }, 7),
    new Error('Unable to generate level 4 from seed 7 after 2 attempts'),
  );
});
