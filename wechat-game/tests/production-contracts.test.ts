import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { DEMO_LEVEL_CONFIG } from '../assets/scripts/core/level-config.ts';
import {
  CURRENT_SNAPSHOT_VERSION,
  createLocalSnapshot,
  decodeLocalSnapshot,
} from '../assets/scripts/core/save-schema.ts';
import { createDemoState } from '../assets/scripts/core/demo-level.ts';

test('level 12 keeps the approved fixed-grid and rewarded-slot contract', () => {
  assert.equal(DEMO_LEVEL_CONFIG.id, 'level-012');
  assert.equal(DEMO_LEVEL_CONFIG.presentationSeed, 12);
  assert.equal(DEMO_LEVEL_CONFIG.capacity, 4);
  assert.equal(DEMO_LEVEL_CONFIG.slotCount, 15);
  assert.equal(DEMO_LEVEL_CONFIG.rewardSlotIndex, 14);
  assert.deepEqual(DEMO_LEVEL_CONFIG.initialState, createDemoState());
});

test('versioned local snapshots round-trip active progress and selected bottle', () => {
  const state = createDemoState();
  const snapshot = createLocalSnapshot({
    levelId: 'level-012',
    configVersion: '2026.08.23.1',
    revision: 7,
    state,
    history: [state],
    selected: 0,
    updatedAt: 1_777_777,
  });

  assert.equal(snapshot.schemaVersion, CURRENT_SNAPSHOT_VERSION);
  assert.equal(CURRENT_SNAPSHOT_VERSION, 2);
  assert.deepEqual(decodeLocalSnapshot(JSON.stringify(snapshot), DEMO_LEVEL_CONFIG), snapshot);
});

test('snapshot decoder rejects corrupt or future-schema data without throwing', () => {
  assert.equal(decodeLocalSnapshot('{bad json', DEMO_LEVEL_CONFIG), null);
  assert.equal(decodeLocalSnapshot(JSON.stringify({ schemaVersion: 999 }), DEMO_LEVEL_CONFIG), null);
  assert.equal(decodeLocalSnapshot(JSON.stringify({ schemaVersion: 1, levelId: 12 }), DEMO_LEVEL_CONFIG), null);
});

test('snapshot decoder enforces the selected level, fixed board, capacity, and history bounds', () => {
  const state = createDemoState();
  const snapshot = createLocalSnapshot({
    levelId: DEMO_LEVEL_CONFIG.id,
    configVersion: DEMO_LEVEL_CONFIG.configVersion,
    revision: 1,
    state,
    history: [state],
    selected: 0,
    updatedAt: 99,
  });
  const wrongLevel = { ...snapshot, levelId: 'level-011' };
  const wrongVersion = { ...snapshot, configVersion: 'stale' };
  const shortBoard = { ...snapshot, state: { ...state, bottles: state.bottles.slice(0, 14) } };
  const overCapacity = {
    ...snapshot,
    history: [{
      ...state,
      bottles: state.bottles.map((bottle, index) => index === 0
        ? { ...bottle, layers: ['rose', 'rose', 'rose', 'rose', 'rose'] }
        : bottle),
    }],
  };

  assert.equal(decodeLocalSnapshot(JSON.stringify(wrongLevel), DEMO_LEVEL_CONFIG), null);
  assert.equal(decodeLocalSnapshot(JSON.stringify(wrongVersion), DEMO_LEVEL_CONFIG), null);
  assert.equal(decodeLocalSnapshot(JSON.stringify(shortBoard), DEMO_LEVEL_CONFIG), null);
  assert.equal(decodeLocalSnapshot(JSON.stringify(overCapacity), DEMO_LEVEL_CONFIG), null);
  assert.equal(decodeLocalSnapshot(JSON.stringify({ ...snapshot, selected: 15 }), DEMO_LEVEL_CONFIG), null);
  assert.equal(decodeLocalSnapshot(JSON.stringify({ ...snapshot, updatedAt: -1 }), DEMO_LEVEL_CONFIG), null);
});

test('shared progress schema exposes the same v2 progress field names as the core contract', () => {
  const schema = JSON.parse(readFileSync(
    new URL('../../shared-contracts/progress.schema.json', import.meta.url),
    'utf8',
  ));

  assert.deepEqual(schema.required, [
    'schemaVersion',
    'revision',
    'currentLevel',
    'highestUnlockedLevel',
    'completedLevels',
    'bestMoves',
    'configVersion',
  ]);
  assert.equal(schema.properties.schemaVersion.const, 2);
  assert.equal(schema.properties.highestUnlockedLevel.pattern, '^level-[0-9]{3}$');
  assert.equal(schema.additionalProperties, false);
});

test('approved chibi and audio manifests are synchronized into Cocos resources', () => {
  const chibiManifestPath = new URL('../assets/resources/game/chibi/assets-manifest.json', import.meta.url);
  const audioManifestPath = new URL('../assets/resources/game/audio/audio-manifest.json', import.meta.url);
  assert.equal(existsSync(chibiManifestPath), true);
  assert.equal(existsSync(audioManifestPath), true);

  const chibi = JSON.parse(readFileSync(chibiManifestPath, 'utf8'));
  const audio = JSON.parse(readFileSync(audioManifestPath, 'utf8'));
  assert.equal(chibi.witch.idle.frames, 18);
  assert.equal(chibi.witch.cast.frames, 20);
  assert.equal(chibi.witch.celebrate.frames, 14);
  assert.equal(audio.entries.length, 11);
});

test('pure core stays independent from Cocos and WeChat runtime APIs', () => {
  const coreRoot = new URL('../assets/scripts/core/', import.meta.url);
  for (const file of readdirSync(coreRoot).filter((name) => name.endsWith('.ts'))) {
    const source = readFileSync(new URL(file, coreRoot), 'utf8');
    assert.doesNotMatch(source, /from\s+['"]cc['"]/);
    assert.doesNotMatch(source, /\bwx\s*\./);
    assert.doesNotMatch(source, /from\s+['"][^'"]*tools[\\/]/);
  }
});

test('every approved chibi PNG is imported as a SpriteFrame resource', () => {
  const root = new URL('../assets/resources/game/chibi/', import.meta.url);
  const pending = [root.pathname.replace(/^\/(?:[A-Za-z]:)/, (drive) => drive.slice(1))];
  let pngCount = 0;

  while (pending.length > 0) {
    const directory = pending.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      if (!entry.isFile() || !entry.name.endsWith('.png')) continue;
      pngCount += 1;
      const meta = JSON.parse(readFileSync(`${path}.meta`, 'utf8'));
      assert.equal(meta.userData.type, 'sprite-frame', entry.name);
      assert.equal(meta.subMetas.f9941.importer, 'sprite-frame', entry.name);
    }
  }

  assert.ok(pngCount >= 140);
});

test('audio playback is unlocked only from a player gesture', () => {
  const director = readFileSync(new URL('../assets/scripts/presentation/AudioDirector.ts', import.meta.url), 'utf8');
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');

  assert.match(director, /unlockFromGesture\(\): void/);
  assert.match(director, /if \(!this\.unlocked\) return;/);
  assert.match(bootstrap, /this\.audio\?\.unlockFromGesture\(\)/);
});

test('production buttons use sliced wide bases and contained square control bases', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');

  assert.match(bootstrap, /buttonBaseLayout\(layout, 'sliced'\)/);
  assert.match(bootstrap, /buttonBaseLayout\(stage, 'contain'\)/);
  assert.match(bootstrap, /sprite\.type = Sprite\.Type\.SLICED/);
  assert.doesNotMatch(bootstrap, /decorateRasterButton\(node, variant, disabled, action\)/);
});

test('production presentation derives level copy, targets, seeds, and reward ids from the active config', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(bootstrap, /level-012/);
  assert.doesNotMatch(bootstrap, /第 12 关/);
  assert.doesNotMatch(bootstrap, /bottlePlacement\(12,/);
  assert.doesNotMatch(bootstrap, /魔药 \$\{completed\}\/8/);
  assert.match(bootstrap, /this\.currentLevel\.number/);
  assert.match(bootstrap, /this\.currentLevel\.presentationSeed/);
  assert.match(bootstrap, /this\.session\.levelId/);
  assert.match(bootstrap, /renderLevelSelect/);
  assert.match(bootstrap, /renderLevelComplete/);
  assert.match(bootstrap, /switchLevel/);
  assert.match(bootstrap, /persistCompletion/);
});

test('completion persistence orders local progress before snapshot clearing and result rendering', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const save = bootstrap.indexOf('this.store.saveProgress(nextProgress)');
  const clear = bootstrap.indexOf('this.store.clearSession(this.session.levelId)');
  const show = bootstrap.indexOf('showLevelComplete(this.flow');

  assert.ok(save >= 0);
  assert.ok(clear > save);
  assert.ok(show > clear);
  assert.match(bootstrap, /进度保存失败，请重试/);
});
