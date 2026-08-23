import test from 'node:test';
import assert from 'node:assert/strict';

import {
  completePendingBottles,
  createGameSession,
  grantRewardBottle,
  pressBottle,
  restartSession,
  undoSession,
} from '../assets/scripts/core/game-session.ts';
import { createDemoState } from '../assets/scripts/core/demo-level.ts';
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

test('invalid starts and targets return an oops state without adding history', () => {
  const emptyStart = pressBottle(createGameSession(DEMO_LEVEL_CONFIG), 9);
  assert.equal(emptyStart.session.witchMood, 'oops');
  assert.equal(emptyStart.session.message, '空瓶不能作为起点');
  assert.equal(emptyStart.cue, 'pour-invalid');

  const selected = pressBottle(createGameSession(DEMO_LEVEL_CONFIG), 0).session;
  const invalidTarget = pressBottle(selected, 2);
  assert.equal(invalidTarget.session.witchMood, 'oops');
  assert.deepEqual(invalidTarget.invalid, [0, 2]);
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

test('reward bottle activates the reserved fifteenth slot once', () => {
  const first = grantRewardBottle(createGameSession(DEMO_LEVEL_CONFIG));
  assert.equal(first.session.game.bottles[14]?.status, 'active');
  assert.equal(first.cue, 'reward-empty-bottle');

  const second = grantRewardBottle(first.session);
  assert.equal(second.session, first.session);
  assert.equal(second.cue, null);
});
