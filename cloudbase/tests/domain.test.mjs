import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBootstrapPayload, mergeProgress, normalizeLevelResult, validateRewardRequest,
} from '../src/domain.mjs';

const VERSION = 'chapter-1.2026-08-23.1';

test('bootstrap defaults to level 1 v2 progress and strips stored identity fields', () => {
  const empty = createBootstrapPayload({
    progress: null,
    configVersion: VERSION,
    serverTime: 1_800_000,
  });
  assert.deepEqual(empty, {
    progress: {
      schemaVersion: 2,
      revision: 0,
      currentLevel: 'level-001',
      highestUnlockedLevel: 'level-001',
      completedLevels: [],
      bestMoves: {},
      configVersion: VERSION,
    },
    configVersion: VERSION,
    serverTime: 1_800_000,
  });

  const populated = createBootstrapPayload({
    progress: { ...empty.progress, playerId: 'server-only', openid: 'hidden' },
    configVersion: VERSION,
    serverTime: 2,
  });
  assert.equal('playerId' in populated.progress, false);
  assert.equal('openid' in populated.progress, false);
});

test('v2 merge unions completion, minimizes moves, and takes a capped unlock maximum', () => {
  const current = {
    schemaVersion: 2,
    revision: 4,
    currentLevel: 'level-003',
    highestUnlockedLevel: 'level-004',
    completedLevels: ['level-001', 'level-003'],
    bestMoves: { 'level-001': 8, 'level-003': 12 },
    configVersion: VERSION,
  };
  const merged = mergeProgress(current, {
    schemaVersion: 2,
    revision: 3,
    currentLevel: 'level-005',
    highestUnlockedLevel: 'level-006',
    completedLevels: ['level-002', 'level-003'],
    bestMoves: { 'level-002': 9, 'level-003': 10 },
    configVersion: VERSION,
    openid: 'attacker',
  });

  assert.deepEqual(merged, {
    schemaVersion: 2,
    revision: 5,
    currentLevel: 'level-005',
    highestUnlockedLevel: 'level-006',
    completedLevels: ['level-001', 'level-002', 'level-003'],
    bestMoves: { 'level-001': 8, 'level-002': 9, 'level-003': 10 },
    configVersion: VERSION,
    conflict: true,
  });
  assert.equal('openid' in merged, false);
});

test('merge preserves a legal current level and rejects levels beyond the published chapter', () => {
  const current = {
    schemaVersion: 2,
    revision: 2,
    currentLevel: 'level-004',
    highestUnlockedLevel: 'level-005',
    completedLevels: [],
    bestMoves: {},
    configVersion: VERSION,
  };
  const merged = mergeProgress(current, {
    ...current,
    revision: 2,
    currentLevel: 'level-010',
    highestUnlockedLevel: 'level-006',
  });
  assert.equal(merged.currentLevel, 'level-004');
  assert.equal(merged.highestUnlockedLevel, 'level-006');
  assert.throws(() => mergeProgress(current, { ...current, highestUnlockedLevel: 'level-016' }));
});

test('reward requests accept published levels 1 and 15 but reject level 16', () => {
  assert.deepEqual(validateRewardRequest({ levelId: 'level-001', claimId: 'claim_12345678' }), {
    levelId: 'level-001', claimId: 'claim_12345678',
  });
  assert.deepEqual(validateRewardRequest({ levelId: 'level-015', claimId: 'claim_87654321' }), {
    levelId: 'level-015', claimId: 'claim_87654321',
  });
  assert.throws(() => validateRewardRequest({ levelId: 'level-016', claimId: 'claim_12345678' }));
  assert.throws(() => validateRewardRequest({ levelId: 'level-001', claimId: 'x'.repeat(129) }));
});

test('completion telemetry accepts only published levels and strips identity fields', () => {
  const result = normalizeLevelResult({
    levelId: 'level-015', moves: 28, durationMs: 45_000, undoCount: 2,
    rewardedBottleUsed: true, openid: 'attacker', extra: 'drop-me',
  });
  assert.deepEqual(result, {
    levelId: 'level-015', moves: 28, durationMs: 45_000, undoCount: 2, rewardedBottleUsed: true,
  });
  assert.throws(() => normalizeLevelResult({
    levelId: 'level-016', moves: 1, durationMs: 1, undoCount: 0,
  }));
});
