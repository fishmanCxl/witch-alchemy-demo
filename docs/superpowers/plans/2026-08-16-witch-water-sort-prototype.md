# Witch Alchemy Water Sort Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable mobile core-level prototype that validates bottle boundaries, legal water-sort moves, witch reactions, rewarded empty-bottle simulation, and completed-potion fly-away removal.

**Architecture:** Preserve the Product Design mobile runtime and implement app-owned UI only in `src/Prototype.tsx` and `src/prototype.css`. Put deterministic puzzle rules in a framework-free ES module so Node's built-in test runner and React use the same code. Keep art in `public/assets/game/`, while the UI owns animation timing and the engine owns legal-state transitions.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Node built-in test runner, Product Design mobile-app runtime, generated PNG game art.

## Global Constraints

- Target app viewport is 393 × 852 CSS pixels inside the protected mobile runtime.
- Preserve `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `src/mobile/`, device assets, Vite config, Worker files, and runtime lock.
- Use a maximum 5 × 3 board with slot 15 reserved for the one-time rewarded empty bottle.
- A bottle holds exactly four layers; only a contiguous same-color top run may pour into an empty target or matching top color.
- Selecting or pouring triggers the casting witch; one second without input returns the witch to idle.
- A four-layer single-color bottle seals, celebrates, flies away, and leaves an inactive non-reusable slot without reflowing neighboring bottles.
- The prototype simulates the rewarded-ad completion locally and never calls a real ad SDK.
- The workspace is a dedicated non-Git project, so verification checkpoints replace commit steps.
- Dynamic liquid fills are intentionally code-native solid-color layers because their height and color must track game state; the bottle, character, and backdrop remain generated raster art.

---

### Task 1: Deterministic water-sort engine

**Files:**
- Create: `prototype/tests/game-engine.test.mjs`
- Create: `prototype/src/game/engine.mjs`
- Create: `prototype/src/game/engine.d.ts`
- Modify: `prototype/package.json`

**Interfaces:**
- Produces: `CAPACITY`, `canPour(state, from, to)`, `pour(state, from, to)`, `isCompleteBottle(bottle)`, `vanishBottle(state, index)`, `addRewardBottle(state)`, and `createDemoState()`.
- `GameState` contains `bottles`, `rewardBottleUsed`, and `moves`; bottle layers are ordered bottom-to-top.

- [ ] **Step 1: Add failing legal-move tests**

```js
test('pours only the contiguous matching top run', () => {
  const state = stateOf([['violet', 'rose', 'rose'], ['rose']]);
  const result = pour(state, 0, 1);
  assert.deepEqual(result.state.bottles[0].layers, ['violet']);
  assert.deepEqual(result.state.bottles[1].layers, ['rose', 'rose', 'rose']);
  assert.equal(result.moved, 2);
});

test('rejects a target with a different top color', () => {
  const state = stateOf([['rose'], ['amber']]);
  assert.equal(canPour(state, 0, 1), false);
  assert.equal(pour(state, 0, 1).moved, 0);
});
```

- [ ] **Step 2: Run the engine test and confirm RED**

Run: `node --test tests/game-engine.test.mjs`

Expected: FAIL because `src/game/engine.mjs` does not exist.

- [ ] **Step 3: Implement the minimum legal-pour engine**

```js
export const CAPACITY = 4;

export function canPour(state, from, to) {
  const source = state.bottles[from];
  const target = state.bottles[to];
  if (!source || !target || from === to || source.status !== 'active' || target.status !== 'active') return false;
  if (source.layers.length === 0 || target.layers.length >= CAPACITY) return false;
  const color = source.layers.at(-1);
  return target.layers.length === 0 || target.layers.at(-1) === color;
}
```

- [ ] **Step 4: Run the test and confirm GREEN**

Run: `node --test tests/game-engine.test.mjs`

Expected: all legal-move tests PASS.

- [ ] **Step 5: Add failing completion, vanish, and reward-slot tests**

```js
test('marks a four-layer single-color target complete', () => {
  const result = pour(stateOf([['rose'], ['rose', 'rose', 'rose']]), 0, 1);
  assert.deepEqual(result.completed, [1]);
});

test('vanishing a completed bottle makes its slot inactive', () => {
  const vanished = vanishBottle(stateOf([[], ['rose', 'rose', 'rose', 'rose']]), 1);
  assert.equal(vanished.bottles[1].status, 'vanished');
  assert.deepEqual(vanished.bottles[1].layers, []);
});

test('reward bottle can activate slot fifteen only once', () => {
  const first = addRewardBottle(createDemoState());
  const second = addRewardBottle(first);
  assert.equal(first.bottles[14].status, 'active');
  assert.equal(second, first);
});
```

- [ ] **Step 6: Run completion tests and confirm RED**

Run: `node --test tests/game-engine.test.mjs`

Expected: FAIL because completion and reward behavior are not implemented.

- [ ] **Step 7: Implement completion, vanish, reward, and demo state**

```js
export function isCompleteBottle(bottle) {
  return bottle.status === 'active' && bottle.layers.length === CAPACITY && bottle.layers.every((layer) => layer === bottle.layers[0]);
}

export function vanishBottle(state, index) {
  return {
    ...state,
    bottles: state.bottles.map((bottle, bottleIndex) => bottleIndex === index ? { layers: [], status: 'vanished' } : bottle),
  };
}
```

- [ ] **Step 8: Run all engine tests**

Run: `node --test tests/game-engine.test.mjs`

Expected: all tests PASS with no warnings.

### Task 2: Production game assets and board design system

**Files:**
- Modify: `prototype/public/assets/game/alchemy-lab-bg.png`
- Modify: `prototype/public/assets/game/witch-idle.png`
- Modify: `prototype/public/assets/game/witch-cast.png`
- Modify: `prototype/public/assets/game/witch-celebrate.png`
- Modify: `prototype/public/assets/game/bottle-frame.png`
- Modify: `prototype/AGENTS.md`
- Modify: `prototype/src/prototype.css`

**Interfaces:**
- Consumes: the five generated source images already copied under `public/assets/game/`.
- Produces: optimized transparent sprite assets plus reusable CSS classes `.alchemy-screen`, `.witch-stage`, `.bottle-grid`, `.bottle-slot`, `.potion-bottle`, `.liquid-layer`, and `.game-controls`.

- [ ] **Step 1: Remove checkerboard backgrounds and optimize assets**

Use Pillow to convert near-white neutral checker pixels to alpha, crop transparent margins on character and bottle sprites, resize the background to 786 × 1704, and cap sprite height at 768 pixels. Preserve production copies in `public/assets/game/`.

- [ ] **Step 2: Verify asset dimensions and alpha**

Run a Pillow inspection that prints each image size, mode, and alpha extrema.

Expected: background is 786 × 1704 RGB; witch and bottle sprites are RGBA with alpha extrema `(0, 255)`.

- [ ] **Step 3: Record confirmed durable design decisions**

Append to `AGENTS.md`: dark alchemy workshop, 5 × 3 slot geometry, no bottle reflow, completed slot becomes inactive, witch has idle/cast/celebrate states, rewarded bottle uses slot 15.

- [ ] **Step 4: Implement board tokens and responsive geometry**

```css
.alchemy-screen {
  --slot-width: 64px;
  --slot-height: 112px;
  --bottle-width: 48px;
  --bottle-height: 104px;
  min-height: 100%;
  color: #fff8ee;
  background: #130b18 url('/assets/game/alchemy-lab-bg.png') center / cover no-repeat;
}

.bottle-grid {
  display: grid;
  grid-template-columns: repeat(5, var(--slot-width));
  grid-template-rows: repeat(3, var(--slot-height));
  justify-content: center;
  gap: 10px 8px;
}
```

- [ ] **Step 5: Check board-boundary arithmetic**

Verify that `5 × 64 + 4 × 8 = 352px`, leaving 41px inside a 393px screen, and that the three 112px rows plus two 10px gaps fit above the fixed control rail.

### Task 3: Interactive core level and witch choreography

**Files:**
- Modify: `prototype/src/Prototype.tsx`
- Modify: `prototype/src/prototype.css`

**Interfaces:**
- Consumes: engine functions from Task 1 and class/asset tokens from Task 2.
- Produces: source-target bottle interaction, legal/illegal feedback, undo, reset, reward bottle activation, witch state transitions, completion departure, and live move count.

- [ ] **Step 1: Compose the app-owned level surface**

```tsx
type WitchMood = 'idle' | 'cast' | 'celebrate' | 'oops';

function BottleView({ bottle, index, selected, departing, onPress }: BottleViewProps) {
  return (
    <button className="bottle-slot" onClick={() => onPress(index)} aria-label={`药瓶 ${index + 1}`}>
      <span className={`potion-bottle${selected ? ' is-selected' : ''}${departing ? ' is-departing' : ''}`}>
        <span className="liquid-stack" aria-hidden="true">
          {bottle.layers.map((color, layerIndex) => <span key={`${color}-${layerIndex}`} className="liquid-layer" style={{ backgroundColor: POTION_COLORS[color] }} />)}
        </span>
        <img src="/assets/game/bottle-frame.png" alt="" draggable={false} />
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Implement tap selection and pouring**

First tap stores the source index and changes the witch to `cast`; tapping the selected bottle cancels; tapping a target calls `pour`. Invalid moves shake both source and target while keeping the source selected. Valid moves push the previous state into history and clear selection.

- [ ] **Step 3: Implement completion departure**

For every returned completed index, set `departing[index] = true`, show `celebrate`, wait 780ms, call `vanishBottle`, then clear the departure flag. Keep the CSS grid slot present but non-interactive so neighboring bottles never reflow.

- [ ] **Step 4: Implement inactivity and character timing**

Every interaction clears the idle timer. Casting returns to idle after 650ms, invalid feedback after 700ms, and celebration after 1300ms. A final one-second inactivity timer always settles the character to idle.

- [ ] **Step 5: Implement the control rail**

Undo restores the last immutable state snapshot. Restart restores `createDemoState()`. Add Bottle sets a rewarded-ad toast, calls `addRewardBottle`, and disables itself after the first use.

- [ ] **Step 6: Respect reduced motion**

Under `prefers-reduced-motion: reduce`, disable wand, shake, float, sparkle, and fly-away keyframes while keeping instant state changes and visible selection borders.

### Task 4: Runtime, functional, and visual verification

**Files:**
- Create: `prototype/design-qa.md`
- Create: `prototype/artifacts/implementation-mobile-screen.png`
- Create: `prototype/artifacts/source-reference-normalized.png`

**Interfaces:**
- Consumes: the completed prototype and original reference image.
- Produces: passing runtime/build/tests and a fidelity ledger with final result `passed`.

- [ ] **Step 1: Run automated verification**

Run:

```powershell
node --test tests/game-engine.test.mjs
pnpm run check:runtime
pnpm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Start the local preview**

Run Vite on an available local port and keep it running for handoff.

- [ ] **Step 3: Capture a 1:1 app viewport**

Use the in-app Browser when available. If it is unavailable and the user has authorized the Playwright fallback, open a 1400 × 1200 browser viewport, confirm `[data-phone-screen]` measures 393 × 852, and capture the screen element only.

- [ ] **Step 4: Verify the core interaction path**

Test: select source bottle → witch casts → pour rose into three-rose target → target celebrates and flies away → original slot becomes inactive → wait one second → witch returns to idle → activate reward bottle → slot 15 appears → undo and reset remain functional. Confirm no console errors.

- [ ] **Step 5: Compare source and implementation together**

Normalize the 750px-wide reference to the 393px app viewport and inspect it together with the latest app capture. Check at least: 5-column boundaries, 3-row rhythm, transparent bottle readability, dark walnut palette, bottom control reachability, and witch/board separation.

- [ ] **Step 6: Write and pass `design-qa.md`**

Record source path, implementation capture, dimensions, viewport, state, comparison history, functional checks, above-the-fold copy diff, intentional dynamic-liquid deviation, and `final result: passed`. Fix every P0/P1/P2 issue before handoff.

