# First Chapter Multi-Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, difficulty-graded first chapter of levels 1–15 with selection, unlocking, per-level saves, legacy level-12 migration, completion flow, and CloudBase progress boundaries.

**Architecture:** The framework-free TypeScript core owns immutable level contracts, the published catalog, session completion, and progress rules. A Node-only deterministic reverse-pour generator and solver produce checked static data; Cocos presentation consumes the catalog without runtime generation, while platform adapters persist per-level snapshots and opportunistically sync validated progress.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node.js `--experimental-strip-types`, `node:test`, WeChat Mini Game APIs, WeChat Cloud Development / CloudBase.

**Spec:** `docs/superpowers/specs/2026-08-23-first-chapter-multi-level-design.md`

## Global Constraints

- `wechat-game/assets/scripts/core/` must remain independent from `cc`, `wx`, storage, audio, timers, and presentation state.
- Every board has exactly 15 slots; regular content uses indices 0–13 and index 14 is the one-time rewarded empty bottle.
- Bottle capacity remains four; completed bottles become `vanished`, slots never reflow, and vanished slots are never reusable.
- Level 12 initial state must stay byte-for-byte equivalent to the current `createDemoState()` value.
- Wide raster buttons use nine-slice rendering; bottom control artwork stays 72×72 inside 110×72 hit targets.
- Ordinary gameplay and local saves work offline; reward claims require successful online authority.
- No environment IDs, secrets, ad unit IDs, or administrator credentials are committed.
- Use the bundled Node executable at `C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` when `node` is not on PATH.
- Preserve all existing user changes and existing tests; never weaken a contract test to make implementation pass.

---

### Task 1: Level contract and validation

**Files:**
- Modify: `wechat-game/assets/scripts/core/level-config.ts`
- Modify: `wechat-game/assets/scripts/core/demo-level.ts`
- Create: `wechat-game/tests/level-config.test.ts`
- Modify: `wechat-game/package.json`

**Interfaces:**
- Consumes: `GameState`, `PotionColor`, fixed water-sort capacity.
- Produces: `CompletionRule`, `LevelMetrics`, `LevelConfig`, `validateLevelConfig(config): readonly string[]`, `levelNumber(levelId): number | null`, and `levelId(number): string`.

- [ ] **Step 1: Write the failing level-contract tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_LEVEL_CONFIG, levelId, levelNumber, validateLevelConfig } from '../assets/scripts/core/level-config.ts';

test('level ids round-trip only the published three-digit format', () => {
  assert.equal(levelId(1), 'level-001');
  assert.equal(levelNumber('level-015'), 15);
  assert.equal(levelNumber('level-16'), null);
});

test('level validation enforces fixed slots, reward reservation, and four units per color', () => {
  assert.deepEqual(validateLevelConfig(DEMO_LEVEL_CONFIG), []);
  const invalid = { ...DEMO_LEVEL_CONFIG, initialState: { ...DEMO_LEVEL_CONFIG.initialState, bottles: [] } };
  assert.match(validateLevelConfig(invalid).join('\n'), /15 slots/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --experimental-strip-types --test tests/level-config.test.ts
```

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement the immutable contract and validator**

Add these exact public shapes and keep `DEMO_LEVEL_CONFIG` as the level-12 compatibility fixture:

```ts
export type CompletionRule =
  | Readonly<{ type: 'first-valid-pour' }>
  | Readonly<{ type: 'first-bottle-complete' }>
  | Readonly<{ type: 'all-colors'; targetCount: number }>;

export interface LevelMetrics {
  readonly colorCount: number;
  readonly optimalMoves: number;
  readonly segmentCount: number;
  readonly exploredStates: number;
  readonly openingMoves: number;
  readonly difficultyScore: number;
}

export interface LevelConfig {
  readonly id: string;
  readonly number: number;
  readonly configVersion: string;
  readonly presentationSeed: number;
  readonly capacity: 4;
  readonly slotCount: 15;
  readonly rewardSlotIndex: 14;
  readonly completionRule: CompletionRule;
  readonly metrics: LevelMetrics;
  readonly initialState: GameState;
}
```

`validateLevelConfig` must return deterministic error strings for ID/number mismatch, slot count, reward slot state, layer capacity, unknown colors, per-color totals, initial complete bottles, fewer than two active empty bottles for non-legacy levels, and fewer than two legal opening moves for non-tutorial levels. Permit only level 12 to retain its current partial-bottle legacy distribution.

- [ ] **Step 4: Run focused and existing core tests**

Run the focused command, then `npm`-equivalent full command from the Global Constraints. Expected: new tests PASS and existing 36 tests remain PASS.

- [ ] **Step 5: Add the new test to `test:core` and commit**

```powershell
git add wechat-game/assets/scripts/core/level-config.ts wechat-game/assets/scripts/core/demo-level.ts wechat-game/tests/level-config.test.ts wechat-game/package.json
git commit -m "feat: define validated level contracts"
```

---

### Task 2: Deterministic solver and difficulty analysis

**Files:**
- Create: `wechat-game/tools/level-solver.ts`
- Create: `wechat-game/tests/level-solver.test.ts`
- Modify: `wechat-game/package.json`

**Interfaces:**
- Consumes: `GameState`, `pour`, `vanishBottle`, and `CompletionRule`.
- Produces: `legalMoves(state): readonly Move[]`, `applyMoveAndVanish(state, move): GameState`, `canonicalStateKey(state): string`, and `solveLevel(state, options): SolveResult`.

```ts
export interface Move { readonly from: number; readonly to: number }
export interface SolveOptions {
  readonly completionRule: CompletionRule;
  readonly maxExploredStates: number;
}
export interface SolveResult {
  readonly solved: boolean;
  readonly moves: readonly Move[];
  readonly exploredStates: number;
  readonly openingMoves: number;
}
```

- [ ] **Step 1: Write failing solver tests**

Cover canonical equality under empty-bottle permutations, automatic vanish after completion, a two-move fixture, unsolved search-limit behavior, and replay validity:

```ts
test('solver returns a replayable path under vanish semantics', () => {
  const state = stateOf([['rose'], ['rose', 'rose', 'rose'], []]);
  const result = solveLevel(state, {
    completionRule: { type: 'all-colors', targetCount: 1 },
    maxExploredStates: 100,
  });
  assert.equal(result.solved, true);
  assert.deepEqual(result.moves, [{ from: 0, to: 1 }]);
  assert.equal(applyMoveAndVanish(state, result.moves[0]).bottles[1].status, 'vanished');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Expected: module-not-found failure for `tools/level-solver.ts`.

- [ ] **Step 3: Implement breadth-first search with symmetry reduction**

Canonicalize only equivalent bottle contents/statuses while retaining the reserved slot outside the sortable group. Prune moves that pour an entire monochrome bottle into an empty bottle, immediate inverse moves that restore the parent key, and moves involving non-active bottles. Evaluate completion rules without mutating source states.

- [ ] **Step 4: Run the solver tests and measure the level-12 anchor**

Add a diagnostic assertion that level 12 returns a solved path before the chosen `maxExploredStates`; record its `moves.length`, `exploredStates`, and `openingMoves` for Task 3. If breadth-first search exceeds the bound, implement A* with the admissible lower bound `remainingColorSegments - remainingColors` rather than raising the bound without limit.

- [ ] **Step 5: Add the test to `test:core` and commit**

```powershell
git add wechat-game/tools/level-solver.ts wechat-game/tests/level-solver.test.ts wechat-game/package.json
git commit -m "feat: add deterministic water-sort solver"
```

---

### Task 3: Offline reverse-pour generator and published catalog

**Files:**
- Create: `wechat-game/tools/level-generator.ts`
- Create: `wechat-game/tools/generate-levels.ts`
- Create: `wechat-game/assets/scripts/core/level-data.generated.ts`
- Create: `wechat-game/assets/scripts/core/level-catalog.ts`
- Create: `wechat-game/assets/scripts/core/level-generation-report.json`
- Create: `wechat-game/tests/level-generator.test.ts`
- Create: `wechat-game/tests/level-catalog.test.ts`
- Modify: `wechat-game/package.json`

**Interfaces:**
- Consumes: Task 1 contracts and Task 2 solver.
- Produces: `generateCandidate(spec, seed): GeneratedCandidate`, `FIRST_CHAPTER_LEVELS`, `getLevelConfig(id)`, `nextLevelConfig(id)`, and CLI `generate-levels.ts [--check]`.

```ts
export interface GenerationSpec {
  readonly number: number;
  readonly colorCount: number;
  readonly emptyBottleCount: number;
  readonly reverseMoves: number;
  readonly minimumDifficulty: number;
  readonly maximumDifficulty: number;
  readonly maxAttempts: number;
}
```

- [ ] **Step 1: Write failing generator invariants**

Test identical seed identity, different-seed diversity, recorded inverse replay, per-color totals, reserved slot, no initial complete bottle, and failure after `maxAttempts` with a stable diagnostic.

- [ ] **Step 2: Write failing catalog invariants**

```ts
test('first chapter publishes exactly fifteen consecutive validated levels', () => {
  assert.deepEqual(FIRST_CHAPTER_LEVELS.map((level) => level.id),
    Array.from({ length: 15 }, (_, index) => levelId(index + 1)));
  for (const level of FIRST_CHAPTER_LEVELS) assert.deepEqual(validateLevelConfig(level), []);
});

test('difficulty never decreases and level 12 is frozen', () => {
  const scores = FIRST_CHAPTER_LEVELS.map((level) => level.metrics.difficultyScore);
  assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
  assert.deepEqual(getLevelConfig('level-012')?.initialState, createDemoState());
});
```

- [ ] **Step 3: Run both tests and verify RED**

Expected: missing generator and catalog modules.

- [ ] **Step 4: Implement reverse-pour candidate generation**

Start from solved color bottles plus empty working bottles. A reverse move removes `k` units from a top run and places them on an empty or different-color active target only when the recorded forward inverse is legal and moves exactly `k` units. Reject candidates whose replay fails under vanish semantics or whose solver result is outside the spec.

- [ ] **Step 5: Implement authored tutorial and frozen legacy overrides**

Define levels 1–3 as small explicit fixtures with completion rules `first-valid-pour`, `first-bottle-complete`, and `all-colors`. Import level 12 from `createDemoState()`. Generate only levels 4–11 and 13–15.

- [ ] **Step 6: Implement scoring and select monotonic candidates**

Use a deterministic integer score derived from normalized color count, solver move count, segment count, base-2 bucket of explored states, opening constraint, and wrong-branch penalty. Select candidates in ascending order; constrain level 11 to at most the measured level-12 score and level 13 to at least it. Store all component metrics in the generation report.

- [ ] **Step 7: Generate static data and verify `--check`**

Run:

```powershell
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --experimental-strip-types tools/generate-levels.ts
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --experimental-strip-types tools/generate-levels.ts --check
```

Expected: second command exits 0 with `15 published levels match generated output`.

- [ ] **Step 8: Run generator, catalog, water-sort, and production-contract tests**

Expected: all PASS; generation completes within a practical offline build budget and never executes from Cocos runtime.

- [ ] **Step 9: Add `generate:levels` and `check:levels` scripts and commit**

```powershell
git add wechat-game/tools wechat-game/assets/scripts/core/level-data.generated.ts wechat-game/assets/scripts/core/level-catalog.ts wechat-game/assets/scripts/core/level-generation-report.json wechat-game/tests wechat-game/package.json
git commit -m "feat: generate and publish first chapter levels"
```

---

### Task 4: Level-bound sessions and completion rules

**Files:**
- Modify: `wechat-game/assets/scripts/core/game-session.ts`
- Modify: `wechat-game/tests/game-session.test.ts`
- Create: `wechat-game/tests/level-completion.test.ts`

**Interfaces:**
- Consumes: `LevelConfig` and catalog entries.
- Produces: `createGameSession(level: LevelConfig, game?: GameState)`, `GameSession.levelId`, `GameSession.initialState`, `GameSession.levelComplete`, and `isSessionComplete(session)`.

- [ ] **Step 1: Write failing tests for level-bound restart and input lock**

```ts
test('restart restores the current level and preserves an earned reward bottle', () => {
  const level = getLevelConfig('level-004')!;
  const rewarded = grantRewardBottle(createGameSession(level)).session;
  const restarted = restartSession(rewarded).session;
  assert.equal(restarted.levelId, 'level-004');
  assert.equal(restarted.game.bottles[14].status, 'active');
  assert.equal(restarted.game.rewardBottleUsed, true);
});
```

Add one test for each completion rule and a test proving `pressBottle`, undo, restart, and reward inputs are blocked while `levelComplete` is true except for explicit scene navigation.

- [ ] **Step 2: Run the focused tests and verify RED**

Expected: signature/type failures because sessions do not carry a level.

- [ ] **Step 3: Implement explicit level ownership and completion transitions**

Keep results immutable. Set the first-valid-pour completion flag after the valid result is produced; set first-bottle completion only after `completePendingBottles`; set all-colors completion after the configured target count has vanished. `restartSession` rebuilds the current initial state and reapplies only the earned reward bottle.

- [ ] **Step 4: Update all existing session call sites and tests**

Pass `DEMO_LEVEL_CONFIG` where old tests relied on the default. Do not retain a hidden level-12 default in production code.

- [ ] **Step 5: Run session, completion, and water-sort tests and commit**

```powershell
git add wechat-game/assets/scripts/core/game-session.ts wechat-game/tests/game-session.test.ts wechat-game/tests/level-completion.test.ts
git commit -m "feat: bind sessions to level completion rules"
```

---

### Task 5: Global progress and versioned save schemas

**Files:**
- Create: `wechat-game/assets/scripts/core/level-progress.ts`
- Modify: `wechat-game/assets/scripts/core/save-schema.ts`
- Create: `wechat-game/tests/level-progress.test.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`
- Modify: `shared-contracts/progress.schema.json`

**Interfaces:**
- Produces: `PlayerProgress`, `createDefaultProgress()`, `isLevelUnlocked(progress, id)`, `selectCurrentLevel(progress, id)`, `completeLevel(progress, id, moves)`, `mergePlayerProgress(local, remote)`, snapshot schema version 2, and progress schema version 2.

```ts
export interface PlayerProgress {
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly currentLevel: string;
  readonly highestUnlockedLevel: string;
  readonly completedLevels: readonly string[];
  readonly bestMoves: Readonly<Record<string, number>>;
  readonly configVersion: string;
}
```

- [ ] **Step 1: Write failing progress tests**

Cover new-player defaults, sequential unlock, idempotent replay, lower best-move retention, selecting an old level without lowering unlock, locked selection rejection, merge union/min/max behavior, and the level-15 cap.

- [ ] **Step 2: Run focused tests and verify RED**

- [ ] **Step 3: Implement pure progress rules**

Reject unknown IDs through catalog lookup. `completeLevel` increments revision once, adds the completed ID once, keeps the lower positive move count, unlocks at most the next published level, and moves `currentLevel` to that next level when it exists.

- [ ] **Step 4: Upgrade snapshot decoding**

Validate exact level ID/config pair at the platform boundary, bottle count 15, layer capacity, selected index range, history states, and non-negative timestamps. Keep the decoder non-throwing. Do not silently reinterpret schema version 1 as version 2; Task 6 owns migration.

- [ ] **Step 5: Update the JSON schema and contract tests**

Add required `highestUnlockedLevel` with `^level-[0-9]{3}$`, preserve `additionalProperties: false`, and verify the JSON file matches TypeScript field names.

- [ ] **Step 6: Run progress and production-contract tests and commit**

```powershell
git add wechat-game/assets/scripts/core/level-progress.ts wechat-game/assets/scripts/core/save-schema.ts wechat-game/tests/level-progress.test.ts wechat-game/tests/production-contracts.test.ts shared-contracts/progress.schema.json
git commit -m "feat: add multi-level progress contracts"
```

---

### Task 6: Per-level storage and legacy level-12 migration

**Files:**
- Modify: `wechat-game/assets/scripts/platform/LocalProgressStore.ts`
- Create: `wechat-game/assets/scripts/platform/storage-port.ts`
- Create: `wechat-game/tests/local-progress-store.test.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`

**Interfaces:**
- Consumes: Task 4 sessions, Task 5 schemas, and catalog lookup.
- Produces: `loadProgress()`, `saveProgress(progress)`, `loadSession(level)`, `saveSession(session)`, `clearSession(levelId)`, and idempotent `migrateLegacyLevel12()`.

- [ ] **Step 1: Extract an injectable storage port and write failing tests**

```ts
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

Use an in-memory fake in Node tests. Cover per-level isolation, config mismatch fallback, corrupt snapshot fallback, stable session restore, write-before-complete behavior, and sound preference preservation.

- [ ] **Step 2: Add failing migration tests**

Test valid old `witch-water-sort:level-012:v1`, invalid old JSON, selected bottle/history preservation, `currentLevel = highestUnlockedLevel = level-012`, empty completed/best records, idempotent marker, and old-key retention.

- [ ] **Step 3: Run focused tests and verify RED**

- [ ] **Step 4: Implement parameterized keys and migration**

Use keys `witch-water-sort:progress:v2`, `witch-water-sort:session:<levelId>:v2`, and `witch-water-sort:migration:level-012:v2`. Default to WeChat storage when available, otherwise `sys.localStorage`; tests pass an explicit fake without importing Cocos from core.

- [ ] **Step 5: Run store, session, progress, and production-contract tests and commit**

```powershell
git add wechat-game/assets/scripts/platform/LocalProgressStore.ts wechat-game/assets/scripts/platform/storage-port.ts wechat-game/tests/local-progress-store.test.ts wechat-game/tests/production-contracts.test.ts
git commit -m "feat: persist and migrate per-level sessions"
```

---

### Task 7: Scene flow and presentation layout contracts

**Files:**
- Modify: `wechat-game/assets/scripts/core/scene-flow.ts`
- Modify: `wechat-game/tests/scene-flow.test.ts`
- Modify: `wechat-game/assets/scripts/presentation/presentation-layout.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`

**Interfaces:**
- Produces: scenes `home | levelSelect | level | levelComplete`, `openLevelSelect`, `enterSelectedLevel`, `showLevelComplete`, `returnHome`, `LEVEL_SELECT_LAYOUT`, and `LEVEL_COMPLETE_LAYOUT`.

- [ ] **Step 1: Write failing scene-flow tests**

Verify home → selector → unlocked level → complete overlay → next level, selector rejection for locked IDs, settings preservation across all scenes, and level 15 returning to selector without a next ID.

- [ ] **Step 2: Write failing layout tests**

Assert a five-column by three-row grid fits inside 393×852 safe bounds, all grid buttons remain square, home retains its accepted hierarchy without a progress card, and result buttons use sliced wide bases.

- [ ] **Step 3: Run tests and verify RED**

- [ ] **Step 4: Implement pure scene transitions and immutable layout constants**

Scene transitions receive validated IDs/unlock results from core progress rather than reading storage. Keep settings state shared. Use existing raster button geometry helpers for selector and result buttons.

- [ ] **Step 5: Run scene and layout tests and commit**

```powershell
git add wechat-game/assets/scripts/core/scene-flow.ts wechat-game/tests/scene-flow.test.ts wechat-game/assets/scripts/presentation/presentation-layout.ts wechat-game/tests/presentation-layout.test.ts
git commit -m "feat: define level selection and completion scenes"
```

---

### Task 8: Cocos home, selector, dynamic level, and completion presentation

**Files:**
- Modify: `wechat-game/assets/scripts/presentation/ProductionBootstrap.ts`
- Modify: `wechat-game/tests/production-contracts.test.ts`
- Modify: `wechat-game/tests/presentation-layout.test.ts`

**Interfaces:**
- Consumes: catalog, progress/store APIs, Task 7 flow/layouts.
- Produces: dynamic home copy, five-by-three selector, selected-level loading, completion persistence, next-level navigation, and chapter-complete UI.

- [ ] **Step 1: Add failing source and layout contract tests**

Require all hard-coded `level-012`, `第 12 关`, seed `12`, and fixed `魔药 8` usages in `ProductionBootstrap.ts` to be replaced by current config fields. Assert selector states map completed/current/unlocked/locked to gold/highlight/purple/disabled artwork.

- [ ] **Step 2: Run presentation contracts and verify RED**

- [ ] **Step 3: Split focused rendering helpers before adding behavior**

Keep `ProductionBootstrap` as coordinator; extract private or focused helper methods for `renderLevelSelect`, `renderLevelComplete`, `switchLevel`, and `persistCompletion`. Do not introduce a second Cocos scene asset; preserve the single boot scene and render surfaces as today.

- [ ] **Step 4: Implement dynamic home and selector**

Home continue uses `progress.currentLevel`. Selector saves the stable current session before switching, rejects disabled buttons, loads valid saved sessions, and shows current/completed/unlocked states using existing assets.

- [ ] **Step 5: Implement completion ordering**

After final required animation: save global completion synchronously, clear the per-level snapshot, set the flow to `levelComplete`, then render. Only after local success call asynchronous cloud telemetry/sync. If local save throws, keep the board locked and show `进度保存失败，请重试` with a retry action.

- [ ] **Step 6: Parameterize reward claims and all presentation seeds**

Use `session.levelId` in claim IDs and reward calls, and `level.presentationSeed` in `bottlePlacement`. Preserve ad busy/offline/error messages.

- [ ] **Step 7: Run all WeChat Node tests and commit**

```powershell
git add wechat-game/assets/scripts/presentation/ProductionBootstrap.ts wechat-game/tests/production-contracts.test.ts wechat-game/tests/presentation-layout.test.ts
git commit -m "feat: present first chapter selection and results"
```

---

### Task 9: CloudBase progress, rewards, telemetry, and client sync

**Files:**
- Modify: `cloudbase/src/domain.mjs`
- Modify: `cloudbase/tests/domain.test.mjs`
- Modify: `cloudbase/functions/_shared/runtime.js`
- Regenerate: `cloudbase/functions/*/_shared/runtime.js`
- Modify: `cloudbase/functions/bootstrap/index.js`
- Modify: `cloudbase/functions/syncProgress/index.js`
- Modify: `wechat-game/assets/scripts/platform/WeChatPlatform.ts`
- Create: `wechat-game/assets/scripts/platform/progress-sync.ts`
- Create: `wechat-game/tests/progress-sync.test.ts`

**Interfaces:**
- Produces: CloudBase v2 progress merge, published-level reward validation, `ProgressSyncPort.sync(progress)`, `submitLevelResult(result)`, and offline no-op/retry behavior.

- [ ] **Step 1: Write failing CloudBase tests**

Update defaults to level 1 with `highestUnlockedLevel`. Test maximum unlocked merge capped at level 15, current-level validation, completed union, lower best moves, reward acceptance for 1 and 15, rejection for 16, and identity stripping.

- [ ] **Step 2: Write failing client sync coordinator tests**

Test offline skip, concurrent-call coalescing, remote validation, legal merge, retry after failure, and that cloud failure never rolls back local progress.

- [ ] **Step 3: Run CloudBase and client focused tests and verify RED**

- [ ] **Step 4: Implement domain/runtime validation and prepare functions**

Use a shared published range `1..15` for this release. `highestUnlockedLevel` takes numeric maximum after validation. `currentLevel` must not exceed the merged highest unlocked level. Run `cloudbase/tools/prepare-functions.mjs` and verify all five copied runtimes match the source hash.

- [ ] **Step 5: Implement WeChat sync ports**

When `wx.cloud` is unavailable, return an offline result without mutation. On startup/foreground/completion, submit the local progress; decode and merge only validated remote fields. Continue deriving OPENID exclusively inside cloud functions.

- [ ] **Step 6: Run CloudBase, progress-sync, rewarded-bottle, and full WeChat tests**

Expected: all existing and new tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add cloudbase shared-contracts wechat-game/assets/scripts/platform wechat-game/tests/progress-sync.test.ts
git commit -m "feat: sync first chapter progress with CloudBase"
```

---

### Task 10: Full verification, Cocos import, documentation, and push

**Files:**
- Modify: `wechat-game/README.md`
- Modify: `wechat-game/AGENTS.md` only if implementation establishes durable new invariants not already recorded in the approved spec.
- Retain: Cocos-generated `.meta` files for all newly imported assets/scripts.

**Interfaces:**
- Consumes: every earlier task.
- Produces: reproducible verification evidence, clean repository state, and pushed GitHub branch.

- [ ] **Step 1: Run deterministic level check**

```powershell
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --experimental-strip-types tools/generate-levels.ts --check
```

Expected: exact generated-output match.

- [ ] **Step 2: Run all WeChat tests**

```powershell
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --experimental-strip-types --test tests/*.test.ts
```

Expected: zero failures; count exceeds the original 36.

- [ ] **Step 3: Run all CloudBase tests**

```powershell
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/*.test.mjs
```

Expected: zero failures; count exceeds the original 4.

- [ ] **Step 4: Run protected React prototype checks without changing its runtime**

Use the bundled `pnpm.cmd` in `prototype/` to run `check:runtime` and existing non-Playwright unit tests. The production work must not alter protected prototype runtime hashes.

- [ ] **Step 5: Open in Cocos Creator 3.8.8 and retain generated metadata**

Verify the project imports without TypeScript/component errors. Retain `.meta` files generated for new scripts. Do not claim this step passed if Cocos Creator cannot be opened in the environment.

- [ ] **Step 6: Exercise the acceptance path in Cocos Preview**

Check: new player level 1, level-1 tutorial completion, level-2 bottle completion, selector lock states, switching and resuming two levels, legacy level-12 restore, reward then restart preservation, ordinary all-color completion, next-level unlock, level-15 chapter completion, settings on every scene, offline ordinary save, and online reward failure messaging.

- [ ] **Step 7: Update README with commands and data ownership**

Document `generate:levels`, `check:levels`, progress/session storage keys, legacy migration, and Cocos verification steps. Do not include environment IDs or ad unit IDs.

- [ ] **Step 8: Run final clean verification and inspect Git state**

Repeat Steps 1–4 after documentation changes. Run `git status --short`; only intended source/docs/meta changes may remain.

- [ ] **Step 9: Commit final verification artifacts and push**

```powershell
git add wechat-game cloudbase shared-contracts docs
git commit -m "docs: document first chapter workflow"
git push origin main
```

Expected: `main` tracks `origin/main`, push succeeds without force, and `git status --short --branch` reports no uncommitted files.

---

## Plan Self-Review

- Spec coverage: Tasks 1–3 cover contracts, deterministic generation, solvability, scoring, catalog, and level-12 compatibility; Tasks 4–6 cover completion, progress, snapshots, reward restart semantics, and migration; Tasks 7–8 cover scene/UI behavior; Task 9 covers shared/cloud boundaries; Task 10 covers all verification and handoff requirements.
- Placeholder scan: no `TBD`, `TODO`, “implement later”, or unspecified edge-case steps remain.
- Type consistency: `LevelConfig`, `CompletionRule`, `PlayerProgress`, storage APIs, scene names, and sync interfaces are introduced once and consumed under the same names in later tasks.
