import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeProgress, normalizeLevelResult, validateRewardRequest } from '../src/domain.mjs';

test('cloud progress, reward claims, and telemetry accept 240 but reject 241', () => {
  const progress = { schemaVersion: 3, revision: 0, currentLevel: 'level-240', completedThrough: 240, bestMoves: {}, configVersion: 'chapters-1-8.2026-09-22.1' };
  assert.equal(mergeProgress(null, progress).completedThrough, 240);
  assert.equal(validateRewardRequest({ levelId: 'level-240', claimId: 'claim_12345678' }).levelId, 'level-240');
  assert.equal(normalizeLevelResult({ levelId: 'level-240', moves: 42, durationMs: 1000, undoCount: 0 }).levelId, 'level-240');
  assert.throws(() => mergeProgress(null, { ...progress, completedThrough: 241 }));
  assert.throws(() => validateRewardRequest({ levelId: 'level-241', claimId: 'claim_12345678' }));
  assert.throws(() => normalizeLevelResult({ levelId: 'level-241', moves: 42, durationMs: 1000, undoCount: 0 }));
});
