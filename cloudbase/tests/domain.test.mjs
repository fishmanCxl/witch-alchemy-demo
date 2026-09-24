import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBootstrapPayload, mergeProgress, normalizeLevelResult, validateRewardRequest,
} from '../src/domain.mjs';

const VERSION = 'chapters-1-9.2026-09-23.1';

test('bootstrap defaults to level 1 v3 progress and strips stored identity fields', () => {
  const empty = createBootstrapPayload({
    progress: null,
    configVersion: VERSION,
    serverTime: 1_800_000,
  });
  assert.deepEqual(empty, {
    progress: {
      schemaVersion: 3,
      revision: 0,
      currentLevel: 'level-001',
      completedThrough: 0,
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

test('v3 merge takes the furthest continuous completion and minimizes moves', () => {
  const current = {
    schemaVersion: 3,
    revision: 4,
    currentLevel: 'level-003',
    completedThrough: 3,
    bestMoves: { 'level-001': 8, 'level-003': 12 },
    configVersion: VERSION,
  };
  const merged = mergeProgress(current, {
    schemaVersion: 3,
    revision: 3,
    currentLevel: 'level-005',
    completedThrough: 5,
    bestMoves: { 'level-002': 9, 'level-003': 10 },
    configVersion: VERSION,
    openid: 'attacker',
  });

  assert.deepEqual(merged, {
    schemaVersion: 3,
    revision: 5,
    currentLevel: 'level-005',
    completedThrough: 5,
    bestMoves: { 'level-001': 8, 'level-002': 9, 'level-003': 10 },
    configVersion: VERSION,
    conflict: true,
  });
  assert.equal('openid' in merged, false);
});

test('merge preserves a legal current level and accepts chapter nine but rejects level 271', () => {
  const current = {
    schemaVersion: 3,
    revision: 2,
    currentLevel: 'level-004',
    completedThrough: 4,
    bestMoves: {},
    configVersion: VERSION,
  };
  const merged = mergeProgress(current, {
    ...current,
    revision: 2,
    currentLevel: 'level-010',
    completedThrough: 5,
  });
  assert.equal(merged.currentLevel, 'level-004');
  assert.equal(merged.completedThrough, 5);
  assert.equal(mergeProgress(current, {
    ...current,
    currentLevel: 'level-031',
    completedThrough: 30,
  }).completedThrough, 30);
  assert.equal(mergeProgress(current, {
    ...current,
    currentLevel: 'level-061',
    completedThrough: 60,
  }).completedThrough, 60);
  assert.equal(mergeProgress(current, {
    ...current,
    currentLevel: 'level-091',
    completedThrough: 90,
  }).completedThrough, 90);
  assert.equal(mergeProgress(current, {
    ...current,
    currentLevel: 'level-120',
    completedThrough: 120,
  }).completedThrough, 120);
  assert.equal(mergeProgress(current, {
    ...current,
    currentLevel: 'level-150',
    completedThrough: 150,
  }).completedThrough, 150);
  assert.equal(mergeProgress(current, {
    ...current,
    currentLevel: 'level-180',
    completedThrough: 180,
  }).completedThrough, 180);
  assert.equal(mergeProgress(current, {
    ...current,
    currentLevel: 'level-210',
    completedThrough: 210,
  }).completedThrough, 210);
  assert.equal(mergeProgress(current, {
    ...current,
    currentLevel: 'level-240',
    completedThrough: 240,
  }).completedThrough, 240);
  assert.equal(mergeProgress(current, {
    ...current,
    currentLevel: 'level-270',
    completedThrough: 270,
  }).completedThrough, 270);
  assert.throws(() => mergeProgress(current, { ...current, completedThrough: 271 }));
});

test('bootstrap migrates a completed chapter-two v2 cloud save to constant-size v3', () => {
  const payload = createBootstrapPayload({
    progress: {
      schemaVersion: 2,
      revision: 60,
      currentLevel: 'level-060',
      highestUnlockedLevel: 'level-060',
      completedLevels: ['level-001', 'level-060'],
      bestMoves: { 'level-060': 41 },
      configVersion: 'chapters-1-2.2026-08-29.1',
    },
    configVersion: VERSION,
    serverTime: 2,
  });
  assert.deepEqual(payload.progress, {
    schemaVersion: 3,
    revision: 60,
    currentLevel: 'level-060',
    completedThrough: 60,
    bestMoves: { 'level-060': 41 },
    configVersion: 'chapters-1-2.2026-08-29.1',
  });
});

test('reward requests accept published levels 1 and 270 but reject level 271', () => {
  assert.deepEqual(validateRewardRequest({ levelId: 'level-001', claimId: 'claim_12345678' }), {
    levelId: 'level-001', claimId: 'claim_12345678',
  });
  assert.deepEqual(validateRewardRequest({ levelId: 'level-270', claimId: 'claim_87654321' }), {
    levelId: 'level-270', claimId: 'claim_87654321',
  });
  assert.throws(() => validateRewardRequest({ levelId: 'level-271', claimId: 'claim_12345678' }));
  assert.throws(() => validateRewardRequest({ levelId: 'level-001', claimId: 'x'.repeat(129) }));
});

test('completion telemetry accepts only published levels and strips identity fields', () => {
  const result = normalizeLevelResult({
    levelId: 'level-270', moves: 28, durationMs: 45_000, undoCount: 2,
    rewardedBottleUsed: true, openid: 'attacker', extra: 'drop-me',
  });
  assert.deepEqual(result, {
    levelId: 'level-270', moves: 28, durationMs: 45_000, undoCount: 2, rewardedBottleUsed: true,
  });
  assert.throws(() => normalizeLevelResult({
    levelId: 'level-271', moves: 1, durationMs: 1, undoCount: 0,
  }));
});
