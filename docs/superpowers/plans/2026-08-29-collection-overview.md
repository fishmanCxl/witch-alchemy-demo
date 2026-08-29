# 《暮影炼金室》收藏品总览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有单瓶拼图入口改为统一收藏品入口，交付十章双列滚动收藏总览、第一章拼图详情和锁定章节反馈。

**Architecture:** 保留现有 `collection` 顶层场景，用 `SceneFlowState.selectedCollectionChapterId` 区分总览与详情。核心层提供不可变收藏展示目录和纯场景流，展示层用原生 Cocos `ScrollView` 挂载固定 10 张卡片；收藏和称号继续完全从 `PlayerProgress.completedLevels` 派生。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Node.js `node:test`、微信小游戏、原生 `Graphics`。

**Spec:** `docs/superpowers/specs/2026-08-29-collection-overview-design.md`

## Global Constraints

- 首页收藏入口只显示炼金书图标和“收藏品”，不显示任何单瓶 `n/6`。
- 总览恰好 10 张卡、固定两列、纵向滚动，不分页、不横向切换、不增加分类标签。
- 只有第一章“星露药水”可进入六块拼图详情；第 2–10 章保持锁定。
- 锁定卡使用 9 个不同剪影，点击只抖动并提示“第 X 章开放后解锁”。
- `selectedCollectionChapterId`、锁定提示和新拼图微光都是临时展示状态，不写入本地或云端进度。
- 不改变关卡、称号、瓶子交互、粒子、液体裁切、音频、存档和微信分包规则。
- 保留当前 worktree 中未提交的首页布局和 AppID 注入修复；禁止 `git reset`、`git checkout --` 和 `git add .`。
- 每个提交只暂存本任务列出的路径，并先运行 `git diff --cached --check`。

## File Structure

**Create**

- `wechat-game/assets/scripts/core/potion-collection-catalog.ts` — 10 个收藏展示项的稳定数据。
- `wechat-game/tests/potion-collection-catalog.test.ts` — 收藏目录完整性和锁定边界。

**Modify**

- `wechat-game/assets/scripts/core/scene-flow.ts` — 总览/详情临时选择和导航函数。
- `wechat-game/tests/scene-flow.test.ts` — 收藏两层导航测试。
- `wechat-game/assets/scripts/presentation/presentation-layout.ts` — 总览、卡片和原生矢量剪影布局。
- `wechat-game/tests/presentation-layout.test.ts` — 两列滚动几何测试。
- `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts` — 首页入口、总览、详情、锁定反馈。
- `wechat-game/tests/production-contracts.test.ts` — 资源和展示静态契约。
- `wechat-game/package.json` — 把新目录测试加入 `test:core`。
- `wechat-game/AGENTS.md` — 收藏总览生产不变量。

---

### Task 1: 收藏目录与两层场景流

**Files:**
- Create: `wechat-game/assets/scripts/core/potion-collection-catalog.ts`
- Create: `wechat-game/tests/potion-collection-catalog.test.ts`
- Modify: `wechat-game/assets/scripts/core/scene-flow.ts`
- Modify: `wechat-game/tests/scene-flow.test.ts`
- Modify: `wechat-game/package.json`

**Interfaces:**
- Produces: `POTION_COLLECTIONS: readonly PotionCollectionConfig[]`
- Produces: `getPotionCollection(chapterId: number): PotionCollectionConfig | null`
- Produces: `openCollectionDetail(state, chapterId): SceneFlowState`
- Produces: `closeCollectionDetail(state): SceneFlowState`

- [ ] **Step 1: 写收藏目录失败测试**

```ts
assert.equal(POTION_COLLECTIONS.length, 10);
assert.deepEqual(POTION_COLLECTIONS.map((item) => item.chapterId), [1,2,3,4,5,6,7,8,9,10]);
assert.deepEqual(POTION_COLLECTIONS.map((item) => item.collectionId), CHAPTERS.map((chapter) => chapter.collectionId));
assert.equal(POTION_COLLECTIONS[0].name, '星露药水');
assert.equal(POTION_COLLECTIONS[0].artworkKey, 'star-dew-potion');
assert.deepEqual(POTION_COLLECTIONS.slice(1).map((item) => item.name), Array(9).fill('???'));
assert.equal(new Set(POTION_COLLECTIONS.slice(1).map((item) => item.silhouetteIndex)).size, 9);
assert.equal(Object.isFrozen(POTION_COLLECTIONS), true);
```

- [ ] **Step 2: 写场景流失败测试**

```ts
const overview = openCollection(createSceneFlow());
const detail = openCollectionDetail(overview, 1);
assert.equal(overview.selectedCollectionChapterId, null);
assert.equal(detail.selectedCollectionChapterId, 1);
assert.equal(closeCollectionDetail(detail).scene, 'collection');
assert.equal(closeCollectionDetail(detail).selectedCollectionChapterId, null);
assert.equal(openCollectionDetail(overview, 2), overview);
assert.equal(closeCollection(detail), detail);
```

- [ ] **Step 3: 运行测试确认红灯**

Run: `node --experimental-strip-types --test tests/potion-collection-catalog.test.ts tests/scene-flow.test.ts`

Expected: FAIL，缺少 `potion-collection-catalog.ts` 和详情导航导出。

- [ ] **Step 4: 实现最小不可变目录**

```ts
export interface PotionCollectionConfig {
  readonly chapterId: number;
  readonly collectionId: string;
  readonly name: string;
  readonly description: string;
  readonly artworkKey: string | null;
  readonly silhouetteIndex: number | null;
}

export const POTION_COLLECTIONS = Object.freeze(CHAPTERS.map((chapter, index) => Object.freeze({
  chapterId: chapter.id,
  collectionId: chapter.collectionId,
  name: index === 0 ? '星露药水' : '???',
  description: index === 0 ? '收集夜空星辉的稀有药水' : '',
  artworkKey: index === 0 ? 'star-dew-potion' : null,
  silhouetteIndex: index === 0 ? null : index - 1,
})));
```

- [ ] **Step 5: 扩展场景状态**

在 `createSceneFlow` 增加 `selectedCollectionChapterId: null`；`openCollection` 清空选择；`openCollectionDetail` 仅当场景为 `collection`、当前处于总览且章节 `releaseState === 'available'` 时写入章节 ID；`closeCollectionDetail` 只清空选择；`closeCollection` 在详情态返回原 state。

- [ ] **Step 6: 运行测试确认绿灯并提交**

Run: `node --experimental-strip-types --test tests/potion-collection-catalog.test.ts tests/scene-flow.test.ts`

Expected: PASS。

```bash
git add wechat-game/assets/scripts/core/potion-collection-catalog.ts wechat-game/tests/potion-collection-catalog.test.ts wechat-game/assets/scripts/core/scene-flow.ts wechat-game/tests/scene-flow.test.ts wechat-game/package.json
git diff --cached --check
git commit -m "feat: add collection overview flow"
```

---

### Task 2: 双列滚动布局和剪影裁切

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`

**Interfaces:**
- Produces: `COLLECTION_OVERVIEW_LAYOUT`
- Produces: `collectionCardLayout(index: number): CollectionCardLayout`
- Produces: `mysteryPotionVisual(index: number): MysteryPotionVisual`

- [ ] **Step 1: 写布局失败测试**

```ts
assert.deepEqual(COLLECTION_OVERVIEW_LAYOUT.viewport, { x: 0, y: -4, width: 360, height: 636 });
assert.deepEqual(COLLECTION_OVERVIEW_LAYOUT.card, { width: 158, height: 180 });
assert.equal(COLLECTION_OVERVIEW_LAYOUT.columns, 2);
assert.equal(COLLECTION_OVERVIEW_LAYOUT.contentHeight, 1008);
const cards = Array.from({ length: 10 }, (_, index) => collectionCardLayout(index));
assert.deepEqual(cards.map((card) => card.column), [0,1,0,1,0,1,0,1,0,1]);
assert.equal(new Set(cards.map((card) => card.y)).size, 5);
assert.throws(() => collectionCardLayout(10), RangeError);
```

剪影测试固定 3×3 九格顺序，并断言九个 `artOffsetX/artOffsetY` 组合唯一、总裁切面积等于网格面积、索引 9 抛出 `RangeError`。

- [ ] **Step 2: 运行测试确认红灯**

Run: `node --experimental-strip-types --test tests/presentation-layout.test.ts`

Expected: FAIL，缺少总览布局导出。

- [ ] **Step 3: 实现最小布局**

卡片宽 158、高 180，列中心为 -87 和 87，5 行间距 18；内容上下各留 18。剪影网格按 3×3 均分，运行时在 92×92 遮罩内绘制 276×276 全图并使用偏移选取对应格。

- [ ] **Step 4: 运行布局测试并提交**

Run: `node --experimental-strip-types --test tests/presentation-layout.test.ts`

Expected: PASS，现有首页、关卡、粒子和拼图布局断言不变。

```bash
git add wechat-game/assets/scripts/presentation/presentation-layout.ts wechat-game/tests/presentation-layout.test.ts
git diff --cached --check
git commit -m "feat: define collection overview layout"
```

---

### Task 3: 原生矢量锁与九种药水剪影

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`

**Interfaces:**
- Produces: `mysteryPotionVisual(index: number): MysteryPotionVisual`
- Produces: `renderCollectionLock`、`renderMysteryPotion`

- [ ] **Step 1: 写九种剪影规格和原生绘制契约失败测试**

断言九种 body 唯一、索引越界抛出 `RangeError`，并且生产实现引用 `Graphics`、不引用新增剪影 PNG。

- [ ] **Step 2: 实现最小 Graphics 绘制**

卡框、紫金锁和 9 个药水剪影全部由 Cocos `Graphics` 绘制；星露药水继续复用现有 PNG，不增加 SVG 解析器或第三方依赖。

- [ ] **Step 3: 运行定向契约**

Run: `node --experimental-strip-types --test tests/presentation-layout.test.ts tests/production-contracts.test.ts`

Expected: PASS，九种剪影稳定且 `mystery-potions-grid` 不出现在生产源码。

---

### Task 4: 收藏总览、卡片交互与拼图详情

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`

**Interfaces:**
- Consumes: `POTION_COLLECTIONS`、`collectionCardLayout`、`mysteryPotionVisual`、两层场景流。
- Produces: `renderCollectionOverview`、`renderCollectionCard`、`renderCollectionDetail`。

- [ ] **Step 1: 写展示契约失败测试**

断言源码包含 `ScrollView`、`renderCollectionOverview`、`renderCollectionCard`、`renderCollectionDetail`、`renderMysteryPotion`、`openCollectionDetail`、`closeCollectionDetail`、`POTION_COLLECTIONS` 和锁定提示文本；断言 `renderCollectionEntry` 不再引用 `revealedPieces`，且生产源码不引用 `mystery-potions-grid`。

- [ ] **Step 2: 运行展示契约确认红灯**

Run: `node --experimental-strip-types --test tests/production-contracts.test.ts`

Expected: FAIL，缺少总览渲染方法和 `ScrollView`。

- [ ] **Step 3: 改造统一入口**

`renderCollectionEntry` 移除 `CollectionProgress` 参数。首页方形按钮显示炼金书图标和“收藏品”，选关页宽按钮显示炼金书图标和“收藏品”；保留 `collectionHasNewPiece` 的微光，但不显示 `n/6`。

- [ ] **Step 4: 创建原生纵向 ScrollView**

导入 `ScrollView`。总览绘制背景、标题、紫金面板、636px 高遮罩视口和 1008px 内容节点；设置 `vertical = true`、`horizontal = false`、`inertia = true`、`elastic = true`，按 `collectionCardLayout` 挂载 10 张卡片。

- [ ] **Step 5: 渲染可用与锁定卡片**

第一张卡显示星露药水插画、名称和派生的 `n/6`。后 9 张用 92×92 `Mask` 裁出九宫格对应剪影，叠加金锁、`???` 和“第 X 章”。卡片框用现有 `addPanel` 绘制深紫填充、暖金描边，避免新增通用组件。

- [ ] **Step 6: 实现锁定反馈**

点击锁定卡先 `Tween.stopAllByTarget(card)`，再执行约 0.24 秒的 `x: 0 → -6 → 6 → -4 → 4 → 0` 相对抖动。总览底部提示节点显示“第 X 章开放后解锁”，用 `UIOpacity` tween 在 1.4 秒后淡出；重复点击先停止旧 tween，不堆积动画。

- [ ] **Step 7: 分派详情并保留原拼图**

`renderCollection` 根据 `selectedCollectionChapterId` 调用总览或详情。把现有拼图代码迁入 `renderCollectionDetail`，详情返回按钮调用 `closeCollectionDetail`；总览返回按钮调用 `closeCollectionView`。设置弹层打开/关闭不修改选择。

- [ ] **Step 8: 运行定向测试并提交**

Run: `node --experimental-strip-types --test tests/scene-flow.test.ts tests/potion-collection-catalog.test.ts tests/presentation-layout.test.ts tests/production-contracts.test.ts`

Expected: PASS。

```bash
git add wechat-game/assets/scripts/presentation/ProductionBootstrap.ts wechat-game/tests/production-contracts.test.ts
