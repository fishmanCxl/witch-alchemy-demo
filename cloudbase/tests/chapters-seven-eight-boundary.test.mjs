import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { mergeProgress, normalizeLevelResult, validateRewardRequest } from '../src/domain.mjs';

test('cloud progress, reward claims, and telemetry accept 300 but reject 301', () => {
  const progress = { schemaVersion: 3, revision: 0, currentLevel: 'level-300', completedThrough: 300, bestMoves: { 'level-270': 44 }, configVersion: 'chapters-1-10.2026-09-24.1' };
  assert.equal(mergeProgress(null, progress).completedThrough, 300);
  assert.equal(mergeProgress(null, progress).bestMoves['level-270'], 44);
  assert.equal(validateRewardRequest({ levelId: 'level-270', claimId: 'claim_12345678' }).levelId, 'level-270');
  assert.equal(validateRewardRequest({ levelId: 'level-300', claimId: 'claim_12345678' }).levelId, 'level-300');
  assert.equal(normalizeLevelResult({ levelId: 'level-300', moves: 42, durationMs: 1000, undoCount: 0 }).levelId, 'level-300');
  assert.throws(() => mergeProgress(null, { ...progress, completedThrough: 301 }));
  assert.throws(() => mergeProgress(null, { ...progress, currentLevel: 'level-301' }));
  assert.throws(() => validateRewardRequest({ levelId: 'level-301', claimId: 'claim_12345678' }));
  assert.throws(() => normalizeLevelResult({ levelId: 'level-301', moves: 42, durationMs: 1000, undoCount: 0 }));
});

test('all deployed runtime copies use the chapter ten boundary', () => {
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
      /const LAST_LEVEL = 300;/,
      relative,
    );
  }
});
