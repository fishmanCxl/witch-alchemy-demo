import test from 'node:test';
import assert from 'node:assert/strict';

import { RewardedBottleCoordinator } from '../assets/scripts/platform/rewarded-bottle.ts';

test('reward is unavailable offline without opening the ad', async () => {
  let shows = 0;
  let claims = 0;
  const coordinator = new RewardedBottleCoordinator(
    { show: async () => { shows += 1; return 'completed'; } },
    { claim: async () => { claims += 1; return 'granted'; } },
  );

  assert.deepEqual(await coordinator.run('level-012', 'claim-1', false), { status: 'offline', activateBottle: false });
  assert.equal(shows, 0);
  assert.equal(claims, 0);
});

test('cancelled or failed ads never request a cloud reward', async () => {
  let claims = 0;
  const claim = { claim: async () => { claims += 1; return 'granted' as const; } };

  const cancelled = new RewardedBottleCoordinator({ show: async () => 'cancelled' }, claim);
  const failed = new RewardedBottleCoordinator({ show: async () => 'failed' }, claim);
  assert.equal((await cancelled.run('level-012', 'claim-2', true)).activateBottle, false);
  assert.equal((await failed.run('level-012', 'claim-3', true)).activateBottle, false);
  assert.equal(claims, 0);
});

test('a completed ad activates only after an authoritative cloud grant', async () => {
  const seen: string[] = [];
  const coordinator = new RewardedBottleCoordinator(
    { show: async () => { seen.push('ad'); return 'completed'; } },
    { claim: async (levelId, claimId) => { seen.push(`${levelId}:${claimId}`); return 'granted'; } },
  );

  assert.deepEqual(await coordinator.run('level-012', 'claim-4', true), { status: 'granted', activateBottle: true });
  assert.deepEqual(seen, ['ad', 'level-012:claim-4']);
});

test('already-granted recovery activates locally while rejected claims do not', async () => {
  const recovered = new RewardedBottleCoordinator(
    { show: async () => 'completed' },
    { claim: async () => 'alreadyGranted' },
  );
  const rejected = new RewardedBottleCoordinator(
    { show: async () => 'completed' },
    { claim: async () => 'rejected' },
  );

  assert.equal((await recovered.run('level-012', 'claim-5', true)).activateBottle, true);
  assert.equal((await rejected.run('level-012', 'claim-6', true)).activateBottle, false);
});

test('concurrent taps share no authority and only the first flow runs', async () => {
  let release!: () => void;
  let shows = 0;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const coordinator = new RewardedBottleCoordinator(
    { show: async () => { shows += 1; await gate; return 'completed'; } },
    { claim: async () => 'granted' },
  );

  const first = coordinator.run('level-012', 'claim-7', true);
  assert.deepEqual(await coordinator.run('level-012', 'claim-8', true), { status: 'busy', activateBottle: false });
  release();
  assert.equal((await first).activateBottle, true);
  assert.equal(shows, 1);
});
