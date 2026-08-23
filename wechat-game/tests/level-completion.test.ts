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

function pourFromTo(
  session: ReturnType<typeof createGameSession>,
  from: number,
  to: number,
): ReturnType<typeof createGameSession> {
  return pressBottle(pressBottle(session, from).session, to).session;
}

test('level 1 completes after its first valid pour result is produced', () => {
  const level = getLevelConfig('level-001')!;
  const initial = createGameSession(level);
  const completed = pourFromTo(initial, 0, 1);

  assert.equal(completed.levelId, 'level-001');
  assert.equal(completed.levelComplete, true);
  assert.equal(isSessionComplete(completed), true);
  assert.deepEqual(completed.pendingCompletion, [1]);
});

test('level 2 completes only after its first finished bottle vanishes', () => {
  const level = getLevelConfig('level-002')!;
  const poured = pourFromTo(createGameSession(level), 0, 1);

  assert.equal(poured.levelComplete, false);
  assert.deepEqual(poured.pendingCompletion, [1]);
  const vanished = completePendingBottles(poured);
  assert.equal(vanished.game.bottles[1].status, 'vanished');
  assert.equal(vanished.levelComplete, true);
});

test('ordinary levels complete only after every configured target color vanishes', () => {
  const level = getLevelConfig('level-003')!;
  const roseComplete = completePendingBottles(pourFromTo(createGameSession(level), 0, 1));
  assert.equal(roseComplete.levelComplete, false);

  const amberPoured = pourFromTo(roseComplete, 2, 3);
  assert.equal(amberPoured.levelComplete, false);
  const completed = completePendingBottles(amberPoured);
  assert.equal(completed.levelComplete, true);
  assert.equal(completed.game.bottles.filter((bottle) => bottle.status === 'vanished').length, 2);
});

test('completed sessions reject bottle, undo, restart, and reward input', () => {
  const level = getLevelConfig('level-001')!;
  const completed = pourFromTo(createGameSession(level), 0, 1);

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

