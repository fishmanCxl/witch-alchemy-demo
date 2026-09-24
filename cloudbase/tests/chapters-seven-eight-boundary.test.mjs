import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { mergeProgress, normalizeLevelResult, validateRewardRequest } from '../src/domain.mjs';

test('cloud progress, reward claims, and telemetry accept 270 but reject 271', () => {
  const progress = { schemaVersion: 3, revision: 0, currentLevel: 'level-270', completedThrough: 270, bestMoves: {}, configVersion: 'chapters-1-9.2026-09-23.1' };
  assert.equal(mergeProgress(null, progress).completedThrough, 270);
  assert.equal(validateRewardRequest({ levelId: 'level-270', claimId: 'claim_12345678' }).levelId, 'level-270');
  assert.equal(normalizeLevelResult({ levelId: 'level-270', moves: 42, durationMs: 1000, undoCount: 0 }).levelId, 'level-270');
  assert.throws(() => mergeProgress(null, { ...progress, completedThrough: 271 }));
  assert.throws(() => validateRewardRequest({ levelId: 'level-271', claimId: 'claim_12345678' }));
  assert.throws(() => normalizeLevelResult({ levelId: 'level-271', moves: 42, durationMs: 1000, undoCount: 0 }));
});

test('all deployed runtime copies use the chapter nine boundary', () => {
  const runtimePaths = [
    '../functions/_shared/runtime.js',
    '../functions/bootstrap/_shared/runtime.js',
    '../functions/claimRewardedBottle/_shared/runtime.js',
    '../functions/getGameConfig/_shared/runtime.js',
    '../functions/submitLevelResult/_shared/runtime.js',
    '../functions/syncProgress/_shared/runtime.js',
  ];
  for (const relative of runtimePaths) {
    assert.match(
      readFileSync(new URL(relative, import.meta.url), 'utf8'),
      /const LAST_LEVEL = 270;/,
      relative,
    );
  }
});
