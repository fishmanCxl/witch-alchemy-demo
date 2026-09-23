import test from 'node:test';
import assert from 'node:assert/strict';

import {
  claimDailyReward,
  completeDailyCommission,
  createDailyCommission,
  dailyDateKey,
  decodeDailyCommission,
  encodeDailyCommission,
  reconcileDailyCommission,
} from '../assets/scripts/core/daily-commission.ts';

const DAY_ONE = new Date('2026-09-09T12:00:00+08:00').getTime();
const DAY_TWO = new Date('2026-09-10T12:00:00+08:00').getTime();
const DAY_FOUR = new Date('2026-09-12T12:00:00+08:00').getTime();

test('daily commission unlocks at five completions and excludes the tutorial', () => {
  assert.equal(dailyDateKey(DAY_ONE), '2026-09-09');
  assert.equal(createDailyCommission(DAY_ONE, 4).levelId, null);
  assert.equal(createDailyCommission(DAY_ONE, 5).levelId, 'level-003');
});

test('same-day commission stays fixed while a new day resets the challenge', () => {
  const first = createDailyCommission(DAY_ONE, 5);
  const progressed = reconcileDailyCommission(first, DAY_ONE + 60_000, 80);
  const nextDay = reconcileDailyCommission(first, DAY_TWO, 5);

  assert.equal(progressed, first);
  assert.deepEqual(nextDay, {
    schemaVersion: 1,
    date: '2026-09-10',
    levelId: 'level-004',
    bestMoves: null,
    completed: false,
    rewardClaimed: false,
    streak: 0,
    lastCompletedDate: null,
  });
});

test('completion tracks daily best, streak, and an idempotent reward claim', () => {
  const dayOne = completeDailyCommission(createDailyCommission(DAY_ONE, 5), 18)!;
  const repeated = completeDailyCommission(dayOne, 15)!;
  const claimed = claimDailyReward(repeated, DAY_ONE)!;

  assert.equal(dayOne.streak, 1);
  assert.equal(repeated.streak, 1);
  assert.equal(repeated.bestMoves, 15);
  assert.equal(claimDailyReward(claimed, DAY_ONE), claimed);

  const dayTwo = completeDailyCommission(reconcileDailyCommission(claimed, DAY_TWO, 5), 14)!;
  assert.equal(dayTwo.streak, 2);
  const dayFour = completeDailyCommission(reconcileDailyCommission(dayTwo, DAY_FOUR, 5), 13)!;
  assert.equal(dayFour.streak, 1);
});

test('an unclaimed daily reward expires when the local date changes', () => {
  const pending = completeDailyCommission(createDailyCommission(DAY_ONE, 5), 18)!;
  const nextDay = reconcileDailyCommission(pending, DAY_TWO, 5);

  assert.equal(claimDailyReward(pending, DAY_TWO), null);
  assert.equal(nextDay.completed, false);
  assert.equal(nextDay.rewardClaimed, false);
  assert.equal(nextDay.bestMoves, null);
});

test('daily state codec rejects malformed records without affecting the caller', () => {
  const state = completeDailyCommission(createDailyCommission(DAY_ONE, 5), 18)!;
  assert.deepEqual(decodeDailyCommission(encodeDailyCommission(state)), state);
  assert.equal(decodeDailyCommission('{bad'), null);
  assert.equal(decodeDailyCommission(JSON.stringify({ ...state, rewardClaimed: true, completed: false })), null);
});
