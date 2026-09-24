# 《魔女炼金屋》第十章 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布 271–300 关“终极炼金”、贤者药水图鉴、300/301 客户端与云端边界，并交付供用户真机验收的微信包。

**Architecture:** 复制第九章已验证的独立离线生成器控制流，只替换第十章参数和父棋盘；探测后锁定静态 TS/JSON，常规 `--check` 不调用精确求解器。运行时继续从静态目录派生关卡、拼图和称号，CloudBase 只扩大发布上限，不改启动、平台适配或构建链。

**Tech Stack:** TypeScript、Node.js `--experimental-strip-types`、`node:test`、Cocos Creator 3.8.8、微信小游戏、CloudBase、PNG SpriteFrame。

**Spec:** `docs/superpowers/specs/2026-09-24-chapter-ten-design.md`

## Global Constraints

- 仅在 `D:\codex_pro\my_game_water\.worktrees\chapter-ten` 的 `codex/chapter-ten` 分支实施；基线 `5aa6a36`，第六章备份分支不动。
- 271–300 固定 11 色、每色四层、2 个普通空瓶；普通槽 0–13，广告空瓶专属槽 14。分段门槛不得超过物理上限 44，绝不自动升 12 色。
- 系数锚点为 271=1.44、272=1.52、275=1.55、280=1.57、290=1.60、295–297=1.61、300=1.54，其余分段线性插值、三位小数；评分输入封顶 1.0。
- 代表关 271/272/275/280/290/295/296/297/300 先探测；普通 60 次、峰值累计 150 次，90 秒/关、15 分钟/轮。完整搜索最多 600 次和 5 分钟/关、60 分钟/章，每次求解最多 150,000 状态。预算耗尽就停，不无界重试。
- `--search` 才扫描候选；`--check` 仅重建锁定棋盘、校验报告/全局唯一性且不求解；`--verify-solver` 才重跑 30 关精确求解。
- 新资源仅一张 512×512 RGBA、透明与不透明像素并存、≤307,200 字节的占位图；两份 PNG 字节相同，不运行 `sync-approved-assets`。
- 不修改已真机验收的第七至九章棋盘、微信启动、平台适配、构建链或延期的无尽模式问题。
- 配置版本 `chapters-1-10.2026-09-24.1`，AppID `wx44e5e0b648b140ce`；自动化通过不代表真机通过。

## Review Focus

- 高系数或非法关号不能生成 12 色、45 段门槛或无界搜索；Task 1 的全关契约、越界与预算测试覆盖。
- 失败的代表关不能悄悄进入全章搜索或降低第九章主段/峰值已验证底线；Task 2 的探测计数器、停止条件和规格修订门禁覆盖。
- 270→271 与 300 封顶迁移不能丢掉旧存档的 `bestMoves`，301 的选择/快照/远端输入不能被接受；Task 3、Task 5 各有边界测试。
- 报告专有字段、锁定 attempt、旧关重复棋盘遭篡改时 `--check` 必须失败且不启动求解；Task 1、Task 2 的重建测试与快速检查覆盖。
- PNG 存在但缺少 `@f9941` SpriteFrame 或微信子包遗漏资源时必须失败；Task 4、Task 6 的源资源与构建 config 测试覆盖。

---

## 文件职责图

- `wechat-game/tools/generate-chapter-ten.ts`：独立四模式离线生成、候选预算、checkpoint 与报告锁定。
- `wechat-game/assets/scripts/core/level-data.chapter-10.generated.ts`、`level-generation-report.chapter-10.json`：30 个只读棋盘和可审计生成证据；两个 `.meta` 由 Creator 导入生成。
- `wechat-game/assets/scripts/core/{level-catalog,chapter-catalog,potion-collection-catalog}.ts`：发布目录、主题与图鉴元数据；不改进度/场景算法。
- `cloudbase/src/domain.mjs`：唯一权威关卡上限；`prepare:functions` 生成六份部署副本。
- `prototype/public/assets/game/chibi/collection/sage-potion.png` 与 `wechat-game/assets/resources/game/chibi/collection/sage-potion.png`：同一占位图；后者的 `.meta` 提供 SpriteFrame。

### Task 1: 固定第十章生成器契约与有限预算

**Files:** Create `wechat-game/tools/generate-chapter-ten.ts`、`wechat-game/tests/chapter-ten-generator.test.ts`；modify `wechat-game/package.json`。

**Interfaces:** Consumes `GenerationSpec`、`solveStateCandidate`、`completeStateAnalysis`、`countColorSegments`、`CHAPTER_NINE_LEVEL_DATA` 和第九章生成器控制流。Produces `ChapterTenGenerationSpec`、`chapterTenDifficultyTarget(number): number`、`chapterTenDifficultyProfile(number): 'baseline' | 'deep' | 'deceptive' | 'tangled'`、`chapterTenParentLevel(number): 265 | 266 | 267 | 270 | null`、`chapterTenGenerationSpec(number): ChapterTenGenerationSpec`、`chapterTenGeneratorSeed(number): number`、`chapterTenMode(args): 'probe' | 'search' | 'check' | 'verify-solver'`、`searchChapterTenLevel(number, maxAttempts)`、`reconstructReportLevel(number, entry, seen, verifySolver)`。

- [ ] **Step 1: 写 RED 契约测试。** 在新测试文件以第九章测试导入方式导入上述函数，加入下列实测断言；报告篡改测试在 Task 2 静态报告生成后运行。

```ts
assert.deepEqual(
  [271, 272, 275, 280, 290, 295, 296, 297, 300].map(chapterTenDifficultyTarget),
  [1.44, 1.52, 1.55, 1.57, 1.60, 1.61, 1.61, 1.61, 1.54],
);
assert.throws(() => chapterTenDifficultyTarget(270), RangeError);
assert.throws(() => chapterTenDifficultyTarget(301), RangeError);
for (let n = 271; n <= 300; n += 1) {
  const s = chapterTenGenerationSpec(n);
  assert.equal(s.colorCount, 11);
  assert.equal(s.emptyBottleCount, 2);
  assert.ok(s.minimumSegments <= 44);
  assert.equal(s.minimumOpeningMoves, 22);
  assert.equal(s.maximumOpeningMoves, 22);
  assert.equal(s.maxAttempts, 600);
  assert.equal(s.targetDifficulty, 1);
}
assert.deepEqual(
  [271, 272, 273, 274, 295, 296, 297, 298, 300].map(chapterTenDifficultyProfile),
  ['baseline', 'deep', 'deceptive', 'tangled', 'deep', 'deceptive', 'tangled', 'baseline', 'baseline'],
);
assert.deepEqual(
  [271, 272, 273, 274, 298, 300].map(chapterTenParentLevel),
  [null, 265, 266, 267, 270, 270],
);
assert.deepEqual([295, 296, 297].map(n => chapterTenGenerationSpec(n).minimumExploredStates), [80_000, 80_000, 110_000]);
assert.deepEqual([295, 296, 297].map(n => chapterTenGenerationSpec(n).minimumMisleadingBranchRatio), [1 / 11, 4 / 11, 2 / 11]);
assert.deepEqual(['--probe', '--search', '--check', '--verify-solver'].map(flag => chapterTenMode([flag])), ['probe', 'search', 'check', 'verify-solver']);
assert.throws(() => chapterTenMode([]));
assert.throws(() => chapterTenMode(['--search', '--check']));
assert.equal(searchChapterTenLevel(271, 0).counters.attempts, 0);
assert.throws(() => searchChapterTenLevel(271, 601), RangeError);
test('a late solver result cannot be accepted', (t) => {
  let clockReads = 0;
  t.mock.method(performance, 'now', () => (++clockReads < 3 ? 0 : 300_001));
  assert.throws(() => searchChapterTenLevel(272, 1), /exceeded level budget/);
});
```

从 `node:perf_hooks` 导入 `performance`；最后一段放在独立测试中，不复用前一个测试的 mock 状态。

- [ ] **Step 2: 运行 RED。** 在 `wechat-game` 运行 `node --experimental-strip-types --test tests/chapter-ten-generator.test.ts`；预期因新模块缺失而失败。
- [ ] **Step 3: 复制第九章生成器控制流，最小替换章节、路径、锚点、父级与门槛。** 不抽公共框架。目标函数的起始门槛明确如下，最终仅可依 Task 2 的实测校准：

```ts
const CONFIG_VERSION = 'chapter-10.2026-09-24.1';
const MAX_EXPLORED_STATES = 150_000;
const MAX_LEVEL_MS = 5 * 60_000;
const MAX_CHAPTER_MS = 60 * 60_000;
const MAX_PROBE_LEVEL_MS = 90_000;
const MAX_PROBE_CHAPTER_MS = 15 * 60_000;
const PROBE_ATTEMPTS = 60;
const PEAK_PROBE_ATTEMPTS = 150;
const PROBE_LEVELS = [271, 272, 275, 280, 290, 295, 296, 297, 300] as const;
const DIFFICULTY_ANCHORS = [[271, 1.44], [272, 1.52], [275, 1.55], [280, 1.57], [290, 1.60], [295, 1.61], [297, 1.61], [300, 1.54]] as const;

const p = Math.max(0, Math.min(1, (targetCoefficient - 1.44) / 0.17));
let minimumOptimalMoves = Math.round(38 + 2 * p);
let minimumSegments = difficultyProfile === 'baseline' ? 43 : 44;
let minimumExploredStates = Math.round(55_000 + 15_000 * p);
let minimumMisleadingBranchRatio = difficultyProfile === 'baseline' ? 4 / 11 : 2 / 11;
if (difficultyProfile === 'tangled' && levelNumber < 295) {
  minimumOptimalMoves -= 1;
  minimumExploredStates += 30_000;
}
if (levelNumber === 295) { minimumOptimalMoves = 41; minimumSegments = 44; minimumExploredStates = 80_000; minimumMisleadingBranchRatio = 1 / 11; }
if (levelNumber === 296) { minimumOptimalMoves = 40; minimumSegments = 44; minimumExploredStates = 80_000; minimumMisleadingBranchRatio = 4 / 11; }
if (levelNumber === 297) { minimumOptimalMoves = 40; minimumSegments = 44; minimumExploredStates = 110_000; minimumMisleadingBranchRatio = 2 / 11; }
```

局部变量沿用第九章结构。`maximumOptimalMoves = minimumOptimalMoves + 5`，`reverseMoves = 44`，`targetDifficulty = Math.min(1, targetCoefficient)`，`slotCount = 15`、`rewardSlotIndex = 14`。默认初始种子使用 `(0x270F_0000 + Math.imul(levelNumber, 104_729)) >>> 0`，若探测证明峰值需单关种子，则仅记录有证据的特例。271 用确定性洗牌；272–294 的 deep/deceptive/tangled 分别引用 `CHAPTER_NINE_LEVEL_DATA[265-241]`、`[266-241]`、`[267-241]`，295–297 同 profile，298–300 引用 `[270-241]`。`priorBoardKeys()` 必须包含第九章和此前所有已发布数据。每次求解或分支分析返回后再次检查关卡与章节 deadline。

- [ ] **Step 4: 增加四个 npm 脚本并跑 GREEN。** 对应 `probe/search/check/verify:chapter-ten` 均调用 `node --experimental-strip-types tools/generate-chapter-ten.ts` 加相应 flag；运行 Step 2 命令，预期全部当前契约测试通过。
- [ ] **Step 5: 提交。** `git add wechat-game/tools/generate-chapter-ten.ts wechat-game/tests/chapter-ten-generator.test.ts wechat-game/package.json`，`git commit -m "feat: add bounded chapter ten generator"`。

### Task 2: 探测并锁定 30 个静态棋盘

**Files:** Create `wechat-game/assets/scripts/core/level-data.chapter-10.generated.ts`、其 `.meta`、`level-generation-report.chapter-10.json`、其 `.meta`；search-only `wechat-game/tmp/chapter-ten/chapter-10.checkpoint-*.json` 不提交；modify Task 1 的生成器测试。

**Interfaces:** Consumes Task 1 四模式生成器。Produces `CHAPTER_TEN_LEVEL_DATA: readonly LevelConfig[]` 与 `schemaVersion: 1`、`chapterId: 10` 的 30 条锁定报告；每条保留 `initialSeed`、`generatorSeed`、`attempt`、`boardKey`、`metrics`、`scoreComponents`。

- [ ] **Step 1: RED 锁定报告测试。** 增加对报告缺失、篡改专有字段、越界 attempt 的测试；在产物不存在时先运行并确认失败。采用第九章 `reconstructReportLevel` 的相同接口，关键断言为：

```ts
const report = JSON.parse(readFileSync(new URL('../assets/scripts/core/level-generation-report.chapter-10.json', import.meta.url), 'utf8'));
assert.equal(report.chapterId, 10);
assert.equal(report.levels.length, 30);
const entry = report.levels[0];
assert.doesNotThrow(() => reconstructReportLevel(271, entry, new Set(), false));
assert.throws(() => reconstructReportLevel(271, entry, new Set([entry.boardKey]), false));
for (const change of [
  { source: 'tampered' },
  { compatibilityExemption: 'tampered' },
  { reverseMoves: 999 },
  { attempt: 601 },
  { scoreComponents: { ...entry.scoreComponents, color: -1 } },
]) assert.throws(() => reconstructReportLevel(271, { ...entry, ...change }, new Set(), false));
```

- [ ] **Step 2: 先运行代表关探测。** 在 `wechat-game` 执行 `npm run probe:chapter-ten`；记录每关 attempts/uniqueShapes/segmentPasses/openingPasses/solved/baseGatePasses/branchGatePasses/elapsedMs。任一无命中立即停止，不能自动运行完整搜索。只根据零通过率调整单项门槛或父级，同步修订已确认规格及 Task 1 测试并请用户审阅实测取舍；主段/峰值若需低于第九章已验证对应门槛，必须先获用户许可。
- [ ] **Step 3: 探测全部命中后运行有界搜索。** `npm run search:chapter-ten`；每关锁定一个候选并写 checkpoint，600 次/5 分钟/关或 60 分钟/章耗尽应非零退出，不提升预算。若部分锁定，可按第九章 checkpoint 恢复逻辑继续，但累计尝试不得重置。
- [ ] **Step 4: 快速 GREEN 与完整性检查。** 运行 `npm run check:chapter-ten` 与 `node --experimental-strip-types --test tests/chapter-ten-generator.test.ts`，预期 30 关及报告一致。检查报告中 271–300 连续、每关 11 色、2 空瓶、44 段上限、22 开局、最优步数/状态数/误导比达到对应门槛，所有 300 个发布棋盘 boardKey 唯一；检查 `reconstructReportLevel(..., false)` 的代码路径只重建和比较锁定报告，精确求解调用仅位于 `verifySolver === true` 分支。
- [ ] **Step 5: 用 Cocos Creator 3.8.8 导入新 TS/JSON 后保留其自动生成的两个 `.meta`。** 不手写 UUID；按四个精确路径提交，`tmp/chapter-ten` 不入库：`git commit -m "feat: lock chapter ten level data"`。

### Task 3: 发布目录、进度与图鉴边界

**Files:** Modify `wechat-game/assets/scripts/core/level-catalog.ts`、`chapter-catalog.ts`、`potion-collection-catalog.ts`；tests `chapter-catalog.test.ts`、`level-catalog.test.ts`、`level-progress.test.ts`、`local-progress-store.test.ts`、`progress-sync.test.ts`、`scene-flow.test.ts`、`collection-progress.test.ts`、`potion-collection-catalog.test.ts`、`chapters-seven-eight-integration.test.ts`。除测试证明现有算法缺陷外，不改 `level-progress.ts`、`collection-progress.ts`、`scene-flow.ts`。

**Interfaces:** Consumes `CHAPTER_TEN_LEVEL_DATA`。Produces `CHAPTER_TEN_LEVELS`、300 项 `PUBLISHED_LEVELS`、`chapters-1-10.2026-09-24.1`、`sage-potion` 图鉴配置。

- [ ] **Step 1: 先更新 RED 测试。** 将旧“270 封顶/271 无效”断言移到 300/301，同时保留 270→271；测试旧配置存档解码后 `completedThrough=270`、合法 `bestMoves['level-270']` 不变，完成 300 后 `currentLevel='level-300'` 且 301 的选择、快照解码、同步输入不被接受。代表性断言：

```ts
assert.equal(PUBLISHED_LEVELS.length, 300);
assert.equal(new Set(PUBLISHED_LEVELS.map(x => JSON.stringify(x.initialState.bottles))).size, 300);
assert.equal(nextLevelConfig('level-270')?.id, 'level-271');
assert.equal(nextLevelConfig('level-300'), null);
assert.equal(getLevelConfig('level-301'), null);
assert.equal(getChapter(10)?.releaseState, 'available');
assert.equal(getChapter(10)?.themeTitle, '终极炼金');
assert.equal(getChapter(10)?.stageTitle, '传奇炼金师');
assert.equal(getPotionCollection(10)?.collectionId, 'sage-potion');
assert.equal(getPotionCollection(10)?.artworkKey, 'sage-potion');
assert.equal(getPotionCollection(10)?.silhouetteIndex, 8);
for (const [level, piece] of [[275,1],[280,2],[285,3],[290,4],[295,5],[300,6]] as const) {
  assert.equal(deriveCollectionProgress(progressWithCompleted(level), 10).revealedPieces, piece);
  assert.equal(deriveCompletionReward(progressWithCompleted(level - 1), progressWithCompleted(level), levelId(level)).puzzlePiece, piece);
}
assert.equal(deriveHighestTitle(progressWithCompleted(300)).title, '传奇炼金师');
const upgraded = decodePlayerProgress(JSON.stringify({
  schemaVersion: 3, revision: 270, currentLevel: 'level-270', completedThrough: 270,
  bestMoves: { 'level-270': 44 }, configVersion: 'chapters-1-9.2026-09-23.1',
}));
assert.equal(upgraded?.completedThrough, 270);
assert.equal(upgraded?.bestMoves['level-270'], 44);
assert.equal(upgraded?.configVersion, 'chapters-1-10.2026-09-24.1');
assert.equal(upgraded && isLevelUnlocked(upgraded, 'level-271'), true);
```

- [ ] **Step 2: 运行 RED 聚焦测试。** 在 `wechat-game` 执行 `node --experimental-strip-types --test tests/chapter-catalog.test.ts tests/level-catalog.test.ts tests/level-progress.test.ts tests/local-progress-store.test.ts tests/progress-sync.test.ts tests/scene-flow.test.ts tests/collection-progress.test.ts tests/potion-collection-catalog.test.ts tests/chapters-seven-eight-integration.test.ts`；预期旧目录的 270/271 边界导致失败。
- [ ] **Step 3: 最小 GREEN 接入。** `level-catalog.ts` 导入 `CHAPTER_TEN_LEVEL_DATA`，用现有 `freezeLevel` 得到 `CHAPTER_TEN_LEVELS` 并追加到 `PUBLISHED_LEVELS`、`levelsForChapter(10)`；版本改为 `chapters-1-10.2026-09-24.1`。`chapter-catalog.ts` 只将 index 9 的 theme 改“终极炼金”、collection ID 改 `sage-potion`、`releaseState` 条件改为 `index <= 9`；`TITLES[9]` 原本已经是“传奇炼金师”，不改。`potion-collection-catalog.ts` 只补 index 9 的 name“贤者药水”、description“凝聚终极炼金智慧与赤金贤者之光的稀有药水”、artworkKey `sage-potion`；既有 `silhouetteIndex: index - 1` 自动得到 8。
- [ ] **Step 4: 重跑 Step 2 命令至全绿。** 额外断言回玩 275/300 不重复给拼图、300 称号仍为“传奇炼金师”、客户端无 `level-301`；只在测试揭示真实缺陷时触碰算法。
- [ ] **Step 5: 提交本任务精确目录和测试文件。** `git commit -m "feat: publish chapter ten progression"`。

### Task 4: 精准接入一张贤者药水占位图

**Files:** Create `prototype/public/assets/game/chibi/collection/sage-potion.png`、`wechat-game/assets/resources/game/chibi/collection/sage-potion.png`、后者 `.meta`；modify `wechat-game/tools/verify-collection-assets.py`、`wechat-game/tests/production-contracts.test.ts`、`wechat-game/tests/wechat-build-preparation.test.mjs`。

**Interfaces:** Consumes Task 3 的 `artworkKey='sage-potion'`。Produces `game/chibi/collection/sage-potion/spriteFrame`。

- [ ] **Step 1: 写 RED 资源测试。** 仿照第九章的 moon-goddess 测试，检查两个路径 PNG 的宽高 512、color type 6、≤307,200 字节、哈希/字节相同，以及 production `.meta` 的 `userData.type === 'sprite-frame'`、`subMetas.f9941.importer === 'sprite-frame'`；在微信包测试中断言 `resources/config.json` 包含上述 spriteFrame 路径。`verify-collection-assets.py` 的 `EXPECTED` 和大小列表各加一项 `collection/sage-potion.png`。
- [ ] **Step 2: 跑 RED。** `node --experimental-strip-types --test tests/production-contracts.test.ts`；预期因新图缺失失败。
- [ ] **Step 3: 仅制作一张简单占位图。** 实施时按适用的 `imagegen` 技能完成单次生成，规范为 512×512 RGBA、透明和不透明像素并存、主体避开 2×3 拼图接缝、≤307,200 字节；精准放到两个目标路径，不生成变体、不运行全量 `sync:assets`。
- [ ] **Step 4: Creator 3.8.8 导入 PNG 后，仅运行 `node tools/configure-sprite-frames.mjs collection/sage-potion.png`。** 必须看到 `configured 1`，只提交新资源 `.meta`，不得手写 UUID。
- [ ] **Step 5: GREEN 与真实透明检查。** 重跑 Step 2；用 PowerShell `System.Drawing.Bitmap.GetPixel` 扫描 alpha 最小值 0、最大值 255，并用 `Get-FileHash -Algorithm SHA256` 对比两图；若本机 Python/Pillow 可用，再运行 `python tools/verify-collection-assets.py`。提交精确六个文件，`git commit -m "feat: add sage potion placeholder"`。

### Task 5: CloudBase 300/301 权威边界

**Files:** Modify `cloudbase/src/domain.mjs`、`cloudbase/tests/domain.test.mjs`、`cloudbase/tests/chapters-seven-eight-boundary.test.mjs`；regenerate `cloudbase/functions/_shared/runtime.js` 和 `bootstrap`、`claimRewardedBottle`、`getGameConfig`、`submitLevelResult`、`syncProgress` 五个函数各自的 `_shared/runtime.js`。

**Interfaces:** Consumes发布上限 300、版本 `chapters-1-10.2026-09-24.1`。Produces云端进度、奖励、遥测接受 300，拒绝 301；OPENID 仍由可信上下文派生。

- [ ] **Step 1: RED 边界测试。** 保留旧 270 合法断言，增加：

```js
const p = { schemaVersion: 3, revision: 0, currentLevel: 'level-300', completedThrough: 300, bestMoves: { 'level-270': 44 }, configVersion: 'chapters-1-10.2026-09-24.1' };
assert.equal(mergeProgress(null, p).completedThrough, 300);
assert.equal(mergeProgress(null, p).bestMoves['level-270'], 44);
assert.throws(() => mergeProgress(null, { ...p, completedThrough: 301 }));
assert.throws(() => mergeProgress(null, { ...p, currentLevel: 'level-301' }));
assert.equal(validateRewardRequest({ levelId: 'level-300', claimId: 'claim_12345678' }).levelId, 'level-300');
assert.throws(() => validateRewardRequest({ levelId: 'level-301', claimId: 'claim_12345678' }));
assert.equal(normalizeLevelResult({ levelId: 'level-300', moves: 42, durationMs: 1000, undoCount: 0 }).levelId, 'level-300');
assert.throws(() => normalizeLevelResult({ levelId: 'level-301', moves: 42, durationMs: 1000, undoCount: 0 }));
```

- [ ] **Step 2: 在 `cloudbase` 运行 `npm test`，确认 300 被旧上限拒绝。**
- [ ] **Step 3: 仅把 `cloudbase/src/domain.mjs` 的 `LAST_LEVEL` 从 270 改为 300，运行 `npm run prepare:functions`。** 不直接编辑六份副本。
- [ ] **Step 4: GREEN、哈希一致与幂等检查。** `npm test`；对源和六份副本逐一 `Get-FileHash -Algorithm SHA256`，要求相同；再次运行 `npm run prepare:functions` 后要求 `git diff` 无新变化。提交源、测试与六份副本，`git commit -m "feat: extend cloud boundary to level 300"`。

### Task 6: 文档、构建与交付验证

**Files:** Modify `wechat-game/AGENTS.md`、`prototype/AGENTS.md`；verify only `wechat-game/build/wechatgame/**`；不提交 `build/`、`tmp/`、Cocos 日志、`engine.json` 换行差异或根 `project.config.json`。

**Interfaces:** Consumes Tasks 1–5 的分支。Produces第十章发布约束文档、Cocos 3.8.8 构建证据、生产 AppID 微信包及真机验收入口。

- [ ] **Step 1: 更新两份 AGENTS.md 的耐久事实。** 1–300、十章发布、300 封顶/301 未发布、系数及硬门槛/预算、贤者药水六块拼图、最高称号保持；保留第七至九章、无尽模式延期事项及全部启动/平台/构建约束。
- [ ] **Step 2: 运行静态与聚焦回归。** 在 `wechat-game` 运行 `npm run check:chapter-nine`、`npm run check:chapter-ten`、`npm run test:core`、`node --experimental-strip-types --test tests/chapter-ten-generator.test.ts tests/chapters-seven-eight-integration.test.ts`；在 `cloudbase` 运行 `npm test`。预期 0 失败、旧章节锁定数据无漂移。
- [ ] **Step 3: 最终精确求解取证。** 在 `wechat-game` 运行 `npm run verify:chapter-ten`，预期 30/30 锁定棋盘满足最优步数、状态和误导分支门槛，任何 150,000 状态上限失败不得放宽。
- [ ] **Step 4: Cocos Creator 3.8.8 构建微信 release。** 在 `wechat-game` 执行：

```powershell
$creator = 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe'
& $creator --project (Resolve-Path '.').Path --build 'platform=wechatgame;debug=false'
```

要求日志有 `build Task (wechatgame) Finished`、`build/wechatgame/assets/main/index.js` 和 `build/wechatgame/subpackages/resources/config.json` 非空；不能只凭 Creator 退出码宣称成功。
- [ ] **Step 5: 准备生产 AppID 微信包并验证资源。**

```powershell
$env:WECHAT_APPID = 'wx44e5e0b648b140ce'
npm run prepare:wechat-build
npm run test:wechat-build
$config = Get-Content -Raw build/wechatgame/project.config.json | ConvertFrom-Json
if ($config.appid -ne 'wx44e5e0b648b140ce') { throw 'wrong AppID' }
$resources = Get-Content -Raw build/wechatgame/subpackages/resources/config.json
if (-not $resources.Contains('game/chibi/collection/sage-potion/spriteFrame')) { throw 'missing sage SpriteFrame' }
```

要求主包 <4 MiB、总包 <30 MiB、resources 子包完整；用全新微信开发者工具进程和官方 CLI 制作新预览二维码，不复用旧码。
- [ ] **Step 6: 最终差异自检。** `git diff --check`、`git status --short`、`git diff --name-only 5aa6a36...HEAD`；确认没有混入整合工作树的 `engine.json`、Cocos 日志、`project.config.json` 或无尽模式修复。提交两份 AGENTS.md：`git commit -m "docs: record chapter ten production contract"`。
- [ ] **Step 7: 向用户交付新二维码和验证证据，明确等待真机验收。** 未收到用户真机确认前不写“真机通过”，也不合并到整合分支。
