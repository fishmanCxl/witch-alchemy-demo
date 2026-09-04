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

test('collection and title artwork is synchronized as loadable SpriteFrames', () => {
  const collectionAssets = [
    'ui/icon-alchemy-book.png',
    'collection/star-dew-potion.png',
    'collection/forest-potion.png',
    'titles/title-badge-novice.png',
    'titles/title-badge-junior.png',
    'effects/particle-scarlet-flame.png',
    'effects/particle-chartreuse-rune.png',
    'effects/particle-indigo-comet.png',
    'effects/particle-pearl-diamond.png',
  ];

  for (const relative of collectionAssets) {
    assert.equal(
      existsSync(new URL(`../assets/resources/game/chibi/${relative}`, import.meta.url)),
      true,
      relative,
    );
  }

  for (const relative of collectionAssets) {
    const metaPath = new URL(`../assets/resources/game/chibi/${relative}.meta`, import.meta.url);
    assert.equal(existsSync(metaPath), true, `${relative}.meta`);
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    assert.equal(meta.userData.type, 'sprite-frame', relative);
    assert.equal(meta.subMetas.f9941.importer, 'sprite-frame', relative);
  }
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

test('the bundled Chinese art font keeps its open-source license beside the runtime asset', () => {
  const fontRoot = new URL('../assets/resources/game/fonts/', import.meta.url);
  assert.equal(existsSync(new URL('noto-serif-sc-ui.ttf', fontRoot)), true);
  assert.equal(existsSync(new URL('OFL.txt', fontRoot)), true);
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

test('production bottle feedback uses prototype transforms and deterministic particles', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');

  assert.match(bootstrap, /bottleFeedbackVisual\(/);
  assert.match(bootstrap, /potionParticleVisuals\(/);
  assert.match(bootstrap, /BottleHitTarget/);
  assert.match(bootstrap, /BottleVisual/);
  assert.doesNotMatch(bootstrap, /SelectedGlow/);
  assert.match(bootstrap, /SelectedAura/);
});

test('production bottle interactions refresh level nodes without rebuilding the full surface', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const applyBody = bootstrap.slice(
    bootstrap.indexOf('private applySessionResult'),
    bootstrap.indexOf('private persistCompletion'),
  );
  const refreshBody = bootstrap.slice(
    bootstrap.indexOf('private refreshLevelContent'),
    bootstrap.indexOf('private addWitch'),
  );

  assert.match(applyBody, /levelInteractionRefreshMode\(/);
  assert.match(applyBody, /this\.refreshLevelFeedback\(\)/);
  assert.match(applyBody, /this\.refreshLevelContent\(\)/);
  assert.doesNotMatch(applyBody, /this\.render\(\)/);
  assert.doesNotMatch(refreshBody, /this\.surface\?\.destroy\(\)/);
  assert.doesNotMatch(refreshBody, /new Node\('ProductionSurface'\)/);
});

test('production labels use the bundled art font and approved prototype copy', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');

  assert.match(bootstrap, /resources\.load\(ART_FONT_RESOURCE, Font/);
  assert.match(bootstrap, /potionProgressLabel\(/);
  assert.match(bootstrap, /RESTART_LABEL/);
  assert.doesNotMatch(bootstrap, /`目标 \$\{completed\}/);
  assert.doesNotMatch(bootstrap, /'重开'/);
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
  assert.match(bootstrap, /levelsForChapter\(this\.flow\.selectedLevelChapterId\)/);
  assert.match(bootstrap, /selectLevelChapter\(/);
  assert.doesNotMatch(bootstrap, /FIRST_CHAPTER_LEVELS\.forEach/);
  assert.doesNotMatch(bootstrap, /'第一章 · 1–30 关'/);
  assert.match(bootstrap, /renderLevelComplete/);
  assert.match(bootstrap, /switchLevel/);
  assert.match(bootstrap, /persistCompletion/);
});

test('production renders one collection entry, a scroll overview, and the selected puzzle detail', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const entry = bootstrap.slice(
    bootstrap.indexOf('private renderCollectionEntry'),
    bootstrap.indexOf('private renderCollectionPuzzle'),
  );

  assert.match(bootstrap, /private renderCollection\(/);
  assert.match(bootstrap, /private renderCollectionOverview\(/);
  assert.match(bootstrap, /private renderCollectionCard\(/);
  assert.match(bootstrap, /private renderCollectionDetail\(/);
  assert.match(bootstrap, /private renderMysteryPotion\(/);
  assert.match(bootstrap, /addComponent\(ScrollView\)/);
  assert.match(bootstrap, /POTION_COLLECTIONS/);
  assert.match(bootstrap, /mysteryPotionVisual\(/);
  assert.match(bootstrap, /openCollectionDetail\(/);
  assert.match(bootstrap, /closeCollectionDetail\(/);
  assert.match(bootstrap, /deriveHighestTitle\(this\.progress\)/);
  assert.match(bootstrap, /openCollection\(this\.flow\)/);
  assert.match(bootstrap, /collectionPuzzlePiece\(/);
  assert.match(bootstrap, /collectionHasNewPiece/);
  assert.match(bootstrap, /const collectionConfig = getPotionCollection\(collection\.chapterId\)!/);
  assert.match(bootstrap, /const artworkPath = `game\/chibi\/collection\/\$\{collectionConfig\.artworkKey\}\/spriteFrame`/);
  assert.match(bootstrap, /isLevelUnlocked\(this\.progress, firstLevelId\)/);
  assert.doesNotMatch(bootstrap, /game\/chibi\/collection\/star-dew-potion\/spriteFrame/);
  assert.match(bootstrap, /开放后解锁/);
  assert.doesNotMatch(entry, /revealedPieces/);
  assert.doesNotMatch(bootstrap, /revealedPieces\s*=\s*this\./);
  assert.doesNotMatch(bootstrap, /mystery-potions-grid/);
});

test('completion persistence orders local progress before snapshot clearing and result rendering', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const save = bootstrap.indexOf('this.store.saveProgress(nextProgress)');
  const reward = bootstrap.indexOf('this.completionReward = deriveCompletionReward');
  const clear = bootstrap.indexOf('this.store.clearSession(this.session.levelId)');
  const show = bootstrap.indexOf('showLevelComplete(this.flow');

  assert.ok(save >= 0);
  assert.ok(reward > save);
  assert.ok(clear > reward);
  assert.ok(show > clear);
  assert.match(bootstrap, /进度保存失败，请重试/);
});

test('production launch preloads the real game directory before rendering home or syncing cloud', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const startBody = bootstrap.slice(bootstrap.indexOf('start(): void'), bootstrap.indexOf('onDestroy(): void'));
  const transitionBody = bootstrap.slice(
    bootstrap.indexOf('private enterHomeAfterLaunch'),
    bootstrap.indexOf('private render(): void'),
  );

  assert.match(startBody, /this\.renderLaunch\(\)/);
  assert.match(startBody, /this\.startLaunchPreload\(\)/);
  assert.doesNotMatch(startBody, /this\.render\(\)/);
  assert.doesNotMatch(startBody, /this\.syncCloudProgress\(\)/);
  assert.match(bootstrap, /resources\.preloadDir\('game'/);
  assert.match(transitionBody, /this\.render\(\)/);
  assert.match(transitionBody, /void this\.syncCloudProgress\(\)/);
  assert.ok(transitionBody.indexOf('this.render()') < transitionBody.indexOf('this.syncCloudProgress()'));
});

test('production launch uses the approved timing and keeps input blocked through fade', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  assert.match(bootstrap, /LAUNCH_MIN_VISIBLE_MS/);
  assert.match(bootstrap, /\.to\(0\.22, \{ opacity: 0 \}\)/);
  assert.match(bootstrap, /new Node\('LaunchSurface'\)/);
  assert.match(bootstrap, /addComponent\(BlockInputEvents\)/);
  assert.match(bootstrap, /addComponent\(UIOpacity\)/);
});

test('production launch reschedules the minimum gate while real-clock time remains', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const helper = bootstrap.slice(
    bootstrap.indexOf('private scheduleLaunchMinimumCheck'),
    bootstrap.indexOf('private handlePlatformForeground'),
  );

  assert.match(helper, /launchMinimumRemainingMs\(this\.launchState\.startedAt, Date\.now\(\)\)/);
  assert.match(helper, /if \(remainingMs > 0\)/);
  assert.match(helper, /this\.scheduleOnce\(\(\) => this\.scheduleLaunchMinimumCheck\(\), remainingMs \/ 1000\)/);
  assert.ok(helper.indexOf('remainingMs > 0') < helper.indexOf('markLaunchMinimumVisible'));
});

test('production launch exposes an explicit idempotent retry path', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  assert.match(bootstrap, /failLaunchResources\(/);
  assert.match(bootstrap, /'资源加载失败，请检查网络或存储空间'/);
  assert.match(bootstrap, /'重新加载'/);
  assert.match(bootstrap, /retryLaunch\(/);
  assert.match(bootstrap, /button\.interactable = false/);
  assert.match(bootstrap, /const attempt = this\.launchState\.attempt/);
  assert.match(bootstrap, /updateLaunchProgress\(this\.launchState, attempt,/);
  assert.match(bootstrap, /completeLaunchResources\(this\.launchState, attempt\)/);
});

test('production launch ignores stale preload callbacks before UI work and clears launch references on exit', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const preloadBody = bootstrap.slice(
    bootstrap.indexOf('private startLaunchPreload'),
    bootstrap.indexOf('private showLaunchFailure'),
  );
  const filters = [...preloadBody.matchAll(/if \(!this\.isCurrentLaunchAttempt\(attempt\)\) return;/g)]
    .map((match) => match.index ?? -1);
  const exitBody = bootstrap.slice(
    bootstrap.indexOf('private enterHomeAfterLaunch'),
    bootstrap.indexOf('private render(): void'),
  );

  assert.match(bootstrap, /private isCurrentLaunchAttempt\(attempt: number\): boolean \{\s+return this\.launchState\.phase === 'loading' && this\.launchState\.attempt === attempt;\s+\}/);
  assert.equal(filters.length, 2);
  assert.ok(filters[0] < preloadBody.indexOf('this.updateLaunchView'));
  assert.ok(filters[1] < preloadBody.indexOf('failLaunchResources'));
  assert.ok(filters[1] < preloadBody.indexOf('this.showLaunchFailure'));
  assert.ok(filters[1] < preloadBody.indexOf('completeLaunchResources'));
  assert.ok(filters[1] < preloadBody.lastIndexOf('this.updateLaunchView'));
  assert.ok(filters[1] < preloadBody.indexOf('this.tryExitLaunch'));
  assert.match(exitBody, /this\.clearLaunchNodeReferences\(\);\s+this\.render\(\);/);
  assert.match(bootstrap, /private clearLaunchNodeReferences\(\): void \{\s+this\.launchProgressFill = null;\s+this\.launchPercentLabel = null;\s+this\.launchStatusLabel = null;\s+this\.launchRetryButton = null;\s+\}/);
});

test('home stamina labels explicitly shrink without wrapping', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const render = bootstrap.slice(
    bootstrap.indexOf('private renderStaminaBar'),
    bootstrap.indexOf('private staminaRecoveryText'),
  );
  assert.match(render, /homeStaminaValueLabel\\.overflow = Label\\.Overflow\\.SHRINK/);
  assert.match(render, /homeStaminaValueLabel\\.enableWrapText = false/);
  assert.match(render, /homeStaminaCountdownLabel\\.overflow = Label\\.Overflow\\.SHRINK/);
  assert.match(render, /homeStaminaCountdownLabel\\.enableWrapText = false/);
});

test('production integrates stamina startup, refill, countdown labels, and zero-value entry guard', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const switchLevel = bootstrap.slice(
    bootstrap.indexOf('private switchLevel'),
    bootstrap.indexOf('private renderLevel('),
  );
  const update = bootstrap.slice(
    bootstrap.indexOf('update(deltaTime: number): void'),
    bootstrap.indexOf('private scheduleLaunchMinimumCheck'),
  );

  assert.match(bootstrap, /private stamina: StaminaState/);
  assert.match(bootstrap, /this\.store\.loadStamina\(Date\.now\(\)\)/);
  assert.match(bootstrap, /spendStamina\(this\.stamina, Date\.now\(\)\)/);
  assert.match(bootstrap, /grantAdStamina\(this\.stamina, Date\.now\(\)\)/);
  assert.match(bootstrap, /看广告 · 恢复 5 点/);
  assert.match(bootstrap, /返回主页将消耗 1 点体力/);
  assert.match(bootstrap, /game\/chibi\/ui\/stamina-icons\/spriteFrame/);
  assert.match(update, /reconcileStamina\(this\.stamina, Date\.now\(\)\)/);
  assert.match(update, /this\.refreshStaminaLabels\(\)/);
  assert.doesNotMatch(update, /this\.render\(\)/);
  assert.match(switchLevel, /reconcileStamina\(this\.stamina, Date\.now\(\)\)/);
  assert.match(switchLevel, /if \(this\.stamina\.value === 0\)[\s\S]*openStaminaDialog\(this\.flow\)[\s\S]*this\.render\(\);[\s\S]*return;/);
  assert.ok(switchLevel.indexOf('this.stamina.value === 0') < switchLevel.indexOf('selectCurrentLevel'));
});

test('production spends stamina only after completion progress and before clearing the session', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const persist = bootstrap.slice(
    bootstrap.indexOf('private persistCompletion'),
    bootstrap.indexOf('private async syncCloudProgress'),
  );
  const save = persist.indexOf('this.store.saveProgress(nextProgress)');
  const spend = persist.indexOf('this.consumeOneStamina()');
  const clear = persist.indexOf('this.store.clearSession(this.session.levelId)');

  assert.ok(save >= 0);
  assert.ok(spend > save);
  assert.ok(clear > spend);
});

test('bottle and stamina rewards share the production busy guard', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const bottle = bootstrap.slice(
    bootstrap.indexOf('private async handleRewardedBottle'),
    bootstrap.indexOf('private rewardFailureMessage'),
  );
  const stamina = bootstrap.slice(
    bootstrap.indexOf('private async handleRewardedStamina'),
    bootstrap.indexOf('private renderExitConfirm'),
  );

  for (const handler of [bottle, stamina]) {
    assert.match(handler, /this\.rewardBusy/);
    assert.match(handler, /this\.rewardBusy = true/);
    assert.match(handler, /this\.rewardBusy = false/);
  }
});

test('final settling blocks exit without cancelling completion callbacks or charging stamina', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const apply = bootstrap.slice(
    bootstrap.indexOf('private applySessionResult'),
    bootstrap.indexOf('private persistCompletion'),
  );
  const confirmStart = bootstrap.indexOf('private confirmLevelExit');
  const confirm = bootstrap.slice(
    confirmStart,
    bootstrap.indexOf('private consumeOneStamina'),
  );
  const settings = bootstrap.slice(
    bootstrap.indexOf('private renderSettings('),
    bootstrap.indexOf('private addMessage'),
  );
  const guard = /if \(this\.completionScheduled \|\| this\.session\.pendingCompletion\.length > 0 \|\| this\.session\.levelComplete\) return;/;

  assert.ok(confirmStart >= 0);
  assert.match(confirm, guard);
  assert.match(settings, guard);
  assert.ok(confirm.indexOf(') return;') < confirm.indexOf('this.unscheduleAllCallbacks()'));
  assert.ok(confirm.indexOf(') return;') < confirm.indexOf('this.store.saveSession(this.session)'));
  assert.ok(confirm.indexOf(') return;') < confirm.indexOf('this.consumeOneStamina()'));
  assert.ok(confirm.indexOf(') return;') < confirm.indexOf('returnHome(this.flow)'));
  assert.match(apply, /this\.scheduleOnce\(\(\) => \{[\s\S]*this\.persistCompletion\(\);/);
});

test('completion and exit retries share one durable-before-memory stamina charge', () => {
  const bootstrap = readFileSync(new URL('../assets/scripts/presentation/ProductionBootstrap.ts', import.meta.url), 'utf8');
  const switchLevel = bootstrap.slice(
    bootstrap.indexOf('private switchLevel'),
    bootstrap.indexOf('private renderLevel('),
  );
  const persist = bootstrap.slice(
    bootstrap.indexOf('private persistCompletion'),
    bootstrap.indexOf('private async syncCloudProgress'),
  );
  const exit = bootstrap.slice(
    bootstrap.indexOf('private renderExitConfirm'),
    bootstrap.indexOf('private consumeOneStamina'),
  );
  const consume = bootstrap.slice(
    bootstrap.indexOf('private consumeOneStamina'),
    bootstrap.indexOf('private renderStaminaIcon'),
  );

  assert.match(bootstrap, /private staminaSpentForActiveLevel = false/);
  assert.match(switchLevel, /this\.staminaSpentForActiveLevel = false/);
  assert.match(persist, /if \(!this\.staminaSpentForActiveLevel\) \{\s+this\.staminaSpentForActiveLevel = this\.consumeOneStamina\(\);\s+\}/);
  assert.match(exit, /if \(!this\.staminaSpentForActiveLevel\) \{\s+this\.staminaSpentForActiveLevel = this\.consumeOneStamina\(\);\s+\}/);
  assert.ok(persist.indexOf('this.staminaSpentForActiveLevel = this.consumeOneStamina()')
    < persist.indexOf('this.store.clearSession(this.session.levelId)'));
  assert.ok(persist.indexOf('} catch {') < persist.indexOf('this.store.clearSession(this.session.levelId)'));
  assert.ok(consume.indexOf('this.store.saveStamina(next)') < consume.indexOf('this.stamina = next'));
  assert.match(consume, /private consumeOneStamina\(\): boolean/);
});
