import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beginLaunchExit,
  canExitLaunch,
  completeLaunchResources,
  createLaunchLoadingState,
  failLaunchResources,
  markLaunchMinimumVisible,
  retryLaunch,
  updateLaunchProgress,
} from '../assets/scripts/presentation/launch-loading.ts';

test('launch progress clamps invalid values, never regresses, and reserves 100 for completion', () => {
  let state = createLaunchLoadingState(1_000);
  assert.deepEqual([state.progress, state.percent], [0, 0]);
  state = updateLaunchProgress(state, 1, 3, 10);
  assert.deepEqual([state.progress, state.percent], [0.3, 30]);
  state = updateLaunchProgress(state, 1, 2, 10);
  assert.deepEqual([state.progress, state.percent], [0.3, 30]);
  state = updateLaunchProgress(state, 1, 99, 10);
  assert.deepEqual([state.progress, state.percent], [1, 99]);
  state = updateLaunchProgress(state, 1, Number.NaN, Number.POSITIVE_INFINITY);
  assert.deepEqual([state.progress, state.percent], [1, 99]);
  state = completeLaunchResources(state, 1);
  assert.deepEqual([state.progress, state.percent, state.resourcesReady], [1, 100, true]);
});

test('launch exits only after resources and the 900ms minimum are both ready', () => {
  let state = createLaunchLoadingState(1_000);
  state = completeLaunchResources(state, 1);
  assert.equal(canExitLaunch(state), false);
  state = markLaunchMinimumVisible(state, 1_899);
  assert.equal(canExitLaunch(state), false);
  state = markLaunchMinimumVisible(state, 1_900);
  assert.equal(state.phase, 'ready');
  assert.equal(canExitLaunch(state), true);
  state = beginLaunchExit(state);
  assert.equal(state.phase, 'exiting');
  assert.equal(canExitLaunch(state), false);
});

test('failed launch retries once and ignores stale callbacks', () => {
  let state = createLaunchLoadingState(1_000);
  state = failLaunchResources(state, 1, 'broken');
  assert.deepEqual([state.phase, state.errorMessage], ['failed', 'broken']);
  assert.equal(canExitLaunch(state), false);

  state = retryLaunch(state);
  assert.deepEqual([state.attempt, state.phase, state.progress, state.percent], [2, 'loading', 0, 0]);
  const sameRetry = retryLaunch(state);
  assert.equal(sameRetry, state);

  const staleProgress = updateLaunchProgress(state, 1, 9, 10);
  const staleComplete = completeLaunchResources(state, 1);
  assert.equal(staleProgress, state);
  assert.equal(staleComplete, state);

  state = markLaunchMinimumVisible(state, 1_900);
  state = completeLaunchResources(state, 2);
  assert.equal(state.phase, 'ready');
  const duplicateComplete = completeLaunchResources(state, 2);
  assert.equal(duplicateComplete, state);
});

test('zero and negative totals stay at zero before completion', () => {
  let state = createLaunchLoadingState(0);
  state = updateLaunchProgress(state, 1, 0, 0);
  assert.deepEqual([state.progress, state.percent], [0, 0]);
  state = updateLaunchProgress(state, 1, 4, -1);
  assert.deepEqual([state.progress, state.percent], [0, 0]);
});
