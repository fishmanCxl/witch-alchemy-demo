import test from 'node:test';
import assert from 'node:assert/strict';

import {
  completePendingBottles,
  createGameSession,
  grantRewardBottle,
  isSessionComplete,
  pressBottle,
  restartSession,
  undoSession,
} from '../assets/scripts/core/game-session.ts';
import { getLevelConfig } from '../assets/scripts/core/level-catalog.ts';
import { solveLevel } from '../tools/level-solver.ts';

function pourFromTo(
  session: ReturnType<typeof createGameSession>,
  from: number,
  to: number,
): ReturnType<typeof createGameSession> {
  return pressBottle(pressBottle(session, from).session, to).session;
}

test('level 1 completes only after a full potion is created and vanished', () => {
  const level = getLevelConfig('level-001')!;
  let session = createGameSession(level);

  session = pourFromTo(session, 0, 2);
  assert.equal(session.game.moves, 1);
  assert.equal(session.levelComplete, false);
  assert.equal(isSessionComplete(session), false);
  assert.deepEqual(session.pendingCompletion, []);

  session = pourFromTo(session, 2, 1);
  assert.equal(session.levelComplete, false);
  assert.deepEqual(session.pendingCompletion, [1]);

  const completed = completePendingBottles(session);

  assert.equal(completed.levelId, 'level-001');
  assert.equal(completed.levelComplete, true);
  assert.equal(isSessionComplete(completed), true);
  assert.deepEqual(completed.pendingCompletion, []);
});

for (const levelId of ['level-002', 'level-003'] as const) {
  test(`${levelId} completes only after every configured color vanishes`, () => {
    const level = getLevelConfig(levelId)!;
    if (level.completionRule.type !== 'all-colors') {
      assert.fail(`${levelId} must use the all-colors completion rule`);
    }
    const solution = solveLevel(level.initialState, {
      completionRule: level.completionRule,
      maxExploredStates: 250_000,
    });
    assert.equal(solution.solved, true);

    let session = createGameSession(level);
    let sawPartialVanish = false;
    for (const move of solution.moves) {
      session = pourFromTo(session, move.from, move.to);
      if (session.pendingCompletion.length === 0) continue;
      session = completePendingBottles(session);
      const vanished = session.game.bottles.filter((bottle) => bottle.status === 'vanished').length;
      const complete = vanished === level.completionRule.targetCount;
      assert.equal(session.levelComplete, complete);
      assert.equal(isSessionComplete(session), complete);
      if (vanished > 0 && !complete) sawPartialVanish = true;
    }

    assert.equal(sawPartialVanish, true);
    assert.equal(session.levelComplete, true);
    assert.equal(session.game.bottles.filter((bottle) => bottle.status === 'vanished').length,
      level.completionRule.targetCount);
  });
}

test('completed sessions reject bottle, undo, restart, and reward input', () => {
  const level = getLevelConfig('level-001')!;
  const completed = completePendingBottles(pourFromTo(createGameSession(level), 0, 1));

  assert.equal(pressBottle(completed, 2).session, completed);
  assert.equal(undoSession(completed).session, completed);
  assert.equal(restartSession(completed).session, completed);
  assert.equal(grantRewardBottle(completed).session, completed);
});

test('restart restores the bound level and preserves an earned reward bottle', () => {
  const level = getLevelConfig('level-004')!;
  const rewarded = grantRewardBottle(createGameSession(level)).session;
  const moved = pourFromTo(rewarded, 0, 3);
  const restarted = restartSession(moved).session;

  assert.equal(restarted.levelId, 'level-004');
  assert.deepEqual(restarted.initialState, level.initialState);
  assert.equal(restarted.game.bottles[14].status, 'active');
  assert.equal(restarted.game.rewardBottleUsed, true);
  assert.equal(restarted.game.moves, 0);
  assert.deepEqual(restarted.history, []);
  assert.equal(restarted.levelComplete, false);
});

