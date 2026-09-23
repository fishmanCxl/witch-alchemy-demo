# 《魔女炼金屋》第九章实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已真机验证的 `68630b7` 基线上发布 241–270 关“月神秘术”，接入“月神药水”、第九章进度/CloudBase 边界和可供真机验收的微信包。

**Architecture:** 延续第八章的独立离线生成器和锁定静态产物模式；客户端运行时只消费 270 关目录，CloudBase 以独立常量验证同一上限。图鉴继续从 `completedThrough` 派生，仅新增一个精确接入的占位 SpriteFrame，不改变展示架构或资源同步链。

**Tech Stack:** TypeScript、Node.js `--experimental-strip-types`、`node:test`、Cocos Creator 3.8.8、微信小游戏、CloudBase、PNG SpriteFrame。

**Spec:** `docs/superpowers/specs/2026-09-23-chapter-nine-design.md`

## Global Constraints

- 工作只在 `D:\codex_pro\my_game_water\.worktrees\chapter-nine` 的 `codex/chapter-nine` 分支进行，基线必须是 `68630b7`。
- 第六章备份 `codex/chapter-six-device-verified-backup`/`ac46193` 不得改动。
- 第九章固定 11 色、2 个初始空瓶、普通索引 0–13、广告空瓶索引 14；禁止按系数增加到 12 色。
- 11 色最多 44 个颜色分段；任何门槛不得为 45 或更高。
- 运行时不生成、不求解；`--check` 不调用精确求解器。
- 搜索封顶 600 次/关、5 分钟/关、60 分钟/章；探测封顶常规 60 次、峰值 150 次、90 秒/关、15 分钟/轮。
- 仅新增一张 512×512 RGBA、真实透明、≤300 KiB 的月神药水占位图；禁止运行 `sync-approved-assets`。
- 不修改微信启动、平台适配、构建链或无尽模式。
- 微信 AppID 固定为 `wx44e5e0b648b140ce`；自动化通过不等于真机通过。

## Review Focus

- 高系数输入仍必须输出 11 色、2 空瓶且分段门槛不超过 44；Task 1 的生成器契约测试固定这一点。
- 旧 240 封顶必须完整移动为 240→241、270 封顶、271 拒绝；Task 3 同时覆盖目录、进度、场景、QA 存档和云同步输入。
- 锁定报告被改动、attempt 越界或棋盘重复时，快速 `--check` 必须失败且不启动求解；Task 2 通过生成器测试和命令级检查覆盖。
- 月神药水 PNG 存在但没有 `@f9941` SpriteFrame 时必须在测试或微信包检查失败；Task 4 覆盖源资源、`.meta` 和构建 config。
- CloudBase 源文件更新但任一函数副本仍停在 240 时必须失败；Task 5 运行副本生成与哈希测试，并显式验证 270/271。

---

## 基线证据

计划编写前已在新工作树执行：

- `npm run check:chapter-eight`：通过，30 关锁定产物一致。
- `npm run test:core`：291/291 通过。
- `npm test`（`cloudbase`）：7/7 通过。
- `verify-collection-assets.py`：当前机器只有 Microsoft Store 的 Python 占位入口，无法执行；最终资源契约同时使用 Node 测试和 PowerShell `System.Drawing` 验证，不把该环境缺失误报为产品失败。

### Task 1: 先固定第九章生成器契约

**Files:**

- Create: `wechat-game/tests/chapter-nine-generator.test.ts`
- Create: `wechat-game/tools/generate-chapter-nine.ts`
- Modify: `wechat-game/package.json`

**Interfaces:**

- Consumes: `countColorSegments`、`validateLevelConfig`、`solveStateCandidate`、`completeStateAnalysis` 和第八章 235/236/237/240 的静态状态。
- Produces: `chapterNineDifficultyTarget(number)`、`chapterNineDifficultyProfile(number)`、`chapterNineGenerationSpec(number)`、`chapterNineGeneratorSeed(number)`、`chapterNineParentLevel(number)`、`chapterNineMode(args)`、`searchChapterNineLevel(number, maxAttempts)`。

- [ ] **Step 1: 写生成器契约失败测试**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chapterNineDifficultyProfile,
  chapterNineDifficultyTarget,
  chapterNineGenerationSpec,
  chapterNineGeneratorSeed,
  chapterNineMode,
  chapterNineParentLevel,
  searchChapterNineLevel,
} from '../tools/generate-chapter-nine.ts';

test('chapter nine uses approved anchors and piecewise interpolation', () => {
  assert.deepEqual(
    [241, 242, 245, 250, 260, 265, 266, 267, 270].map(chapterNineDifficultyTarget),
    [1.37, 1.45, 1.48, 1.50, 1.53, 1.54, 1.54, 1.54, 1.47],
  );
  assert.equal(chapterNineDifficultyTarget(243), 1.46);
  assert.equal(chapterNineDifficultyTarget(268), 1.517);
  assert.equal(chapterNineDifficultyTarget(269), 1.493);
  assert.throws(() => chapterNineDifficultyTarget(240), RangeError);
  assert.throws(() => chapterNineDifficultyTarget(271), RangeError);
});

test('chapter nine hard gates never substitute colors or impossible segments', () => {
  for (let number = 241; number <= 270; number += 1) {
    const spec = chapterNineGenerationSpec(number);
    assert.equal(spec.colorCount, 11, String(number));
    assert.equal(spec.emptyBottleCount, 2, String(number));
    assert.ok(spec.minimumSegments <= 44, String(number));
    assert.equal(spec.minimumOpeningMoves, 22, String(number));
    assert.equal(spec.maximumOpeningMoves, 22, String(number));
    assert.equal(spec.maxAttempts, 600, String(number));
  }
  assert.deepEqual(
    [241, 242, 243, 244, 265, 266, 267, 268, 269, 270].map(chapterNineDifficultyProfile),
    ['baseline', 'deep', 'deceptive', 'tangled', 'deep', 'deceptive', 'tangled', 'baseline', 'baseline', 'baseline'],
  );
  assert.deepEqual(
    [241, 242, 243, 244, 268, 269, 270].map(chapterNineParentLevel),
    [null, 235, 236, 237, 240, 240, 240],
  );
  assert.equal(chapterNineGenerationSpec(255).minimumMisleadingBranchRatio, 2 / 11);
  assert.equal(chapterNineGenerationSpec(264).minimumMisleadingBranchRatio, 2 / 11);
  assert.equal(chapterNineGenerationSpec(257).minimumOptimalMoves, 39);
  assert.equal(chapterNineGenerationSpec(265).minimumOptimalMoves, 40);
  assert.equal(chapterNineGenerationSpec(266).minimumMisleadingBranchRatio, 4 / 11);
  assert.equal(chapterNineGeneratorSeed(266), 4_151_867_415);
  assert.equal(chapterNineGenerationSpec(267).minimumExploredStates, 100_000);
  assert.equal(chapterNineGenerationSpec(267).minimumMisleadingBranchRatio, 2 / 11);
  assert.equal(chapterNineGeneratorSeed(267), 96_355_240);
  assert.equal(chapterNineGenerationSpec(268).minimumOptimalMoves, 38);
});

test('chapter nine modes are explicit and bounded search validates attempt limits', () => {
  assert.equal(chapterNineMode(['--probe']), 'probe');
  assert.equal(chapterNineMode(['--search']), 'search');
  assert.equal(chapterNineMode(['--check']), 'check');
  assert.equal(chapterNineMode(['--verify-solver']), 'verify-solver');
  assert.throws(() => chapterNineMode([]));
  assert.throws(() => chapterNineMode(['--search', '--check']));
  assert.deepEqual(searchChapterNineLevel(241, 0).counters.attempts, 0);
  assert.throws(() => searchChapterNineLevel(241, 601), RangeError);
});
```

- [ ] **Step 2: 运行测试并确认缺少生成器**

Run:

```powershell
cd wechat-game
node --experimental-strip-types --test tests/chapter-nine-generator.test.ts
```

Expected: FAIL，错误指出 `tools/generate-chapter-nine.ts` 不存在。

- [ ] **Step 3: 以第八章文件为机械模板建立独立生成器**

复制 `generate-chapter-eight.ts` 的控制流，不抽公共层；做以下完整替换：

```ts
export type ChapterNineDifficultyProfile = 'baseline' | 'deep' | 'deceptive' | 'tangled';
export type ChapterNineMode = 'probe' | 'search' | 'check' | 'verify-solver';

const CONFIG_VERSION = 'chapter-9.2026-09-23.1';
const MAX_EXPLORED_STATES = 150_000;
const MAX_LEVEL_MS = 5 * 60 * 1_000;
const MAX_CHAPTER_MS = 60 * 60 * 1_000;
const MAX_PROBE_LEVEL_MS = 90 * 1_000;
const MAX_PROBE_CHAPTER_MS = 15 * 60 * 1_000;
const PROBE_ATTEMPTS = 60;
const PEAK_PROBE_ATTEMPTS = 150;
const PROBE_LEVELS = [241, 242, 245, 250, 260, 265, 266, 267, 270] as const;

const COLORS: readonly PotionColor[] = [
  'rose', 'violet', 'amber', 'cyan', 'mint', 'blue',
  'gold', 'lilac', 'scarlet', 'chartreuse', 'indigo', 'pearl',
];

const DIFFICULTY_ANCHORS = [
  [241, 1.37], [242, 1.45], [245, 1.48], [250, 1.50],
  [260, 1.53], [265, 1.54], [267, 1.54], [270, 1.47],
] as const;
```

`chapterNineGenerationSpec` 必须按规格计算并应用峰值覆盖：

```ts
const progress = Math.max(0, Math.min(1, (targetCoefficient - 1.37) / 0.17));
let minimumOptimalMoves = Math.round(37 + 2 * progress);
let minimumSegments = 43;
let minimumExploredStates = Math.round(45_000 + 20_000 * progress);
let minimumMisleadingBranchRatio = 4 / 11;

if (difficultyProfile === 'deep') {
  minimumSegments = 44;
  minimumMisleadingBranchRatio = 2 / 11;
}
if (difficultyProfile === 'deceptive') {
  minimumSegments = 44;
  minimumMisleadingBranchRatio = 2 / 11;
}
if (difficultyProfile === 'tangled') {
  minimumSegments = 44;
  minimumOptimalMoves -= 1;
  minimumExploredStates += 30_000;
}
if (levelNumber === 268) {
  minimumOptimalMoves = 38;
}
if (levelNumber === 265) {
  minimumOptimalMoves = 40;
  minimumSegments = 44;
  minimumExploredStates = 70_000;
  minimumMisleadingBranchRatio = 1 / 11;
}
if (levelNumber === 266) {
  minimumOptimalMoves = 39;
  minimumSegments = 44;
  minimumExploredStates = 70_000;
  minimumMisleadingBranchRatio = 4 / 11;
}
if (levelNumber === 267) {
  minimumOptimalMoves = 39;
  minimumSegments = 44;
  minimumExploredStates = 100_000;
  minimumMisleadingBranchRatio = 2 / 11;
}
```

候选父级映射必须是：

```ts
const sourceLevel = chapterNineParentLevel(spec.number);
if (sourceLevel === null) return randomState(seed);
const source = CHAPTER_EIGHT_LEVEL_DATA[sourceLevel - 211].initialState;
```

保持 cheap filters → solver → branch analysis 顺序；范围改为 241–270，chapter/report/checkpoint ID 改为 9，输出文件改为 chapter-09。`runProbe` 同时检查 90 秒单关和 15 分钟整轮 deadline，探测无命中只打印计数并以失败退出。

- [ ] **Step 4: 加入四个 npm 命令**

```json
"probe:chapter-nine": "node --experimental-strip-types tools/generate-chapter-nine.ts --probe",
"search:chapter-nine": "node --experimental-strip-types tools/generate-chapter-nine.ts --search",
"check:chapter-nine": "node --experimental-strip-types tools/generate-chapter-nine.ts --check",
"verify:chapter-nine": "node --experimental-strip-types tools/generate-chapter-nine.ts --verify-solver"
```

- [ ] **Step 5: 运行契约测试**

Run:

```powershell
node --experimental-strip-types --test tests/chapter-nine-generator.test.ts
```

Expected: PASS；测试本身不做昂贵搜索。

- [ ] **Step 6: 提交生成器骨架**

```powershell
git add wechat-game/tools/generate-chapter-nine.ts wechat-game/tests/chapter-nine-generator.test.ts wechat-game/package.json
git commit -m "feat: add bounded chapter nine generator"
```

### Task 2: 探测、锁定并校验 30 关静态数据

**Files:**

- Create: `wechat-game/assets/scripts/core/level-data.chapter-09.generated.ts`
- Create: `wechat-game/assets/scripts/core/level-data.chapter-09.generated.ts.meta`
- Create: `wechat-game/assets/scripts/core/level-generation-report.chapter-09.json`
- Create: `wechat-game/assets/scripts/core/level-generation-report.chapter-09.json.meta`
- Create during search only: `wechat-game/tmp/chapter-nine/chapter-09.checkpoint-*.json`（不得提交）

**Interfaces:**

- Consumes: Task 1 的生成器和第八章 235/236/237/240 静态棋盘。
- Produces: `CHAPTER_NINE_LEVEL_DATA: readonly LevelConfig[]` 与 schemaVersion 1 的 30 关锁定报告。

- [ ] **Step 1: 运行小样本探测，不得直接开始完整搜索**

```powershell
cd wechat-game
npm run probe:chapter-nine
```

Expected: 9 个代表关各输出 attempts/uniqueShapes/segmentPasses/openingPasses/solved/baseGatePasses/branchGatePasses/elapsedMs；全部在预算内命中。任一无命中则停止，根据零通过计数只调整父级或单项门槛，先同步修改规格和 Task 1 测试，再重复 Task 1 测试和本步骤；不得提高预算。

- [ ] **Step 2: 执行有界完整搜索**

```powershell
npm run search:chapter-nine
```

Expected: 241–270 各锁定一个 attempt，生成 TS/JSON；任何关超过 600 次、5 分钟或全章 60 分钟都非零退出。

- [ ] **Step 3: 立即运行快速锁定检查**

```powershell
npm run check:chapter-nine
```

Expected: `30 chapter 9 levels match locked generated output`，耗时明显短于精确 solver 验证。

- [ ] **Step 4: 用脚本断言报告完整性和硬门槛**

```powershell
node --experimental-strip-types --input-type=module -e "import {CHAPTER_NINE_LEVEL_DATA as xs} from './assets/scripts/core/level-data.chapter-09.generated.ts'; if(xs.length!==30) throw Error('count'); if(xs.some(x=>x.metrics.colorCount!==11||x.metrics.segmentCount>44||x.metrics.openingMoves!==22)) throw Error('gate'); if(new Set(xs.map(x=>JSON.stringify(x.initialState.bottles))).size!==30) throw Error('duplicate'); console.log('chapter nine static gates ok')"
```

Expected: `chapter nine static gates ok`。

- [ ] **Step 5: 用 Cocos Creator 3.8.8 导入新增 TS/JSON 并保留自动生成的 meta**

打开工程或执行 Task 6 的构建，使 Creator 生成两个 `.meta`。不得手写 UUID。确认两个 meta 都存在后再提交。

- [ ] **Step 6: 提交锁定静态产物**

```powershell
git add wechat-game/assets/scripts/core/level-data.chapter-09.generated.ts wechat-game/assets/scripts/core/level-data.chapter-09.generated.ts.meta wechat-game/assets/scripts/core/level-generation-report.chapter-09.json wechat-game/assets/scripts/core/level-generation-report.chapter-09.json.meta
git commit -m "feat: lock chapter nine level data"
```

### Task 3: 发布目录、进度、场景与图鉴边界

**Files:**

- Modify: `wechat-game/assets/scripts/core/chapter-catalog.ts`
- Modify: `wechat-game/assets/scripts/core/level-catalog.ts`
- Modify: `wechat-game/assets/scripts/core/potion-collection-catalog.ts`
- Modify: `wechat-game/tests/chapter-catalog.test.ts`
- Modify: `wechat-game/tests/level-catalog.test.ts`
- Modify: `wechat-game/tests/level-progress.test.ts`
- Modify: `wechat-game/tests/local-progress-store.test.ts`
- Modify: `wechat-game/tests/progress-sync.test.ts`
- Modify: `wechat-game/tests/scene-flow.test.ts`
- Modify: `wechat-game/tests/collection-progress.test.ts`
- Modify: `wechat-game/tests/potion-collection-catalog.test.ts`
- Modify: `wechat-game/tests/chapters-seven-eight-integration.test.ts`

**Interfaces:**

- Consumes: Task 2 的 `CHAPTER_NINE_LEVEL_DATA`。
- Produces: 1–270 发布目录、`chapters-1-9.2026-09-23.1`、第九章图鉴/称号派生和 271 客户端拒绝边界。

- [ ] **Step 1: 先把测试期望移动到 270/271**

关键断言必须包括：

```ts
assert.deepEqual(publishedChapters().map((chapter) => chapter.id), [1,2,3,4,5,6,7,8,9]);
assert.deepEqual(getChapter(9), {
  id: 9,
  stageTitle: '月之魔女',
  themeTitle: '月神秘术',
  firstLevel: 241,
  levelCount: 30,
  collectionId: 'moon-goddess-potion',
  releaseState: 'available',
});
assert.equal(getChapter(10)?.releaseState, 'coming-soon');
assert.equal(PUBLISHED_LEVELS.length, 270);
assert.equal(nextLevelConfig('level-240')?.id, 'level-241');
assert.equal(nextLevelConfig('level-270'), null);
assert.equal(getLevelConfig('level-271'), null);
```

进度/场景测试必须固定：240 完成后 241 解锁；270 完成后 `currentLevel === 'level-270'`、`completedThrough === 270`；271 的存档、选择和进入均失败。`local-progress-store.test.ts` 的 QA 全关卡 current level 改为 270，`progress-sync.test.ts` 的 malformed remote boundary 改为 271。

图鉴测试必须逐个检查：

```ts
for (const [level, piece] of [[245,1],[250,2],[255,3],[260,4],[265,5],[270,6]] as const) {
  const before = progressWithCompleted(level - 1);
  const after = progressWithCompleted(level);
  assert.equal(deriveCollectionProgress(after, 9).revealedPieces, piece);
  assert.equal(deriveCompletionReward(before, after, levelId(level)).puzzlePiece, piece);
}
assert.equal(deriveHighestTitle(progressWithCompleted(270)).title, '传奇炼金师');
```

- [ ] **Step 2: 运行聚焦测试并确认旧目录失败**

```powershell
node --experimental-strip-types --test tests/chapter-catalog.test.ts tests/level-catalog.test.ts tests/level-progress.test.ts tests/local-progress-store.test.ts tests/progress-sync.test.ts tests/scene-flow.test.ts tests/collection-progress.test.ts tests/potion-collection-catalog.test.ts tests/chapters-seven-eight-integration.test.ts
```

Expected: FAIL，原因是第九章仍 coming-soon、发布上限仍 240、月神药水尚无公开配置。

- [ ] **Step 3: 最小接入目录**

`level-catalog.ts` 新增：

```ts
import { CHAPTER_NINE_LEVEL_DATA } from './level-data.chapter-09.generated.ts';
export const GAME_CONFIG_VERSION = 'chapters-1-9.2026-09-23.1' as const;
export const CHAPTER_NINE_LEVELS = Object.freeze(CHAPTER_NINE_LEVEL_DATA.map(freezeLevel));
// append CHAPTER_NINE_LEVELS to PUBLISHED_LEVELS
// return CHAPTER_NINE_LEVELS when chapterId === 9
```

`chapter-catalog.ts` 只扩展现有条件映射：index 8 的 theme 为“月神秘术”、collection ID 为 `moon-goddess-potion`，`releaseState` 改为 `index <= 8`。

`potion-collection-catalog.ts` 只扩展 index 8：

```ts
name: '月神药水'
description: '凝聚月神秘术与银紫月华的稀有药水'
artworkKey: 'moon-goddess-potion'
silhouetteIndex: 7
```

不要修改 `level-progress.ts`、`collection-progress.ts` 或 `scene-flow.ts` 算法；它们应从目录自动得到新行为。

- [ ] **Step 4: 重新运行聚焦测试**

Run: Step 2 的同一命令。

Expected: 全部 PASS。

- [ ] **Step 5: 提交客户端发布边界**

```powershell
git add wechat-game/assets/scripts/core/chapter-catalog.ts wechat-game/assets/scripts/core/level-catalog.ts wechat-game/assets/scripts/core/potion-collection-catalog.ts wechat-game/tests/chapter-catalog.test.ts wechat-game/tests/level-catalog.test.ts wechat-game/tests/level-progress.test.ts wechat-game/tests/local-progress-store.test.ts wechat-game/tests/progress-sync.test.ts wechat-game/tests/scene-flow.test.ts wechat-game/tests/collection-progress.test.ts wechat-game/tests/potion-collection-catalog.test.ts wechat-game/tests/chapters-seven-eight-integration.test.ts
git commit -m "feat: publish chapter nine progression"
```

### Task 4: 精准接入唯一一张月神药水占位图

**Files:**

- Create: `prototype/public/assets/game/chibi/collection/moon-goddess-potion.png`
- Create: `wechat-game/assets/resources/game/chibi/collection/moon-goddess-potion.png`
- Create: `wechat-game/assets/resources/game/chibi/collection/moon-goddess-potion.png.meta`
- Modify: `wechat-game/tools/verify-collection-assets.py`
- Modify: `wechat-game/tests/production-contracts.test.ts`
- Modify: `wechat-game/tests/wechat-build-preparation.test.mjs`

**Interfaces:**

- Consumes: Task 3 的 `artworkKey = 'moon-goddess-potion'` 和现有 `ProductionBootstrap` 动态路径。
- Produces: `game/chibi/collection/moon-goddess-potion/spriteFrame`。

- [ ] **Step 1: 先写失败的资源契约**

在 `production-contracts.test.ts` 增加一条专门测试，同时检查 prototype、production 和 meta：

```ts
test('moon goddess placeholder is one 512px transparent SpriteFrame under 300 KiB', () => {
  const relative = 'collection/moon-goddess-potion.png';
  const prototypePath = new URL(`../../prototype/public/assets/game/chibi/${relative}`, import.meta.url);
  const productionPath = new URL(`../assets/resources/game/chibi/${relative}`, import.meta.url);
  for (const path of [prototypePath, productionPath]) {
    const png = readFileSync(path);
    assert.equal(png.readUInt32BE(16), 512);
    assert.equal(png.readUInt32BE(20), 512);
    assert.equal(png.readUInt8(25), 6, 'PNG must be RGBA');
    assert.ok(png.length <= 307_200);
  }
  assert.deepEqual(readFileSync(prototypePath), readFileSync(productionPath));
  const meta = JSON.parse(readFileSync(new URL(`../assets/resources/game/chibi/${relative}.meta`, import.meta.url), 'utf8'));
  assert.equal(meta.userData.type, 'sprite-frame');
  assert.equal(meta.subMetas.f9941.importer, 'sprite-frame');
});
```

在微信包测试的 resources config 断言中加入：

```js
assert.equal(
  readFileSync(resourcesConfigPath, 'utf8').includes('game/chibi/collection/moon-goddess-potion/spriteFrame'),
  true,
);
```

- [ ] **Step 2: 运行资源测试并确认图片缺失**

```powershell
cd wechat-game
node --experimental-strip-types --test tests/production-contracts.test.ts
```

Expected: FAIL，缺少 `moon-goddess-potion.png`。

- [ ] **Step 3: 只生成一个占位图**

实施时先加载 `imagegen` skill，调用一次 ImageGen：简单居中月神药水瓶、银紫液体、月冠符号、透明背景、主体避开 2×3 接缝；不请求候选或变体。将唯一结果规范为 512×512 RGBA、≤307,200 字节，并把完全相同的字节写入上述两个目标路径。

不得运行：

```powershell
npm run sync:assets
```

- [ ] **Step 4: 让 Creator 生成 meta，再只配置这个 SpriteFrame**

完成一次 Cocos Creator 3.8.8 导入后运行：

```powershell
node tools/configure-sprite-frames.mjs collection/moon-goddess-potion.png
```

Expected: 输出 `configured 1 ...`；只允许新 `.meta` 改动。

- [ ] **Step 5: 验证真实透明像素、体积和字节一致**

```powershell
Add-Type -AssemblyName System.Drawing
$paths = @(
  (Resolve-Path '..\prototype\public\assets\game\chibi\collection\moon-goddess-potion.png').Path,
  (Resolve-Path 'assets\resources\game\chibi\collection\moon-goddess-potion.png').Path
)
$hashes = $paths | ForEach-Object { (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash }
if ($hashes[0] -ne $hashes[1]) { throw 'asset bytes differ' }
foreach ($path in $paths) {
  $bitmap = [Drawing.Bitmap]::new($path)
  try {
    if ($bitmap.Width -ne 512 -or $bitmap.Height -ne 512) { throw 'wrong size' }
    $minimumAlpha = 255; $maximumAlpha = 0
    for ($y=0; $y -lt 512; $y+=1) { for ($x=0; $x -lt 512; $x+=1) {
      $alpha = $bitmap.GetPixel($x,$y).A
      if ($alpha -lt $minimumAlpha) { $minimumAlpha = $alpha }
      if ($alpha -gt $maximumAlpha) { $maximumAlpha = $alpha }
    }}
    if ($minimumAlpha -ne 0 -or $maximumAlpha -ne 255) { throw 'alpha extrema missing' }
  } finally { $bitmap.Dispose() }
  if ((Get-Item -LiteralPath $path).Length -gt 307200) { throw 'file too large' }
}
```

Expected: 无输出、退出码 0。

- [ ] **Step 6: 更新现有 Python 资源清单并跑可用测试**

给 `EXPECTED` 和体积循环各加入 `collection/moon-goddess-potion.png`。当前环境没有真实 Python；不要安装依赖，使用 Step 5 和 Node 生产契约作为本机证据。若执行环境已有 Python/Pillow，再补跑：

```powershell
python tools/verify-collection-assets.py
```

- [ ] **Step 7: 提交单图资源**

```powershell
git add prototype/public/assets/game/chibi/collection/moon-goddess-potion.png wechat-game/assets/resources/game/chibi/collection/moon-goddess-potion.png wechat-game/assets/resources/game/chibi/collection/moon-goddess-potion.png.meta wechat-game/tools/verify-collection-assets.py wechat-game/tests/production-contracts.test.ts wechat-game/tests/wechat-build-preparation.test.mjs
git commit -m "feat: add moon goddess potion placeholder"
```

### Task 5: 同步 CloudBase 270/271 权威边界

**Files:**

- Modify: `cloudbase/src/domain.mjs`
- Modify: `cloudbase/tests/domain.test.mjs`
- Modify: `cloudbase/tests/chapters-seven-eight-boundary.test.mjs`
- Regenerate: `cloudbase/functions/_shared/runtime.js`
- Regenerate: `cloudbase/functions/bootstrap/_shared/runtime.js`
- Regenerate: `cloudbase/functions/claimRewardedBottle/_shared/runtime.js`
- Regenerate: `cloudbase/functions/getGameConfig/_shared/runtime.js`
- Regenerate: `cloudbase/functions/submitLevelResult/_shared/runtime.js`
- Regenerate: `cloudbase/functions/syncProgress/_shared/runtime.js`

**Interfaces:**

- Consumes: 客户端配置版本 `chapters-1-9.2026-09-23.1` 和发布上限 270。
- Produces: 云进度、奖励请求、遥测统一接受 270、拒绝 271。

- [ ] **Step 1: 先更新 CloudBase 测试**

```js
const VERSION = 'chapters-1-9.2026-09-23.1';
assert.equal(mergeProgress(current, {
  ...current,
  currentLevel: 'level-270',
  completedThrough: 270,
}).completedThrough, 270);
assert.throws(() => mergeProgress(current, { ...current, completedThrough: 271 }));
assert.equal(validateRewardRequest({ levelId: 'level-270', claimId: 'claim_87654321' }).levelId, 'level-270');
assert.throws(() => validateRewardRequest({ levelId: 'level-271', claimId: 'claim_12345678' }));
assert.equal(normalizeLevelResult({ levelId: 'level-270', moves: 42, durationMs: 1000, undoCount: 0 }).levelId, 'level-270');
assert.throws(() => normalizeLevelResult({ levelId: 'level-271', moves: 42, durationMs: 1000, undoCount: 0 }));
```

- [ ] **Step 2: 运行 CloudBase 测试并确认旧上限失败**

```powershell
cd cloudbase
npm test
```

Expected: FAIL，270 被旧 `LAST_LEVEL = 240` 拒绝。

- [ ] **Step 3: 只改源上限并刷新副本**

```js
const LAST_LEVEL = 270;
```

```powershell
npm run prepare:functions
```

Expected: 六份函数 runtime 精确由源模板刷新，不手改副本。

- [ ] **Step 4: 验证测试与副本**

```powershell
npm test
$runtimePaths = @(
  'functions/_shared/runtime.js',
  'functions/bootstrap/_shared/runtime.js',
  'functions/claimRewardedBottle/_shared/runtime.js',
  'functions/getGameConfig/_shared/runtime.js',
  'functions/submitLevelResult/_shared/runtime.js',
  'functions/syncProgress/_shared/runtime.js'
)
$before = $runtimePaths | ForEach-Object { (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash }
npm run prepare:functions
$after = $runtimePaths | ForEach-Object { (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash }
if ((Compare-Object $before $after).Count -ne 0) { throw 'prepare:functions is not idempotent' }
```

Expected: 测试 PASS；第二次生成后无差异。

- [ ] **Step 5: 提交 CloudBase 边界**

```powershell
git add cloudbase/src/domain.mjs cloudbase/tests cloudbase/functions
git commit -m "feat: extend cloud boundary to level 270"
```

### Task 6: 更新耐久文档并完成发布验证

**Files:**

- Modify: `wechat-game/AGENTS.md`
- Modify: `prototype/AGENTS.md`
- Verify only: `wechat-game/build/wechatgame/**`
- Do not add: `wechat-game/project.config.json`、`wechat-game/cocos-build-*.log`、`wechat-game/build/**`、`wechat-game/tmp/**`

**Interfaces:**

- Consumes: Tasks 1–5 的完整分支。
- Produces: 可审计测试日志、Cocos 3.8.8 release 构建、生产 AppID 微信包和用户真机验收入口。

- [ ] **Step 1: 更新两份 AGENTS.md 的耐久事实**

将“1–240/前八章/241 未发布”改为“1–270/前九章/271 未发布”，加入本规格的第九章系数、11 色、2 空瓶、44 段上限、探测/搜索预算、月神药水和“传奇炼金师”。保留第十章 coming-soon、后期占位图、无尽模式和所有启动/平台/构建约束。

- [ ] **Step 2: 运行快速生成检查和聚焦测试**

```powershell
cd wechat-game
npm run check:chapter-eight
npm run check:chapter-nine
node --experimental-strip-types --test tests/chapter-nine-generator.test.ts tests/chapters-seven-eight-integration.test.ts tests/chapter-catalog.test.ts tests/level-catalog.test.ts tests/level-progress.test.ts tests/local-progress-store.test.ts tests/progress-sync.test.ts tests/scene-flow.test.ts tests/collection-progress.test.ts tests/potion-collection-catalog.test.ts tests/production-contracts.test.ts
cd ..\cloudbase
npm test
npm run prepare:functions
```

Expected: 全部 PASS；第八章锁定数据没有漂移。

- [ ] **Step 3: 运行完整核心回归**

```powershell
cd ..\wechat-game
npm run test:core
```

Expected: 0 failures。不要运行无尽模式专项修复或改其代码；这里只确认静态池扩展没有破坏现有测试。

- [ ] **Step 4: 仅在最终取证时重跑第九章锁定 solver**

```powershell
npm run verify:chapter-nine
```

Expected: `30 chapter 9 levels passed exact solver verification`；任何超出 150,000 状态的锁定关失败，不扩大上限。

- [ ] **Step 5: 用 Cocos Creator 3.8.8 构建微信 release**

```powershell
$creator = 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe'
& $creator --project (Resolve-Path '.').Path --build 'platform=wechatgame;debug=false'
```

Expected: 日志含 `build Task (wechatgame) Finished`，且 `build/wechatgame/assets/main/index.js`、`build/wechatgame/subpackages/resources/config.json` 存在且非空。即使 Creator 因已知窗口状态警告返回非零，也必须同时满足完成标记和输出存在，不能只看退出码宣称成功。

- [ ] **Step 6: 以生产 AppID 准备并测试微信包**

```powershell
$env:WECHAT_APPID='wx44e5e0b648b140ce'
npm run prepare:wechat-build
npm run test:wechat-build
$config = Get-Content -Raw build/wechatgame/project.config.json | ConvertFrom-Json
if ($config.appid -ne 'wx44e5e0b648b140ce') { throw 'wrong AppID' }
$resources = Get-Content -Raw build/wechatgame/subpackages/resources/config.json
if (-not $resources.Contains('game/chibi/collection/moon-goddess-potion/spriteFrame')) { throw 'missing moon goddess SpriteFrame' }
```

Expected: 微信包测试全通过，resources config 非空并包含月神药水 SpriteFrame，AppID 正确。

- [ ] **Step 7: 检查没有带入基线外垃圾文件**

```powershell
git status --short
git diff --check
git diff --name-only 68630b7...HEAD
```

Expected: 无 `engine.json` 换行差异、Cocos 日志、根 `project.config.json`、`project.private.config.json`、`build/` 或 `tmp/`；每个改动都可追溯到第九章。

- [ ] **Step 8: 提交文档与最终验证调整**

```powershell
git add wechat-game/AGENTS.md prototype/AGENTS.md
git commit -m "docs: record chapter nine production contract"
```

- [ ] **Step 9: 交给用户真机验收**

从全新的微信开发者工具进程导入最终 `build/wechatgame`，生成新二维码。向用户报告自动化、包体和 AppID 证据，并明确“等待真机确认”；不得复用旧二维码或写“真机已通过”。
