import test from 'node:test';
import assert from 'node:assert/strict';

import {
  completeEndlessStage,
  createEndlessState,
  decodeEndlessState,
  encodeEndlessState,
  endlessAllowedMoves,
  endlessLevelIds,
  endEndlessRun,
  evaluateEndlessSession,
  failEndlessRun,
  retryEndlessStage,
  restoreEndlessSession,
  saveEndlessSession,
  startEndlessRun,
} from '../assets/scripts/core/endless-mode.ts';
import { createGameSession, grantRewardBottle, pressBottle } from '../assets/scripts/core/game-session.ts';
import { getLevelConfig, PUBLISHED_LEVELS } from '../assets/scripts/core/level-catalog.ts';
import { createLocalSnapshot, decodeLocalSnapshot } from '../assets/scripts/core/save-schema.ts';

test('endless pool shuffles only adjacent five-level windows within chapters', () => {
  const first = endlessLevelIds(20);
  const second = endlessLevelIds(20);

  assert.deepEqual(first, second);
  assert.equal(first.includes('level-001'), false);
  assert.equal(first.length, PUBLISHED_LEVELS.length - 1);
  assert.equal(new Set(first).size, first.length);
  assert.deepEqual(new Set(first.slice(0, 5)), new Set(['level-002', 'level-003', 'level-004', 'level-005', 'level-006']));
  assert.deepEqual(new Set(first.slice(5, 10)), new Set(['level-007', 'level-008', 'level-009', 'level-010', 'level-011']));
  assert.deepEqual(new Set(first.slice(25, 29)), new Set(['level-027', 'level-028', 'level-029', 'level-030']));
  assert.deepEqual(new Set(first.slice(29, 34)), new Set(['level-031', 'level-032', 'level-033', 'level-034', 'level-035']));
});

test('endless allowance tightens as the streak rises', () => {
  assert.equal(endlessAllowedMoves(20, 0), 25);
  assert.equal(endlessAllowedMoves(20, 6), 24);
  assert.equal(endlessAllowedMoves(20, 16), 24);
});

test('completion on the final move wins before the zero-step failure check', () => {
  const level = getLevelConfig('level-002')!;
  const session = createGameSession(level);
  const final = {
    ...session,
    levelComplete: true,
    game: { ...session.game, moves: endlessAllowedMoves(level.metrics.optimalMoves, 0) },
  };

  assert.equal(evaluateEndlessSession(final, final.game.moves), 'complete');
});

test('an unfinished session fails at its move limit or when no legal pour remains', () => {
  const level = getLevelConfig('level-002')!;
  const session = createGameSession(level);
  const atLimit = {
    ...session,
    game: { ...session.game, moves: endlessAllowedMoves(level.metrics.optimalMoves, 0) },
  };
  const deadEnd = {
    ...session,
    game: {
      ...session.game,
      bottles: session.game.bottles.map((bottle, index) => index === 14
        ? { layers: [], status: 'reserved' as const }
        : { layers: ['rose', 'violet', 'amber', 'cyan'] as const, status: 'active' as const }),
    },
  };

  assert.equal(evaluateEndlessSession(atLimit, atLimit.game.moves), 'failed');
  assert.equal(evaluateEndlessSession(deadEnd, 99), 'failed');
});

test('one ad retry resets the same stage while a second retry is rejected', () => {
  const active = startEndlessRun(createEndlessState(), 1234, 100);
  const failed = failEndlessRun(active);
  const retried = retryEndlessStage(failed, 200);

  assert.equal(retried.run?.levelId, active.run?.levelId);
  assert.equal(retried.run?.snapshot.state.moves, 0);
  assert.equal(retried.run?.streak, active.run?.streak);
  assert.equal(retried.run?.reviveUsed, true);
  assert.equal(retried.run?.failed, false);

  const failedAgain = failEndlessRun(retried);
  assert.equal(retryEndlessStage(failedAgain, 300), failedAgain);
});

test('completion advances the endless stage and ending a failed run preserves only the best streak', () => {
  const active = startEndlessRun(createEndlessState(2), 1234, 100);
  const next = completeEndlessStage(active, 200);

  assert.equal(next.run?.stage, 2);
  assert.equal(next.run?.streak, 1);
  assert.equal(next.run?.reviveUsed, false);
  assert.notEqual(next.run?.levelId, active.run?.levelId);
  assert.equal(endEndlessRun(failEndlessRun(next)).run, null);
  assert.equal(endEndlessRun(failEndlessRun(next)).bestStreak, 2);
});

test('stable endless state round-trips without using a main level snapshot key', () => {
  const started = startEndlessRun(createEndlessState(), 1234, 100);
  const level = getLevelConfig(started.run!.levelId)!;
  const selected = pressBottle(createGameSession(level), 0).session;
  const saved = saveEndlessSession(started, selected, 200);

  assert.deepEqual(decodeEndlessState(encodeEndlessState(saved)), saved);
  assert.deepEqual(decodeEndlessState('{bad'), createEndlessState());
});

test('new endless runs advance from the first five-level window to the next', () => {
  let state = startEndlessRun(createEndlessState(), 20, 100);
  assert.ok(Number(state.run?.levelId.slice(-3)) >= 2 && Number(state.run?.levelId.slice(-3)) <= 6);
  for (let stage = 1; stage <= 5; stage += 1) state = completeEndlessStage(state, 100 + stage);
  assert.equal(state.run?.stage, 6);
  assert.ok(Number(state.run?.levelId.slice(-3)) >= 7 && Number(state.run?.levelId.slice(-3)) <= 11);
});

test('legacy endless saves keep their chapter order across restore and completion', () => {
  const level = getLevelConfig('level-027')!;
  const legacy = {
    schemaVersion: 1 as const,
    bestStreak: 4,
    run: {
      seed: 20, cycle: 0, stage: 1, streak: 0, levelId: level.id,
      allowedMoves: endlessAllowedMoves(level.metrics.optimalMoves, 0),
      reviveUsed: false, failed: false,
      snapshot: createLocalSnapshot({
        levelId: level.id, configVersion: level.configVersion, revision: 0,
        state: level.initialState, history: [], selected: null, updatedAt: 100,
      }),
    },
  };
  const restored = decodeEndlessState(encodeEndlessState(legacy));
  assert.equal(restored.run?.levelId, 'level-027');
  assert.equal(restored.bestStreak, 4);
  const next = completeEndlessStage(restored, 200);
  assert.equal(next.run?.levelId, 'level-012');
  assert.equal(decodeEndlessState(encodeEndlessState(next)).run?.levelId, 'level-012');
});

test('endless snapshots preserve shared controls and the rewarded empty bottle', () => {
  const started = startEndlessRun(createEndlessState(), 1234, 100);
  const level = getLevelConfig(started.run!.levelId)!;
  const withBottle = grantRewardBottle(createGameSession(level)).session;
  const session = { ...withBottle, undoRemaining: 2, restartRemaining: 0 };
  const saved = saveEndlessSession(started, session, 200);
  const restored = restoreEndlessSession(decodeEndlessState(encodeEndlessState(saved)))!;

  assert.deepEqual(restored.game, session.game);
  assert.deepEqual(restored.history, session.history);
  assert.equal(restored.undoRemaining, 2);
  assert.equal(restored.restartRemaining, 0);
  assert.equal(restored.game.rewardBottleUsed, true);
});

test('saved snapshots accept every potion color used by published chapters', () => {
  const level = getLevelConfig('level-121')!;
  const snapshot = createLocalSnapshot({
    levelId: level.id,
    configVersion: level.configVersion,
    revision: 0,
    state: level.initialState,
    history: [],
    selected: null,
    updatedAt: 100,
  });

  assert.notEqual(decodeLocalSnapshot(JSON.stringify(snapshot), level), null);
});
