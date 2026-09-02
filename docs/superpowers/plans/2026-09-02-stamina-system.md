# 《暮影炼金室》体力系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为微信小游戏加入上限 10、每 30 分钟恢复 1、通关或确认退出扣 1、完整观看广告恢复 5 的本地体力系统和紫金补给 UI。

**Architecture:** 新建纯 TypeScript 体力状态模块负责所有时间与数值计算；`LocalProgressStore` 使用独立键持久化；场景流只保存弹窗开关；平台层复用现有激励广告端口；`ProductionBootstrap` 负责生命周期结算、扣除时机和 Cocos UI。体力不进入 `PlayerProgress`、云存档或棋盘快照。

**Tech Stack:** TypeScript、Node `node:test`、Cocos Creator 3.8.8、微信小游戏激励广告、本地 Storage。

**Spec:** `docs/superpowers/specs/2026-09-02-stamina-system-design.md`

## Global Constraints

- 体力上限固定为 10，恢复间隔固定为 1,800,000 毫秒，广告奖励固定为 5。
- 进入关卡不扣体力；通关或关卡内确认返回主页各扣一次；重开、撤销、切后台和强制关闭不扣。
- 体力为 0 时阻止进入关卡并打开补给弹窗。
- 广告结果只有 `completed` 可以发奖，奖励后不得超过 10。
- 体力存档与关卡进度、图鉴、称号、棋盘快照和云存档保持独立。
- 只复用现有激励广告 SDK 和按钮/弹窗素材，不新增依赖。
- 所有源码修改使用 `apply_patch`；暂存或提交时只列出本任务文件，禁止 `git add .`。
- 保留工作树已有改动，不格式化或重构无关代码。

---

### Task 1: 纯体力规则

**Files:**
- Create: `wechat-game/assets/scripts/core/stamina.ts`
- Create: `wechat-game/tests/stamina.test.ts`

**Interfaces:**
- Produces: `StaminaState`、`STAMINA_MAX`、`STAMINA_RECOVERY_MS`、`STAMINA_AD_REWARD`、`createFullStamina(now)`、`decodeStamina(serialized, now)`、`encodeStamina(state)`、`reconcileStamina(state, now)`、`spendStamina(state, now)`、`grantAdStamina(state, now)`、`nextRecoveryMs(state, now)`。
- Consumes: only JavaScript standard library values; no Cocos, WeChat, storage or timers.

- [ ] **Step 1: Write the failing rule tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAMINA_RECOVERY_MS, createFullStamina, decodeStamina, grantAdStamina,
  nextRecoveryMs, reconcileStamina, spendStamina,
} from '../assets/scripts/core/stamina.ts';

test('new and invalid stamina start full without touching other progress', () => {
  assert.deepEqual(createFullStamina(1_000), { schemaVersion: 1, value: 10, updatedAt: 1_000 });
  assert.deepEqual(decodeStamina('{bad', 2_000), createFullStamina(2_000));
  assert.deepEqual(decodeStamina(JSON.stringify({ schemaVersion: 1, value: 11, updatedAt: 0 }), 2_000),
    createFullStamina(2_000));
});

test('recovery keeps partial time and caps at ten', () => {
  const state = { schemaVersion: 1, value: 7, updatedAt: 1_000 } as const;
  const now = 1_000 + STAMINA_RECOVERY_MS * 2 + 12_345;
  assert.deepEqual(reconcileStamina(state, now), {
    schemaVersion: 1, value: 9, updatedAt: 1_000 + STAMINA_RECOVERY_MS * 2,
  });
  assert.equal(nextRecoveryMs(state, now), STAMINA_RECOVERY_MS - 12_345);
  assert.equal(reconcileStamina(state, 0), state);
});

test('spending and ad rewards obey zero and maximum boundaries', () => {
  assert.equal(spendStamina({ schemaVersion: 1, value: 0, updatedAt: 1_000 }, 2_000), null);
  assert.deepEqual(spendStamina(createFullStamina(1_000), 2_000),
    { schemaVersion: 1, value: 9, updatedAt: 2_000 });
  assert.deepEqual(grantAdStamina({ schemaVersion: 1, value: 4, updatedAt: 1_000 }, 2_000),
    { schemaVersion: 1, value: 9, updatedAt: 1_000 });
  assert.deepEqual(grantAdStamina({ schemaVersion: 1, value: 8, updatedAt: 1_000 }, 2_000),
    createFullStamina(2_000));
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd wechat-game; node --experimental-strip-types --test tests/stamina.test.ts`

Expected: FAIL because `assets/scripts/core/stamina.ts` does not exist.

- [ ] **Step 3: Implement the minimum deterministic model**

```ts
export const STAMINA_MAX = 10;
export const STAMINA_RECOVERY_MS = 30 * 60 * 1000;
export const STAMINA_AD_REWARD = 5;

export interface StaminaState {
  readonly schemaVersion: 1;
  readonly value: number;
  readonly updatedAt: number;
}

export function createFullStamina(now: number): StaminaState {
  return Object.freeze({ schemaVersion: 1, value: STAMINA_MAX, updatedAt: now });
}

export function reconcileStamina(state: StaminaState, now: number): StaminaState {
  if (state.value >= STAMINA_MAX || now <= state.updatedAt) return state;
  const recovered = Math.floor((now - state.updatedAt) / STAMINA_RECOVERY_MS);
  if (recovered < 1) return state;
  const value = Math.min(STAMINA_MAX, state.value + recovered);
  return Object.freeze({
    schemaVersion: 1,
    value,
    updatedAt: value === STAMINA_MAX ? now : state.updatedAt + recovered * STAMINA_RECOVERY_MS,
  });
}
```

Complete decode/encode, spend, grant and countdown with the same constants and immutable return values. `decodeStamina()` must catch JSON errors, reject arrays/future versions/non-integer values/non-finite timestamps, and return `createFullStamina(now)` for invalid input.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `cd wechat-game; node --experimental-strip-types --test tests/stamina.test.ts`

Expected: all stamina tests pass with zero failures.

- [ ] **Step 5: Commit only the pure rule files**

```powershell
git add -- wechat-game/assets/scripts/core/stamina.ts wechat-game/tests/stamina.test.ts
git commit -m "feat: add deterministic stamina rules"
```

---

### Task 2: 独立本地存储

**Files:**
- Modify: `wechat-game/assets/scripts/platform/LocalProgressStore.ts`
- Modify: `wechat-game/tests/local-progress-store.test.ts`

**Interfaces:**
- Consumes: `StaminaState`、`createFullStamina()`、`decodeStamina()`、`encodeStamina()` from Task 1.
- Produces: `LocalProgressStore.loadStamina(now): StaminaState` and `LocalProgressStore.saveStamina(state): void` using `witch-water-sort:stamina:v1`.

- [ ] **Step 1: Add failing storage tests**

```ts
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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd wechat-game; node --experimental-strip-types --test tests/local-progress-store.test.ts`

Expected: FAIL with `store.loadStamina is not a function`.

- [ ] **Step 3: Add the two storage methods**

```ts
const STAMINA_KEY = 'witch-water-sort:stamina:v1';

loadStamina(now: number): StaminaState {
  return decodeStamina(this.storage.getItem(STAMINA_KEY), now);
}

saveStamina(state: StaminaState): void {
  this.storage.setItem(STAMINA_KEY, encodeStamina(state));
}
```

- [ ] **Step 4: Run store and stamina tests and verify GREEN**

Run: `cd wechat-game; node --experimental-strip-types --test tests/stamina.test.ts tests/local-progress-store.test.ts`

Expected: both suites pass with zero failures.

- [ ] **Step 5: Commit the storage boundary**

```powershell
git add -- wechat-game/assets/scripts/platform/LocalProgressStore.ts wechat-game/tests/local-progress-store.test.ts
git commit -m "feat: persist stamina independently"
```

---

### Task 3: 激励广告体力协调器

**Files:**
- Create: `wechat-game/assets/scripts/platform/rewarded-stamina.ts`
- Create: `wechat-game/tests/rewarded-stamina.test.ts`
- Modify: `wechat-game/assets/scripts/platform/rewarded-bottle.ts`

**Interfaces:**
- Consumes: existing `RewardedAdPort` and `RewardedAdResult`.
- Produces: `RewardedStaminaCoordinator.run(online): Promise<RewardedAdResult | 'offline' | 'busy'>`.
- The existing bottle reward coordinator continues to behave byte-for-byte; move only shared ad result/port type declarations if needed.

- [ ] **Step 1: Write failing coordinator tests**

```ts
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
```

- [ ] **Step 2: Run and verify RED**

Run: `cd wechat-game; node --experimental-strip-types --test tests/rewarded-stamina.test.ts`

Expected: FAIL because the coordinator module does not exist.

- [ ] **Step 3: Implement the coordinator with the existing port**

```ts
export class RewardedStaminaCoordinator {
  private running = false;
  constructor(private readonly ad: RewardedAdPort) {}

  async run(online: boolean): Promise<RewardedStaminaStatus> {
    if (!online) return 'offline';
    if (this.running) return 'busy';
    this.running = true;
    try { return await this.ad.show(); }
    catch { return 'failed'; }
    finally { this.running = false; }
  }
}
```

- [ ] **Step 4: Run both reward suites and verify GREEN**

Run: `cd wechat-game; node --experimental-strip-types --test tests/rewarded-bottle.test.ts tests/rewarded-stamina.test.ts`

Expected: bottle and stamina reward tests pass with zero failures.

- [ ] **Step 5: Commit the ad coordinator**

```powershell
git add -- wechat-game/assets/scripts/platform/rewarded-bottle.ts wechat-game/assets/scripts/platform/rewarded-stamina.ts wechat-game/tests/rewarded-stamina.test.ts
git commit -m "feat: coordinate rewarded stamina ads"
```

---

### Task 4: 弹窗场景状态和布局契约

**Files:**
- Modify: `wechat-game/assets/scripts/core/scene-flow.ts`
- Modify: `wechat-game/tests/scene-flow.test.ts`
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`

**Interfaces:**
- Extends `SceneFlowState` with `staminaDialogOpen` and `exitConfirmOpen`.
- Produces `openStaminaDialog()`、`closeStaminaDialog()`、`openExitConfirm()`、`closeExitConfirm()`.
- Produces `STAMINA_LAYOUT` and `formatRecoveryCountdown(ms)`.

- [ ] **Step 1: Add failing scene and layout tests**

```ts
test('stamina and exit overlays are mutually exclusive and navigation closes both', () => {
  const home = openStaminaDialog(createSceneFlow());
  assert.equal(home.staminaDialogOpen, true);
  const level = enterSelectedLevel(closeStaminaDialog(home), 'level-001', true);
  const exit = openExitConfirm(level);
  assert.equal(exit.exitConfirmOpen, true);
  assert.equal(exit.settingsOpen, false);
  assert.equal(openExitConfirm(createSceneFlow()), createSceneFlow());
  assert.equal(returnHome(exit).exitConfirmOpen, false);
});

test('stamina layouts stay clear of home title and WeChat capsule', () => {
  assert.equal(formatRecoveryCountdown(1_800_000), '30:00');
  assert.equal(formatRecoveryCountdown(1), '00:01');
  assert.ok(STAMINA_LAYOUT.homeBar.x - STAMINA_LAYOUT.homeBar.width / 2 >= 4);
  assert.ok(STAMINA_LAYOUT.homeBar.x + STAMINA_LAYOUT.homeBar.width / 2 <= 158);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `cd wechat-game; node --experimental-strip-types --test tests/scene-flow.test.ts tests/presentation-layout.test.ts`

Expected: FAIL because overlay fields, actions and stamina layout do not exist.

- [ ] **Step 3: Implement explicit overlay state**

Every navigation constructor must close both overlays. `openExitConfirm()` returns the same object unless `scene === 'level'`; when it opens, it also sets `settingsOpen: false` and `staminaDialogOpen: false`. `openStaminaDialog()` closes settings and exit confirmation.

Add one frozen layout contract with measured rectangles:

```ts
export const STAMINA_LAYOUT = Object.freeze({
  homeBar: Object.freeze({ x: 80, y: 330, width: 148, height: 46 }),
  dialog: Object.freeze({ x: 0, y: -8, width: 321, height: 430 }),
  close: Object.freeze({ x: 118, y: 166, width: 48, height: 48 }),
  adButton: Object.freeze({ x: 0, y: -72, width: 240, height: 72 }),
  exitDialog: Object.freeze({ x: 0, y: -12, width: 304, height: 310 }),
  exitConfirm: Object.freeze({ x: 0, y: -48, width: 224, height: 64 }),
  exitCancel: Object.freeze({ x: 0, y: -120, width: 224, height: 56 }),
});
```

`formatRecoveryCountdown()` uses `Math.ceil`, clamps negative/invalid input to zero, and emits fixed `MM:SS`.

- [ ] **Step 4: Run scene and layout tests and verify GREEN**

Run: `cd wechat-game; node --experimental-strip-types --test tests/scene-flow.test.ts tests/presentation-layout.test.ts`

Expected: all scene and layout tests pass.

- [ ] **Step 5: Commit state and layout contracts**

```powershell
git add -- wechat-game/assets/scripts/core/scene-flow.ts wechat-game/tests/scene-flow.test.ts wechat-game/assets/scripts/presentation/presentation-layout.ts wechat-game/tests/presentation-layout.test.ts
git commit -m "feat: define stamina overlay flow"
```

---

### Task 5: 体力素材和生产 UI 集成

**Files:**
- Create: `prototype/public/assets/game/chibi/ui/stamina-icons.png`
- Create: `wechat-game/assets/resources/game/chibi/ui/stamina-icons.png`
- Create: `wechat-game/assets/resources/game/chibi/ui/stamina-icons.png.meta`
- Modify: `wechat-game/assets/resources/game/sync-report.json`
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`
- Modify: `wechat-game/AGENTS.md`
- Modify: `prototype/AGENTS.md`

**Interfaces:**
- Consumes: stamina rules/store/coordinator/scene/layout from Tasks 1–4 and existing `badge-plus.png`.
- Produces: rendered home stamina bar, refill modal, exit confirmation, foreground reconciliation and one-second label refresh.

- [ ] **Step 1: Add failing production contracts**

Add source-level contracts that require:

```ts
assert.match(bootstrap, /private stamina: StaminaState/);
assert.match(bootstrap, /this\.store\.loadStamina\(Date\.now\(\)\)/);
assert.match(bootstrap, /spendStamina\(this\.stamina, Date\.now\(\)\)/);
assert.match(bootstrap, /grantAdStamina\(this\.stamina, Date\.now\(\)\)/);
assert.match(bootstrap, /看广告 · 恢复 5 点/);
assert.match(bootstrap, /返回主页将消耗 1 点体力/);
assert.match(bootstrap, /game\/chibi\/ui\/stamina-icons\/spriteFrame/);
```

Also require completion progress to be saved before stamina deduction, stamina before session clearing, and `switchLevel()` to open the stamina dialog instead of entering when the reconciled value is zero.

- [ ] **Step 2: Run and verify RED**

Run: `cd wechat-game; node --experimental-strip-types --test tests/production-contracts.test.ts`

Expected: FAIL because stamina is not integrated.

- [ ] **Step 3: Generate and inspect the icon sheet**

Use the ImageGen skill to create one 256×128 two-cell transparent PNG. Left cell: glossy red alchemy heart with cream highlight, dark-purple outline and no text. Right cell: white-and-warm-gold rewarded-video camera/play icon with dark-purple outline and no text. Match the existing cute storybook UI, center each icon in its 128×128 cell, keep 16 px transparent padding, and keep the final optimized file under 128 KiB.

Inspect the generated file at original resolution, post-process only the background transparency, copy the exact approved bytes to both prototype and Cocos resource paths, and create/load a Cocos `sprite-frame` meta file. Do not generate or edit any other art.

- [ ] **Step 4: Implement production behavior minimally**

At startup:

```ts
this.stamina = this.store.loadStamina(Date.now());
const rewardPorts = this.platform.createRewardedPorts(REWARDED_AD_UNIT_ID);
this.rewarded = new RewardedBottleCoordinator(rewardPorts.ad, rewardPorts.claims);
this.staminaRewarded = new RewardedStaminaCoordinator(rewardPorts.ad);
```

Use `update(deltaTime)` with a one-second accumulator. Each tick reconciles stamina, saves only when the immutable state object changes, then updates existing home/modal labels directly. Do not rebuild the whole surface every second.

Before `switchLevel()` enters a level, reconcile and persist stamina. If `value === 0`, set `flow = openStaminaDialog(flow)`, render, and return. On successful completion, keep the required order:

```ts
this.store.saveProgress(nextProgress);
this.consumeOneStamina();
this.store.clearSession(this.session.levelId);
```

`consumeOneStamina()` calls `spendStamina`, updates the field, and persists exactly once. Confirmed exit saves the current session, consumes once, returns home and renders. Cancelled exit only closes the overlay.

The ad handler uses `RewardedStaminaCoordinator.run(this.platform.isOnline())`; only `completed` grants and persists stamina. Use the existing reward failure wording for offline/cancelled/failed/unconfigured cases and share the existing busy lock so bottle and stamina ads cannot overlap.

Render overlays after settings in this order: settings, stamina dialog, exit confirmation. Each overlay owns a full-screen `BlockInputEvents` shield. The home bar and dialog labels store `Label` references for one-second updates.

- [ ] **Step 5: Record durable product decisions**

Add the confirmed constants, deduction rules, independent storage boundary, no force-close deduction, and local-only ad reward scope to both AGENTS files. Do not alter unrelated decisions.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
cd wechat-game
node --experimental-strip-types --test tests/stamina.test.ts tests/local-progress-store.test.ts tests/rewarded-stamina.test.ts tests/scene-flow.test.ts tests/presentation-layout.test.ts tests/production-contracts.test.ts
```

Expected: all focused suites pass, zero failures.

- [ ] **Step 7: Commit only stamina integration files**

```powershell
git add -- prototype/public/assets/game/chibi/ui/stamina-icons.png prototype/AGENTS.md wechat-game/AGENTS.md wechat-game/assets/resources/game/chibi/ui/stamina-icons.png wechat-game/assets/resources/game/chibi/ui/stamina-icons.png.meta wechat-game/assets/resources/game/sync-report.json wechat-game/assets/scripts/presentation/ProductionBootstrap.ts wechat-game/tests/production-contracts.test.ts
git commit -m "feat: add stamina refill experience"
```

---

### Task 6: 全量验证、微信构建和同步

**Files:**
- Verify only: all changed files from Tasks 1–5
- Build output: `wechat-game/build/wechatgame`
- Sync target: `D:\codex_pro\my_game_water\wechat-game\build\wechatgame`

**Interfaces:**
- Consumes: completed stamina feature.
- Produces: verified Cocos/WeChat build with AppID `wx44e5e0b648b140ce`.

- [ ] **Step 1: Run the full core suite**

Run: `cd wechat-game; node --experimental-strip-types --test tests/*.test.ts`

Expected: all tests pass, zero failures.

- [ ] **Step 2: Check generated level data remains unchanged**

Run: `cd wechat-game; node --experimental-strip-types tools/generate-levels.ts --check`

Expected: committed levels match deterministic generation; no generated file changes.

- [ ] **Step 3: Build with Cocos Creator 3.8.8**

Run the existing release build configuration:

```powershell
$creatorArgs = @(
  '--project', 'D:\codex_pro\my_game_water\.worktrees\chapter-one-collection\wechat-game',
  '--build', 'configPath=D:\codex_pro\my_game_water\.worktrees\chapter-one-collection\wechat-game\temp\wechat-release-build.json'
)
Start-Process -FilePath 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe' `
  -ArgumentList $creatorArgs -Wait -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput 'temp\stamina-build.stdout.log' `
  -RedirectStandardError 'temp\stamina-build.stderr.log'
```

Expected: stdout contains `build Task (wechatgame) Finished`. The known empty `C:\Users\cxl\.CocosCreator\editor\window.json` warning may still return process code 36; do not call the build successful unless the completion marker and output files both exist.

- [ ] **Step 4: Prepare and test the WeChat package**

```powershell
$env:WECHAT_APPID='wx44e5e0b648b140ce'
node tools/prepare-wechat-build.mjs
node --test tests/wechat-build-preparation.test.mjs
$env:WECHAT_APPID='wx44e5e0b648b140ce'
node tools/prepare-wechat-build.mjs
```

Expected: WeChat preparation tests pass and `project.config.json` contains the configured AppID.

- [ ] **Step 5: Sync the exact build and verify hashes**

Use `robocopy /E` from the worktree build directory to `D:\codex_pro\my_game_water\wechat-game\build\wechatgame`. Verify source and target SHA256 for `assets/main/index.js` match, `project.config.json` AppID is correct, compiled bundle contains `体力补给` and `看广告 · 恢复 5 点`, and the resources subpackage contains `stamina-icons`.

- [ ] **Step 6: Final manual acceptance in WeChat Developer Tools**

Import the exact target directory, compile, then verify these paths:

1. 首页体力条打开补给弹窗。
2. 满体力广告按钮禁用。
3. 体力为 0 时关卡入口打开补给弹窗。
4. 开发模拟完整广告后增加 5 且封顶 10。
5. 通关扣 1。
6. 关卡中返回主页先确认；取消不扣，确认扣 1。
7. 返回前台后恢复时间正确刷新。

Do not claim visual completion until the user confirms the WeChat preview matches the screenshots' information hierarchy and the game's established purple-gold art direction.
