# Stars And Daily Commission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add derived three-star ratings and a local daily commission that unlocks after level 5 and grants one deferred, capped stamina reward.

**Architecture:** Keep rating and daily-date transitions as framework-free core functions. Persist one compact daily record through `LocalProgressStore`; Cocos presentation renders the home entry, modal, selector stars and completion state while reusing existing button, panel, stamina and level-session primitives.

**Tech Stack:** TypeScript, Node test runner, Cocos Creator 3.8.8, WeChat Mini Game local storage.

**Spec:** `docs/superpowers/specs/2026-09-09-stars-daily-commission-design.md`

## Global Constraints

- Runtime never generates or solves a level.
- Daily play does not overwrite a formal per-level session and never consumes stamina.
- Stars and chapter totals are derived; do not add per-level star storage.
- Preserve the fixed 5×6 single-page selector and all existing user changes.
- Use existing raster UI assets and code-native labels/shapes; add no new image dependency.

---

### Task 1: Derived star rules

**Files:**
- Create: `wechat-game/assets/scripts/core/level-rating.ts`
- Create: `wechat-game/tests/level-rating.test.ts`
- Modify: `wechat-game/package.json`

**Interfaces:**
- Produces: `levelStarRating(completed, bestMoves, optimalMoves): 0 | 1 | 2 | 3`
- Produces: `chapterStarTotal(progress, chapterId): number`

- [ ] Write literal boundary tests for optimal, 15% allowance, slower completion, incomplete levels, legacy completion without best moves, and a chapter sum.
- [ ] Run the new test and verify failure because the module is absent.
- [ ] Implement the two pure functions using existing level/chapter catalogs.
- [ ] Run the new test and the core suite.

### Task 2: Daily state machine

**Files:**
- Create: `wechat-game/assets/scripts/core/daily-commission.ts`
- Create: `wechat-game/tests/daily-commission.test.ts`
- Modify: `wechat-game/assets/scripts/core/level-progress.ts`
- Modify: `wechat-game/tests/level-progress.test.ts`

**Interfaces:**
- Produces: `DailyCommissionState`, `dailyDateKey`, `reconcileDailyCommission`, `completeDailyCommission`, `claimDailyReward`.
- Produces: `recordBestMoves(progress, levelId, moves)` without changing `currentLevel` or `completedThrough`.

- [ ] Write failing tests for locked state, deterministic level selection excluding level 1, same-day stability, next-day reset, streak transitions, idempotent completion/claim, and best-move-only progress.
- [ ] Run focused tests and confirm expected missing-symbol failures.
- [ ] Implement the minimum immutable daily record and best-move update.
- [ ] Re-run focused tests and the core suite.

### Task 3: Durable storage and modal flow

**Files:**
- Modify: `wechat-game/assets/scripts/platform/LocalProgressStore.ts`
- Modify: `wechat-game/tests/local-progress-store.test.ts`
- Modify: `wechat-game/assets/scripts/core/scene-flow.ts`
- Modify: `wechat-game/tests/scene-flow.test.ts`
- Modify: `wechat-game/assets/scripts/core/stamina.ts`
- Modify: `wechat-game/tests/stamina.test.ts`

**Interfaces:**
- Produces: `loadDailyCommission(now, completedThrough)` and `saveDailyCommission(state)` under a separate v1 key.
- Produces: daily dialog open/close state mutually exclusive with other overlays.
- Produces: `grantDailyStamina(state, now)` capped at 10.

- [ ] Write failing storage, overlay and one-point stamina tests.
- [ ] Run focused tests and confirm failures are caused by missing behavior.
- [ ] Add the smallest storage methods, scene flag/transitions and stamina grant.
- [ ] Re-run focused tests and the core suite.

### Task 4: Cocos presentation

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`

**Interfaces:**
- Consumes: star and daily core APIs from Tasks 1–3.
- Produces: home entry states, daily modal/start/claim flow, temporary daily session, selector stars, chapter total and completion stars.

- [ ] Write failing layout tests for the mirrored 64×64 entry, widened selector row spacing, star offset and daily dialog bounds.
- [ ] Run layout tests and confirm the old constants fail.
- [ ] Add layout constants/helpers and update Cocos rendering using existing panel/button/stamina helpers.
- [ ] Ensure normal completion remains unchanged while daily completion skips unlock and stamina spending.
- [ ] Run presentation and production contract tests.

### Task 5: Document and package

**Files:**
- Modify: `wechat-game/AGENTS.md`
- Modify: `prototype/AGENTS.md`
- Modify: `wechat-game/assets/scripts/**/*.meta` only for newly created Cocos TypeScript assets if Creator does not generate them during the build.

**Interfaces:**
- Records the approved product contract for future chapters and UI changes.

- [ ] Record star and daily-commission invariants in both guides.
- [ ] Run all core tests and deterministic level checks.
- [ ] Close Developer Tools, build with Cocos Creator 3.8.8, then run `tools/prepare-wechat-build.mjs`.
- [ ] Verify production AppID, full resources subpackage, non-empty `subpackages/resources/config.json`, and direct `System.register` entry.

