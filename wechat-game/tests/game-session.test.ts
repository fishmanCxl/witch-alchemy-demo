import test from 'node:test';
import assert from 'node:assert/strict';

import {
  completePendingBottles,
  createGameSession,
  grantRewardBottle,
  pressBottle,
  refillRestartAllowance,
  refillUndoAllowance,
  restartSession,
  undoSession,
} from '../assets/scripts/core/game-session.ts';
import { createDemoState } from '../assets/scripts/core/demo-level.ts';
import { getLevelConfig } from '../assets/scripts/core/level-catalog.ts';
import { solveLevel } from '../tools/level-solver.ts';
import { DEMO_LEVEL_CONFIG } from '../assets/scripts/core/level-config.ts';

test('selecting a filled bottle prepares the witch and preserves the board', () => {
  const initial = createGameSession(DEMO_LEVEL_CONFIG);
  const result = pressBottle(initial, 0);

  assert.equal(result.session.selected, 0);
  assert.equal(result.session.witchMood, 'prepare');
  assert.equal(result.session.message, '法杖已锁定，再点目标瓶');
  assert.equal(result.cue, 'bottle-select');
  assert.equal(result.session.game, initial.game);
});

test('a valid pour records history and queues a completed bottle for departure', () => {
  const selected = pressBottle(createGameSession(DEMO_LEVEL_CONFIG), 0).session;
  const result = pressBottle(selected, 1);

  assert.equal(result.session.game.moves, 1);
  assert.equal(result.session.history.length, 1);
  assert.deepEqual(result.session.pendingCompletion, [1]);
  assert.equal(result.session.witchMood, 'celebrate');
  assert.equal(result.cue, 'potion-complete');
  assert.equal(result.session.game.bottles[1]?.status, 'active');

  const completed = completePendingBottles(result.session);
  assert.equal(completed.game.bottles[1]?.status, 'vanished');
  assert.deepEqual(completed.pendingCompletion, []);
});

test('other bottles remain fully interactive while a completed bottle departs', () => {
  let session = createGameSession(DEMO_LEVEL_CONFIG);
  session = pressBottle(session, 0).session;
  session = pressBottle(session, 1).session;
  assert.deepEqual(session.pendingCompletion, [1]);

  const selected = pressBottle(session, 2);
  const poured = pressBottle(selected.session, 9);

  assert.equal(selected.session.selected, 2);
  assert.equal(poured.session.game.moves, 2);
  assert.deepEqual(poured.session.pendingCompletion, [1]);
  assert.deepEqual(poured.pouring, [2, 9]);
});

test('the completed bottle itself cannot be selected while it departs', () => {
  let session = createGameSession(DEMO_LEVEL_CONFIG);
  session = pressBottle(session, 0).session;
  session = pressBottle(session, 1).session;

  const result = pressBottle(session, 1);

  assert.equal(result.session, session);
  assert.equal(result.cue, null);
});

test('invalid starts and targets return an oops state without adding history', () => {
  const emptyStart = pressBottle(createGameSession(DEMO_LEVEL_CONFIG), 9);
  assert.equal(emptyStart.session.witchMood, 'oops');
  assert.equal(emptyStart.session.message, '空瓶不能作为起点');
  assert.equal(emptyStart.cue, 'pour-invalid');

  const selected = pressBottle(createGameSession(DEMO_LEVEL_CONFIG), 0).session;
  const invalidTarget = pressBottle(selected, 2);
  assert.equal(invalidTarget.session.witchMood, 'oops');
  assert.deepEqual(invalidTarget.invalid, [0, 2]);
  assert.equal(invalidTarget.session.selected, 2);
  assert.equal(invalidTarget.session.history.length, 0);
});

test('undo and restart restore stable gameplay state', () => {
  const selected = pressBottle(createGameSession(DEMO_LEVEL_CONFIG), 0).session;
  const poured = pressBottle(selected, 9).session;
  const undone = undoSession(poured);

  assert.deepEqual(undone.session.game, createDemoState());
  assert.equal(undone.session.history.length, 0);
  assert.equal(undone.cue, 'undo');

  const restarted = restartSession(poured);
  assert.deepEqual(restarted.session.game, createDemoState());
  assert.equal(restarted.session.message, '关卡已重新开始');
});

test('undo allows three successful uses and a rewarded refill immediately serves the pending undo', () => {
  let session = createGameSession(DEMO_LEVEL_CONFIG);
  for (const remaining of [2, 1, 0]) {
    session = pressBottle(session, 0).session;
    session = pressBottle(session, 9).session;
    const undone = undoSession(session);
    assert.equal(undone.cue, 'undo');
    assert.equal(undone.session.undoRemaining, remaining);
    session = undone.session;
  }

  session = pressBottle(session, 0).session;
  session = pressBottle(session, 9).session;
  const blocked = undoSession(session);
  assert.equal(blocked.session, session);
  assert.equal(blocked.cue, null);

  const rewarded = undoSession(refillUndoAllowance(session));
  assert.equal(rewarded.cue, 'undo');
  assert.equal(rewarded.session.undoRemaining, 2);
});

test('restart allows one use, does not refill undo, and rewarded refill immediately restarts', () => {
  const initial = createGameSession(DEMO_LEVEL_CONFIG);
  const first = restartSession(initial);
  assert.equal(first.cue, 'restart');
  assert.equal(first.session.restartRemaining, 0);
  assert.equal(first.session.undoRemaining, 3);

  const blocked = restartSession(first.session);
  assert.equal(blocked.session, first.session);
  assert.equal(blocked.cue, null);

  const rewarded = restartSession(refillRestartAllowance(first.session));
  assert.equal(rewarded.cue, 'restart');
  assert.equal(rewarded.session.restartRemaining, 0);
  assert.equal(rewarded.session.undoRemaining, 3);
});

test('reward bottle activates the reserved fifteenth slot once', () => {
  const first = grantRewardBottle(createGameSession(DEMO_LEVEL_CONFIG));
  assert.equal(first.session.game.bottles[14]?.status, 'active');
  assert.equal(first.cue, 'reward-empty-bottle');

  const second = grantRewardBottle(first.session);
  assert.equal(second.session, first.session);
  assert.equal(second.cue, null);
});
test('level two waits for every color to vanish before completing', () => {
  const level = getLevelConfig('level-002');
  assert.ok(level);
  assert.equal(level.completionRule.type, 'all-colors');
  const solution = solveLevel(level.initialState, {
    completionRule: level.completionRule,
    maxExploredStates: 250_000,
  });
  assert.equal(solution.solved, true);

  let session = createGameSession(level);
  let sawFirstVanish = false;
  for (const move of solution.moves) {
    session = pressBottle(session, move.from).session;
    session = pressBottle(session, move.to).session;
    if (session.pendingCompletion.length === 0) continue;
    session = completePendingBottles(session);
    const vanished = session.game.bottles.filter((bottle) => bottle.status === 'vanished').length;
    if (!sawFirstVanish && vanished > 0) {
      sawFirstVanish = true;
      assert.equal(session.levelComplete, vanished === level.metrics.colorCount);
    }
  }

  assert.equal(sawFirstVanish, true);
  assert.equal(session.levelComplete, true);
});
