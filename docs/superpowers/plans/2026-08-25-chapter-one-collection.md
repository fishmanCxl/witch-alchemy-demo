# 《魔女炼金屋》第一章与图鉴系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布数据驱动的第一章 1–30 关、显著递增的离线生成难度、六块星露药水拼图图鉴和自动最高称号，并保持现有微信小游戏玩法、存档、视觉和构建能力。

**Architecture:** 纯 TypeScript 核心层新增章节目录、收藏派生和结算奖励，离线工具层用确定性约束生成与精确求解产出 30 关静态数据，Cocos 展示层只消费不可变目录与派生结果。长期进度继续使用 v2 完成关卡集合，图鉴块数和称号不单独存档；新增美术先进入 React 原型的批准资源目录，再通过现有同步脚本进入 Cocos resources。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Node.js `node:test`、微信小游戏、React/Vite 视觉原型、现有本地资源同步脚本。

**Spec:** `docs/superpowers/specs/2026-08-25-chapter-one-collection-design.md`

## Global Constraints

- 固定 5×3 槽位；普通关卡最多使用 14 个槽位，索引 14 永久保留给一次性激励空瓶。
- 完成瓶变为 `vanished` 后槽位不可复用，离线生成器与求解器必须使用运行时相同语义。
- 运行时不得生成或求解关卡；只提交 `tools/generate-levels.ts` 的确定性输出和报告。
- 第一章发布恰好 1–30 关；仅第 1 关为教学，第 2 关起均为 `all-colors`。
- 第 12 关 `initialState` 与当前 `createDemoState()` 保持字节级一致。
- 30 个关卡按钮固定为 5×6 单页布局，不滚动、不翻页。
- 图鉴每完成 5 个不同关卡揭示一块，六块进度和最高称号必须从 `PlayerProgress.completedLevels` 派生。
- 不增加可佩戴称号、道具系统、运行时碎片存档、第二章可玩关卡或云端 schema 字段。
- 新增文字使用现有艺术字体；宽按钮继续九宫格，底部方形按钮继续在 110×72 热区内居中。
- 新增 4 种棋盘颜色时必须同时提供唯一粒子语言，不能只换液体颜色。
- 不提交 AppID、环境 ID、广告位 ID、密钥或管理员凭据。
- 当前工作树已有获批改动；不得使用 `git reset`、`git checkout --` 或 blanket `git add .`。每次仅暂存任务列出的路径，并在提交前运行 `git diff --cached --check`。

## File Structure

**Create**

- `wechat-game/assets/scripts/core/chapter-catalog.ts` — 10 章稳定元数据、发布边界、关卡到章节查询。
- `wechat-game/assets/scripts/core/collection-progress.ts` — 六块拼图、最高称号、首次里程碑奖励的纯派生函数。
- `wechat-game/tests/chapter-catalog.test.ts` — 章节范围、发布状态与称号顺序测试。
- `wechat-game/tests/collection-progress.test.ts` — 拼图、称号和重复通关幂等测试。
- `prototype/public/assets/game/chibi/ui/icon-alchemy-book.png` — 首页/选关页炼金书入口。
- `prototype/public/assets/game/chibi/collection/star-dew-potion.png` — 第一章 2×3 拼图完整插画。
- `prototype/public/assets/game/chibi/titles/title-badge-novice.png` — 见习魔女徽章底图，不烘焙文字。
- `prototype/public/assets/game/chibi/titles/title-badge-junior.png` — 初级魔女徽章底图，不烘焙文字。
- `prototype/public/assets/game/chibi/effects/particle-scarlet-flame.png` — 新增红色火苗粒子。
- `prototype/public/assets/game/chibi/effects/particle-chartreuse-rune.png` — 新增黄绿色符文粒子。
- `prototype/public/assets/game/chibi/effects/particle-indigo-comet.png` — 新增靛蓝彗星粒子。
- `prototype/public/assets/game/chibi/effects/particle-pearl-diamond.png` — 新增珍珠色菱晶粒子。

**Modify**

- `wechat-game/assets/scripts/core/types.ts` — 扩展 4 种 `PotionColor`。
- `wechat-game/assets/scripts/core/level-config.ts` — 扩展难度指标并校验 12 色目录。
- `wechat-game/assets/scripts/core/level-catalog.ts` — 发布 30 关并升级配置版本。
- `wechat-game/assets/scripts/core/level-progress.ts` — 30 关解锁边界与旧 v2 存档规范化。
- `wechat-game/assets/scripts/core/scene-flow.ts` — 增加图鉴场景和来源返回状态。
- `wechat-game/assets/scripts/core/level-data.generated.ts` — 生成后的 30 关静态数据。
- `wechat-game/assets/scripts/core/level-generation-report.json` — 生成后的目标/实际难度与兼容豁免报告。
- `wechat-game/tools/level-solver.ts` — 保持最短解保证的确定性 A* 与开局分支分析。
- `wechat-game/tools/level-generator.ts` — 多指标约束、12 色候选与难度评级。
- `wechat-game/tools/generate-levels.ts` — 唯一教学关、30 关曲线和第 12 关固定覆盖。
- `wechat-game/assets/scripts/presentation/presentation-layout.ts` — 5×6 选关、图鉴与称号布局和拼图切片几何。
- `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts` — 首页图鉴入口、称号、选关进度、图鉴页和里程碑结算。
- `wechat-game/tools/sync-approved-assets.mjs` — 保持目录同步并验证新增资源路径。
- `wechat-game/tools/verify-collection-assets.py` — 校验正式收藏、称号和粒子 PNG 的尺寸与透明通道。
- `wechat-game/tests/level-config.test.ts`、`level-solver.test.ts`、`level-generator.test.ts`、`level-catalog.test.ts`、`level-progress.test.ts`、`scene-flow.test.ts`、`presentation-layout.test.ts`、`production-contracts.test.ts`、`local-progress-store.test.ts` — 对应回归与新功能测试。
- `wechat-game/package.json` — 把新增测试加入 `test:core`。
- `wechat-game/AGENTS.md`、`prototype/AGENTS.md` — 更新为 30 关、仅第 1 关教学、拼图和自动称号的已确认不变量。

---

### Task 1: 数据驱动章节目录与派生收藏

**Files:**
- Create: `wechat-game/assets/scripts/core/chapter-catalog.ts`
- Create: `wechat-game/assets/scripts/core/collection-progress.ts`
- Create: `wechat-game/tests/chapter-catalog.test.ts`
- Create: `wechat-game/tests/collection-progress.test.ts`
- Modify: `wechat-game/package.json`

**Interfaces:**
- Consumes: `PlayerProgress.completedLevels: readonly string[]` 和 `levelNumber(id): number | null`。
- Produces: `CHAPTERS`, `getChapter(id)`, `chapterForLevel(levelNumber)`, `publishedChapters()`, `deriveCollectionProgress(progress, chapterId)`, `deriveHighestTitle(progress)`, `deriveCompletionReward(before, after, levelId)`。

- [ ] **Step 1: 写章节目录失败测试**

```ts
test('catalog defines ten non-overlapping thirty-level chapters and only chapter one is available', () => {
  assert.equal(CHAPTERS.length, 10);
  assert.deepEqual(CHAPTERS.map((chapter) => chapter.firstLevel),
    [1, 31, 61, 91, 121, 151, 181, 211, 241, 271]);
  assert.deepEqual(publishedChapters().map((chapter) => chapter.id), [1]);
  assert.equal(chapterForLevel(30)?.id, 1);
  assert.equal(chapterForLevel(31)?.id, 2);
});

test('title order follows the approved reference', () => {
  assert.deepEqual(CHAPTERS.map((chapter) => chapter.stageTitle), [
    '见习魔女', '初级魔女', '熟练魔女', '高级魔女', '炼金大师',
    '炼金导师', '大魔女', '星辉魔女', '月之魔女', '传奇炼金师',
  ]);
});
```

- [ ] **Step 2: 写收藏派生失败测试**

```ts
function progressWithCompleted(count: number): PlayerProgress {
  return {
    ...createDefaultProgress(),
    completedLevels: Array.from({ length: count }, (_, index) => levelId(index + 1)),
  };
}

for (const [completed, pieces] of [[0, 0], [4, 0], [5, 1], [9, 1], [10, 2], [29, 5], [30, 6]]) {
  test(`${completed} unique completions derive ${pieces} puzzle pieces`, () => {
    const progress = progressWithCompleted(completed);
    assert.equal(deriveCollectionProgress(progress, 1).revealedPieces, pieces);
  });
}

test('chapter completion promotes automatically and replay gives no reward', () => {
  const before = progressWithCompleted(29);
  const after = { ...before, completedLevels: [...before.completedLevels, 'level-030'] };
  assert.equal(deriveHighestTitle(before).title, '见习魔女');
  assert.equal(deriveHighestTitle(after).title, '初级魔女');
  assert.deepEqual(deriveCompletionReward(after, after, 'level-030'), {
    puzzlePiece: null, collectionCompleted: false, titleChanged: false,
  });
});
```

- [ ] **Step 3: 运行新增测试并确认因模块不存在而失败**

Run: `node --experimental-strip-types --test tests/chapter-catalog.test.ts tests/collection-progress.test.ts`

Expected: FAIL，错误包含 `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 4: 实现不可变章节目录**

```ts
export interface ChapterConfig {
  readonly id: number;
  readonly stageTitle: string;
  readonly themeTitle: string;
  readonly firstLevel: number;
  readonly levelCount: 30;
  readonly collectionId: string;
  readonly releaseState: 'available' | 'coming-soon';
}

const TITLES = [
  '见习魔女', '初级魔女', '熟练魔女', '高级魔女', '炼金大师',
  '炼金导师', '大魔女', '星辉魔女', '月之魔女', '传奇炼金师',
] as const;

export const CHAPTERS: readonly ChapterConfig[] = Object.freeze(TITLES.map((stageTitle, index) => Object.freeze({
  id: index + 1,
  stageTitle,
  themeTitle: index === 0 ? '基础炼金' : `第 ${index + 1} 章`,
  firstLevel: index * 30 + 1,
  levelCount: 30 as const,
  collectionId: index === 0 ? 'star-dew-potion' : `chapter-${String(index + 1).padStart(2, '0')}-potion`,
  releaseState: index === 0 ? 'available' : 'coming-soon',
})));
```

Implement exact guards: chapter IDs outside 1–10 and level numbers outside 1–300 return `null`; `publishedChapters()` returns only immutable `available` entries.

- [ ] **Step 5: 实现拼图、称号与结算奖励派生**

```ts
export interface CollectionProgress {
  readonly chapterId: number;
  readonly completedLevels: number;
  readonly revealedPieces: number;
  readonly totalPieces: 6;
  readonly collected: boolean;
  readonly nextMilestone: number | null;
}

export interface CompletionReward {
  readonly puzzlePiece: number | null;
  readonly collectionCompleted: boolean;
  readonly titleChanged: boolean;
}
```

Use a normalized `Set` of valid level IDs, count only IDs inside the chapter range, calculate `Math.floor(count / 5)`, and compute title from the highest **contiguous fully completed** chapter. `deriveCompletionReward` compares before/after derived values so replaying a completed level is idempotent.

- [ ] **Step 6: 把两项测试加入 `test:core` 并运行**

Run: `npm run test:core`

Expected: PASS，且原有测试数量只增加不减少。

- [ ] **Step 7: 提交任务**

```bash
git add wechat-game/assets/scripts/core/chapter-catalog.ts wechat-game/assets/scripts/core/collection-progress.ts wechat-game/tests/chapter-catalog.test.ts wechat-game/tests/collection-progress.test.ts wechat-game/package.json
git diff --cached --check
git commit -m "feat: add chapter and collection progression"
```

---

### Task 2: 精确求解器与多指标难度评级

**Files:**
- Modify: `wechat-game/assets/scripts/core/types.ts`
- Modify: `wechat-game/assets/scripts/core/level-config.ts`
- Modify: `wechat-game/tools/level-solver.ts`
- Modify: `wechat-game/tools/level-generator.ts`
- Modify: `wechat-game/tests/level-config.test.ts`
- Modify: `wechat-game/tests/level-solver.test.ts`
- Modify: `wechat-game/tests/level-generator.test.ts`

**Interfaces:**
- Consumes: `GameState`, `CompletionRule`, `canPour`, `pour`, `vanishBottle`。
- Produces: `countColorSegments(state)`, `solveLevel(state, options): SolveResult`（保留现有调用方式）、`analyzeOpeningBranches(state, rule, optimalMoves, maxExploredStates)`, `difficultyRating(metrics)`, 扩展后的 `GenerationSpec`。

- [ ] **Step 1: 写扩展颜色和指标失败测试**

```ts
test('validator accepts the twelve approved potion colors', () => {
  const colors: PotionColor[] = [
    'rose', 'violet', 'amber', 'cyan', 'mint', 'blue', 'gold', 'lilac',
    'scarlet', 'chartreuse', 'indigo', 'pearl',
  ];
  assert.equal(new Set(colors).size, 12);
});

test('difficulty metrics include normalized rating and misleading branches', () => {
  assert.equal(DEMO_LEVEL_CONFIG.metrics.difficultyRating >= 0, true);
  assert.equal(DEMO_LEVEL_CONFIG.metrics.difficultyRating <= 1, true);
  assert.equal(DEMO_LEVEL_CONFIG.metrics.misleadingBranchRatio >= 0, true);
});
```

- [ ] **Step 2: 写 A* 最短解与开局诱导分支失败测试**

```ts
const twoColorState = stateOf([
  ['rose'], ['rose', 'rose', 'rose'], ['amber'], ['amber', 'amber', 'amber'],
]);
const branchingState = stateOf([
  ['rose', 'amber', 'violet', 'rose'],
  ['violet', 'rose', 'amber', 'violet'],
  ['amber', 'violet', 'rose', 'amber'],
  [],
  [],
]);
const options = {
  completionRule: { type: 'all-colors', targetCount: 2 } as const,
  maxExploredStates: 50_000,
};

test('A star keeps the known two-move solution shortest and deterministic', () => {
  const first = solveLevel(twoColorState, options);
  const second = solveLevel(twoColorState, options);
  assert.equal(first.moves.length, 2);
  assert.deepEqual(second, first);
});

test('opening analysis marks branches longer than the optimum as misleading', () => {
  const rule = { type: 'all-colors', targetCount: 3 } as const;
  const solved = solveLevel(branchingState, { completionRule: rule, maxExploredStates: 50_000 });
  assert.equal(solved.solved, true);
  const analysis = analyzeOpeningBranches(branchingState, rule, solved.moves.length, 50_000);
  assert.equal(analysis.totalBranches > 0, true);
  assert.equal(analysis.misleadingBranches > 0, true);
  assert.equal(analysis.ratio, analysis.misleadingBranches / analysis.totalBranches);
});
```

- [ ] **Step 3: 运行定向测试并确认新接口不存在**

Run: `node --experimental-strip-types --test tests/level-config.test.ts tests/level-solver.test.ts tests/level-generator.test.ts`

Expected: FAIL，缺少新颜色、`difficultyRating`、`misleadingBranchRatio` 或 `analyzeOpeningBranches`。

- [ ] **Step 4: 扩展颜色和 `LevelMetrics`**

```ts
export type PotionColor =
  | 'rose' | 'violet' | 'amber' | 'cyan' | 'mint' | 'blue' | 'gold' | 'lilac'
  | 'scarlet' | 'chartreuse' | 'indigo' | 'pearl';

export interface LevelMetrics {
  readonly colorCount: number;
  readonly optimalMoves: number;
  readonly segmentCount: number;
  readonly exploredStates: number;
  readonly openingMoves: number;
  readonly misleadingBranchRatio: number;
  readonly difficultyRating: number;
  readonly difficultyScore: number;
}
```

Add all 12 values to the validator’s color set. Validate both new metrics as finite values in `[0, 1]`; keep `difficultyScore` for report compatibility.

- [ ] **Step 5: 用确定性 A* 替换队列实现而不改变规则语义**

Move the current generator-private segment counter into `level-config.ts`, then import the same helper from both solver and generator:

```ts
export function countColorSegments(state: GameState): number {
  let total = 0;
  for (const bottle of state.bottles) {
    let previous: PotionColor | undefined;
    for (const color of bottle.layers) {
      if (color !== previous) total += 1;
      previous = color;
    }
  }
  return total;
}
```

Implement a local binary min-heap ordered by `(depth + lowerBound, depth, insertionOrder)`. The admissible lower bound is:

```ts
function mergeLowerBound(state: GameState): number {
  const segments = countColorSegments(state);
  const unfinishedColors = new Set(state.bottles.flatMap((bottle) => bottle.layers)).size;
  return Math.max(0, segments - unfinishedColors);
}
```

Continue using `canonicalStateKey`, skip monochrome-to-empty relocations, keep `maxExploredStates`, and reconstruct the first shortest solution. Existing solver tests, including the frozen level 12 replay, must remain green.

- [ ] **Step 6: 实现开局分支分析和归一化评级**

For every legal opening move, solve its child state with the remaining rule. A branch is misleading when it cannot solve within budget or `1 + child.moves.length > optimalMoves`. Return an exact ratio in `[0,1]`.

```ts
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round3 = (value: number): number => Math.round(value * 1_000) / 1_000;

export function difficultyRating(metrics: Omit<LevelMetrics, 'difficultyRating' | 'difficultyScore'>): number {
  const solution = clamp01((metrics.optimalMoves - 5) / 30);
  const segments = clamp01((metrics.segmentCount - metrics.colorCount) / (metrics.colorCount * 2.5));
  const search = clamp01(Math.log10(metrics.exploredStates + 1) / 6);
  const openingConstraint = clamp01(1 - Math.abs(metrics.openingMoves - 8) / 20);
  return round3(0.36 * solution + 0.22 * segments + 0.18 * search
    + 0.10 * openingConstraint + 0.14 * metrics.misleadingBranchRatio);
}
```

`difficultyScore` becomes `Math.round(difficultyRating * 10_000)` so reports stay sortable while decisions use the normalized value and individual windows.

- [ ] **Step 7: 扩展生成约束并保持确定性**

```ts
export interface GenerationSpec {
  readonly number: number;
  readonly colorCount: number;
  readonly emptyBottleCount: number;
  readonly reverseMoves: number;
  readonly targetDifficulty: number;
  readonly minimumOptimalMoves: number;
  readonly maximumOptimalMoves: number;
  readonly minimumSegments: number;
  readonly minimumExploredStates: number;
  readonly minimumOpeningMoves: number;
  readonly maximumOpeningMoves: number;
  readonly minimumMisleadingBranchRatio: number;
  readonly maxAttempts: number;
}
```

Expand generator `COLORS` in the exact union order. Reject candidates on each field before ranking accepted candidates by absolute distance to `targetDifficulty`; never accept a candidate solely because its aggregate score is high.

- [ ] **Step 8: 运行求解与生成测试**

Run: `node --experimental-strip-types --test tests/level-config.test.ts tests/level-solver.test.ts tests/level-generator.test.ts`

Expected: PASS，冻结第 12 关仍在预算内可解，固定种子重复结果完全一致。

- [ ] **Step 9: 提交任务**

```bash
git add wechat-game/assets/scripts/core/types.ts wechat-game/assets/scripts/core/level-config.ts wechat-game/tools/level-solver.ts wechat-game/tools/level-generator.ts wechat-game/tests/level-config.test.ts wechat-game/tests/level-solver.test.ts wechat-game/tests/level-generator.test.ts
git diff --cached --check
git commit -m "feat: score generated levels with solver metrics"
```

---

### Task 3: 生成并发布第一章 30 关

**Files:**
- Modify: `wechat-game/tools/generate-levels.ts`
- Modify: `wechat-game/assets/scripts/core/level-catalog.ts`
- Modify: `wechat-game/assets/scripts/core/level-data.generated.ts`
- Modify: `wechat-game/assets/scripts/core/level-generation-report.json`
- Modify: `wechat-game/tests/level-catalog.test.ts`
- Modify: `wechat-game/tests/level-generator.test.ts`
- Modify: `wechat-game/tests/game-session.test.ts`

**Interfaces:**
- Consumes: Task 2 `GenerationSpec`, `generateCandidate`, `analyzeState` 和现有 `DEMO_LEVEL_CONFIG`。
- Produces: `FIRST_CHAPTER_LEVELS` 恰好 30 项，配置版本 `chapter-1.2026-08-25.1`，生成报告 schema v2。

- [ ] **Step 1: 将目录测试改成新发布契约并先观察失败**

```ts
test('first chapter publishes exactly thirty consecutive validated levels', () => {
  assert.deepEqual(FIRST_CHAPTER_LEVELS.map((level) => level.id),
    Array.from({ length: 30 }, (_, index) => levelId(index + 1)));
  for (const level of FIRST_CHAPTER_LEVELS) assert.deepEqual(validateLevelConfig(level), [], level.id);
});

test('only level one is tutorial and level two starts at seven to ten optimal moves', () => {
  assert.deepEqual(getLevelConfig('level-001')?.completionRule, { type: 'first-valid-pour' });
  for (let number = 2; number <= 30; number += 1) {
    assert.equal(getLevelConfig(levelId(number))?.completionRule.type, 'all-colors');
  }
  assert.ok((getLevelConfig('level-002')?.metrics.optimalMoves ?? 0) >= 7);
  assert.ok((getLevelConfig('level-002')?.metrics.optimalMoves ?? 99) <= 10);
});
```

Replace the old monotonic-score assertion with anchor/envelope assertions and an explicit `25–27` peak plus `28–30` easing assertion. Keep `assert.deepEqual(getLevelConfig('level-012')?.initialState, createDemoState())` unchanged.

- [ ] **Step 2: 运行目录测试并确认仍只有 15 关**

Run: `node --experimental-strip-types --test tests/level-catalog.test.ts`

Expected: FAIL，实际数组长度为 15，且第 2 关仍是 `first-bottle-complete`。

- [ ] **Step 3: 实现曲线函数和逐关规格**

```ts
export function chapterOneDifficultyTarget(level: number): number {
  const anchors = [[1, .05], [2, .60], [3, .68], [5, .78], [10, .88],
    [20, .97], [25, 1], [27, 1], [30, .90]] as const;
  // Return exact anchor or linear interpolation between adjacent anchors, rounded to 3 decimals.
}

const COLOR_COUNTS = [
  1, 3, 3, 4, 4, 4, 5, 5, 5, 5,
  6, 8, 6, 6, 6, 7, 7, 7, 7, 7,
  8, 8, 9, 9, 9, 10, 12, 10, 9, 8,
] as const;
```

Level 1 remains the existing fixed first-valid-pour board. Levels 2–30 use two empty bottles and all-colors completion. Implement the exact range table below in one pure `generationSpecForLevel(number)` function; level 12 still uses the fixed override rather than candidate acceptance.

| 关卡 | 最短解 min–max | 颜色段 min | 搜索状态 min | 开局动作 min–max | 诱导比例 min | maxAttempts |
|---|---:|---:|---:|---:|---:|---:|
| 2–4 | 7–10 | 8 | 20 | 2–12 | 0.10 | 5,000 |
| 5–9 | 10–16 | 12 | 100 | 2–14 | 0.15 | 5,000 |
| 10–19 | 14–24 | 18 | 500 | 2–16 | 0.20 | 8,000 |
| 20–24 | 18–30 | 26 | 2,000 | 2–18 | 0.25 | 12,000 |
| 25–27 | 22–40 | 34 | 5,000 | 2–18 | 0.30 | 20,000 |
| 28–30 | 16–30 | 24 | 1,000 | 2–18 | 0.20 | 10,000 |

Set `reverseMoves = Math.round(6 + targetDifficulty * 22)`. Candidate ranking may select above the minimums but must never cross a table maximum.

- [ ] **Step 4: 固定第 12 关覆盖并升级报告**

Keep `initialState: createDemoState()` and `configVersion: DEMO_LEVEL_CONFIG.configVersion` for level 12. Report fields:

```ts
interface ReportLevel {
  readonly id: string;
  readonly source: 'tutorial' | 'generated' | 'legacy';
  readonly targetDifficulty: number;
  readonly compatibilityExemption: 'legacy-level-12' | null;
  readonly generatorSeed: number | null;
  readonly attempt: number | null;
  readonly reverseMoves: number | null;
  readonly metrics: LevelMetrics;
  readonly scoreComponents: GenerationScoreComponents | null;
}
```

The level 12 report may miss the new target window only when `compatibilityExemption === 'legacy-level-12'`; no other level may have an exemption.

- [ ] **Step 5: 生成静态数据并保存耗时/失败诊断**

Run: `npm run generate:levels`

Expected: `Generated 30 published levels and difficulty report`。若候选耗尽，诊断必须包含关卡号、种子、尝试次数和未满足的具体指标；只调整该关 seed、reverseMoves 或窗口，不降低第 2 关的 7 步下限，不改第 12 关棋盘。

- [ ] **Step 6: 验证静态输出、唯一性和会话胜利规则**

Run: `npm run check:levels`

Expected: `30 published levels match generated output`。

Run: `node --experimental-strip-types --test tests/level-catalog.test.ts tests/level-generator.test.ts tests/game-session.test.ts`

Expected: PASS；30 个棋盘唯一，第 2–30 关均需完成所有颜色。

- [ ] **Step 7: 提交任务**

```bash
git add wechat-game/tools/generate-levels.ts wechat-game/assets/scripts/core/level-catalog.ts wechat-game/assets/scripts/core/level-data.generated.ts wechat-game/assets/scripts/core/level-generation-report.json wechat-game/tests/level-catalog.test.ts wechat-game/tests/level-generator.test.ts wechat-game/tests/game-session.test.ts
git diff --cached --check
git commit -m "feat: publish thirty chapter one levels"
```

---

### Task 4: 30 关进度、图鉴场景流与里程碑结算

**Files:**
- Modify: `wechat-game/assets/scripts/core/level-progress.ts`
- Modify: `wechat-game/assets/scripts/core/scene-flow.ts`
- Modify: `wechat-game/assets/scripts/platform/LocalProgressStore.ts`
- Modify: `wechat-game/tests/level-progress.test.ts`
- Modify: `wechat-game/tests/scene-flow.test.ts`
- Modify: `wechat-game/tests/local-progress-store.test.ts`

**Interfaces:**
- Consumes: Task 1 章节/收藏派生，Task 3 的 30 关目录。
- Produces: 可解锁至 `level-030` 的 v2 进度、`GameScene = ... | 'collection'`、`openCollection(state)`、`closeCollection(state)`。

- [ ] **Step 1: 写 30 关边界和旧存档失败测试**

```ts
function progressAt(levelId: string): PlayerProgress {
  return {
    ...createDefaultProgress(),
    currentLevel: levelId,
    highestUnlockedLevel: levelId,
  };
}

const oldFifteenLevelProgress: PlayerProgress = {
  ...createDefaultProgress(),
  revision: 15,
  currentLevel: 'level-015',
  highestUnlockedLevel: 'level-015',
  completedLevels: Array.from({ length: 14 }, (_, index) => levelId(index + 1)),
  configVersion: 'chapter-1.2026-08-23.1',
};

test('level 30 caps progression without unlocking an unpublished chapter', () => {
  const progress = progressAt('level-030');
  const completed = completeLevel(progress, 'level-030', 42)!;
  assert.equal(completed.currentLevel, 'level-030');
  assert.equal(completed.highestUnlockedLevel, 'level-030');
  assert.equal(isLevelUnlocked(completed, 'level-031'), false);
});

test('old v2 progress is normalized to the new config without losing completions', () => {
  const decoded = decodePlayerProgress(JSON.stringify(oldFifteenLevelProgress));
  assert.deepEqual(decoded?.completedLevels, oldFifteenLevelProgress.completedLevels);
  assert.equal(decoded?.configVersion, 'chapter-1.2026-08-25.1');
});
```

- [ ] **Step 2: 写图鉴来源返回状态失败测试**

```ts
test('collection returns to the scene that opened it', () => {
  const fromHome = openCollection(createSceneFlow());
  assert.equal(fromHome.scene, 'collection');
  assert.equal(closeCollection(fromHome).scene, 'home');
  const fromSelect = openCollection(openLevelSelect(createSceneFlow()));
  assert.equal(closeCollection(fromSelect).scene, 'levelSelect');
});
```

- [ ] **Step 3: 运行定向测试并观察旧 15 关边界失败**

Run: `node --experimental-strip-types --test tests/level-progress.test.ts tests/scene-flow.test.ts tests/local-progress-store.test.ts`

Expected: FAIL，缺少图鉴场景，旧测试仍把 `level-015` 当终点。

- [ ] **Step 4: 更新进度规范化和本地快照兼容**

Keep `schemaVersion: 2` and storage keys unchanged. Normalize valid old completion IDs through the 30-level catalog and always rewrite `configVersion` to `FIRST_CHAPTER_CONFIG_VERSION`. Do not infer missing earlier completions from a high unlock. Keep level 12’s unchanged config version so its existing valid v2 snapshot remains restorable; changed level snapshots continue to reset only themselves.

- [ ] **Step 5: 添加图鉴场景和来源字段**

```ts
export type GameScene = 'home' | 'levelSelect' | 'collection' | 'level' | 'levelComplete';

export interface SceneFlowState {
  // existing fields
  readonly collectionReturnScene: 'home' | 'levelSelect';
}
```

`openCollection` only accepts home or selector as origin, closes settings, and records the origin. `closeCollection` returns there and clears `nextLevelId`. Level/completion scenes cannot open collection through the core API.

- [ ] **Step 6: 运行进度和场景回归**

Run: `node --experimental-strip-types --test tests/level-progress.test.ts tests/scene-flow.test.ts tests/local-progress-store.test.ts tests/progress-sync.test.ts`

Expected: PASS；全局进度与单关快照仍独立，云同步 schema 无新增字段。

- [ ] **Step 7: 提交任务**

```bash
git add wechat-game/assets/scripts/core/level-progress.ts wechat-game/assets/scripts/core/scene-flow.ts wechat-game/assets/scripts/platform/LocalProgressStore.ts wechat-game/tests/level-progress.test.ts wechat-game/tests/scene-flow.test.ts wechat-game/tests/local-progress-store.test.ts
git diff --cached --check
git commit -m "feat: extend progress and collection flow"
```

---

### Task 5: 5×6 单页选关与图鉴布局契约

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`

**Interfaces:**
- Consumes: 393×852 设计分辨率与现有 `RectLayout`。
- Produces: 30 项 `levelSelectButton(index)`、`COLLECTION_LAYOUT`、`collectionPuzzlePiece(index)`、首页/选关图鉴入口布局。

- [ ] **Step 1: 写 30 项单页布局失败测试**

```ts
test('selector fits thirty square buttons in one five by six page', () => {
  const cells = Array.from({ length: 30 }, (_, index) => levelSelectButton(index));
  assert.equal(LEVEL_SELECT_LAYOUT.columns, 5);
  assert.equal(LEVEL_SELECT_LAYOUT.rows, 6);
  assert.equal(cells.length, 30);
  assert.throws(() => levelSelectButton(30), RangeError);
  for (const cell of cells) {
    assert.equal(cell.width, 48);
    assert.equal(cell.height, 48);
    assert.ok(Math.abs(cell.x) + 24 <= 393 / 2);
    assert.ok(Math.abs(cell.y) + 24 <= 852 / 2);
  }
});
```

- [ ] **Step 2: 写 2×3 拼图裁切失败测试**

```ts
test('collection artwork is divided into six gapless two by three masks', () => {
  const pieces = Array.from({ length: 6 }, (_, index) => collectionPuzzlePiece(index));
  assert.equal(COLLECTION_LAYOUT.puzzle.columns, 2);
  assert.equal(COLLECTION_LAYOUT.puzzle.rows, 3);
  assert.deepEqual(pieces.map((piece) => [piece.column, piece.row]),
    [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]);
  assert.equal(pieces.reduce((sum, piece) => sum + piece.width * piece.height, 0),
    COLLECTION_LAYOUT.puzzle.width * COLLECTION_LAYOUT.puzzle.height);
});
```

- [ ] **Step 3: 运行布局测试并观察旧 5×3 契约失败**

Run: `node --experimental-strip-types --test tests/presentation-layout.test.ts`

Expected: FAIL，旧 `rows` 为 3 且索引 15 越界。

- [ ] **Step 4: 实现固定几何**

```ts
export const LEVEL_SELECT_LAYOUT = Object.freeze({
  header: Object.freeze({ x: 0, y: 344, width: 321, height: 44 }),
  subtitleY: 310,
  collectionButton: Object.freeze({ x: 0, y: 255, width: 176, height: 44 }),
  columns: 5,
  rows: 6,
  buttonSize: 48,
  columnCenters: Object.freeze([-136, -68, 0, 68, 136] as const),
  rowCenters: Object.freeze([180, 120, 60, 0, -60, -120] as const),
  backButton: Object.freeze({ x: 0, y: -342, width: 224, height: 72 }),
});

export const COLLECTION_LAYOUT = Object.freeze({
  title: Object.freeze({ x: 0, y: 334, width: 300, height: 48 }),
  titleBadge: Object.freeze({ x: 0, y: 260, width: 250, height: 92 }),
  puzzle: Object.freeze({ x: 0, y: 58, width: 252, height: 252, columns: 2, rows: 3 }),
  progressY: -96,
  description: Object.freeze({ x: 0, y: -174, width: 300, height: 92 }),
  backButton: Object.freeze({ x: 0, y: -342, width: 224, height: 72 }),
});
```

`collectionPuzzlePiece(index)` accepts 0–5, returns mask size 126×84, mask center, and full-art offset so six masked copies align into one seamless 252×252 image.

- [ ] **Step 5: 运行完整展示层纯测试**

Run: `node --experimental-strip-types --test tests/presentation-layout.test.ts tests/production-contracts.test.ts`

Expected: PASS；旧瓶子高亮、粒子、九宫格和底部按钮测试不变。

- [ ] **Step 6: 提交任务**

```bash
git add wechat-game/assets/scripts/presentation/presentation-layout.ts wechat-game/tests/presentation-layout.test.ts
git diff --cached --check
git commit -m "feat: define chapter and collection layouts"
```

---

### Task 6: 制作并同步称号、稀有药水和新粒子素材

**Files:**
- Create: `prototype/public/assets/game/chibi/ui/icon-alchemy-book.png`
- Create: `prototype/public/assets/game/chibi/collection/star-dew-potion.png`
- Create: `prototype/public/assets/game/chibi/titles/title-badge-novice.png`
- Create: `prototype/public/assets/game/chibi/titles/title-badge-junior.png`
- Create: four particle PNGs listed in File Structure
- Modify: `wechat-game/tools/sync-approved-assets.mjs`
- Modify: `wechat-game/tests/production-contracts.test.ts`
- Create: `wechat-game/tools/verify-collection-assets.py`
- Generated: matching files under `wechat-game/assets/resources/game/chibi/` plus Cocos `.meta` files

**Interfaces:**
- Consumes: 用户提供的两张视觉参考图和现有 chibi 资源风格。
- Produces: 可由 `resources.load(.../spriteFrame)` 加载的透明 PNG，标题文字继续由运行时 Label 渲染。

- [ ] **Step 1: 先写资源契约失败测试**

```ts
for (const relative of [
  'ui/icon-alchemy-book.png',
  'collection/star-dew-potion.png',
  'titles/title-badge-novice.png',
  'titles/title-badge-junior.png',
  'effects/particle-scarlet-flame.png',
  'effects/particle-chartreuse-rune.png',
  'effects/particle-indigo-comet.png',
  'effects/particle-pearl-diamond.png',
]) {
  assert.equal(existsSync(new URL(`../assets/resources/game/chibi/${relative}`, import.meta.url)), true, relative);
}
```

- [ ] **Step 2: 运行资源测试并确认文件尚不存在**

Run: `node --experimental-strip-types --test tests/production-contracts.test.ts`

Expected: FAIL，第一项缺失资源为 `icon-alchemy-book.png`。

- [ ] **Step 3: 用附件作为参考生成正式透明资源**

Use the image generation workflow with the two user-provided local reference images. Generate separate files, never one sprite sheet:

- 炼金书：深紫皮革、金色月星搭扣、正视角、透明背景、256×256。
- 星露药水：蓝紫星空液体、星形瓶身或星星吊坠、金色轨道星光、主体居中且避开 2×3 分割线、透明背景、1024×1024。
- 见习/初级徽章：统一木质/金边牌匾安全区，分别使用棕紫软帽与深紫羽毛帽，不含任何文字，透明背景、768×384。
- 四个粒子：火苗、符文、彗星、菱晶，各自单一高对比轮廓、透明背景、128×128。

Inspect every result at original resolution. Reject black/white matte backgrounds, clipped glow, illegible small silhouettes, baked Chinese text, or collage remnants.

- [ ] **Step 4: 验证图片尺寸和透明通道**

```py
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'prototype/public/assets/game/chibi'
EXPECTED = {
    'ui/icon-alchemy-book.png': (256, 256),
    'collection/star-dew-potion.png': (1024, 1024),
    'titles/title-badge-novice.png': (768, 384),
    'titles/title-badge-junior.png': (768, 384),
    'effects/particle-scarlet-flame.png': (64, 64),
    'effects/particle-chartreuse-rune.png': (64, 64),
    'effects/particle-indigo-comet.png': (64, 64),
    'effects/particle-pearl-diamond.png': (64, 64),
}
for relative, expected_size in EXPECTED.items():
    with Image.open(ROOT / relative) as image:
        assert image.format == 'PNG', relative
        assert image.size == expected_size, (relative, image.size)
        rgba = image.convert('RGBA')
        assert rgba.getchannel('A').getextrema() == (0, 255), relative
print(f'verified {len(EXPECTED)} collection assets')
````

After visually approving the 128×128 particle sources, downscale them to 64×64 with Lanczos and save the final files at the paths above. Run: `python tools/verify-collection-assets.py`

Expected: `verified 8 collection assets`.

- [ ] **Step 5: 同步批准资源并让 Cocos 生成元数据**

Run: `npm run sync:assets`

Open `wechat-game` in Cocos Creator 3.8.8, wait for asset import to finish, and retain every generated `.meta`. Do not hand-author UUIDs.

- [ ] **Step 6: 运行资源契约**

Run: `node --experimental-strip-types --test tests/production-contracts.test.ts`

Expected: PASS，新增 PNG 和对应 Cocos SpriteFrame meta 均存在。

- [ ] **Step 7: 提交任务**

```bash
git add prototype/public/assets/game/chibi wechat-game/assets/resources/game/chibi wechat-game/assets/resources/game/sync-report.json wechat-game/tools/sync-approved-assets.mjs wechat-game/tools/verify-collection-assets.py wechat-game/tests/production-contracts.test.ts
git diff --cached --check
git commit -m "feat: add collection and title artwork"
```

---

### Task 7: 接入首页称号、炼金书、图鉴和结算反馈

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`

**Interfaces:**
- Consumes: Tasks 1/4 的派生和场景函数、Task 5 布局、Task 6 SpriteFrame 路径。
- Produces: `renderCollection`, `renderTitleBadge`, `renderCollectionPuzzle`, 首页/选关图鉴入口和 `CompletionReward` 展示。

- [ ] **Step 1: 写生产展示静态契约失败测试**

```ts
assert.match(bootstrap, /private renderCollection\(/);
assert.match(bootstrap, /deriveCollectionProgress\(this\.progress, 1\)/);
assert.match(bootstrap, /deriveHighestTitle\(this\.progress\)/);
assert.match(bootstrap, /openCollection\(this\.flow\)/);
assert.match(bootstrap, /collectionPuzzlePiece\(/);
assert.match(bootstrap, /collectionHasNewPiece/);
assert.match(bootstrap, /game\/chibi\/collection\/star-dew-potion\/spriteFrame/);
assert.doesNotMatch(bootstrap, /revealedPieces\s*=\s*this\./);
```

Add a completion-order assertion: `saveProgress(nextProgress)` occurs before assigning the derived reward, clearing the session, and rendering the completion scene.

- [ ] **Step 2: 运行展示契约并确认缺少图鉴实现**

Run: `node --experimental-strip-types --test tests/production-contracts.test.ts tests/presentation-layout.test.ts`

Expected: FAIL，缺少 `renderCollection`。

- [ ] **Step 3: 扩展资源颜色与粒子路径**

```ts
const POTION_COLORS: Record<PotionColor, string> = {
  rose: '#F05B9A', violet: '#9353E6', amber: '#F29A38', cyan: '#2CC4D2',
  mint: '#63D6A5', blue: '#4C70E8', gold: '#F2CC4D', lilac: '#B77ADF',
  scarlet: '#E34A54', chartreuse: '#A8D84A', indigo: '#4A3EB5', pearl: '#F4E9D2',
};
```

Extend `particleSuffix` with `scarlet: 'flame'`, `chartreuse: 'rune'`, `indigo: 'comet'`, `pearl: 'diamond'`. Keep all existing particle timing and bottle-mask behavior unchanged.

- [ ] **Step 4: 接入首页与选关页信息**

On home, derive the current title and render its art-backed badge with runtime art-font text. Add a square炼金书 button that calls `openCollection`; retain existing settings position and continue/select actions. On selector, render `见习魔女 · 基础炼金`, `revealedPieces/6`, 30 buttons, and a compact book entry; no page controls or scrolling nodes. Keep `collectionHasNewPiece` as a session-only boolean: when true, add a small star-glow to both book entries; clear it immediately when `openCollection` succeeds.

- [ ] **Step 5: 实现 2×3 图鉴页**

For each `collectionPuzzlePiece(index)`, create a rectangular `Mask`; add the same full star-dew sprite under the mask using the returned art offset. Revealed pieces display full color; locked pieces use 18% opacity plus a parchment-dark overlay. Render `已收集 n/6`, next milestone copy, potion name and description. The back button calls `closeCollection` and returns to its recorded origin.

- [ ] **Step 6: 接入首次里程碑和章节结算**

Before `completeLevel`, capture `previousProgress`. After local save succeeds, calculate `deriveCompletionReward(previousProgress, nextProgress, session.levelId)` and store it in an ephemeral `completionReward` field. Render:

- levels 5/10/15/20/25: `获得星露药水拼图 · n/6`。
- level 30: first show `星露药水已收入图鉴`, then `晋升 · 初级魔女` inside the completion panel.
- replay: no puzzle or promotion copy.

Set `collectionHasNewPiece = true` only when `CompletionReward.puzzlePiece !== null`. Clear the ephemeral completion reward when leaving the completion scene. Never add either field to `PlayerProgress` or cloud payloads.

- [ ] **Step 7: 运行展示与核心回归**

Run: `npm run test:core`

Expected: PASS，包括瓶子选择高亮不整屏重建、粒子动画、完成存档顺序、30 关单页和图鉴场景。

- [ ] **Step 8: 提交任务**

```bash
git add wechat-game/assets/scripts/presentation/ProductionBootstrap.ts wechat-game/assets/scripts/presentation/presentation-layout.ts wechat-game/tests/production-contracts.test.ts wechat-game/tests/presentation-layout.test.ts
git diff --cached --check
git commit -m "feat: add collection and title presentation"
```

---

### Task 8: 更新工程契约并完成 Cocos/微信验证

**Files:**
- Modify: `wechat-game/AGENTS.md`
- Modify: `prototype/AGENTS.md`

- Test: all `wechat-game/tests/*.test.ts` and `tests/wechat-build-preparation.test.mjs`; the existing full-folder subpackage test is sufficient because Cocos emits hashed asset names.

**Interfaces:**
- Consumes: Tasks 1–7 的完整功能和资源。
- Produces: 与实现一致的项目不变量、可在 Cocos Creator 3.8.8 和微信开发者工具预览的构建。

- [ ] **Step 1: 更新两份 AGENTS.md 的过时不变量**

Replace “第一章发布 1–15” with “第一章发布 1–30”；replace “1–3 authored tutorials” with “level 1 is the only authored tutorial”；add 5×6 no-pagination selector, six-piece derived collection, automatic highest title, runtime-never-solves, and level-12 byte compatibility. Preserve every unrelated audio、粒子、按钮、云端和交互规则。

- [ ] **Step 2: 运行确定性生成检查**

Run: `npm run check:levels`

Expected: `30 published levels match generated output`。

- [ ] **Step 3: 运行全部工程测试**

Run: `npm run test:core`

Run: `npm run test:wechat-build`

Expected: 两条命令均退出码 0；现有 114 项基线测试不减少，新增测试全部计入。

- [ ] **Step 4: 在 Cocos Creator 3.8.8 验证场景**

Open the project and verify at 393×852 plus at least one tall Android preview:

- 首页显示最高称号与炼金书入口。
- 选关页同屏完整显示 1–30，无滚动/分页且锁定状态正确。
- 第 1 关仍是教学；第 2 关必须完成 3 色且不能 1–2 步通关。
- 第 12 关棋盘与旧演示完全一致。
- 瓶子高亮、无效选择转移、液体裁切和粒子动画无回归。
- 图鉴 0/6、1/6、5/6、6/6 的拼图无缝、遮罩正确。
- 第 30 关不进入第 31 关，显示收录与晋升。

- [ ] **Step 5: 构建微信小游戏并准备分包**

Build from Cocos Creator, then run: `npm run prepare:wechat-build`

Expected: 主包保持在微信限制内，完整 Cocos `resources` bundle 位于分包，新增收藏资源没有漏传。

- [ ] **Step 6: 从全新微信开发者工具进程预览**

Use AppID already configured outside source control. Complete smoke path: 启动页 → 首页 → 选关 → 第 2 关 → 返回 → 图鉴 → 返回。确认无 80051 包体错误、无资源 404、无控制台异常、二维码有效。

- [ ] **Step 7: 提交契约和任何必要构建规则修订**

```bash
git add wechat-game/AGENTS.md prototype/AGENTS.md
git diff --cached --check
git commit -m "docs: publish chapter one production contract"
```

- [ ] **Step 8: 最终证据检查**

Run: `git status --short`

Record the exact output counts from `npm run check:levels`, `npm run test:core`, `npm run test:wechat-build`, Cocos import/build, and微信开发者工具预览。Do not claim completion if generated output differs, any test fails, Cocos has missing SpriteFrames, or the preview cannot traverse the smoke path.
