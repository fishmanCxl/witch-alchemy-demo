# 无尽模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Cocos 微信小游戏中加入与主线完全隔离、可恢复、按步数失败且每关最多一次广告重试的无尽模式。

**Architecture:** 新建框架无关的 `core/endless-mode.ts`，使用静态关卡目录计算关卡顺序、步数与可序列化状态；`LocalProgressStore` 只负责一个独立键；`ProductionBootstrap` 复用现有棋盘、广告、音频和弹窗。首页入口是唯一新资源，主线进度与云同步不接触无尽状态。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Node.js `node:test`、微信小游戏本地存储与激励视频接口。

**Spec:** `docs/superpowers/specs/2026-09-12-endless-mode-design.md`

## Global Constraints

- 首页入口源图为128×128双倍图，运行时显示64×64，位于左侧并与收藏品入口同一水平线。
- 第5关完成后解锁；无尽模式不消耗体力、禁用撤销与额外空瓶。
- 只复用 `PUBLISHED_LEVELS` 中第2关以后静态数据；不在运行时生成或求解。
- 每个无尽关卡最多一次广告重试；主线、每日委托、图鉴、称号、体力和云同步不读写无尽状态。
- 保留工作区全部既有未提交改动；只修改本计划列出的文件。

---

### Task 1: 无尽模式纯规则与状态

**Files:**
- Create: `wechat-game/assets/scripts/core/endless-mode.ts`
- Create: `wechat-game/assets/scripts/core/endless-mode.ts.meta`
- Modify: `wechat-game/assets/scripts/core/save-schema.ts`
- Create: `wechat-game/tests/endless-mode.test.ts`
- Modify: `wechat-game/package.json`

**Interfaces:**
- Consumes: `PUBLISHED_LEVELS`, `getLevelConfig`, `chapterForLevel`, `canPour`, `GameSession`, `LocalSnapshot`。
- Produces: `EndlessState`, `EndlessRun`, `createEndlessState()`, `decodeEndlessState()`, `encodeEndlessState()`, `startEndlessRun()`, `saveEndlessSession()`, `endlessAllowedMoves()`, `evaluateEndlessSession()`, `completeEndlessStage()`, `failEndlessRun()`, `retryEndlessStage()`, `endEndlessRun()`。

- [ ] **Step 1: 写入关卡池、顺序和步数的失败测试**

```ts
test('endless pool excludes only the tutorial and stays deterministic', () => {
  const first = endlessLevelIds(1234);
  assert.deepEqual(first, endlessLevelIds(1234));
  assert.equal(first.includes('level-001'), false);
  assert.equal(first.length, PUBLISHED_LEVELS.length - 1);
  assert.equal(new Set(first).size, first.length);
});

test('endless allowance tightens as the streak rises', () => {
  assert.equal(endlessAllowedMoves(20, 0), 25);
  assert.equal(endlessAllowedMoves(20, 6), 24);
  assert.equal(endlessAllowedMoves(20, 16), 24);
});
```

- [ ] **Step 2: 运行测试确认因模块不存在而失败**

Run: `node --experimental-strip-types --test tests/endless-mode.test.ts`

Expected: FAIL，包含 `Cannot find module .../core/endless-mode.ts`。

- [ ] **Step 3: 实现最小数据结构和确定性顺序**

```ts
export interface EndlessRun {
  readonly seed: number;
  readonly stage: number;
  readonly streak: number;
  readonly levelId: string;
  readonly allowedMoves: number;
  readonly reviveUsed: boolean;
  readonly failed: boolean;
  readonly snapshot: LocalSnapshot;
}

export interface EndlessState {
  readonly schemaVersion: 1;
  readonly bestStreak: number;
  readonly run: EndlessRun | null;
}

export function endlessAllowedMoves(optimalMoves: number, streak: number): number {
  const tolerance = streak <= 5 ? 0.25 : streak <= 15 ? 0.20 : 0.15;
  return optimalMoves + Math.max(4, Math.ceil(optimalMoves * tolerance));
}
```

按章节升序分组、章内用文件内确定性 PRNG 洗牌；`stage` 超过一轮池长后将循环号混入种子重新洗牌，不保存完整ID数组。

- [ ] **Step 4: 写入最后一步成功、失败、复活和结束整轮测试**

```ts
test('completion on the final move wins before failure', () => {
  assert.equal(evaluateEndlessSession({ ...session, levelComplete: true }, session.game.moves), 'complete');
});

test('one retry resets the same stage and a second retry is rejected', () => {
  const retried = retryEndlessStage(failEndlessRun(active));
  assert.equal(retried.run?.levelId, active.run?.levelId);
  assert.equal(retried.run?.snapshot.state.moves, 0);
  assert.equal(retried.run?.reviveUsed, true);
  assert.equal(retryEndlessStage(failEndlessRun(retried)), failEndlessRun(retried));
});
```

- [ ] **Step 5: 实现转换、解码和12色快照支持**

`evaluateEndlessSession()` 先检查完成，再检查步数上限，最后遍历瓶子组合调用 `canPour()`。损坏版本、未知关卡或配置不匹配返回安全默认状态。`save-schema.ts` 合法颜色补齐 `scarlet`、`chartreuse`、`indigo`、`pearl`。

- [ ] **Step 6: 运行无尽规则测试并加入 `test:core`**

Run: `node --experimental-strip-types --test tests/endless-mode.test.ts`

Expected: PASS；随后把该测试加入 `package.json` 的 `test:core`。

---

### Task 2: 独立本地存档

**Files:**
- Modify: `wechat-game/assets/scripts/platform/LocalProgressStore.ts`
- Modify: `wechat-game/tests/local-progress-store.test.ts`

**Interfaces:**
- Produces: `loadEndlessState()`、`saveEndlessState()`，固定键 `witch-water-sort:endless:v1`。

- [ ] **Step 1: 写入独立键和损坏数据回退测试**

```ts
test('endless state cannot alter main progress', () => {
  const storage = new MemoryStorage();
  const store = new LocalProgressStore(storage);
  const main = { ...store.loadProgress(), completedThrough: 5 };
  store.saveProgress(main);
  storage.setItem('witch-water-sort:endless:v1', '{bad');
  assert.deepEqual(store.loadEndlessState(), createEndlessState());
  store.saveEndlessState(startEndlessRun(createEndlessState(), 1234));
  assert.deepEqual(store.loadProgress(), main);
});
```

- [ ] **Step 2: 运行测试确认方法缺失，再添加两个薄存档方法**

Run: `node --experimental-strip-types --test tests/local-progress-store.test.ts`

```ts
const ENDLESS_KEY = 'witch-water-sort:endless:v1';
loadEndlessState(): EndlessState { return decodeEndlessState(this.storage.getItem(ENDLESS_KEY)); }
saveEndlessState(state: EndlessState): void { this.storage.setItem(ENDLESS_KEY, encodeEndlessState(state)); }
```

- [ ] **Step 3: 运行无尽和存档测试**

Run: `node --experimental-strip-types --test tests/endless-mode.test.ts tests/local-progress-store.test.ts`

Expected: PASS。

---

### Task 3: 首页布局与弹窗流

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/assets/scripts/core/scene-flow.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`
- Modify: `wechat-game/tests/scene-flow.test.ts`

- [ ] **Step 1: 写入入口对齐和互斥弹窗失败测试**

```ts
test('endless entry mirrors collection at the same height', () => {
  assert.deepEqual(HOME_LAYOUT.endlessButton, { x: -150, y: 198, width: 64, height: 64 });
});
```

场景流测试要求 `endlessDialog: null | 'locked' | 'failed' | 'end-confirm'` 与设置、体力、委托、退出弹窗互斥。

- [ ] **Step 2: 运行测试确认字段缺失，添加最小布局和纯流函数**

Run: `node --experimental-strip-types --test tests/presentation-layout.test.ts tests/scene-flow.test.ts`

在 `HOME_LAYOUT` 添加 `endlessButton`，在 `SceneFlowState` 添加 `endlessDialog`；所有已有导航关闭它，只添加打开/关闭三种无尽弹窗所需函数。

- [ ] **Step 3: 运行布局和场景流测试**

Run: `node --experimental-strip-types --test tests/presentation-layout.test.ts tests/scene-flow.test.ts`

Expected: PASS。

---

### Task 4: 128×128 SpriteFrame 入口资源

**Files:**
- Create: `prototype/public/assets/game/chibi/ui/home-endless-mode-button.png`
- Create: `wechat-game/assets/resources/game/chibi/ui/home-endless-mode-button.png`
- Create: `wechat-game/assets/resources/game/chibi/ui/home-endless-mode-button.png.meta`
- Modify: 两端 `assets-manifest.json`、微信 `sync-report.json`
- Modify: `wechat-game/tests/production-contracts.test.ts`

- [ ] **Step 1: 写入128×128、透明通道和 SpriteFrame 契约测试**

测试真实读取 PNG 尺寸、alpha 与 `.meta` 的 `userData.type`/`@f9941`，先运行并确认素材缺失而失败。

Run: `node --experimental-strip-types --test tests/production-contracts.test.ts`

- [ ] **Step 2: 保真处理并同步用户素材**

保留原图造型和透明背景，输出128×128，不叠加运行时文字。执行 `node tools/sync-approved-assets.mjs` 同步到生产工程，再执行 `node tools/configure-sprite-frames.mjs` 生成 SpriteFrame 元数据。

- [ ] **Step 3: 运行资源契约测试**

Run: `node --experimental-strip-types --test tests/production-contracts.test.ts`

Expected: PASS。

---

### Task 5: Cocos 入口、HUD、完成和失败交互

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`

- [ ] **Step 1: 写入HUD失败测试**

```ts
assert.deepEqual(endlessHudText(7, 4, 3), {
  title: '无尽 · 第7关', streak: '连胜 4', moves: '剩余 0 步',
});
```

Run: `node --experimental-strip-types --test tests/presentation-layout.test.ts`

- [ ] **Step 2: 添加首页入口和加载/恢复路径**

`start()` 只加载独立无尽状态。首页入口未解锁时弹提示；已解锁时恢复现有轮或用 `Date.now() >>> 0` 新建。入口 Sprite 显示64×64。

- [ ] **Step 3: 接入关卡交互与稳定状态保存**

无尽分支使用自己的保存函数，不调用主线快照。HUD显示序号、连胜、剩余步数；撤销和加瓶禁用；重来进入失败流程。瓶子交互继续局部刷新，稳定后完成优先、再判失败并先落盘。

- [ ] **Step 4: 接入完成页**

无尽完成只调用 `completeEndlessStage()`，显示当前连胜、历史最高和“下一关”；不调用主线完成、体力、云同步、星级或图鉴逻辑。

- [ ] **Step 5: 接入失败、广告和二次确认**

失败弹窗首次提供“看广告 · 再次挑战”和“返回首页”；完整广告重置同一关，取消保留失败状态。重试机会用完后不再显示广告按钮。返回首页先显示结束整轮确认；中途退出则保存现场直接回首页且不耗体力。

- [ ] **Step 6: 运行受影响测试**

Run: `node --experimental-strip-types --test tests/endless-mode.test.ts tests/local-progress-store.test.ts tests/presentation-layout.test.ts tests/scene-flow.test.ts tests/game-session.test.ts`

Expected: PASS。

---

### Task 6: 规则记录、Cocos 构建与微信预览

**Files:**
- Modify: `wechat-game/AGENTS.md`
- Modify: `prototype/AGENTS.md`
- Generated: `wechat-game/build/wechatgame/**`

- [ ] **Step 1: 记录无尽模式长期规则**

只增加入口、解锁、关卡池、失败、恢复、广告重试和主线隔离约束。

- [ ] **Step 2: 运行聚焦核心和资源测试**

Run: `node --experimental-strip-types --test tests/endless-mode.test.ts tests/local-progress-store.test.ts tests/presentation-layout.test.ts tests/scene-flow.test.ts tests/game-session.test.ts tests/production-contracts.test.ts`

- [ ] **Step 3: Cocos Creator 3.8.8 构建微信目标**

Run: `CocosCreator.exe --project D:\codex_pro\my_game_water\wechat-game --build "platform=wechatgame;debug=false"`

Expected: 日志包含 `build Task (wechatgame) Finished`。

- [ ] **Step 4: 准备和验证微信包**

Run: `$env:WECHAT_APPID='wx44e5e0b648b140ce'; npm run prepare:wechat-build`

Run: `node --test tests/wechat-build-preparation.test.mjs`

Expected: 主包小于4 MiB、总包小于30 MiB，非空资源 `config.json`、直接 `System.register` 入口和无尽按钮 `/spriteFrame` 均存在。

- [ ] **Step 5: 全新开发者工具进程上传预览**

关闭旧进程，从 `D:\codex_pro\my_game_water\wechat-game\build\wechatgame` 上传并生成新二维码。报告必须列出 `main` 与 `/subpackages/resources/`；手机手动验收入口、锁定、恢复、失败、广告重试和结束整轮。
