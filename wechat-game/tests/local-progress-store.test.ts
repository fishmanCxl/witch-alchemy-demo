import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createGameSession,
  pressBottle,
} from '../assets/scripts/core/game-session.ts';
import { getLevelConfig } from '../assets/scripts/core/level-catalog.ts';
import { createLocalSnapshot } from '../assets/scripts/core/save-schema.ts';
import { LocalProgressStore } from '../assets/scripts/platform/LocalProgressStore.ts';
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
    highestUnlockedLevel: level16.id,
    completedLevels: ['level-002', 'level-015'],
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

  const completed = pressBottle(stable, 1).session;
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
    highestUnlockedLevel: 'level-004',
    completedLevels: ['level-001', 'level-002'],
    bestMoves: { 'level-001': 3, 'level-002': 5 },
  } as const;

  store.saveProgress(progress);
  store.saveSoundEnabled(false);

  assert.deepEqual(store.loadProgress(), progress);
  assert.equal(store.loadSoundEnabled(), false);
  store.clearSession('level-003');
  assert.equal(store.loadSoundEnabled(), false);
});

test('progress persistence strips derived and unknown fields from storage and reload', () => {
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

  store.saveProgress(polluted);

  const stored = JSON.parse(storage.getItem('witch-water-sort:progress:v2')!);
  const loaded = store.loadProgress();
  const expected = {
    schemaVersion: 2,
    revision: 9,
    currentLevel: 'level-003',
    highestUnlockedLevel: 'level-004',
    completedLevels: ['level-001', 'level-003'],
    bestMoves: { 'level-001': 5, 'level-003': 9 },
    configVersion: 'chapters-1-2.2026-08-29.1',
  };

  assert.deepEqual(stored, expected);
  assert.deepEqual(loaded, expected);
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
  assert.equal(migrated.highestUnlockedLevel, 'level-012');
  assert.deepEqual(migrated.completedLevels, []);
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
  assert.equal(progress.highestUnlockedLevel, 'level-001');
  assert.equal(storage.getItem('witch-water-sort:migration:level-012:v2'), 'done');
  assert.equal(storage.getItem('witch-water-sort:level-012:v1'), '{bad json');
});
