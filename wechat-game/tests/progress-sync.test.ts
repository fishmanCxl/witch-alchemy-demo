import test from 'node:test';
import assert from 'node:assert/strict';

import { completeLevel, createDefaultProgress } from '../assets/scripts/core/level-progress.ts';
import {
  ProgressSyncCoordinator,
  applyProgressSyncResult,
  type ProgressSyncPort,
} from '../assets/scripts/platform/progress-sync.ts';

test('offline progress and telemetry skip the cloud port without mutating local progress', async () => {
  let syncCalls = 0;
  let resultCalls = 0;
  const port: ProgressSyncPort = {
    sync: async () => { syncCalls += 1; return null; },
    submitLevelResult: async () => { resultCalls += 1; },
  };
  const coordinator = new ProgressSyncCoordinator(port);
  const local = createDefaultProgress();

  assert.deepEqual(await coordinator.sync(local, false), { status: 'offline', progress: local });
  assert.equal(await coordinator.submitLevelResult({
    levelId: 'level-001', moves: 1, durationMs: 1000, undoCount: 0, rewardedBottleUsed: false,
  }, false), 'offline');
  assert.equal(syncCalls, 0);
  assert.equal(resultCalls, 0);
});

test('concurrent sync calls coalesce into one cloud request', async () => {
  let release!: (value: unknown) => void;
  let calls = 0;
  const gate = new Promise<unknown>((resolve) => { release = resolve; });
  const coordinator = new ProgressSyncCoordinator({
    sync: async () => { calls += 1; return gate; },
    submitLevelResult: async () => undefined,
  });
  const local = createDefaultProgress();
  const first = coordinator.sync(local, true);
  const second = coordinator.sync(local, true);

  assert.equal(first, second);
  release(local);
  assert.equal((await first).status, 'synced');
  assert.equal(calls, 1);
});

test('remote progress is validated before legal union and minimum merge', async () => {
  const local = completeLevel(createDefaultProgress(), 'level-001', 8)!;
  const remote = {
    ...local,
    revision: 5,
    currentLevel: 'level-003',
    completedThrough: 2,
    bestMoves: { 'level-001': 5, 'level-002': 9 },
  };
  const coordinator = new ProgressSyncCoordinator({
    sync: async () => remote,
    submitLevelResult: async () => undefined,
  });

  const result = await coordinator.sync(local, true);
  assert.equal(result.status, 'synced');
  assert.equal(result.progress.revision, 6);
  assert.equal(result.progress.currentLevel, 'level-003');
  assert.equal(result.progress.completedThrough, 2);
  assert.deepEqual(result.progress.bestMoves, { 'level-001': 5, 'level-002': 9 });
});

test('malformed remote data and cloud failures preserve the exact local object', async () => {
  const local = createDefaultProgress();
  const invalid = new ProgressSyncCoordinator({
    sync: async () => ({ ...local, completedThrough: 241 }),
    submitLevelResult: async () => undefined,
  });
  const failing = new ProgressSyncCoordinator({
    sync: async () => { throw new Error('offline'); },
    submitLevelResult: async () => { throw new Error('offline'); },
  });

  assert.deepEqual(await invalid.sync(local, true), { status: 'invalid', progress: local });
  const failed = await failing.sync(local, true);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.progress, local);
  assert.equal(await failing.submitLevelResult({
    levelId: 'level-001', moves: 1, durationMs: 1, undoCount: 0, rewardedBottleUsed: false,
  }, true), 'failed');
});

test('a failed request releases the coalescing lock so the next call can retry', async () => {
  let calls = 0;
  const local = createDefaultProgress();
  const coordinator = new ProgressSyncCoordinator({
    sync: async () => {
      calls += 1;
      if (calls === 1) throw new Error('first failure');
      return local;
    },
    submitLevelResult: async () => undefined,
  });

  assert.equal((await coordinator.sync(local, true)).status, 'failed');
  assert.equal((await coordinator.sync(local, true)).status, 'synced');
  assert.equal(calls, 2);
});

test('a stale cloud sync result cannot erase newer local completions', () => {
  let current = createDefaultProgress();
  for (let level = 1; level <= 5; level += 1) {
    current = completeLevel(current, `level-${String(level).padStart(3, '0')}`, 8)!;
  }
  const stale = createDefaultProgress();
  const applied = applyProgressSyncResult(current, { status: 'synced', progress: stale });

  assert.equal(applied.completedThrough, 5);
});
