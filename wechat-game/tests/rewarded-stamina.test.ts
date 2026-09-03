import test from 'node:test';
import assert from 'node:assert/strict';

import { RewardedStaminaCoordinator } from '../assets/scripts/platform/rewarded-stamina.ts';

test('stamina reward opens one online ad and reports its result', async () => {
  let shows = 0;
  const reward = new RewardedStaminaCoordinator({ show: async () => { shows += 1; return 'completed'; } });
  assert.equal(await reward.run(true), 'completed');
  assert.equal(shows, 1);
});

test('offline and concurrent stamina rewards never open a second ad', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const reward = new RewardedStaminaCoordinator({ show: async () => { await gate; return 'completed'; } });
  assert.equal(await reward.run(false), 'offline');
  const first = reward.run(true);
  assert.equal(await reward.run(true), 'busy');
  release();
  assert.equal(await first, 'completed');
});
