# 《暮影炼金室》启动加载页实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Cocos Creator 微信小游戏增加真实资源进度、最短展示时间、淡出转场和失败重试完整可用的启动加载页。

**Architecture:** 在 `presentation/launch-loading.ts` 中实现无 `cc` 依赖的不可变启动状态机，`presentation-layout.ts` 负责固定布局与进度填充几何，`ProductionBootstrap` 负责 Cocos 资源回调、节点和转场。启动加载阶段不进入 `SceneFlowState`，首页渲染与首次云同步都由加载门控统一放行。

**Tech Stack:** TypeScript、Node.js `node:test`、Cocos Creator 3.8.8、Cocos `resources.preloadDir`/`tween`/`UIOpacity`、微信小游戏构建。

**Spec:** `docs/superpowers/specs/2026-08-24-launch-loading-screen-design.md`

## Global Constraints

- 设计分辨率固定为 `393×852`。
- `resources.preloadDir('game')` 是进入首页前唯一的完整资源就绪条件，禁止假进度。
- 启动页从首次可见起至少展示 `900ms`，满足条件后淡出 `220ms`。
- 加载中的百分比封顶 `99%`，只有成功完成回调显示 `100%`。
- 失败必须显示“资源加载失败，请检查网络或存储空间”和“重新加载”，重试必须幂等。
- 首次云同步必须延后到首页已经渲染之后，离线本地启动不能被网络阻塞。
- 只复用 `assets/resources/game/` 中已批准的炼金室、女巫、按钮、字体和粒子资源。
- 页面不得显示虚构的公司名、ISBN、审批号、出版单位或软件著作权信息。
- 不修改 `core`、关卡数据、第一章 1–15 关、5×3 棋盘、存档结构或 CloudBase 协议。
- 工作树已有粒子、字体、文案等未提交改动；每次提交只暂存本任务列出的精确文件，绝不清理或覆盖其他改动。

## 文件结构

- Create: `wechat-game/assets/scripts/presentation/launch-loading.ts` — 纯启动状态、真实进度归一化、最短时长门控、失败与重试幂等。
- Create: `wechat-game/assets/scripts/presentation/launch-loading.ts.meta` — 由 Cocos Creator 3.8.8 首次导入后生成并保留。
- Create: `wechat-game/tests/launch-loading.test.ts` — 状态机和边界单元测试。
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts` — 启动页固定布局、健康忠告和进度填充几何。
- Modify: `wechat-game/tests/presentation-layout.test.ts` — 启动页安全区和进度几何测试。
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts` — 启动页节点、真实预加载、淡出、错误与重试、首页门控。
- Modify: `wechat-game/tests/production-contracts.test.ts` — 生产启动顺序和资源 API 契约测试。
- Modify: `wechat-game/package.json` — 将新单元测试加入 `test:core` 固定测试列表。

---

### Task 1: 纯启动加载状态机

**Files:**
- Create: `wechat-game/assets/scripts/presentation/launch-loading.ts`
- Create: `wechat-game/tests/launch-loading.test.ts`
- Modify: `wechat-game/package.json`

**Interfaces:**
- Consumes: `Date.now()` 产生的毫秒时间、Cocos 进度回调的 `finished/total`、当前加载尝试编号。
- Produces: `LaunchLoadingState`、`createLaunchLoadingState()`、`updateLaunchProgress()`、`completeLaunchResources()`、`failLaunchResources()`、`markLaunchMinimumVisible()`、`retryLaunch()`、`beginLaunchExit()`、`canExitLaunch()`。

- [ ] **Step 1: 写进度归一化和完成门控失败测试**

在 `wechat-game/tests/launch-loading.test.ts` 写入：

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beginLaunchExit,
  canExitLaunch,
  completeLaunchResources,
  createLaunchLoadingState,
  failLaunchResources,
  markLaunchMinimumVisible,
  retryLaunch,
  updateLaunchProgress,
} from '../assets/scripts/presentation/launch-loading.ts';

test('launch progress clamps invalid values, never regresses, and reserves 100 for completion', () => {
  let state = createLaunchLoadingState(1_000);
  assert.deepEqual([state.progress, state.percent], [0, 0]);
  state = updateLaunchProgress(state, 1, 3, 10);
  assert.deepEqual([state.progress, state.percent], [0.3, 30]);
  state = updateLaunchProgress(state, 1, 2, 10);
  assert.deepEqual([state.progress, state.percent], [0.3, 30]);
  state = updateLaunchProgress(state, 1, 99, 10);
  assert.deepEqual([state.progress, state.percent], [1, 99]);
  state = updateLaunchProgress(state, 1, Number.NaN, Number.POSITIVE_INFINITY);
  assert.deepEqual([state.progress, state.percent], [1, 99]);
  state = completeLaunchResources(state, 1);
  assert.deepEqual([state.progress, state.percent, state.resourcesReady], [1, 100, true]);
});

test('launch exits only after resources and the 900ms minimum are both ready', () => {
  let state = createLaunchLoadingState(1_000);
  state = completeLaunchResources(state, 1);
  assert.equal(canExitLaunch(state), false);
  state = markLaunchMinimumVisible(state, 1_899);
  assert.equal(canExitLaunch(state), false);
  state = markLaunchMinimumVisible(state, 1_900);
  assert.equal(state.phase, 'ready');
  assert.equal(canExitLaunch(state), true);
  state = beginLaunchExit(state);
  assert.equal(state.phase, 'exiting');
  assert.equal(canExitLaunch(state), false);
});
```

- [ ] **Step 2: 写失败、重试和过期回调测试**

继续追加：

```ts
test('failed launch retries once and ignores stale callbacks', () => {
  let state = createLaunchLoadingState(1_000);
  state = failLaunchResources(state, 1, 'broken');
  assert.deepEqual([state.phase, state.errorMessage], ['failed', 'broken']);
  assert.equal(canExitLaunch(state), false);

  state = retryLaunch(state);
  assert.deepEqual([state.attempt, state.phase, state.progress, state.percent], [2, 'loading', 0, 0]);
  const sameRetry = retryLaunch(state);
  assert.equal(sameRetry, state);

  const staleProgress = updateLaunchProgress(state, 1, 9, 10);
  const staleComplete = completeLaunchResources(state, 1);
  assert.equal(staleProgress, state);
  assert.equal(staleComplete, state);

  state = markLaunchMinimumVisible(state, 1_900);
  state = completeLaunchResources(state, 2);
  assert.equal(state.phase, 'ready');
  const duplicateComplete = completeLaunchResources(state, 2);
  assert.equal(duplicateComplete, state);
});

test('zero and negative totals stay at zero before completion', () => {
  let state = createLaunchLoadingState(0);
  state = updateLaunchProgress(state, 1, 0, 0);
  assert.deepEqual([state.progress, state.percent], [0, 0]);
  state = updateLaunchProgress(state, 1, 4, -1);
  assert.deepEqual([state.progress, state.percent], [0, 0]);
});
```

- [ ] **Step 3: 运行测试确认因模块不存在而失败**

Run:

```powershell
cd D:\codex_pro\my_game_water\wechat-game
node --experimental-strip-types --test tests/launch-loading.test.ts
```

Expected: FAIL，错误包含 `ERR_MODULE_NOT_FOUND` 和 `launch-loading.ts`。

- [ ] **Step 4: 实现最小不可变状态机**

创建 `wechat-game/assets/scripts/presentation/launch-loading.ts`：

```ts
export const LAUNCH_MIN_VISIBLE_MS = 900;

export type LaunchLoadingPhase = 'loading' | 'failed' | 'ready' | 'exiting';

export interface LaunchLoadingState {
  readonly attempt: number;
  readonly phase: LaunchLoadingPhase;
  readonly progress: number;
  readonly percent: number;
  readonly startedAt: number;
  readonly resourcesReady: boolean;
  readonly minimumVisibleReady: boolean;
  readonly errorMessage: string | null;
}

function freeze(state: LaunchLoadingState): LaunchLoadingState {
  return Object.freeze(state);
}

function withReadyPhase(state: LaunchLoadingState): LaunchLoadingState {
  if (state.phase === 'loading' && state.resourcesReady && state.minimumVisibleReady) {
    return freeze({ ...state, phase: 'ready' });
  }
  return state;
}

export function createLaunchLoadingState(startedAt: number): LaunchLoadingState {
  return freeze({
    attempt: 1,
    phase: 'loading',
    progress: 0,
    percent: 0,
    startedAt: Number.isFinite(startedAt) ? startedAt : 0,
    resourcesReady: false,
    minimumVisibleReady: false,
    errorMessage: null,
  });
}

export function updateLaunchProgress(
  state: LaunchLoadingState,
  attempt: number,
  finished: number,
  total: number,
): LaunchLoadingState {
  if (state.phase !== 'loading' || state.attempt !== attempt) return state;
  const candidate = Number.isFinite(finished) && Number.isFinite(total) && total > 0
    ? Math.min(1, Math.max(0, finished / total))
    : 0;
  const progress = Math.max(state.progress, candidate);
  const percent = Math.min(99, Math.floor(progress * 100));
  if (progress === state.progress && percent === state.percent) return state;
  return freeze({ ...state, progress, percent });
}

export function completeLaunchResources(state: LaunchLoadingState, attempt: number): LaunchLoadingState {
  if (state.phase !== 'loading' || state.attempt !== attempt) return state;
  return withReadyPhase(freeze({ ...state, progress: 1, percent: 100, resourcesReady: true }));
}

export function failLaunchResources(
  state: LaunchLoadingState,
  attempt: number,
  errorMessage: string,
): LaunchLoadingState {
  if (state.phase !== 'loading' || state.attempt !== attempt) return state;
  return freeze({ ...state, phase: 'failed', errorMessage });
}

export function markLaunchMinimumVisible(state: LaunchLoadingState, now: number): LaunchLoadingState {
  if (state.phase === 'exiting' || state.minimumVisibleReady) return state;
  if (!Number.isFinite(now) || now - state.startedAt < LAUNCH_MIN_VISIBLE_MS) return state;
  return withReadyPhase(freeze({ ...state, minimumVisibleReady: true }));
}

export function retryLaunch(state: LaunchLoadingState): LaunchLoadingState {
  if (state.phase !== 'failed') return state;
  return freeze({
    ...state,
    attempt: state.attempt + 1,
    phase: 'loading',
    progress: 0,
    percent: 0,
    resourcesReady: false,
    errorMessage: null,
  });
}

export function canExitLaunch(state: LaunchLoadingState): boolean {
  return state.phase === 'ready' && state.resourcesReady && state.minimumVisibleReady;
}

export function beginLaunchExit(state: LaunchLoadingState): LaunchLoadingState {
  return canExitLaunch(state) ? freeze({ ...state, phase: 'exiting' }) : state;
}
```

- [ ] **Step 5: 将测试加入固定套件并运行**

在 `wechat-game/package.json` 的 `test:core` 命令末尾加入 `tests/launch-loading.test.ts`，然后运行：

```powershell
cd D:\codex_pro\my_game_water\wechat-game
node --experimental-strip-types --test tests/launch-loading.test.ts
npm run test:core
```

Expected: 新文件 4 个测试 PASS；完整套件 PASS。

- [ ] **Step 6: 提交状态机**

```powershell
cd D:\codex_pro\my_game_water
git add -- wechat-game/assets/scripts/presentation/launch-loading.ts wechat-game/tests/launch-loading.test.ts wechat-game/package.json
git commit -m "feat: model launch loading lifecycle"
```

---

### Task 2: 启动页布局与进度几何

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `LaunchLoadingState.progress`。
- Produces: `LAUNCH_LAYOUT`、`HEALTHY_GAME_ADVICE_LINES`、`launchProgressFill(progress)`。

- [ ] **Step 1: 写安全区和填充几何失败测试**

在 `wechat-game/tests/presentation-layout.test.ts` 的 import 中加入 `HEALTHY_GAME_ADVICE_LINES`、`LAUNCH_LAYOUT`、`launchProgressFill`，并追加：

```ts
test('launch screen keeps every required element inside the 393 by 852 safe frame', () => {
  assert.deepEqual(LAUNCH_LAYOUT.ageBadge, { x: -155, y: 376, width: 42, height: 42 });
  assert.deepEqual(LAUNCH_LAYOUT.title, { x: 0, y: 235, width: 330, height: 74 });
  assert.deepEqual(LAUNCH_LAYOUT.witch, { x: 0, y: 22, width: 260, height: 260 });
  assert.deepEqual(LAUNCH_LAYOUT.progressTrack, { x: 0, y: -230, width: 300, height: 18 });
  assert.deepEqual(LAUNCH_LAYOUT.percent, { x: 0, y: -265, width: 120, height: 32 });
  assert.deepEqual(LAUNCH_LAYOUT.status, { x: 0, y: -290, width: 330, height: 32 });
  assert.deepEqual(LAUNCH_LAYOUT.retryButton, { x: 0, y: -334, width: 224, height: 56 });
  assert.deepEqual(LAUNCH_LAYOUT.adviceCenters, [-374, -394]);
  assert.equal(HEALTHY_GAME_ADVICE_LINES.join(''),
    '抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。');

  for (const rect of [LAUNCH_LAYOUT.ageBadge, LAUNCH_LAYOUT.title, LAUNCH_LAYOUT.witch,
    LAUNCH_LAYOUT.progressTrack, LAUNCH_LAYOUT.percent, LAUNCH_LAYOUT.status, LAUNCH_LAYOUT.retryButton]) {
    assert.ok(Math.abs(rect.x) + rect.width / 2 <= 393 / 2);
    assert.ok(Math.abs(rect.y) + rect.height / 2 <= 852 / 2);
  }
});

test('launch progress fill grows from the left edge and clamps to the track', () => {
  assert.deepEqual(launchProgressFill(-1), { x: -148, width: 0 });
  assert.deepEqual(launchProgressFill(0), { x: -148, width: 0 });
  assert.deepEqual(launchProgressFill(0.5), { x: -74, width: 148 });
  assert.deepEqual(launchProgressFill(1), { x: 0, width: 296 });
  assert.deepEqual(launchProgressFill(2), { x: 0, width: 296 });
  assert.deepEqual(launchProgressFill(Number.NaN), { x: -148, width: 0 });
});
```

- [ ] **Step 2: 运行目标测试确认失败**

Run:

```powershell
cd D:\codex_pro\my_game_water\wechat-game
node --experimental-strip-types --test tests/presentation-layout.test.ts
```

Expected: FAIL，提示 `LAUNCH_LAYOUT` 或 `launchProgressFill` 未导出。

- [ ] **Step 3: 实现固定布局、忠告和填充几何**

在 `presentation-layout.ts` 的首页布局前加入：

```ts
export const HEALTHY_GAME_ADVICE_LINES = Object.freeze([
  '抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。',
  '适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。',
] as const);

export const LAUNCH_LAYOUT = Object.freeze({
  ageBadge: Object.freeze({ x: -155, y: 376, width: 42, height: 42 }),
  title: Object.freeze({ x: 0, y: 235, width: 330, height: 74 }),
  witch: Object.freeze({ x: 0, y: 22, width: 260, height: 260 }),
  progressTrack: Object.freeze({ x: 0, y: -230, width: 300, height: 18 }),
  percent: Object.freeze({ x: 0, y: -265, width: 120, height: 32 }),
  status: Object.freeze({ x: 0, y: -290, width: 330, height: 32 }),
  retryButton: Object.freeze({ x: 0, y: -334, width: 224, height: 56 }),
  adviceCenters: Object.freeze([-374, -394] as const),
});

export function launchProgressFill(progress: number): Readonly<{ x: number; width: number }> {
  const normalized = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const fullWidth = LAUNCH_LAYOUT.progressTrack.width - 4;
  const width = fullWidth * normalized;
  return Object.freeze({
    x: -fullWidth / 2 + width / 2,
    width,
  });
}
```

- [ ] **Step 4: 运行布局测试和完整套件**

```powershell
cd D:\codex_pro\my_game_water\wechat-game
node --experimental-strip-types --test tests/presentation-layout.test.ts
npm run test:core
```

Expected: 启动页布局测试 PASS；现有粒子、字体和按钮测试继续 PASS；完整套件 PASS。

- [ ] **Step 5: 提交布局契约**

```powershell
cd D:\codex_pro\my_game_water
git add -- wechat-game/assets/scripts/presentation/presentation-layout.ts wechat-game/tests/presentation-layout.test.ts
git commit -m "feat: define launch screen layout"
```

---

### Task 3: 真实预加载与成功转场

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`

**Interfaces:**
- Consumes: Task 1 的状态机 API；Task 2 的 `LAUNCH_LAYOUT`、`HEALTHY_GAME_ADVICE_LINES`、`launchProgressFill()`；现有 `addSprite()`、`addLabel()`、`addPanel()`、`addWitch()` 和药水粒子帮助函数。
- Produces: `renderLaunch()`、`startLaunchPreload()`、`updateLaunchView()`、`tryExitLaunch()`、`enterHomeAfterLaunch()`；首页和首次云同步的单一放行点。

- [ ] **Step 1: 写真实预加载和启动顺序失败契约**

在 `production-contracts.test.ts` 追加：

```ts
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
```

- [ ] **Step 2: 运行契约测试确认失败**

```powershell
cd D:\codex_pro\my_game_water\wechat-game
node --experimental-strip-types --test tests/production-contracts.test.ts
```

Expected: FAIL，缺少 `renderLaunch`、`preloadDir('game')` 和 `UIOpacity`。

- [ ] **Step 3: 接入状态、引用和启动字段**

在 `ProductionBootstrap.ts`：

1. 从 `cc` 增加 `UIOpacity` import。
2. 从 `launch-loading.ts` import：

```ts
import {
  LAUNCH_MIN_VISIBLE_MS,
  beginLaunchExit,
  canExitLaunch,
  completeLaunchResources,
  createLaunchLoadingState,
  markLaunchMinimumVisible,
  updateLaunchProgress,
  type LaunchLoadingState,
} from './launch-loading.ts';
```

3. 从 `presentation-layout.ts` 增加 `HEALTHY_GAME_ADVICE_LINES`、`LAUNCH_LAYOUT`、`launchProgressFill`。
4. 在类字段中增加：

```ts
private launchState: LaunchLoadingState = createLaunchLoadingState(Date.now());
private launchProgressFill: Node | null = null;
private launchPercentLabel: Label | null = null;
private launchStatusLabel: Label | null = null;
private launchRetryButton: Node | null = null;
```

- [ ] **Step 4: 将 start 改为先显示启动页再预加载**

保留现有本地进度、声音、奖励、云协调器和生命周期初始化，但把结尾改为：

```ts
this.launchState = createLaunchLoadingState(Date.now());
this.renderLaunch();
this.scheduleOnce(() => {
  this.launchState = markLaunchMinimumVisible(this.launchState, Date.now());
  this.tryExitLaunch();
}, LAUNCH_MIN_VISIBLE_MS / 1000);
resources.load(ART_FONT_RESOURCE, Font, (error, font) => {
  if (error || !this.node.isValid) return;
  this.artFont = font;
  for (const label of this.surface?.getComponentsInChildren(Label) ?? []) label.font = font;
});
this.startLaunchPreload();
```

删除 `start()` 末尾原有的 `this.render()` 和 `void this.syncCloudProgress()`。把平台前台闭包改为 `() => this.handlePlatformForeground()`，并新增：

```ts
private handlePlatformForeground(): void {
  this.audio?.setForeground(true);
  if (!this.isLaunchActive()) void this.syncCloudProgress();
}

private isLaunchActive(): boolean {
  return this.launchState.phase !== 'exiting' || this.surface?.name === 'LaunchSurface';
}
```

这样 `start()` 本身不再包含同步调用；加载期间只恢复音频前台状态。

- [ ] **Step 5: 创建启动页成功态节点**

新增 `renderLaunch()`，按以下固定层级创建：

```ts
private renderLaunch(): void {
  this.renderToken += 1;
  this.surface?.destroy();
  this.surface = new Node('LaunchSurface');
  this.surface.addComponent(UITransform).setContentSize(393, 852);
  this.surface.addComponent(BlockInputEvents);
  this.node.addChild(this.surface);
  const root = this.surface;
  const token = this.renderToken;

  this.addPanel(root, 393, 852, 0, 0, color('#13091F'));
  this.addSprite(root, 'game/chibi/background/alchemy-room/spriteFrame', 393, 852, 0, 0, token);
  this.addPanel(root, 393, 852, 0, 0, color('#12081F', 94));
  this.addPanel(root, 42, 42, LAUNCH_LAYOUT.ageBadge.x, LAUNCH_LAYOUT.ageBadge.y,
    color('#271034', 224), color('#E9C477'), 12);
  this.addLabel(root, '8+', 14, LAUNCH_LAYOUT.ageBadge.x, LAUNCH_LAYOUT.ageBadge.y,
    color('#FFF0C2'), LAUNCH_LAYOUT.ageBadge.width);
  this.addLabel(root, '暮影炼金室', 36, LAUNCH_LAYOUT.title.x, LAUNCH_LAYOUT.title.y,
    color('#FFE2A0'), LAUNCH_LAYOUT.title.width);
  this.addLaunchWitch(root);

  const track = LAUNCH_LAYOUT.progressTrack;
  this.addPanel(root, track.width, track.height, track.x, track.y,
    color('#1E0D2D', 232), color('#C99CE9', 180), 9);
  this.launchProgressFill = this.addPanel(root, 0, track.height - 4, track.x - 148, track.y,
    color('#DCA6FF'), undefined, 7);
  this.launchPercentLabel = this.addLabel(root, '0%', 13, LAUNCH_LAYOUT.percent.x,
    LAUNCH_LAYOUT.percent.y, color('#F7E6FF'), LAUNCH_LAYOUT.percent.width).getComponent(Label);
  this.launchStatusLabel = this.addLabel(root, '正在准备炼金室…', 11,
    LAUNCH_LAYOUT.status.x, LAUNCH_LAYOUT.status.y,
    color('#DCC7E8'), LAUNCH_LAYOUT.status.width).getComponent(Label);
  HEALTHY_GAME_ADVICE_LINES.forEach((line, index) => {
    this.addLabel(root, line, 8, 0, LAUNCH_LAYOUT.adviceCenters[index], color('#BDAFC4'), 360);
  });
  this.renderLaunchAmbientParticles(root, token);
  this.updateLaunchView();
}
```

启动页女巫不能复用会调用 `handleWitchSettled()` 的关卡回调，新增专用帮助函数：

```ts
private addLaunchWitch(root: Node): void {
  const stage = LAUNCH_LAYOUT.witch;
  const node = new Node('LaunchWitchAnimator');
  node.setPosition(stage.x, stage.y);
  node.addComponent(UITransform).setContentSize(stage.width, stage.height);
  root.addChild(node);
  node.addComponent(WitchAnimator).play('idle', () => undefined);
}
```

`renderLaunchAmbientParticles()` 固定创建 6 个节点，不得调用随机数：

```ts
private renderLaunchAmbientParticles(root: Node, token: number): void {
  const particles: readonly Readonly<{ x: number; y: number; layer: PotionColor }>[] = [
    { x: -108, y: 72, layer: 'violet' },
    { x: 105, y: 56, layer: 'cyan' },
    { x: -82, y: -55, layer: 'gold' },
    { x: 88, y: -78, layer: 'violet' },
    { x: -126, y: 155, layer: 'cyan' },
    { x: 126, y: 142, layer: 'gold' },
  ];
  particles.forEach((entry, index) => {
    const anchor = new Node(`LaunchParticleAnchor-${index + 1}`);
    anchor.setPosition(entry.x, entry.y);
    root.addChild(anchor);
    const visual = potionParticleVisuals(20260824, index, 0, 'idle')[index % 2];
    this.addPotionParticle(anchor, entry.layer, visual, 'idle', token);
  });
}
```

- [ ] **Step 6: 实现真实进度更新与成功淡出**

新增以下协调方法；`redrawLaunchFill()` 必须更新 `UITransform`、节点 x 坐标并清空重画 `Graphics`，保证填充从左侧增长：

```ts
private startLaunchPreload(): void {
  const attempt = this.launchState.attempt;
  resources.preloadDir('game', (finished, total) => {
    if (!this.node.isValid) return;
    this.launchState = updateLaunchProgress(this.launchState, attempt, finished, total);
    this.updateLaunchView();
  }, (error) => {
    if (!this.node.isValid || error) return;
    this.launchState = completeLaunchResources(this.launchState, attempt);
    this.updateLaunchView();
    this.tryExitLaunch();
  });
}

private updateLaunchView(): void {
  const fill = launchProgressFill(this.launchState.progress);
  if (this.launchProgressFill?.isValid) {
    this.launchProgressFill.setPosition(fill.x, LAUNCH_LAYOUT.progressTrack.y);
    this.launchProgressFill.getComponent(UITransform)?.setContentSize(fill.width, LAUNCH_LAYOUT.progressTrack.height - 4);
    const graphics = this.launchProgressFill.getComponent(Graphics);
    if (graphics) {
      graphics.clear();
      graphics.fillColor = color('#DCA6FF');
      graphics.roundRect(-fill.width / 2, -(LAUNCH_LAYOUT.progressTrack.height - 4) / 2,
        fill.width, LAUNCH_LAYOUT.progressTrack.height - 4, 7);
      graphics.fill();
    }
  }
  if (this.launchPercentLabel) this.launchPercentLabel.string = `${this.launchState.percent}%`;
}

private tryExitLaunch(): void {
  if (!canExitLaunch(this.launchState) || !this.surface?.isValid) return;
  this.launchState = beginLaunchExit(this.launchState);
  const opacity = this.surface.getComponent(UIOpacity) ?? this.surface.addComponent(UIOpacity);
  tween(opacity).to(0.22, { opacity: 0 }).call(() => this.enterHomeAfterLaunch()).start();
}

private enterHomeAfterLaunch(): void {
  if (this.launchState.phase !== 'exiting' || !this.node.isValid) return;
  this.render();
  void this.syncCloudProgress();
}
```

实现时将 `preloadDir` 的完成回调错误分支留给 Task 4，当前最小实现可以直接返回，先让成功路径测试通过。平台前台回调使用 Step 4 已定义的 `isLaunchActive()`，只有首页已显示时才同步。

- [ ] **Step 7: 运行契约和完整测试**

```powershell
cd D:\codex_pro\my_game_water\wechat-game
node --experimental-strip-types --test tests/production-contracts.test.ts
npm run test:core
```

Expected: 新启动顺序契约 PASS；完整套件 PASS。

- [ ] **Step 8: 提交成功启动链路**

```powershell
cd D:\codex_pro\my_game_water
git add -- wechat-game/assets/scripts/presentation/ProductionBootstrap.ts wechat-game/tests/production-contracts.test.ts
git commit -m "feat: preload game resources before home"
```

---

### Task 4: 加载失败与幂等重试

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `failLaunchResources()`、`retryLaunch()` 和 attempt 过滤；Task 3 的启动节点引用和 `startLaunchPreload()`。
- Produces: `showLaunchFailure()`、`handleLaunchRetry()`；失败时唯一可交互的九宫格长按钮。

- [ ] **Step 1: 写失败文案、重试和防并发契约测试**

在 `production-contracts.test.ts` 追加：

```ts
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
```

- [ ] **Step 2: 运行契约测试确认失败**

```powershell
cd D:\codex_pro\my_game_water\wechat-game
node --experimental-strip-types --test tests/production-contracts.test.ts
```

Expected: FAIL，缺少失败文案或 `retryLaunch()`。

- [ ] **Step 3: 接入失败状态并渲染重试按钮**

从 `launch-loading.ts` 增加 `failLaunchResources`、`retryLaunch` import。把 `startLaunchPreload()` 完成回调改为：

```ts
}, (error) => {
  if (!this.node.isValid) return;
  if (error) {
    this.launchState = failLaunchResources(
      this.launchState,
      attempt,
      '资源加载失败，请检查网络或存储空间',
    );
    this.showLaunchFailure();
    return;
  }
  this.launchState = completeLaunchResources(this.launchState, attempt);
  this.updateLaunchView();
  this.tryExitLaunch();
});
```

新增：

```ts
private showLaunchFailure(): void {
  if (this.launchState.phase !== 'failed' || !this.surface?.isValid) return;
  if (this.launchProgressFill) this.launchProgressFill.active = false;
  if (this.launchPercentLabel) this.launchPercentLabel.node.active = false;
  if (this.launchStatusLabel) this.launchStatusLabel.string = this.launchState.errorMessage ?? '资源加载失败';
  if (!this.launchRetryButton?.isValid) {
    this.launchRetryButton = this.addRasterButton(this.surface, '重新加载', 'purple',
      LAUNCH_LAYOUT.retryButton.width, LAUNCH_LAYOUT.retryButton.height,
      LAUNCH_LAYOUT.retryButton.x, LAUNCH_LAYOUT.retryButton.y,
      () => this.handleLaunchRetry(), false, undefined, 16);
  }
  const button = this.launchRetryButton.getComponent(Button);
  if (button) button.interactable = true;
  this.launchRetryButton.active = true;
}

private handleLaunchRetry(): void {
  const next = retryLaunch(this.launchState);
  if (next === this.launchState) return;
  this.launchState = next;
  const button = this.launchRetryButton?.getComponent(Button);
  if (button) button.interactable = false;
  if (this.launchRetryButton) this.launchRetryButton.active = false;
  if (this.launchProgressFill) this.launchProgressFill.active = true;
  if (this.launchPercentLabel) this.launchPercentLabel.node.active = true;
  if (this.launchStatusLabel) this.launchStatusLabel.string = '正在重新准备炼金室…';
  this.updateLaunchView();
  this.startLaunchPreload();
}
```

按钮在下一次失败时由 `showLaunchFailure()` 重新设置 `button.interactable = true` 后激活。成功时保持隐藏。根 `BlockInputEvents` 在失败和重试期间都不移除。

- [ ] **Step 4: 运行状态、契约和完整测试**

```powershell
cd D:\codex_pro\my_game_water\wechat-game
node --experimental-strip-types --test tests/launch-loading.test.ts tests/production-contracts.test.ts
npm run test:core
```

Expected: 失败/重试状态测试 PASS；生产契约 PASS；完整套件 PASS。

- [ ] **Step 5: 提交错误与重试路径**

```powershell
cd D:\codex_pro\my_game_water
git add -- wechat-game/assets/scripts/presentation/ProductionBootstrap.ts wechat-game/tests/production-contracts.test.ts
git commit -m "feat: retry failed launch preload"
```

---

### Task 5: Cocos 导入、回归与微信构建验收

**Files:**
- Create: `wechat-game/assets/scripts/presentation/launch-loading.ts.meta`（仅当 Creator 自动生成）
- Verify only: `wechat-game/assets/resources/game/**`
- Verify only: `prototype/**`

**Interfaces:**
- Consumes: Tasks 1–4 的完整启动加载功能。
- Produces: Creator 可导入的脚本元数据、微信小游戏构建产物和最终验证证据。

- [ ] **Step 1: 检查静态关卡和微信端完整测试**

```powershell
cd D:\codex_pro\my_game_water\wechat-game
npm run check:levels
npm run test:core
```

Expected: 关卡生成检查无差异；完整测试全部 PASS。

- [ ] **Step 2: 运行 React 原型保护校验**

```powershell
cd D:\codex_pro\my_game_water\prototype
npm run check:runtime
npm run test:game
npm run test:presentation
npm run test:audio
npm run test:integration
```

Expected: 受保护运行时检查 PASS；游戏、呈现、音频和集成测试全部 PASS。

- [ ] **Step 3: 用 Cocos Creator 3.8.8 导入并构建微信小游戏**

```powershell
& 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe' --project 'D:\codex_pro\my_game_water\wechat-game' --build 'platform=wechatgame;debug=true'
```

Expected: 构建日志出现 `Finished`；没有 `Cannot set properties of null (setting '_sealed')`、脚本编译错误或资源 UUID 缺失。Creator 若生成 `launch-loading.ts.meta`，保留该文件。

- [ ] **Step 4: 检查构建包与启动契约**

```powershell
cd D:\codex_pro\my_game_water\wechat-game
Get-ChildItem -LiteralPath build -Recurse -File | Select-String -Pattern 'LaunchSurface|resources.preloadDir|资源加载失败' | Select-Object -First 20
```

Expected: 构建包中可找到启动页类名/文案或编译后的对应字符串；没有从 `prototype/artifacts/chibi-raw` 引入资源。

- [ ] **Step 5: 在 Creator/微信预览中做视觉与交互验收**

依次验证：

1. 冷启动第一帧有深紫背景、8+、艺术字标题、女巫、粒子、进度框和健康忠告，无黑屏。
2. 进度从真实值增长、不回退、不提前显示 100%，快速缓存命中仍至少展示约 900ms。
3. 100% 后约 220ms 淡出，淡出期间点击不会触发首页。
4. 结合 Task 1 的失败/过期回调单元测试和 Task 4 的生产契约，确认失败文案、九宫格重试按钮与 attempt 过滤均存在，不为视觉检查破坏真实资源。
5. 进入首页后当前关卡、解锁、本地快照、声音偏好、选关和设置均正常，首次云同步不阻塞首页。
6. 页面没有公司名、ISBN、审批号、出版单位或著作权号。

- [ ] **Step 6: 暂存 Creator 元数据并做最终差异检查**

```powershell
cd D:\codex_pro\my_game_water
if (Test-Path -LiteralPath 'wechat-game\assets\scripts\presentation\launch-loading.ts.meta') {
  git add -- wechat-game/assets/scripts/presentation/launch-loading.ts.meta
}
git diff --cached --check
git status --short
```

Expected: 暂存区若有内容，只包含 Creator 生成的 `launch-loading.ts.meta`；粒子、字体和文案的既有未提交文件仍保留。

- [ ] **Step 7: 提交元数据（若生成）**

```powershell
cd D:\codex_pro\my_game_water
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Output '没有新的 Creator 元数据需要提交'
} else {
  git commit -m "chore: retain launch script metadata"
}
```

如果没有新元数据或已随前序任务生成并提交，则跳过此提交；不得创建手写伪 `.meta`。

- [ ] **Step 8: 记录最终验证结果**

在交付消息中明确列出：微信端通过的测试数量、原型通过的测试数量、关卡检查结果、Creator 构建日志的 `Finished` 证据、已保留的未提交改动，以及未执行远端 push。
