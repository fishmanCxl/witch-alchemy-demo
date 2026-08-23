import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBootstrapPayload, mergeProgress, normalizeLevelResult, validateRewardRequest,
} from '../src/domain.mjs';

test('bootstrap exposes no client-supplied identity and returns server time/config', () => {
  const payload = createBootstrapPayload({
    progress: null,
    configVersion: '2026.08.23.1',
    serverTime: 1_800_000,
  });
  assert.deepEqual(payload, {
    progress: { revision: 0, currentLevel: 'level-012', completedLevels: [], bestMoves: {}, configVersion: '2026.08.23.1' },
    configVersion: '2026.08.23.1',
    serverTime: 1_800_000,
  });
  assert.equal('openid' in payload, false);
});

test('revision merge preserves completed levels and better best move values', () => {
  const current = {
    revision: 4, currentLevel: 'level-013', completedLevels: ['level-012'],
    bestMoves: { 'level-012': 26 }, configVersion: '2026.08.23.1',
  };
  const merged = mergeProgress(current, {
    baseRevision: 3, currentLevel: 'level-014', completedLevels: ['level-013'],
    bestMoves: { 'level-012': 29, 'level-013': 31 }, configVersion: '2026.08.23.1',
  });
  assert.deepEqual(merged.completedLevels, ['level-012', 'level-013']);
  assert.deepEqual(merged.bestMoves, { 'level-012': 26, 'level-013': 31 });
  assert.equal(merged.revision, 5);
  assert.equal(merged.conflict, true);
});

test('reward request accepts only a known level and bounded idempotency key', () => {
  assert.deepEqual(validateRewardRequest({ levelId: 'level-012', claimId: 'claim_12345678' }), {
    levelId: 'level-012', claimId: 'claim_12345678',
  });
  assert.throws(() => validateRewardRequest({ levelId: 'other', claimId: 'x' }));
  assert.throws(() => validateRewardRequest({ levelId: 'level-012', claimId: 'x'.repeat(129) }));
});

test('completion telemetry is clamped and strips unknown identity fields', () => {
  const result = normalizeLevelResult({
    levelId: 'level-012', moves: 28, durationMs: 45_000, undoCount: 2,
    rewardedBottleUsed: true, openid: 'attacker', extra: 'drop-me',
  });
  assert.deepEqual(result, {
    levelId: 'level-012', moves: 28, durationMs: 45_000, undoCount: 2, rewardedBottleUsed: true,
  });
  assert.throws(() => normalizeLevelResult({ levelId: 'level-012', moves: -1, durationMs: 1, undoCount: 0 }));
});
