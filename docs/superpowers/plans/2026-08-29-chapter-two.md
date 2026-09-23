# 《魔女炼金屋》完整第二章 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可发布的第二章“初级魔女 · 草药与自然”：31–60关、森林药水六块拼图、初级魔女自动称号、跨章解锁与完整微信构建。

**Architecture:** 保留第一章30个静态关卡与所有棋盘数据不变，新增独立的第二章离线生成脚本、静态数据模块和生成报告，由 `level-catalog.ts` 聚合为60关运行时目录。章节、收藏和称号继续从 `PlayerProgress.completedLevels` 与最高解锁关派生；森林药水仅是图鉴收藏，不进入棋盘规则。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Node.js `node:test`、微信小游戏、CloudBase、ImageGen、PNG SpriteFrame、原生 Cocos Graphics/Mask/Tween。

**Spec:** `docs/superpowers/specs/2026-08-29-chapters-two-to-ten-rare-potions-design.md`

## Global Constraints

- 本计划只发布第1、2章；第3–10章继续保持 `coming-soon`，不能进入。
- 第一章1–30关及第12关棋盘保持字节级不变；第1关仍是全游戏唯一教学关。
- 第31–60关全部使用 `all-colors` 规则、2个普通空瓶和固定第15槽激励空瓶。
- 第二章难度系数为：第31关0.88、第32关0.96、第35关0.99、第40关1.01、第50关1.04、第55–57关1.05、第60关0.98，非锚点分段线性插值。
- 森林药水是纯图鉴收藏，不增加棋盘颜色、道具、背包或消耗逻辑。
- 每完成第二章5个不同关卡揭示一块森林药水拼图；重复通关不重复奖励。
- 完成第一章后自动显示“初级魔女”；称号不可佩戴、切换或降级。
- 单章选关固定5×6单页，无滚动、无关卡分页；左右箭头只切换已解锁章节。
- `PlayerProgress` 继续使用 schema v2；不持久化章节、拼图、收藏或称号派生字段。
- 微信主包低于4 MiB，总包低于30 MiB，AppID 为 `wx44e5e0b648b140ce`。
- 保留工作区既有未提交资源 `.meta`、AppID注入和分包改动；禁止 `git add .`、`git reset`、`git checkout --`。
- 每个提交只暂存任务列出的文件，并先运行 `git diff --cached --check`。

## File Structure

**Create**

- `wechat-game/tools/generate-chapter-two.ts` — 第二章系数、硬门槛、确定性种子、静态输出和报告生成。
- `wechat-game/assets/scripts/core/level-data.chapter-02.generated.ts` — 第31–60关静态配置。
- `wechat-game/assets/scripts/core/level-generation-report.chapter-02.json` — 第二章生成证据。
- `prototype/public/assets/game/chibi/collection/forest-potion.png` — 512×512透明背景森林药水正式插画。
- `wechat-game/assets/resources/game/chibi/collection/forest-potion.png` — 同步后的Cocos资源。

**Modify**

- `wechat-game/assets/scripts/core/chapter-catalog.ts` — 第二章主题、收藏ID和发布状态。
- `wechat-game/assets/scripts/core/potion-collection-catalog.ts` — 森林药水正式目录数据。
- `wechat-game/assets/scripts/core/level-catalog.ts` — 聚合60关、按章查询和后继关卡。
- `wechat-game/assets/scripts/core/level-progress.ts` — 60关解锁、迁移、合并和配置版本。
- `wechat-game/assets/scripts/core/collection-progress.ts` — 第二章拼图、收藏和称号验收。
- `wechat-game/assets/scripts/core/scene-flow.ts` — 选关章节与收藏详情解锁状态。
- `wechat-game/assets/scripts/presentation/presentation-layout.ts` — 章节切换按钮布局。
- `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts` — 第二章选关、森林药水详情、跨章结算和动态文案。
- `wechat-game/tools/verify-collection-assets.py` — 森林药水尺寸和包体门禁。
- `wechat-game/tools/sync-approved-assets.mjs` — 继续复用目录同步，无新依赖。
- `wechat-game/tests/*.test.ts` — 章节、生成、进度、场景流、布局和生产契约。
- `cloudbase/src/domain.mjs`、`cloudbase/tests/domain.test.mjs` — 云端合法关卡上限扩展到60。
- `cloudbase/functions/_shared/runtime.js` 及函数副本 — 由准备脚本同步。
- `wechat-game/AGENTS.md`、`prototype/AGENTS.md` — 固化第二章生产约束和美术契约。

---

### Task 1: 固化第二章目录与森林药水身份

**Files:**
- Modify: `wechat-game/assets/scripts/core/chapter-catalog.ts`
- Modify: `wechat-game/assets/scripts/core/potion-collection-catalog.ts`
- Modify: `wechat-game/tests/chapter-catalog.test.ts`
- Modify: `wechat-game/tests/potion-collection-catalog.test.ts`

**Interfaces:**
- Produces: `getChapter(2)` = “初级魔女 · 草药与自然”。
- Produces: `getPotionCollection(2)` = “森林药水”。
- Preserves: 第3–10章 `releaseState === 'coming-soon'`。

- [ ] **Step 1: 写目录失败测试**

```ts
const chapter = getChapter(2)!;
assert.equal(chapter.stageTitle, '初级魔女');
assert.equal(chapter.themeTitle, '草药与自然');
assert.equal(chapter.firstLevel, 31);
assert.equal(chapter.collectionId, 'forest-potion');
assert.equal(chapter.releaseState, 'coming-soon');

const potion = getPotionCollection(2)!;
assert.deepEqual(potion, {
  chapterId: 2,
  collectionId: 'forest-potion',
  name: '森林药水',
  description: '凝聚古林生机与草木萤光的稀有药水',
  artworkKey: 'forest-potion',
  silhouetteIndex: 0,
});
```

- [ ] **Step 2: 运行测试确认红灯**

Run: `node --experimental-strip-types --test tests/chapter-catalog.test.ts tests/potion-collection-catalog.test.ts`

Expected: FAIL，第二章主题仍是占位标题、收藏ID仍是 `chapter-02-potion`、药水仍为 `???`。

- [ ] **Step 3: 实现最小目录数据**

把章节数据改为显式表项，至少固定前两章：

```ts
{ id: 1, stageTitle: '见习魔女', themeTitle: '基础炼金', firstLevel: 1,
  levelCount: 30, collectionId: 'star-dew-potion', releaseState: 'available' },
{ id: 2, stageTitle: '初级魔女', themeTitle: '草药与自然', firstLevel: 31,
  levelCount: 30, collectionId: 'forest-potion', releaseState: 'coming-soon' },
```

收藏目录第二项写入正式名称、描述和资源键；其余章节保持锁定剪影数据。

- [ ] **Step 4: 运行测试并提交**

Run: `node --experimental-strip-types --test tests/chapter-catalog.test.ts tests/potion-collection-catalog.test.ts`

Expected: PASS。

```bash
git add wechat-game/assets/scripts/core/chapter-catalog.ts wechat-game/assets/scripts/core/potion-collection-catalog.ts wechat-game/tests/chapter-catalog.test.ts wechat-game/tests/potion-collection-catalog.test.ts
git diff --cached --check
git commit -m "feat: define chapter two catalog"
```

---

### Task 2: 第二章难度系数与硬门槛

**Files:**
- Create: `wechat-game/tools/generate-chapter-two.ts`
- Modify: `wechat-game/tests/level-generator.test.ts`

**Interfaces:**
- Produces: `chapterTwoDifficultyTarget(levelNumber: number): number`
- Produces: `chapterTwoGenerationSpec(levelNumber: number): GenerationSpec`
- Produces: `chapterTwoGeneratorSeed(levelNumber: number): number`

- [ ] **Step 1: 写系数失败测试**

```ts
assert.equal(chapterTwoDifficultyTarget(31), 0.88);
assert.equal(chapterTwoDifficultyTarget(32), 0.96);
assert.equal(chapterTwoDifficultyTarget(35), 0.99);
assert.equal(chapterTwoDifficultyTarget(40), 1.01);
assert.equal(chapterTwoDifficultyTarget(50), 1.04);
assert.equal(chapterTwoDifficultyTarget(55), 1.05);
assert.equal(chapterTwoDifficultyTarget(57), 1.05);
assert.equal(chapterTwoDifficultyTarget(60), 0.98);
assert.throws(() => chapterTwoDifficultyTarget(30), RangeError);
assert.throws(() => chapterTwoDifficultyTarget(61), RangeError);
```

- [ ] **Step 2: 写硬门槛失败测试**

```ts
const opening = chapterTwoGenerationSpec(31);
assert.equal(opening.colorCount, 8);
assert.equal(opening.emptyBottleCount, 2);
assert.equal(opening.minimumOptimalMoves, 22);
assert.equal(opening.maximumOptimalMoves, 36);
assert.equal(opening.minimumSegments, 26);
assert.equal(opening.minimumExploredStates, 2000);
assert.equal(opening.minimumMisleadingBranchRatio, 0.25);
assert.equal(opening.maximumOpeningMoves, 18);

const peak = chapterTwoGenerationSpec(55);
assert.equal(peak.colorCount, 9);
assert.equal(peak.minimumOptimalMoves, 24);
assert.equal(peak.maximumOptimalMoves, 38);
assert.equal(peak.minimumSegments, 28);
assert.ok(peak.minimumExploredStates >= 3800);
assert.ok(peak.minimumMisleadingBranchRatio >= 0.29);
```

- [ ] **Step 3: 运行测试确认红灯**

Run: `node --experimental-strip-types --test tests/level-generator.test.ts`

Expected: FAIL，缺少第二章生成模块导出。

- [ ] **Step 4: 实现分段插值和门槛映射**

```ts
const ANCHORS = [[31, 0.88], [32, 0.96], [35, 0.99], [40, 1.01],
  [50, 1.04], [55, 1.05], [57, 1.05], [60, 0.98]] as const;

const p = Math.max(0, Math.min(1, (target - 0.88) / (1.61 - 0.88)));
return {
  number,
  colorCount: Math.round(8 + 4 * p),
  emptyBottleCount: 2,
  reverseMoves: Math.round(24 + 10 * p),
  targetDifficulty: Math.min(1, target),
  minimumOptimalMoves: Math.round(22 + 10 * p),
  maximumOptimalMoves: Math.round(22 + 10 * p) + 14,
  minimumSegments: Math.round(26 + 10 * p),
  minimumExploredStates: Math.round(2000 * 10 ** (1.2 * p)),
  minimumOpeningMoves: 2,
  maximumOpeningMoves: Math.round(18 - 6 * p),
  minimumMisleadingBranchRatio: 0.25 + 0.20 * p,
  maxAttempts: 25_000,
};
```

种子固定为 `(0x2608_0000 + Math.imul(number, 104_729)) >>> 0`，搜索失败时沿用现有诊断格式并记录最近候选指标。

- [ ] **Step 5: 运行第一章与第二章生成器测试并提交**

Run: `node --experimental-strip-types --test tests/level-generator.test.ts`

Expected: PASS，第一章现有锚点和输出测试不变。

```bash
git add wechat-game/tools/generate-chapter-two.ts wechat-game/tests/level-generator.test.ts
git diff --cached --check
git commit -m "feat: define chapter two difficulty curve"
```

---

### Task 3: 生成并发布第31–60关静态数据

**Files:**
- Modify: `wechat-game/tools/generate-chapter-two.ts`
- Create: `wechat-game/assets/scripts/core/level-data.chapter-02.generated.ts`
- Create: `wechat-game/assets/scripts/core/level-generation-report.chapter-02.json`
- Modify: `wechat-game/assets/scripts/core/level-catalog.ts`
- Modify: `wechat-game/tests/level-catalog.test.ts`
- Modify: `wechat-game/tests/level-generator.test.ts`
- Modify: `wechat-game/package.json`

**Interfaces:**
- Produces: `CHAPTER_TWO_LEVEL_DATA: readonly LevelConfig[]`
- Produces: `PUBLISHED_LEVELS: readonly LevelConfig[]`
- Produces: `levelsForChapter(chapterId: number): readonly LevelConfig[]`
- Produces: `GAME_CONFIG_VERSION = 'chapters-1-2.2026-08-29.1'`

- [ ] **Step 1: 写60关目录失败测试**

```ts
assert.equal(PUBLISHED_LEVELS.length, 60);
assert.deepEqual(levelsForChapter(2).map((level) => level.number),
  Array.from({ length: 30 }, (_, index) => index + 31));
assert.equal(getLevelConfig('level-031')?.completionRule.type, 'all-colors');
assert.equal(getLevelConfig('level-060')?.number, 60);
assert.equal(nextLevelConfig('level-030')?.id, 'level-031');
assert.equal(nextLevelConfig('level-060'), null);
```

保存第一章数据文件当前内容哈希，并断言第二章生成后该哈希不变。

- [ ] **Step 2: 写第二章生成报告失败测试**

```ts
assert.equal(report.schemaVersion, 1);
assert.equal(report.chapterId, 2);
assert.equal(report.levels.length, 30);
assert.deepEqual(report.levels.map((entry) => entry.id),
  Array.from({ length: 30 }, (_, index) => `level-${String(index + 31).padStart(3, '0')}`));
for (const entry of report.levels) {
  assert.equal(entry.source, 'generated');
  assert.equal(entry.compatibilityExemption, null);
}
```

- [ ] **Step 3: 运行测试确认红灯**

Run: `node --experimental-strip-types --test tests/level-catalog.test.ts tests/level-generator.test.ts`

Expected: FAIL，缺少第二章数据和60关聚合目录。

- [ ] **Step 4: 完成离线生成输出**

`generate-chapter-two.ts` 对31–60逐关调用现有 `generateCandidateWithDiagnostics`，构造：

```ts
{
  id: levelId(number),
  number,
  configVersion: 'chapter-2.2026-08-29.1',
  presentationSeed: number,
  capacity: 4,
  slotCount: 15,
  rewardSlotIndex: 14,
  completionRule: { type: 'all-colors', targetCount: spec.colorCount },
  metrics: candidate.metrics,
  initialState: candidate.initialState,
}
```

报告同时记录 `targetCoefficient`、被限制到0–1的 `targetDifficulty`、生成种子、尝试次数、反向步数、真实指标和评分组件。

- [ ] **Step 5: 生成数据并检查确定性**

Run: `node --experimental-strip-types tools/generate-chapter-two.ts`

Expected: 输出“Generated chapter 2 levels 31–60 and difficulty report”。

Run: `node --experimental-strip-types tools/generate-chapter-two.ts --check`

Expected: 输出“30 chapter 2 levels match generated output”。

- [ ] **Step 6: 聚合目录并验证全部棋盘**

`level-catalog.ts` 保留 `FIRST_CHAPTER_LEVELS` 兼容导出，新增 `CHAPTER_TWO_LEVELS` 和 `PUBLISHED_LEVELS`。对60关逐项冻结；全目录按ID建Map，并拒绝跨两章重复棋盘。

Run: `node --experimental-strip-types --test tests/level-config.test.ts tests/level-catalog.test.ts tests/level-generator.test.ts tests/level-solver.test.ts`

Expected: PASS，60关合法、可解、唯一，第1–30关数据未变化。

- [ ] **Step 7: 标记第二章内容已发布并提交**

仅在上述生成和求解全部通过后，把 `getChapter(2).releaseState` 改为 `available`，并更新目录测试为 `publishedChapters() === [1, 2]`。

```bash
git add wechat-game/tools/generate-chapter-two.ts wechat-game/assets/scripts/core/level-data.chapter-02.generated.ts wechat-game/assets/scripts/core/level-generation-report.chapter-02.json wechat-game/assets/scripts/core/level-catalog.ts wechat-game/assets/scripts/core/chapter-catalog.ts wechat-game/tests/level-catalog.test.ts wechat-game/tests/level-generator.test.ts wechat-game/tests/chapter-catalog.test.ts wechat-game/package.json
git diff --cached --check
git commit -m "feat: publish chapter two levels"
```

---

### Task 4: 本地与云端进度扩展到60关

**Files:**
- Modify: `wechat-game/assets/scripts/core/level-progress.ts`
- Modify: `wechat-game/tests/level-progress.test.ts`
- Modify: `wechat-game/tests/local-progress-store.test.ts`
- Modify: `wechat-game/tests/progress-sync.test.ts`
- Modify: `cloudbase/src/domain.mjs`
- Modify: `cloudbase/tests/domain.test.mjs`
- Modify: `cloudbase/functions/_shared/runtime.js`
- Generated: `cloudbase/functions/*/_shared/runtime.js`

**Interfaces:**
- Preserves: `PlayerProgress` schemaVersion 2。
- Changes: 合法关卡上限由当前目录边界扩展到60。
- Preserves: `applyProgressSyncResult` 防旧云结果回滚。

- [ ] **Step 1: 写跨章进度失败测试**

```ts
const atThirty = progressAt('level-030');
const afterThirty = completeLevel(atThirty, 'level-030', 28)!;
assert.equal(afterThirty.highestUnlockedLevel, 'level-031');
assert.equal(afterThirty.currentLevel, 'level-031');

const atSixty = progressAt('level-060');
const afterSixty = completeLevel(atSixty, 'level-060', 41)!;
assert.equal(afterSixty.highestUnlockedLevel, 'level-060');
assert.equal(afterSixty.currentLevel, 'level-060');
```

补充旧第一章v2存档解码测试，断言配置版本规范化但完成集合、最高解锁和最佳步数不丢失。

- [ ] **Step 2: 写云端60关失败测试**

```js
assert.deepEqual(validateRewardRequest({ levelId: 'level-060', claimId: 'claim_12345678' }), {
  levelId: 'level-060', claimId: 'claim_12345678',
});
assert.throws(() => validateRewardRequest({ levelId: 'level-061', claimId: 'claim_12345678' }));
assert.equal(mergeProgress(current, {
  ...current,
  currentLevel: 'level-031',
  highestUnlockedLevel: 'level-031',
}).highestUnlockedLevel, 'level-031');
```

- [ ] **Step 3: 运行测试确认红灯**

Run: `node --experimental-strip-types --test tests/level-progress.test.ts tests/local-progress-store.test.ts tests/progress-sync.test.ts`

Run: `npm test --prefix cloudbase`

Expected: FAIL，客户端后继在30停止，云端仍拒绝第二章关卡。

- [ ] **Step 4: 最小扩展进度边界**

把 `FIRST_CHAPTER_CONFIG_VERSION/FIRST_CHAPTER_LEVELS` 依赖替换为 `GAME_CONFIG_VERSION/PUBLISHED_LEVELS`；排序、最高合法关、选择、完成和合并继续通过 `getLevelConfig` 验证，不新增按数字盲目信任逻辑。

CloudBase 把 `LAST_LEVEL` 改为60，保持OPENID服务端获取、完成集合并集、最低最佳步数和冲突revision语义不变。

- [ ] **Step 5: 同步云函数运行时并验证哈希**

Run: `node cloudbase/tools/prepare-functions.mjs`

Run: `npm test --prefix cloudbase`

Expected: PASS，5个函数副本与 `_shared/runtime.js` 内容一致。

- [ ] **Step 6: 客户端完整进度回归并提交**

Run: `node --experimental-strip-types --test tests/level-progress.test.ts tests/local-progress-store.test.ts tests/progress-sync.test.ts tests/production-contracts.test.ts`

Expected: PASS，包括“旧云同步不能擦除本地5关完成记录”。

```bash
git add wechat-game/assets/scripts/core/level-progress.ts wechat-game/tests/level-progress.test.ts wechat-game/tests/local-progress-store.test.ts wechat-game/tests/progress-sync.test.ts cloudbase/src/domain.mjs cloudbase/tests/domain.test.mjs cloudbase/functions/_shared/runtime.js cloudbase/functions/bootstrap/_shared/runtime.js cloudbase/functions/getGameConfig/_shared/runtime.js cloudbase/functions/syncProgress/_shared/runtime.js cloudbase/functions/claimRewardedBottle/_shared/runtime.js cloudbase/functions/submitLevelResult/_shared/runtime.js
git diff --cached --check
git commit -m "feat: extend progress through chapter two"
```

---

### Task 5: 第二章选关与章节切换

**Files:**
- Modify: `wechat-game/assets/scripts/core/scene-flow.ts`
- Modify: `wechat-game/tests/scene-flow.test.ts`
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`

**Interfaces:**
- Adds: `SceneFlowState.selectedLevelChapterId: number`
- Adds: `openLevelSelect(state, chapterId): SceneFlowState`
- Adds: `selectLevelChapter(state, chapterId, unlocked): SceneFlowState`
- Consumes: `levelsForChapter(chapterId)`

- [ ] **Step 1: 写场景流失败测试**

```ts
const selector = openLevelSelect(createSceneFlow(), 1);
assert.equal(selector.selectedLevelChapterId, 1);
assert.equal(selectLevelChapter(selector, 2, false), selector);
assert.equal(selectLevelChapter(selector, 2, true).selectedLevelChapterId, 2);
assert.equal(selectLevelChapter(selector, 3, true), selector);
```

- [ ] **Step 2: 写布局失败测试**

```ts
assert.deepEqual(LEVEL_SELECT_LAYOUT.previousChapterButton,
  { x: -158, y: 320, width: 44, height: 44 });
assert.deepEqual(LEVEL_SELECT_LAYOUT.nextChapterButton,
  { x: 158, y: 320, width: 44, height: 44 });
for (let index = 0; index < 30; index += 1) {
  const button = levelSelectButton(index);
  assert.ok(button.y - button.height / 2 >= -144);
}
```

- [ ] **Step 3: 运行测试确认红灯**

Run: `node --experimental-strip-types --test tests/scene-flow.test.ts tests/presentation-layout.test.ts tests/production-contracts.test.ts`

Expected: FAIL，场景状态没有章节选择，选关仍硬编码第一章。

- [ ] **Step 4: 实现纯章节切换状态**

`openLevelSelect` 接受调用方传入的当前关卡所属章节；`selectLevelChapter` 同时要求目标章节已发布且调用方证明已解锁。返回首页、打开收藏和进入关卡时清理或保留该状态按现有导航语义处理，不把它写入存档。

- [ ] **Step 5: 渲染第二章单页**

`renderLevelSelect` 从 `selectedLevelChapterId` 读取章节数据并遍历 `levelsForChapter`。顶部显示：

```text
初级魔女
第二章 · 草药与自然 · 31–60关
```

左右箭头只在存在可切换且已解锁章节时启用。第2章仍使用相同30个按钮位置和现有完成/当前/锁定视觉，不增加滚动或分页点。

- [ ] **Step 6: 运行定向测试并提交**

Run: `node --experimental-strip-types --test tests/scene-flow.test.ts tests/presentation-layout.test.ts tests/production-contracts.test.ts`

Expected: PASS，第一章布局断言不回归。

```bash
git add wechat-game/assets/scripts/core/scene-flow.ts wechat-game/tests/scene-flow.test.ts wechat-game/assets/scripts/presentation/presentation-layout.ts wechat-game/tests/presentation-layout.test.ts wechat-game/assets/scripts/presentation/ProductionBootstrap.ts wechat-game/tests/production-contracts.test.ts
git diff --cached --check
git commit -m "feat: add chapter two level selection"
```

---

### Task 6: 森林药水拼图与初级魔女称号逻辑

**Files:**
- Modify: `wechat-game/assets/scripts/core/collection-progress.ts`
- Modify: `wechat-game/tests/collection-progress.test.ts`
- Modify: `wechat-game/assets/scripts/core/scene-flow.ts`
- Modify: `wechat-game/tests/scene-flow.test.ts`

**Interfaces:**
- Preserves: `deriveCollectionProgress(progress, chapterId)`
- Preserves: `deriveHighestTitle(progress)`
- Changes: `openCollectionDetail(state, chapterId, unlocked)` 明确分离发布与玩家解锁。

- [ ] **Step 1: 写第二章收藏失败测试**

```ts
const chapterOneComplete = progressWithCompletedRange(1, 30);
assert.deepEqual(deriveHighestTitle(chapterOneComplete), {
  chapterId: 2,
  title: '初级魔女',
});

const fiveForestLevels = progressWithCompletedRanges([[1, 30], [31, 35]]);
assert.equal(deriveCollectionProgress(fiveForestLevels, 2).revealedPieces, 1);

const chapterTwoComplete = progressWithCompletedRange(1, 60);
assert.equal(deriveCollectionProgress(chapterTwoComplete, 2).collected, true);
assert.deepEqual(deriveCompletionReward(
  progressWithCompletedRange(1, 59), chapterTwoComplete, 'level-060'),
  { puzzlePiece: 6, collectionCompleted: true, titleChanged: true },
);
```

- [ ] **Step 2: 写收藏详情解锁失败测试**

```ts
const overview = openCollection(createSceneFlow());
assert.equal(openCollectionDetail(overview, 2, false), overview);
assert.equal(openCollectionDetail(overview, 2, true).selectedCollectionChapterId, 2);
assert.equal(openCollectionDetail(overview, 3, true), overview);
```

- [ ] **Step 3: 运行测试确认红灯**

Run: `node --experimental-strip-types --test tests/collection-progress.test.ts tests/scene-flow.test.ts`

Expected: FAIL，第二章尚未发布或详情函数没有玩家解锁参数。

- [ ] **Step 4: 实现最小派生与解锁边界**

收藏公式不增加字段，只让第二章目录可用后自然参与计算。详情打开要求：当前为总览、章节已发布、`unlocked === true`。展示层用 `isLevelUnlocked(progress, 'level-031')` 计算该布尔值。

- [ ] **Step 5: 运行测试并提交**

Run: `node --experimental-strip-types --test tests/collection-progress.test.ts tests/scene-flow.test.ts tests/level-progress.test.ts`

Expected: PASS。

```bash
git add wechat-game/assets/scripts/core/collection-progress.ts wechat-game/tests/collection-progress.test.ts wechat-game/assets/scripts/core/scene-flow.ts wechat-game/tests/scene-flow.test.ts
git diff --cached --check
git commit -m "feat: derive chapter two collection rewards"
```

---

### Task 7: 生成并接入森林药水正式素材

**Files:**
- Create: `prototype/public/assets/game/chibi/collection/forest-potion.png`
- Modify: `prototype/AGENTS.md`
- Modify: `wechat-game/tools/verify-collection-assets.py`
- Generated: `wechat-game/assets/resources/game/chibi/collection/forest-potion.png`
- Generated by Cocos: `wechat-game/assets/resources/game/chibi/collection/forest-potion.png.meta`
- Modify: `wechat-game/tests/production-contracts.test.ts`

**Interfaces:**
- Produces resource: `game/chibi/collection/forest-potion/spriteFrame`
- Reuses resource: `game/chibi/titles/title-badge-junior/spriteFrame` for “初级魔女”。

- [ ] **Step 1: 写资源失败测试**

```ts
const forest = new URL('../assets/resources/game/chibi/collection/forest-potion.png', import.meta.url);
assert.equal(existsSync(forest), true);
assert.equal(existsSync(new URL(`${forest.pathname}.meta`, import.meta.url)), true);
assert.match(bootstrap, /game\/chibi\/collection\/\$\{collectionConfig\.artworkKey\}\/spriteFrame/);
```

`verify-collection-assets.py` 断言星露药水为1024×1024、森林药水为512×512，并断言森林药水文件不超过307200字节。

- [ ] **Step 2: 运行资源测试确认红灯**

Run: `node --experimental-strip-types --test tests/production-contracts.test.ts`

Run: `python tools/verify-collection-assets.py`

Expected: FAIL，森林药水资源不存在。

- [ ] **Step 3: 使用 ImageGen 生成森林药水**

执行时读取 `imagegen` 技能，并把现有 `star-dew-potion.png` 作为风格参考。使用以下固定提示：

```text
为微信小游戏《魔女炼金屋》制作一张单瓶稀有药水收藏插画。透明背景，512×512，主体居中且完整，童话绘本Q版炼金风，粗而干净的深紫描边，玻璃高光和金色小配件，与参考的星露药水保持同一系列。主题是“森林药水”：圆润但不同于星露瓶的叶芽形玻璃瓶，翠绿到青绿色发光液体，木质软木塞，瓶颈缠绕小藤蔓和叶片吊坠，周围只有少量萤火、叶片与柔和绿色魔法光环。不要人物，不要文字，不要底座，不要边框，不要黑色背景，不要裁切瓶口或瓶底。轮廓和关键装饰避开2列×3行拼图分割线。
```

- [ ] **Step 4: 规范化并验证资源**

把生成结果缩放到512×512、保留透明通道并进行无损/索引色优化，输出到原型批准资源目录；不得用代码绘制替代正式插画。

Run: `python wechat-game/tools/verify-collection-assets.py`

Expected: PASS，尺寸512×512、透明通道存在、文件不超过300 KiB。

- [ ] **Step 5: 同步资源并生成SpriteFrame元数据**

Run: `npm run sync:assets --prefix wechat-game`

Run: `npm run prepare:sprites --prefix wechat-game`

在 Cocos Creator 3.8.8 打开工程完成导入，保留Creator生成的 `.meta`；随后再次运行资源契约。

- [ ] **Step 6: 验证初级魔女称号素材复用**

确认 `title-badge-junior.png` 仍作为第二章称号徽章底图，显示文字由艺术字体渲染为“初级魔女”，不新增重复称号位图。

- [ ] **Step 7: 提交正式资源**

```bash
git add prototype/public/assets/game/chibi/collection/forest-potion.png prototype/AGENTS.md wechat-game/assets/resources/game/chibi/collection/forest-potion.png wechat-game/assets/resources/game/chibi/collection/forest-potion.png.meta wechat-game/tools/verify-collection-assets.py wechat-game/tests/production-contracts.test.ts
git diff --cached --check
git commit -m "feat: add forest potion collection art"
```

---

### Task 8: 第二章收藏详情、跨章结算与动态文案

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`

**Interfaces:**
- Consumes: `getPotionCollection(chapterId)`、`deriveCollectionProgress`、`deriveHighestTitle`。
- Produces: 动态拼图资源路径、章节奖励文案、跨章完成按钮。

- [ ] **Step 1: 写动态森林药水展示失败测试**

断言生产源码不再硬编码星露资源到通用拼图函数，而是使用：

```ts
const collectionConfig = getPotionCollection(collection.chapterId)!;
const artworkPath = `game/chibi/collection/${collectionConfig.artworkKey}/spriteFrame`;
```

断言第二章卡片在玩家已解锁时显示“森林药水”和派生的 `n/6`，未解锁时仍显示剪影与锁。

- [ ] **Step 2: 写结算文案失败测试**

```ts
assert.equal(completionPrimaryLabel(30, 31), '进入第二章');
assert.equal(completionPrimaryLabel(59, 60), '下一关');
assert.equal(completionPrimaryLabel(60, null), '返回选关');
assert.equal(collectionRewardLabel(2, 1), '获得森林药水拼图 1/6');
assert.equal(collectionCompleteLabel(2), '森林药水已收入图鉴');
```

若当前文案逻辑只存在展示类中，先把这些纯字符串映射放入 `presentation-layout.ts`，不新增通用文案框架。

- [ ] **Step 3: 运行测试确认红灯**

Run: `node --experimental-strip-types --test tests/presentation-layout.test.ts tests/production-contracts.test.ts`

Expected: FAIL，拼图资源和完成页仍硬编码第一章。

- [ ] **Step 4: 实现动态收藏详情**

`renderCollectionDetail` 用章节目录渲染名称、描述和对应资源。`renderCollectionPuzzle` 只接收当前 `CollectionProgress` 与 `artworkKey`，继续复用现有2×3 Mask，不创建六张重复SpriteFrame。

- [ ] **Step 5: 实现跨章完成流程**

完成第30关时：保存本地进度 → 清除第30关快照 → 派生第31关解锁、森林药水0/6和初级魔女称号 → 完成页显示“进入第二章”。点击后加载第31关。

完成第35、40、45、50、55、60关首次到达里程碑时显示对应森林药水拼图；完成第60关显示“森林药水已收入图鉴”和“第二章完成”，随后返回第二章选关，不尝试进入第61关。

- [ ] **Step 6: 运行展示与场景回归并提交**

Run: `node --experimental-strip-types --test tests/collection-progress.test.ts tests/scene-flow.test.ts tests/presentation-layout.test.ts tests/production-contracts.test.ts`

Expected: PASS。

```bash
git add wechat-game/assets/scripts/presentation/ProductionBootstrap.ts wechat-game/tests/production-contracts.test.ts wechat-game/assets/scripts/presentation/presentation-layout.ts wechat-game/tests/presentation-layout.test.ts
git diff --cached --check
git commit -m "feat: integrate chapter two presentation"
```

---

### Task 9: 生产契约、完整回归与微信构建

**Files:**
- Modify: `wechat-game/AGENTS.md`
- Modify: `prototype/AGENTS.md`
- Generated by Cocos: new/updated `.meta` required for chapter2 static data and report.
- Build output: `wechat-game/build/wechatgame` in the worktree, then verified copy to the main preview directory.

**Interfaces:**
- Verifies: 60关、第二章资源、云端契约、Cocos导入、微信包体和AppID。

- [ ] **Step 1: 固化生产不变量**

在 `wechat-game/AGENTS.md` 记录：仅第1关教学；第1、2章各30关；第二章系数锚点；森林药水纯收藏；第30→31关跨章；第60关封顶；单章5×6无分页；第二章完成后仍不开放第3章。

在 `prototype/AGENTS.md` 记录森林药水的瓶型、色彩、透明背景、拼图安全区和资源大小要求。

- [ ] **Step 2: 运行生成一致性**

Run: `node --experimental-strip-types tools/generate-levels.ts --check`

Expected: `30 published levels match generated output`。

Run: `node --experimental-strip-types tools/generate-chapter-two.ts --check`

Expected: `30 chapter 2 levels match generated output`。

- [ ] **Step 3: 运行全部客户端和云端测试**

Run: `npm run test:core --prefix wechat-game`

Run: `npm test --prefix cloudbase`

Run: `node cloudbase/tools/prepare-functions.mjs`

再次运行：`npm test --prefix cloudbase`

Expected: 全部PASS，无失败、跳过或共享运行时哈希差异。

- [ ] **Step 4: 用Cocos Creator 3.8.8导入和release构建**

使用忽略的 `wechat-game/temp/wechat-release-build.json`：

```json
{
  "platform": "wechatgame",
  "debug": false,
  "outputName": "wechatgame",
  "packages": { "wechatgame": { "appid": "wx44e5e0b648b140ce" } }
}
```

通过隐藏Creator进程、独立stdout/stderr日志和等待退出的方式构建，日志必须包含 `build Task (wechatgame) Finished`。Creator生成的合法 `.meta` 保留；窗口恢复警告不等同于构建成功或失败，必须以构建任务结果为准。

- [ ] **Step 5: 整理并验证微信产物**

Run: `$env:WECHAT_APPID='wx44e5e0b648b140ce'; npm run prepare:wechat-build --prefix wechat-game`

Run: `npm run test:wechat-build --prefix wechat-game`

Expected: 资源分包入口存在，动态资源包含森林药水，主包低于4 MiB，总包低于30 MiB，最终 `project.config.json.appid` 为 `wx44e5e0b648b140ce`。

- [ ] **Step 6: 安全更新主预览目录**

先验证源目录和目标目录绝对路径分别为：

```text
D:\codex_pro\my_game_water\.worktrees\chapter-one-collection\wechat-game\build\wechatgame
D:\codex_pro\my_game_water\wechat-game\build\wechatgame
```

如果 `wxfilewatcher_x64.exe` 正在占用目标目录，先让用户关闭微信开发者工具，不在被占用目录上执行删除或递归覆盖。关闭后完整替换目标，验证两边文件数、相对路径和字节长度一致，且不存在 `wechatgame\wechatgame` 嵌套目录。

- [ ] **Step 7: 微信冒烟测试**

在微信开发者工具验证：旧第一章存档仍可用 → 完成第30关 → 显示初级魔女 → 进入第31关 → 第二章30关单页 → 完成5个第二章关卡 → 森林药水显示1/6 → 图鉴详情正确 → 返回继续游戏。

- [ ] **Step 8: 最终提交**

只暂存本任务新增的AGENTS约束和Creator生成的第二章相关 `.meta`，排除既有无关修改。

```bash
git diff --cached --check
git commit -m "chore: finalize chapter two release"
```

## Execution Order

严格按 Task 1→9 顺序执行。Task 3 的30关生成和求解是内容门禁；未通过时不得进入进度、UI和资源集成。Task 7 的正式森林药水素材必须在最终构建前完成，不能用剪影占位作为第二章发布结果。
