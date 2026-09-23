import test from 'node:test';
import assert from 'node:assert/strict';

import { createEndlessState, startEndlessRun } from '../assets/scripts/core/endless-mode.ts';
import {
  completePendingBottles,
  createGameSession,
  pressBottle,
  restartSession,
  undoSession,
} from '../assets/scripts/core/game-session.ts';
import { getLevelConfig, PUBLISHED_LEVELS } from '../assets/scripts/core/level-catalog.ts';
import { createDefaultProgress } from '../assets/scripts/core/level-progress.ts';
import { createLocalSnapshot } from '../assets/scripts/core/save-schema.ts';
import { LocalProgressStore } from '../assets/scripts/platform/LocalProgressStore.ts';
import { PlatformRuntime, REWARDED_AD_CONFIG } from '../assets/scripts/platform/WeChatPlatform.ts';
import type { RewardedAdResult } from '../assets/scripts/platform/rewarded-bottle.ts';
import type { KeyValueStorage } from '../assets/scripts/platform/storage-port.ts';

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function selectFirstFilled(levelId: string) {
  const level = getLevelConfig(levelId)!;
  const session = createGameSession(level);
  const index = session.game.bottles.findIndex((bottle) => bottle.layers.length > 0);
  return pressBottle(session, index).session;
}

test('per-level session keys isolate stable state and restore selected bottles', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const level4 = getLevelConfig('level-004')!;
  const level5 = getLevelConfig('level-005')!;
  const selected4 = selectFirstFilled(level4.id);
  const selected5 = selectFirstFilled(level5.id);

  store.saveSession(selected4);
  store.saveSession(selected5);

  assert.equal(store.loadSession(level4).selected, selected4.selected);
  assert.equal(store.loadSession(level5).selected, selected5.selected);
  assert.equal(storage.values.has('witch-water-sort:session:level-004:v2'), true);
  assert.equal(storage.values.has('witch-water-sort:session:level-005:v2'), true);
});

test('per-level snapshots preserve remaining undo and restart uses', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const level = getLevelConfig('level-004')!;
  let session = createGameSession(level);
  const source = session.game.bottles.findIndex((bottle) => bottle.layers.length > 0);
  const target = session.game.bottles.findIndex((bottle) => bottle.layers.length === 0);
  session = pressBottle(session, source).session;
  session = pressBottle(session, target).session;
  session = undoSession(session).session;
  session = restartSession(session).session;

  store.saveSession(session);
  const restored = store.loadSession(level);

  assert.equal(restored.undoRemaining, 2);
  assert.equal(restored.restartRemaining, 0);
});

test('legacy v2 snapshots without allowances restore the full defaults', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const level = getLevelConfig('level-004')!;
  const snapshot = createLocalSnapshot({
    levelId: level.id,
    configVersion: level.configVersion,
    revision: 0,
    state: level.initialState,
    history: [],
    selected: null,
    updatedAt: 10,
  }) as ReturnType<typeof createLocalSnapshot> & { undoRemaining?: number; restartRemaining?: number };
  const { undoRemaining: _undo, restartRemaining: _restart, ...legacy } = snapshot;
  storage.setItem('witch-water-sort:session:level-004:v2', JSON.stringify(legacy));

  const restored = store.loadSession(level);

  assert.equal(restored.undoRemaining, 3);
  assert.equal(restored.restartRemaining, 1);
});

test('corrupt or config-mismatched snapshots fall back only to that level initial state', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const level4 = getLevelConfig('level-004')!;
  const level5 = getLevelConfig('level-005')!;
  storage.setItem('witch-water-sort:session:level-004:v2', '{bad json');
  const stale = createLocalSnapshot({
    levelId: level5.id,
    configVersion: 'stale-config',
    revision: 1,
    state: level5.initialState,
    history: [],
    selected: null,
    updatedAt: 10,
  });
  storage.setItem('witch-water-sort:session:level-005:v2', JSON.stringify(stale));

  assert.deepEqual(store.loadSession(level4).game, level4.initialState);
  assert.deepEqual(store.loadSession(level5).game, level5.initialState);
  assert.equal(store.loadSession(level4).levelId, level4.id);
  assert.equal(store.loadSession(level5).levelId, level5.id);
});

test('an existing level 12 v2 snapshot remains restorable after the catalog expands', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const level12 = getLevelConfig('level-012')!;
  const selected = selectFirstFilled(level12.id);
  const existingSnapshot = createLocalSnapshot({
    levelId: level12.id,
    configVersion: '2026.08.23.1',
    revision: selected.game.moves,
    state: selected.game,
    history: selected.history,
    selected: selected.selected,
    updatedAt: 100,
  });
  storage.setItem('witch-water-sort:session:level-012:v2', JSON.stringify(existingSnapshot));

  const restored = store.loadSession(level12);

  assert.equal(restored.selected, selected.selected);
  assert.deepEqual(restored.game, selected.game);
});

test('a changed level snapshot resets only itself and leaves long-term progress intact', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const level16 = getLevelConfig('level-016')!;
  const selected16 = selectFirstFilled(level16.id);
  const progress = {
    ...store.loadProgress(),
    revision: 18,
    currentLevel: level16.id,
    completedThrough: 15,
  } as const;
  const stale = createLocalSnapshot({
    levelId: level16.id,
    configVersion: 'chapter-1.2026-08-23.1',
    revision: 4,
    state: selected16.game,
    history: [],
    selected: selected16.selected,
    updatedAt: 100,
  });
  store.saveProgress(progress);
  storage.setItem('witch-water-sort:session:level-016:v2', JSON.stringify(stale));

  assert.deepEqual(store.loadSession(level16).game, level16.initialState);
  assert.equal(store.loadSession(level16).selected, null);
  assert.deepEqual(store.loadProgress(), progress);
});

test('pending and completed sessions never overwrite the last stable snapshot', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const level1 = getLevelConfig('level-001')!;
  const stable = selectFirstFilled(level1.id);
  store.saveSession(stable);

  const pending = pressBottle(stable, 1).session;
  assert.deepEqual(pending.pendingCompletion, [1]);
  assert.equal(pending.levelComplete, false);
  store.saveSession(pending);

  const completed = completePendingBottles(pending);
  assert.equal(completed.levelComplete, true);
  store.saveSession(completed);

  const restored = store.loadSession(level1);
  assert.equal(restored.selected, stable.selected);
  assert.equal(restored.levelComplete, false);
  assert.equal(restored.game.moves, 0);
});

test('global progress and sound preference round-trip independently', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const progress = {
    ...store.loadProgress(),
    revision: 3,
    currentLevel: 'level-003',
    completedThrough: 2,
    bestMoves: { 'level-001': 3, 'level-002': 5 },
  } as const;

  store.saveProgress(progress);
  store.saveSoundEnabled(false);

  assert.deepEqual(store.loadProgress(), progress);
  assert.equal(store.loadSoundEnabled(), false);
  store.clearSession('level-003');
  assert.equal(store.loadSoundEnabled(), false);
});

test('loading v2 progress backs it up and persists only normalized v3 fields', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const polluted = {
    schemaVersion: 2,
    revision: 9,
    currentLevel: 'level-003',
    highestUnlockedLevel: 'level-004',
    completedLevels: ['level-001', 'level-003'],
    bestMoves: { 'level-001': 5, 'level-003': 9 },
    configVersion: 'chapter-1.2026-08-23.1',
    collection: { revealedPieces: 2 },
    title: '不应持久化',
    arbitraryUnknown: true,
  } as const;

  storage.setItem('witch-water-sort:progress:v2', JSON.stringify(polluted));
  const loaded = store.loadProgress();
  const stored = JSON.parse(storage.getItem('witch-water-sort:progress:v2')!);
  const expected = {
    schemaVersion: 3,
    revision: 9,
    currentLevel: 'level-003',
    completedThrough: 3,
    bestMoves: { 'level-001': 5, 'level-003': 9 },
    configVersion: 'chapters-1-6.2026-09-19.1',
  };

  assert.deepEqual(stored, expected);
  assert.deepEqual(loaded, expected);
  assert.equal(storage.getItem('witch-water-sort:progress:v2-backup'), JSON.stringify(polluted));
});

test('startup migration also backs up an existing v2 progress record', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const legacyProgress = JSON.stringify({
    schemaVersion: 2,
    revision: 5,
    currentLevel: 'level-006',
    highestUnlockedLevel: 'level-006',
    completedLevels: [],
    bestMoves: {},
    configVersion: 'chapters-1-2.2026-08-29.1',
  });
  storage.setItem('witch-water-sort:progress:v2', legacyProgress);

  const migrated = store.migrateLegacyLevel12();

  assert.equal(migrated.completedThrough, 5);
  assert.equal(JSON.parse(storage.getItem('witch-water-sort:progress:v2')!).schemaVersion, 3);
  assert.equal(storage.getItem('witch-water-sort:progress:v2-backup'), legacyProgress);
});

test('valid legacy level-12 data migrates once without inventing earlier completions', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const level12 = getLevelConfig('level-012')!;
  const selected = selectFirstFilled(level12.id);
  const legacy = {
    ...createLocalSnapshot({
      levelId: level12.id,
      configVersion: level12.configVersion,
      revision: 7,
      state: selected.game,
      history: [level12.initialState],
      selected: selected.selected,
      updatedAt: 777,
    }),
    schemaVersion: 1,
  };
  const legacySerialized = JSON.stringify(legacy);
  storage.setItem('witch-water-sort:level-012:v1', legacySerialized);
  storage.setItem('witch-water-sort:sound-enabled', 'false');

  const migrated = store.migrateLegacyLevel12();
  const restored = store.loadSession(level12);

  assert.equal(migrated.currentLevel, 'level-012');
  assert.equal(migrated.completedThrough, 11);
  assert.deepEqual(migrated.bestMoves, {});
  assert.equal(restored.selected, selected.selected);
  assert.deepEqual(restored.history, [level12.initialState]);
  assert.equal(store.loadSoundEnabled(), false);
  assert.equal(storage.getItem('witch-water-sort:level-012:v1'), legacySerialized);
  assert.equal(storage.getItem('witch-water-sort:migration:level-012:v2'), 'done');

  const afterFirstMigration = store.loadProgress();
  store.migrateLegacyLevel12();
  assert.deepEqual(store.loadProgress(), afterFirstMigration);
});

test('invalid legacy data marks migration complete and keeps the new-player fallback', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  storage.setItem('witch-water-sort:level-012:v1', '{bad json');

  const progress = store.migrateLegacyLevel12();

  assert.equal(progress.currentLevel, 'level-001');
  assert.equal(progress.completedThrough, 0);
  assert.equal(storage.getItem('witch-water-sort:migration:level-012:v2'), 'done');
  assert.equal(storage.getItem('witch-water-sort:level-012:v1'), '{bad json');
});

test('QA all-level mode backs up progress once and reset restores it exactly', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const original = {
    ...store.loadProgress(),
    revision: 8,
    currentLevel: 'level-005',
    completedThrough: 5,
    bestMoves: { 'level-001': 4, 'level-003': 18, 'level-005': 31 },
  } as const;
  store.saveProgress(original);
  const serializedOriginal = storage.getItem('witch-water-sort:progress:v2');

  assert.equal(typeof store.enableQaAllLevels, 'function');
  const qaProgress = store.enableQaAllLevels();

  assert.equal(store.isQaMode(), true);
  assert.equal(qaProgress.currentLevel, 'level-180');
  assert.equal(qaProgress.completedThrough, PUBLISHED_LEVELS.length);

  store.enableQaAllLevels();
  const restored = store.resetQaMode();

  assert.equal(store.isQaMode(), false);
  assert.deepEqual(restored, original);
  assert.equal(storage.getItem('witch-water-sort:progress:v2'), serializedOriginal);
});

test('QA reset removes progress when the player had no progress before QA mode', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);

  assert.equal(storage.getItem('witch-water-sort:progress:v2'), null);
  store.enableQaAllLevels();
  const restored = store.resetQaMode();

  assert.equal(restored.currentLevel, 'level-001');
  assert.equal(storage.getItem('witch-water-sort:progress:v2'), null);
  assert.equal(store.isQaMode(), false);
});

test('QA console actions attach to the WeChat GameGlobal only in develop and trial environments', () => {
  const host = globalThis as typeof globalThis & {
    wx?: unknown;
    WitchAlchemyQA?: unknown;
    GameGlobal?: { WitchAlchemyQA?: unknown };
  };
  const previousWx = host.wx;
  const previousQa = host.WitchAlchemyQA;
  const previousGameGlobal = host.GameGlobal;
  const actions = { unlockAll: () => undefined, reset: () => undefined };

  try {
    for (const envVersion of ['develop', 'trial']) {
      host.wx = { getAccountInfoSync: () => ({ miniProgram: { envVersion } }) };
      host.GameGlobal = {};
      const runtime = new PlatformRuntime(actions);
      assert.equal(runtime.isQaAvailable(), true);
      assert.equal(host.GameGlobal.WitchAlchemyQA, actions);
      runtime.dispose();
      assert.equal(host.GameGlobal.WitchAlchemyQA, undefined);
    }

    host.wx = { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }) };
    host.GameGlobal = {};
    const runtime = new PlatformRuntime(actions);
    assert.equal(runtime.isQaAvailable(), false);
    assert.equal(host.GameGlobal.WitchAlchemyQA, undefined);
    runtime.dispose();
  } finally {
    if (previousWx === undefined) delete host.wx;
    else host.wx = previousWx;
    if (previousQa === undefined) delete host.WitchAlchemyQA;
    else host.WitchAlchemyQA = previousQa;
    if (previousGameGlobal === undefined) delete host.GameGlobal;
    else host.GameGlobal = previousGameGlobal;
  }
});

test('global mock ad config grants every reward and the QA result changes live', async () => {
  const host = globalThis as typeof globalThis & { wx?: unknown };
  const previousWx = host.wx;
  let qaResult: RewardedAdResult = 'completed';

  try {
    host.wx = { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial' } }) };
    const runtime = new PlatformRuntime();
    const ports = runtime.createRewardedPorts(REWARDED_AD_CONFIG, () => qaResult);

    assert.equal(REWARDED_AD_CONFIG.mode, 'mock');
    assert.equal(await ports.ad.show(), 'completed');
    assert.equal(await ports.claims.claim('level-001', 'qa-claim'), 'granted');
    qaResult = 'failed';
    assert.equal(await ports.ad.show(), 'failed');
    runtime.dispose();
  } finally {
    if (previousWx === undefined) delete host.wx;
    else host.wx = previousWx;
  }
});

test('platform UI feedback requests a light vibration only when WeChat supports it', () => {
  const host = globalThis as typeof globalThis & { wx?: unknown };
  const previousWx = host.wx;
  const vibrationTypes: string[] = [];

  try {
    host.wx = {
      vibrateShort: ({ type }: { type: string }) => { vibrationTypes.push(type); },
    };
    const runtime = new PlatformRuntime();
    runtime.vibrateShort();
    runtime.dispose();
    assert.deepEqual(vibrationTypes, ['light']);

    host.wx = {};
    const unavailable = new PlatformRuntime();
    assert.doesNotThrow(() => unavailable.vibrateShort());
    unavailable.dispose();
  } finally {
    if (previousWx === undefined) delete host.wx;
    else host.wx = previousWx;
  }
});

test('platform reports the WeChat menu capsule center as a window-height ratio', () => {
  const host = globalThis as typeof globalThis & { wx?: unknown };
  const previousWx = host.wx;

  try {
    host.wx = {
      getMenuButtonBoundingClientRect: () => ({ top: 30, bottom: 60 }),
      getWindowInfo: () => ({ windowHeight: 852 }),
    };
    const runtime = new PlatformRuntime();
    assert.equal(runtime.menuButtonCenterRatio(), 45 / 852);
    runtime.dispose();

    host.wx = {};
    const unavailable = new PlatformRuntime();
    assert.equal(unavailable.menuButtonCenterRatio(), null);
    unavailable.dispose();
  } finally {
    if (previousWx === undefined) delete host.wx;
    else host.wx = previousWx;
  }
});

test('platform sharing opens the WeChat share menu and forwards the requested card', () => {
  const host = globalThis as typeof globalThis & { wx?: unknown };
  const previousWx = host.wx;
  const menus: unknown[] = [];
  const cards: unknown[] = [];

  try {
    host.wx = {
      showShareMenu: (options: unknown) => { menus.push(options); },
      shareAppMessage: (options: unknown) => { cards.push(options); },
    };
    const runtime = new PlatformRuntime();
    runtime.share({ title: '魔女炼金屋｜来挑战魔法药水排序', query: 'level=35' });
    runtime.dispose();

    assert.deepEqual(menus, [{ menus: ['shareAppMessage'] }]);
    assert.deepEqual(cards, [{ title: '魔女炼金屋｜来挑战魔法药水排序', query: 'level=35' }]);

    host.wx = {};
    const unavailable = new PlatformRuntime();
    assert.doesNotThrow(() => unavailable.share({ title: '分享', query: 'level=1' }));
    unavailable.dispose();
  } finally {
    if (previousWx === undefined) delete host.wx;
    else host.wx = previousWx;
  }
});

test('stamina uses its own key and corrupt data never changes progress or sessions', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const progress = { ...store.loadProgress(), revision: 3, currentLevel: 'level-003', completedThrough: 2 };
  store.saveProgress(progress);
  storage.setItem('witch-water-sort:stamina:v1', '{bad');

  assert.deepEqual(store.loadStamina(5_000), { schemaVersion: 1, value: 10, updatedAt: 5_000 });
  store.saveStamina({ schemaVersion: 1, value: 6, updatedAt: 4_000 });
  assert.deepEqual(store.loadStamina(5_000), { schemaVersion: 1, value: 6, updatedAt: 4_000 });
  assert.deepEqual(store.loadProgress(), progress);
});

test('daily commission uses one independent record and reconciles the local day', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const dayOne = new Date('2026-09-09T12:00:00+08:00').getTime();
  const dayTwo = new Date('2026-09-10T12:00:00+08:00').getTime();

  assert.equal(store.loadDailyCommission(dayOne, 4).levelId, null);
  const unlocked = store.loadDailyCommission(dayOne, 5);
  assert.equal(unlocked.levelId, 'level-003');
  assert.equal(storage.values.has('witch-water-sort:daily-commission:v1'), true);

  store.saveDailyCommission({ ...unlocked, completed: true, bestMoves: 16, lastCompletedDate: unlocked.date });
  assert.equal(store.loadDailyCommission(dayOne, 100).levelId, 'level-003');
  const nextDay = store.loadDailyCommission(dayTwo, 5);
  assert.equal(nextDay.levelId, 'level-004');
  assert.equal(nextDay.completed, false);
  assert.equal(nextDay.rewardClaimed, false);
  assert.equal(nextDay.bestMoves, null);
  assert.deepEqual(store.loadProgress(), createDefaultProgress());
});

test('endless mode uses one independent record and corrupt data cannot alter main progress', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const main = { ...store.loadProgress(), revision: 2, currentLevel: 'level-006', completedThrough: 5 };
  store.saveProgress(main);
  storage.setItem('witch-water-sort:endless:v1', '{bad');

  assert.deepEqual(store.loadEndlessState(), createEndlessState());
  const endless = startEndlessRun(createEndlessState(), 1234, 100);
  store.saveEndlessState(endless);
  assert.deepEqual(store.loadEndlessState(), endless);
  assert.deepEqual(store.loadProgress(), main);
  assert.equal(storage.values.has('witch-water-sort:session:' + endless.run?.levelId + ':v2'), false);
});
