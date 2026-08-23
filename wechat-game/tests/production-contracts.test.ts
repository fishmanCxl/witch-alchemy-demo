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
  assert.deepEqual(decodeLocalSnapshot(JSON.stringify(snapshot)), snapshot);
});

test('snapshot decoder rejects corrupt or future-schema data without throwing', () => {
  assert.equal(decodeLocalSnapshot('{bad json'), null);
  assert.equal(decodeLocalSnapshot(JSON.stringify({ schemaVersion: 999 })), null);
  assert.equal(decodeLocalSnapshot(JSON.stringify({ schemaVersion: 1, levelId: 12 })), null);
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
