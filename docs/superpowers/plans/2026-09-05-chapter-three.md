# 《暮影炼金室》完整第三章 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布第三章“熟练魔女 · 月光魔法”：61–90 关、月辉药水六块拼图、熟练魔女自动称号、跨章解锁与可预览微信构建。

**Architecture:** 复用第二章离线确定性生成模式，新增独立第三章生成器、静态数据模块和生成报告；运行时目录只聚合已提交数据，不生成或求解。章节导航、收藏、称号、进度和完成文案继续由已有目录及连续完成边界派生，只把发布上限从 60 扩到 90。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Node.js `node:test`、微信小游戏、CloudBase、PNG SpriteFrame、Cocos Graphics/Mask/Tween。

**Spec:** `docs/superpowers/specs/2026-08-29-chapters-two-to-ten-rare-potions-design.md`

## Global Constraints

- 本计划只发布第 1–3 章；第 4–10 章继续保持 `coming-soon`。
- 第 1–60 关及第 12 关棋盘保持字节级不变；第 1 关仍是全游戏唯一教学关。
- 第 61–90 关全部使用 `all-colors`、2 个普通空瓶和固定第 15 槽激励空瓶。
- 第三章难度锚点固定为 61=`0.95`、62=`1.03`、65=`1.06`、70=`1.08`、80=`1.11`、85–87=`1.12`、90=`1.05`，非锚点分段线性插值。
- 月辉药水只进入图鉴；每完成第三章 5 个连续新关卡揭示一块 2×3 拼图。
- 完成第 60 关自动显示“熟练魔女”；称号不可佩戴或切换。
- 每章选关固定 5×6 单页；完成 60 解锁 61，完成 90 后停留在当前发布范围。
- `PlayerProgress` 继续使用常量大小 schema v3；旧 1–60 存档不丢失，不新增收藏或称号字段。
- 微信 AppID 为 `wx44e5e0b648b140ce`；主包小于 4 MiB、总包小于 30 MiB。
- 保留工作树全部既有改动；只修改第三章直接依赖的文件，不执行批量暂存、重置或清理。

---

### Task 1: 第三章目录与月辉药水身份

**Files:**
- Modify: `wechat-game/tests/chapter-catalog.test.ts`
- Modify: `wechat-game/tests/potion-collection-catalog.test.ts`
- Modify: `wechat-game/assets/scripts/core/chapter-catalog.ts`
- Modify: `wechat-game/assets/scripts/core/potion-collection-catalog.ts`

**Interfaces:**
- Produces: `getChapter(3)` = “熟练魔女 · 月光魔法”，关卡 61–90，`releaseState: 'available'`。
- Produces: `getPotionCollection(3)` = `moon-glow-potion` / “月辉药水”。

- [ ] **Step 1: 写失败测试**：断言已发布章节为 `[1, 2, 3]`，第三章字段和月辉药水稳定 ID、描述、资源键准确，第 4 章仍未发布。
- [ ] **Step 2: 验证红灯**：运行 `node --experimental-strip-types --test tests/chapter-catalog.test.ts tests/potion-collection-catalog.test.ts`，失败原因应为第三章仍是占位目录。
- [ ] **Step 3: 最小实现**：只扩展现有目录映射，不引入新目录抽象。
- [ ] **Step 4: 验证绿灯**：重跑同一命令，全部通过。

### Task 2: 第三章难度函数与生成门槛

**Files:**
- Create: `wechat-game/tools/generate-chapter-three.ts`
- Modify: `wechat-game/tests/level-generator.test.ts`
- Modify: `wechat-game/package.json`

**Interfaces:**
- Produces: `chapterThreeDifficultyTarget(levelNumber: number): number`。
- Produces: `chapterThreeGenerationSpec(levelNumber: number): GenerationSpec`。
- Produces: `chapterThreeGeneratorSeed(levelNumber: number): number`。

- [ ] **Step 1: 写难度失败测试**：断言锚点、插值（含 63、88、89）、61/90 外抛 `RangeError`，并断言 61 与 85 的颜色数、最优步数、分段、状态数、开局分支和误导分支门槛。
- [ ] **Step 2: 验证红灯**：运行 `node --experimental-strip-types --test tests/level-generator.test.ts`，失败原因应为第三章生成器不存在。
- [ ] **Step 3: 最小实现**：复制第二章脚本的纯函数结构，替换范围、锚点、配置版本和独立种子前缀；门槛严格使用长期规格公式。
- [ ] **Step 4: 验证绿灯**：重跑生成器测试，难度和门槛测试通过。

### Task 3: 生成并固化 61–90 关

**Files:**
- Create: `wechat-game/assets/scripts/core/level-data.chapter-03.generated.ts`
- Create: `wechat-game/assets/scripts/core/level-generation-report.chapter-03.json`
- Modify: `wechat-game/tools/generate-chapter-three.ts`
- Modify: `wechat-game/tests/level-generator.test.ts`
- Modify: `wechat-game/tests/level-catalog.test.ts`

**Interfaces:**
- Produces: `CHAPTER_THREE_LEVEL_DATA: readonly LevelConfig[]`。
- Produces: 30 条带精确求解指标的第三章报告。

- [ ] **Step 1: 写失败测试**：报告必须有 30 关、无豁免、目标系数逐关匹配；目录必须有 90 个唯一棋盘，61–90 均为正式规则，90 无后继。
- [ ] **Step 2: 验证红灯**：运行 `node --experimental-strip-types --test tests/level-generator.test.ts tests/level-catalog.test.ts`，失败原因应为静态数据未生成和目录仍为 60 关。
- [ ] **Step 3: 最小生成实现**：从第二章已证明的 8/9 色基型中按门槛选择，确定性重映射颜色与普通槽位；每个候选仍调用 `analyzeState` 重新证明最短解，且棋盘键不得与第 1–60 关或本章重复。
- [ ] **Step 4: 写出静态数据与报告**：运行 `node --experimental-strip-types tools/generate-chapter-three.ts`。
- [ ] **Step 5: 确定性复验**：运行 `node --experimental-strip-types tools/generate-chapter-three.ts --check`，输出必须为 `30 chapter 3 levels match generated output`。
- [ ] **Step 6: 验证绿灯**：重跑生成器和目录测试，确认 90 关、90 个唯一棋盘、只第 1 关教学。

### Task 4: 本地进度、会话和云端边界扩到 90

**Files:**
- Modify: `wechat-game/assets/scripts/core/level-catalog.ts`
- Modify: `wechat-game/assets/scripts/core/level-progress.ts`
- Modify: `wechat-game/tests/level-progress.test.ts`
- Modify: `wechat-game/tests/local-progress-store.test.ts`
- Modify: `wechat-game/tests/progress-sync.test.ts`
- Modify: `cloudbase/src/domain.mjs`
- Modify: `cloudbase/tests/domain.test.mjs`
- Generated: `cloudbase/functions/*/_shared/runtime.js`

**Interfaces:**
- Changes: `GAME_CONFIG_VERSION` 到第三章版本，`PUBLISHED_LEVELS.length === 90`。
- Preserves: 常量大小 `completedThrough`、旧 v2/v3 迁移和每关独立快照。

- [ ] **Step 1: 写失败测试**：60 解锁 61，90 完成后 `completedThrough=90/currentLevel=level-090`；旧 60 关 v3 记录无损规范化；QA 全解锁上限为 90。
- [ ] **Step 2: 写云端失败测试**：接受 61/90 的同步、奖励与遥测，拒绝 91；云端合并仍保留合法较旧完成记录。
- [ ] **Step 3: 验证红灯**：运行客户端进度定向测试和 `npm test --prefix cloudbase`。
- [ ] **Step 4: 最小实现**：聚合第三章静态数据并把云端 `LAST_LEVEL` 改为 90；其余边界继续从 `PUBLISHED_LEVELS` 派生。
- [ ] **Step 5: 同步云函数**：运行 `node cloudbase/tools/prepare-functions.mjs`，再跑 CloudBase 测试并核对所有运行时副本哈希一致。
- [ ] **Step 6: 验证绿灯**：客户端进度、存储、同步、会话测试全部通过。

### Task 5: 数据驱动章节导航、完成文案和第三章收藏

**Files:**
- Modify: `wechat-game/tests/collection-progress.test.ts`
- Modify: `wechat-game/tests/scene-flow.test.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`

**Interfaces:**
- Consumes: `chapterForLevel`、`getChapter`、`levelsForChapter`、`getPotionCollection`。
- Produces: 60→61“进入第三章”，90→null“返回选关”，第三章动态标题、月辉拼图和熟练魔女自动称号。

- [ ] **Step 1: 写失败测试**：完成 65 显示月辉拼图 1/6；完成 90 收录月辉药水；完成 60 后称号为熟练魔女；第三章可切换、第四章不可切换。
- [ ] **Step 2: 写展示失败测试**：`completionPrimaryLabel(60, 61) === '进入第三章'`；生产代码不得再用第一/第二章二选一文案，而由章节 ID 生成中文章节名。
- [ ] **Step 3: 验证红灯**：运行收藏、场景流、布局、生产契约定向测试。
- [ ] **Step 4: 最小实现**：增加一个中文章节序号映射函数供选关标题和完成标题复用；收藏详情继续使用现有目录资源键与 2×3 Mask；称号徽章继续复用现有底图。
- [ ] **Step 5: 验证绿灯**：重跑四组定向测试，确保第一、二章文案和布局不变。

### Task 6: 月辉药水正式透明 PNG

**Files:**
- Create: `prototype/public/assets/game/chibi/collection/moon-glow-potion.png`
- Create: `wechat-game/assets/resources/game/chibi/collection/moon-glow-potion.png`
- Generated by Cocos: `wechat-game/assets/resources/game/chibi/collection/moon-glow-potion.png.meta`
- Modify: `wechat-game/tools/verify-collection-assets.py`
- Modify: `wechat-game/tests/production-contracts.test.ts`
- Modify: `prototype/AGENTS.md`

**Interfaces:**
- Produces resource: `game/chibi/collection/moon-glow-potion/spriteFrame`。

- [ ] **Step 1: 写资源失败测试**：要求 512×512、真实透明通道、文件不超过 300 KiB、Cocos SpriteFrame 元数据存在。
- [ ] **Step 2: 验证红灯**：运行生产契约测试和 `python tools/verify-collection-assets.py`，失败原因应为月辉资源不存在。
- [ ] **Step 3: 生成正式素材**：以星露、森林药水为系列参考，制作银蓝发光液体、月牙瓶型/吊坠、少量月尘与柔和月环的透明 PNG；主体和关键装饰避开 2×3 拼图缝。
- [ ] **Step 4: 优化与同步**：规范到 512×512 RGBA、压缩到 300 KiB 内，运行 `npm run sync:assets --prefix wechat-game` 和 `npm run prepare:sprites --prefix wechat-game`。
- [ ] **Step 5: 验证绿灯**：资源校验与生产契约测试通过，且不新增单独拼图碎片图。

### Task 7: 生产约束、完整回归和微信构建

**Files:**
- Modify: `wechat-game/AGENTS.md`
- Modify: `prototype/AGENTS.md`
- Build: `wechat-game/build/wechatgame`
- Copy: `D:\codex_pro\my_game_water\wechat-game\build\wechatgame`

**Interfaces:**
- Verifies: 第三章数据、资源、存档、云端、Cocos 导入、微信包体和固定预览目录。

- [ ] **Step 1: 固化约束**：将生产不变量从两章更新为三章，记录第三章难度锚点、月辉药水、60→61 和 90 封顶。
- [ ] **Step 2: 全部生成复验**：依次运行第一、二、三章 `--check`，第一、二章输出不得改变。
- [ ] **Step 3: 完整测试**：运行 `node --experimental-strip-types --test tests/*.test.ts`、CloudBase 测试、云函数准备后再次 CloudBase 测试。
- [ ] **Step 4: Cocos 3.8.8 release 构建**：构建日志必须包含 `build Task (wechatgame) Finished`，保留新增合法 `.meta`。
- [ ] **Step 5: 微信产物门禁**：运行 `prepare-wechat-build.mjs` 和微信产物测试，确认 AppID、完整资源分包及包体限制。
- [ ] **Step 6: 安全同步固定预览目录**：先核验源/目标绝对路径和微信开发者工具占用状态，再完整同步；比较相对路径、文件数、长度和哈希，不产生嵌套目录。

## Execution Order

严格按 Task 1→7 执行。第三章静态关卡必须先通过确定性求解门禁，才可发布目录并扩展进度；正式月辉药水通过透明度、尺寸和包体检查后，才可生成最终微信预览包。
