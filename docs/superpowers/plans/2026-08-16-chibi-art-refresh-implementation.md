# Chibi Art Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing playable witch water-sort level to the approved chibi storybook art system with frame-animated witch reactions, differentiated potion particles, deterministic irregular bottle placement, image-backed controls, and an animated image-backed message panel.

**Architecture:** Preserve the existing framework-free water-sort engine and protected Product Design mobile runtime. Add a pure presentation module for deterministic poses, animation timing, particle metadata, and message timing; React components consume those interfaces without deciding game legality. Store all generated art under a versioned `public/assets/game/chibi/` tree and validate dimensions, alpha, naming, and frame counts before integration.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Node built-in test runner, Product Design mobile-app runtime, Pillow image pipeline, built-in Image Gen, PNG sprite frames.

## Global Constraints

- The existing water-sort capacity, legal-pour rules, undo semantics, restart semantics, completion detection, bottle fly-away removal, and one-time rewarded slot 15 behavior must not change.
- Preserve `prototype/src/App.tsx`, `prototype/src/main.tsx`, `prototype/src/styles.css`, `prototype/src/mobile/`, device assets, Vite config, Worker files, and runtime lock.
- The target app content viewport is 393 × 852 CSS pixels on iPhone and must also fit 427 × 952 on Pixel 10.
- The approved art direction is chibi 2D storybook alchemy: approximately three-head-tall witch proportions, rounded silhouettes, clean thick outlines, deep-purple ambient light, and warm-orange candlelight.
- Witch animation uses 6 frames for idle and invalid feedback, and 8 frames for casting and completed-potion celebration, with one stable foot anchor across every frame.
- Potion readability uses high-separation hues plus one unique particle language per potion color.
- Bottle placement remains inside the fixed 5 × 3 safety grid and uses deterministic x offset within ±5px, y offset within ±10px, and rotation within ±2 degrees.
- Image-backed UI assets contain no text. Chinese labels, focus semantics, button elements, and live-region messages remain code-native.
- The project directory is not a Git repository; every task ends with a test/build/artifact checkpoint instead of a commit.
- Dynamic liquid layer height and color remain code-native because they encode live puzzle state; every decorative or illustrative visual is a raster asset.

---

## File Structure

### New files

- `prototype/public/assets/game/chibi/background/alchemy-room.png` — approved Q-style room background.
- `prototype/public/assets/game/chibi/character/{idle,cast,celebrate,oops}/*.png` — normalized witch frame sequences.
- `prototype/public/assets/game/chibi/items/bottle-frame.png` — rounded Q-style bottle overlay.
- `prototype/public/assets/game/chibi/effects/*.png` — eight potion particle motifs and completion burst.
- `prototype/public/assets/game/chibi/ui/*.png` — button bases, control icons, add badge, and message panel.
- `prototype/public/assets/game/chibi/assets-manifest.json` — dimensions, frame order, roles, and public URLs.
- `prototype/scripts/prepare-chibi-assets.py` — alpha cleanup, crop, resize, frame normalization, and manifest generation.
- `prototype/scripts/validate-chibi-assets.py` — strict asset validation command.
- `prototype/src/game/presentation.mjs` — deterministic presentation rules shared by Node tests and React.
- `prototype/src/game/presentation.d.mts` — TypeScript contracts for the presentation module.
- `prototype/tests/presentation.test.mjs` — pose, frame, interrupt, particle, and message timing tests.
- `prototype/src/components/WitchAnimator.tsx` — frame-sequence renderer.
- `prototype/src/components/PotionParticles.tsx` — particle motif renderer for liquid layers.
- `prototype/src/components/BottleView.tsx` — bottle UI with image frame, particles, and deterministic pose.
- `prototype/src/components/ControlButton.tsx` — image-backed button states.
- `prototype/src/components/GameMessage.tsx` — single-panel message lifecycle.

### Modified files

- `prototype/src/Prototype.tsx` — screen composition and interaction-to-presentation events.
- `prototype/src/prototype.css` — approved layout, sprite, particle, UI, and reduced-motion styling.
- `prototype/package.json` — add presentation and asset validation scripts without changing runtime dependencies.
- `prototype/AGENTS.md` — already contains the approved durable design decisions; change only if implementation discovers a confirmed correction.
- `prototype/design-qa.md` — replace the blocked first-pass report with the final chibi comparison history.

---

### Task 1: Generate, normalize, and validate the Q-style asset set

**Files:**
- Create: `prototype/scripts/prepare-chibi-assets.py`
- Create: `prototype/scripts/validate-chibi-assets.py`
- Create: `prototype/public/assets/game/chibi/assets-manifest.json`
- Create: all PNG files under `prototype/public/assets/game/chibi/`
- Modify: `prototype/package.json`

**Interfaces:**
- Consumes: the two approved reference images and the fixed `witch_01` character description from the design spec.
- Produces: public asset URLs and a manifest with `background`, `witch`, `bottle`, `particles`, and `ui` keys.
- Every character frame must use a transparent 512 × 512 canvas, foot anchor `(256, 470)`, and 8% transparent safe padding.

- [ ] **Step 1: Write an asset validator that fails while the chibi asset tree is absent**

```python
EXPECTED_FRAMES = {"idle": 6, "cast": 8, "celebrate": 8, "oops": 6}
EXPECTED_PARTICLES = {
    "rose-heart", "violet-star", "amber-spark", "cyan-bubble",
    "mint-leaf", "blue-snow", "gold-dust", "lilac-moon",
}

def require_rgba(path: Path, size: tuple[int, int]) -> None:
    image = Image.open(path)
    assert image.mode == "RGBA", f"{path} must be RGBA"
    assert image.size == size, f"{path} expected {size}, got {image.size}"
    assert image.getchannel("A").getextrema() == (0, 255), f"{path} needs real alpha"
```

The validator must also reject filenames outside lowercase kebab-case, missing UI state variants, mismatched character frame sizes, and a background not sized 786 × 1704.

- [ ] **Step 2: Run the validator and confirm RED**

Run:

```powershell
$pythonRuntime = 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $pythonRuntime scripts\validate-chibi-assets.py
```

Expected: FAIL with `missing public/assets/game/chibi/assets-manifest.json`.

- [ ] **Step 3: Copy and normalize the approved room background**

Use the first attached image as source visual truth. Resize with aspect-preserving crop to 786 × 1704 RGB and save it as:

```text
prototype/public/assets/game/chibi/background/alchemy-room.png
```

Do not repaint the central desk, add UI, add a witch, or bake text into the background.

- [ ] **Step 4: Generate the fixed `witch_01` identity master**

Use built-in Image Gen with the approved background image as a style reference and this exact production prompt:

```text
Use case: stylized-concept
Asset type: transparent chibi mobile-game character identity master
Primary request: one fixed young friendly witch, approximately three heads tall, large amber eyes, rosy cheeks, short reddish-brown curls, deep-purple bent pointed hat with brown leather band and gold buckle, purple-black cape and dress with restrained gold trim, brown ankle boots, cross-body potion satchel with one teal vial, slender brown wand with tiny gold runes
Style: polished 2D chibi storybook mobile-game art, rounded silhouette, clean thick outline, soft cel shading
Lighting: warm orange candle rim from the right, soft violet ambient light from the left
Composition: full body, front three-quarter view, feet aligned, generous transparent padding
Constraints: exactly one character; genuinely transparent background; no platform; no text; no watermark; no extra limbs; no outfit variation; no realistic anatomy; no 3D render
```

Save the selected master non-destructively under the workspace as `prototype/artifacts/witch-identity-master.png`.

- [ ] **Step 5: Generate four frame strips from the identity master**

Issue one built-in Image Gen call per action, attaching the identity master and requiring identical character design, canvas scale, light direction, and foot anchor:

```text
idle: 6 sequential poses — inhale, blink half, blink closed, exhale, hat-tip sway, return
cast: 8 sequential poses — ready, raise wand, wind-up, swing, magic arc peak, follow-through, settle, ready
celebrate: 8 sequential poses — surprise, smile, wand up, small jump, star burst, open hand, land, proud idle
oops: 6 sequential poses — stop, look down, tilt head, small wand shake, apologetic smile, return
```

Each call must request a single horizontal strip on a flat removable neutral background, equal-width cells, no labels, no separators, no cropped hat or feet, and no character redesign.

- [ ] **Step 6: Implement deterministic strip extraction and frame normalization**

`prepare-chibi-assets.py` must:

1. remove the neutral strip background to real alpha;
2. split each strip into exactly the required frame count;
3. place every subject on a 512 × 512 transparent canvas;
4. align foot anchors to `(256, 470)`;
5. save `idle-00.png` through `idle-05.png`, `cast-00.png` through `cast-07.png`, `celebrate-00.png` through `celebrate-07.png`, and `oops-00.png` through `oops-05.png`;
6. keep every visible pixel at least 24px from the canvas edge.

- [ ] **Step 7: Generate the bottle, particle, and UI art assets**

Use the approved references and these exact roles:

```text
bottle-frame.png: one empty rounded front-facing chibi glass sorting bottle, thick dark-purple outline, large white highlight, no cork, no liquid, transparent background
particle-rose-heart.png: one small pink heart-shaped magic mote
particle-violet-star.png: one small violet four-point star mote
particle-amber-spark.png: one small orange fire-spark mote
particle-cyan-bubble.png: one small cyan round bubble mote
particle-mint-leaf.png: one small green leaf mote
particle-blue-snow.png: one small blue six-point snow crystal mote
particle-gold-dust.png: one small gold circular dust mote
particle-lilac-moon.png: one small lilac crescent mote
completion-burst.png: compact purple-blue-gold success burst, transparent center, no text
button-purple-{normal,pressed,disabled}.png: text-free rounded square Q-style purple-wood control base with gold-brown trim
button-gold-{normal,pressed,disabled}.png: text-free rounded square warm-gold reward base with brown trim
icon-undo.png: thick white undo arrow with warm-brown outline
icon-restart.png: thick white restart arrow with warm-brown outline
icon-add-bottle.png: thick white bottle-plus icon with warm-brown outline
badge-plus.png: small bright-green circular plus badge with dark outline
message-panel.png: text-free deep-purple wood-and-gold 9-slice-compatible panel, clean low-texture center, restrained corner stars and vines
```

All non-background assets must be centered RGBA PNGs with real alpha, no text, no watermark, and no checkerboard pixels.

- [ ] **Step 8: Generate `assets-manifest.json`**

```json
{
  "background": "/assets/game/chibi/background/alchemy-room.png",
  "witch": {
    "idle": { "frames": 6, "durationMs": 900, "loop": true, "pattern": "/assets/game/chibi/character/idle/idle-{index}.png" },
    "cast": { "frames": 8, "durationMs": 520, "loop": false, "pattern": "/assets/game/chibi/character/cast/cast-{index}.png" },
    "celebrate": { "frames": 8, "durationMs": 780, "loop": false, "pattern": "/assets/game/chibi/character/celebrate/celebrate-{index}.png" },
    "oops": { "frames": 6, "durationMs": 600, "loop": false, "pattern": "/assets/game/chibi/character/oops/oops-{index}.png" }
  },
  "bottle": "/assets/game/chibi/items/bottle-frame.png",
  "particles": {
    "rose": "/assets/game/chibi/effects/particle-rose-heart.png",
    "violet": "/assets/game/chibi/effects/particle-violet-star.png",
    "amber": "/assets/game/chibi/effects/particle-amber-spark.png",
    "cyan": "/assets/game/chibi/effects/particle-cyan-bubble.png",
    "mint": "/assets/game/chibi/effects/particle-mint-leaf.png",
    "blue": "/assets/game/chibi/effects/particle-blue-snow.png",
    "gold": "/assets/game/chibi/effects/particle-gold-dust.png",
    "lilac": "/assets/game/chibi/effects/particle-lilac-moon.png"
  }
}
```

Add `ui.buttons`, `ui.icons`, `ui.badgePlus`, `ui.messagePanel`, and `effects.completionBurst` using the exact public paths created in Step 7.

- [ ] **Step 9: Run asset validation and confirm GREEN**

Run:

```powershell
$pythonRuntime = 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $pythonRuntime scripts\validate-chibi-assets.py
```

Expected: `validated 28 witch frames, 8 particle motifs, 11 UI assets, 1 completion effect, 1 bottle, 1 background` and exit 0.

### Task 2: Deterministic presentation rules

**Files:**
- Create: `prototype/src/game/presentation.mjs`
- Create: `prototype/src/game/presentation.d.mts`
- Create: `prototype/tests/presentation.test.mjs`
- Modify: `prototype/package.json`

**Interfaces:**
- Produces: `POTION_VISUALS`, `WITCH_ANIMATIONS`, `seededBottlePose(levelSeed, slotIndex)`, `createWitchPlayback(mood, startedAt)`, `witchFrameAt(playback, now)`, `canInterruptWitch(playback, nextMood, now)`, `createMessagePlayback(id, text, startedAt)`, `replaceMessagePlayback(previous, id, text, startedAt)`, `messagePhase(startedAt, now, initialPhase)`, and `particleSeeds(levelSeed, slotIndex, layerIndex)`.
- Consumes no DOM, React, timer, or mutable global state.

- [ ] **Step 1: Write failing deterministic pose tests**

```js
test('seeded bottle pose is stable and stays inside approved bounds', () => {
  const first = seededBottlePose(12, 4);
  const second = seededBottlePose(12, 4);
  assert.deepEqual(first, second);
  assert.ok(first.x >= -5 && first.x <= 5);
  assert.ok(first.y >= -10 && first.y <= 10);
  assert.ok(first.rotate >= -2 && first.rotate <= 2);
});

test('visible neighboring slots receive varied poses', () => {
  const poses = Array.from({ length: 11 }, (_, index) => seededBottlePose(12, index));
  assert.ok(new Set(poses.map((pose) => `${pose.x},${pose.y},${pose.rotate}`)).size >= 8);
});
```

- [ ] **Step 2: Run the presentation test and confirm RED**

Run: `node --test tests/presentation.test.mjs`

Expected: FAIL because `src/game/presentation.mjs` does not exist.

- [ ] **Step 3: Implement a stable integer hash and pose mapping**

```js
function hash32(value) {
  let hash = value | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function seededBottlePose(levelSeed, slotIndex) {
  const hash = hash32(levelSeed * 131 + slotIndex * 977);
  return {
    x: (hash % 11) - 5,
    y: ((hash >>> 8) % 21) - 10,
    rotate: (((hash >>> 16) % 41) - 20) / 10,
  };
}
```

- [ ] **Step 4: Run pose tests and confirm GREEN**

Run: `node --test tests/presentation.test.mjs`

Expected: pose tests PASS.

- [ ] **Step 5: Write failing animation, particle, and message timing tests**

```js
test('cast uses eight frames and finishes at 520ms', () => {
  const playback = createWitchPlayback('cast', 1000);
  assert.equal(witchFrameAt(playback, 1000).index, 0);
  assert.equal(witchFrameAt(playback, 1519).index, 7);
  assert.equal(witchFrameAt(playback, 1520).done, true);
});

test('celebration cannot be interrupted before frame six', () => {
  const playback = createWitchPlayback('celebrate', 0);
  assert.equal(canInterruptWitch(playback, 'cast', 584), false);
  assert.equal(canInterruptWitch(playback, 'cast', 585), true);
});

test('message phases use 180ms enter, 1400ms hold, and 240ms exit', () => {
  assert.equal(messagePhase(0, 0), 'enter');
  assert.equal(messagePhase(0, 180), 'hold');
  assert.equal(messagePhase(0, 1579), 'hold');
  assert.equal(messagePhase(0, 1580), 'exit');
  assert.equal(messagePhase(0, 1820), 'done');
});

test('a replacement message fades text for 120ms before restarting hold', () => {
  const first = createMessagePlayback(1, 'A', 0);
  const replaced = replaceMessagePlayback(first, 2, 'B', 600);
  assert.equal(replaced.phase, 'replace');
  assert.equal(messagePhase(replaced.startedAt, 719, replaced.phase), 'replace');
  assert.equal(messagePhase(replaced.startedAt, 720, replaced.phase), 'hold');
});
```

- [ ] **Step 6: Implement exact animation and message contracts**

```js
export const WITCH_ANIMATIONS = Object.freeze({
  idle: { frames: 6, durationMs: 900, loop: true },
  cast: { frames: 8, durationMs: 520, loop: false },
  celebrate: { frames: 8, durationMs: 780, loop: false, minInterruptMs: 585 },
  oops: { frames: 6, durationMs: 600, loop: false },
});

export function messagePhase(startedAt, now, initialPhase = 'enter') {
  const elapsed = Math.max(0, now - startedAt);
  if (initialPhase === 'replace') {
    if (elapsed < 120) return 'replace';
    if (elapsed < 1520) return 'hold';
    if (elapsed < 1760) return 'exit';
    return 'done';
  }
  if (elapsed < 180) return 'enter';
  if (elapsed < 1580) return 'hold';
  if (elapsed < 1820) return 'exit';
  return 'done';
}
```

Define `createMessagePlayback` to return `{ id, text, startedAt, phase: 'enter' }` and `replaceMessagePlayback` to return the same shape with `phase: 'replace'`. Define `POTION_VISUALS` with the exact eight colors and particle URLs from the approved spec. `particleSeeds` must return two stable values between 0 and 1 for each visible liquid layer.

- [ ] **Step 7: Run presentation and existing engine tests**

Run:

```powershell
node --test tests\presentation.test.mjs
node --test tests\game-engine.test.mjs
```

Expected: all presentation tests and all 8 existing engine tests PASS.

### Task 3: Frame-animated witch component

**Files:**
- Create: `prototype/src/components/WitchAnimator.tsx`
- Modify: `prototype/src/game/presentation.mjs`
- Modify: `prototype/src/game/presentation.d.mts`
- Modify: `prototype/src/prototype.css`
- Test: `prototype/tests/presentation.test.mjs`

**Interfaces:**
- Consumes: `WitchMood`, `createWitchPlayback`, `witchFrameAt`, `canInterruptWitch`, manifest frame URLs.
- Produces: `witchFrameUrl(mood, index)` and `<WitchAnimator mood onSettled />` with one stable 174 × 182 CSS stage and no layout shift.

- [ ] **Step 1: Extend frame URL tests before component code**

```js
test('frame URL pads indices to two digits', () => {
  assert.equal(witchFrameUrl('idle', 0), '/assets/game/chibi/character/idle/idle-00.png');
  assert.equal(witchFrameUrl('celebrate', 7), '/assets/game/chibi/character/celebrate/celebrate-07.png');
});
```

- [ ] **Step 2: Run the URL test and confirm RED**

Run: `node --test tests/presentation.test.mjs`

Expected: FAIL because `witchFrameUrl` is not exported.

- [ ] **Step 3: Implement `witchFrameUrl` and the component**

```tsx
export function WitchAnimator({ mood, onSettled }: Props) {
  const [playback, setPlayback] = useState(() => createWitchPlayback(mood, performance.now()));
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const now = performance.now();
    if (canInterruptWitch(playback, mood, now)) setPlayback(createWitchPlayback(mood, now));
  }, [mood]);

  useEffect(() => {
    let request = 0;
    const tick = (now: number) => {
      const result = witchFrameAt(playback, now);
      setFrame(result.index);
      if (result.done && playback.mood !== 'idle') onSettled();
      else request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [onSettled, playback]);

  return <img className="witch-frame" src={witchFrameUrl(playback.mood, frame)} alt="正在协助炼金的魔女" />;
}
```

Cache the last successfully loaded frame and use it when a subsequent frame returns an image error. Preload the current sequence on mood change.

- [ ] **Step 4: Add fixed stage and reduced-motion styling**

The stage remains 174 × 182 CSS pixels. All frame images use `object-fit: contain`, `object-position: 50% 100%`, and the same drop shadow. Under reduced motion, show frame 0 for idle and the last frame for non-idle states without a requestAnimationFrame loop.

- [ ] **Step 5: Run tests and Vite build**

Run:

```powershell
node --test tests\presentation.test.mjs
node node_modules\vite\bin\vite.js build
```

Expected: tests PASS and Vite transforms the component without TypeScript or module errors.

### Task 4: Potion particles and irregular bottle rendering

**Files:**
- Create: `prototype/src/components/PotionParticles.tsx`
- Create: `prototype/src/components/BottleView.tsx`
- Modify: `prototype/src/prototype.css`
- Test: `prototype/tests/presentation.test.mjs`

**Interfaces:**
- Consumes: `Bottle`, `POTION_VISUALS`, `particleSeeds`, `seededBottlePose`, selected/invalid/departing state.
- Produces: a 64 × 112 logical hit area and a posed 48 × 104 visual bottle whose visible outline never alters grid geometry.

- [ ] **Step 1: Add failing potion metadata tests**

```js
test('every potion has a unique color and particle asset', () => {
  const entries = Object.values(POTION_VISUALS);
  assert.equal(entries.length, 8);
  assert.equal(new Set(entries.map((entry) => entry.color)).size, 8);
  assert.equal(new Set(entries.map((entry) => entry.particleUrl)).size, 8);
});

test('particle seeds are stable and normalized', () => {
  const seeds = particleSeeds(12, 2, 3);
  assert.deepEqual(seeds, particleSeeds(12, 2, 3));
  assert.equal(seeds.length, 2);
  assert.ok(seeds.every((value) => value >= 0 && value <= 1));
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Expected: FAIL until `POTION_VISUALS` and `particleSeeds` are complete.

- [ ] **Step 3: Implement particle rendering with raster motifs**

```tsx
export function PotionParticles({ color, state, seeds }: Props) {
  const visual = POTION_VISUALS[color];
  return (
    <span className={`potion-particles is-${state}`} aria-hidden="true">
      {seeds.map((seed, index) => (
        <img
          key={index}
          src={visual.particleUrl}
          alt=""
          style={{ '--particle-x': `${18 + seed * 64}%`, '--particle-delay': `${-seed * 1.4}s` } as CSSProperties}
        />
      ))}
    </span>
  );
}
```

Render at most two particle images per visible layer. Use transform and opacity only; do not draw heart, star, bubble, leaf, snow, moon, or dust motifs in CSS.

- [ ] **Step 4: Implement deterministic bottle posing**

`BottleView` must apply the pose only to `.potion-bottle`, never to `.bottle-slot`:

```tsx
const pose = seededBottlePose(levelSeed, index);
const style = {
  '--pose-x': `${pose.x}px`,
  '--pose-y': `${pose.y}px`,
  '--pose-rotate': `${pose.rotate}deg`,
} as CSSProperties;
```

Selected lift is added after the base y offset. Invalid shake and departure animation must preserve the base pose. Inactive, reserved, and vanished slots keep their 64 × 112 grid footprint and render no bottle art.

- [ ] **Step 5: Add particle and departure CSS states**

- idle particles: 2.2s upward loop, low opacity;
- selected: 20% faster and 25% brighter;
- pouring: 520ms directional motion;
- complete: use `completion-burst.png` once before the existing 780ms fly-away;
- reduced motion: static particle images at 38% opacity and instant completion fade.

- [ ] **Step 6: Run presentation and engine tests**

Expected: all tests PASS and the engine file remains unchanged.

### Task 5: Image-backed buttons and animated message panel

**Files:**
- Create: `prototype/src/components/ControlButton.tsx`
- Create: `prototype/src/components/GameMessage.tsx`
- Modify: `prototype/src/game/presentation.mjs`
- Modify: `prototype/src/game/presentation.d.mts`
- Modify: `prototype/src/prototype.css`
- Test: `prototype/tests/presentation.test.mjs`

**Interfaces:**
- `ControlButton` consumes `variant: 'purple' | 'gold'`, `iconUrl`, `label`, `disabled`, and `onPress`.
- `GameMessage` consumes a single `message: { id: number; text: string }` and renders one image-backed live region.

- [ ] **Step 1: Add failing image-backed UI URL tests**

```js
test('control and message assets resolve to approved public URLs', () => {
  assert.equal(controlAssetUrl('gold', 'pressed'), '/assets/game/chibi/ui/button-gold-pressed.png');
  assert.equal(messagePanelUrl(), '/assets/game/chibi/ui/message-panel.png');
});
```

- [ ] **Step 2: Run the test and confirm RED**

Expected: FAIL because the UI asset URL helpers do not exist.

- [ ] **Step 3: Implement one-panel message playback**

Use one `<div role="status" aria-live="polite">` with `message-panel.png` as its stretched background. The component may update only the text node and phase class; it must never render two panels during replacement.

```tsx
<div className={`game-message is-${phase}`} role="status" aria-live="polite">
  <span key={message.id} className="game-message-text">{message.text}</span>
</div>
```

CSS timings are exactly 180ms enter, 1400ms hold, 240ms exit, and 120ms text replacement.

Export `controlAssetUrl(variant, state)` and `messagePanelUrl()` from `presentation.mjs`, declare them in `presentation.d.mts`, and use them inside the React components so asset paths stay testable without a DOM.

- [ ] **Step 4: Implement image-backed control states**

Use the purple base for Undo and Restart, and the gold base for Add Bottle. The button element chooses `normal`, `pressed`, or `disabled` image URL. Use pointer down/up/cancel to control pressed state and retain `:focus-visible`, `aria-label`, and `disabled` semantics.

```tsx
const state = disabled ? 'disabled' : pressed ? 'pressed' : 'normal';
const baseUrl = `/assets/game/chibi/ui/button-${variant}-${state}.png`;
```

The add-bottle control overlays `badge-plus.png`. Chinese text remains outside the raster icon and must not be scaled with the button image.

- [ ] **Step 5: Run tests and Vite build**

Expected: timing tests PASS and the build contains no missing imports.

### Task 6: Integrate the approved presentation system into the playable level

**Files:**
- Modify: `prototype/src/Prototype.tsx`
- Modify: `prototype/src/prototype.css`
- Modify: `prototype/package.json`
- Test: `prototype/tests/game-engine.test.mjs`
- Test: `prototype/tests/presentation.test.mjs`

**Interfaces:**
- Consumes: every component and pure helper from Tasks 2–5.
- Produces: the existing playable source-target water-sort flow with the approved chibi presentation.

- [ ] **Step 1: Split the current monolithic presentation imports**

Remove local `POTION_COLORS`, `BottleView`, and `ControlButton` definitions from `Prototype.tsx`. Import `BottleView`, `ControlButton`, `GameMessage`, and `WitchAnimator` from `src/components/` and keep only screen-level state and event handlers in `Prototype`.

- [ ] **Step 2: Connect interaction results to presentation states**

Use these mappings:

```text
first non-empty bottle tap -> witch cast, bottle selected, message "法杖已锁定，再点目标瓶"
empty source tap -> witch oops, bottle invalid, message "空瓶不能作为起点"
invalid target -> witch oops, source and target invalid, message "只能倒入空瓶或同色药液"
valid incomplete pour -> witch cast, source/target particle pouring, message "倒入 N 层药液"
completed target -> witch celebrate, target particle complete, message "魔药合成成功！"
1000ms without input -> witch idle
reward bottle -> witch celebrate, slot 15 active, message "广告奖励完成，空瓶已加入"
```

- [ ] **Step 3: Preserve completion sequencing**

Keep the existing 780ms departure duration. Call `vanishBottle` only after the completion burst and fly-away finish. Do not move, sort, compact, or remap any other bottle after the completed slot becomes vanished.

- [ ] **Step 4: Apply the approved background and responsive coordinates**

Use `/assets/game/chibi/background/alchemy-room.png` as the screen background. Preserve the 5 × 3 logical grid, 64 × 112 slots, and 393px-safe 352px grid width. On Pixel 10, keep the grid centered and use the extra vertical space between board and controls rather than increasing bottle scale.

- [ ] **Step 5: Add scripts without changing dependencies**

```json
{
  "test:presentation": "node --test tests/presentation.test.mjs"
}
```

Keep art validation as the explicit bundled-Python command from Task 1 so the npm script remains portable. Do not add a new npm dependency for particles, animation, random numbers, or test timing.

- [ ] **Step 6: Run regression and build checkpoints**

Run:

```powershell
node --test tests\game-engine.test.mjs
node --test tests\presentation.test.mjs
node scripts\check-mobile-runtime.mjs
node node_modules\vite\bin\vite.js build
```

Expected: 8 engine tests PASS, all presentation tests PASS, 28 protected runtime files PASS, and Vite build exits 0.

### Task 7: Browser interaction, visual comparison, and handoff

**Files:**
- Modify: `prototype/design-qa.md`
- Create: `prototype/artifacts/chibi-initial-393x852.png`
- Create: `prototype/artifacts/chibi-cast-393x852.png`
- Create: `prototype/artifacts/chibi-complete-393x852.png`
- Create: `prototype/artifacts/chibi-pixel-427x952.png`
- Create: `prototype/artifacts/chibi-reference-comparison.png`

**Interfaces:**
- Consumes: the verified local prototype and both approved reference images.
- Produces: same-state captures, a comparison history, fixed P0/P1/P2 issues, and `final result: passed`.

- [ ] **Step 1: Start or refresh the local preview**

Run Vite on `http://127.0.0.1:4173/` and keep it alive. Open it in the Codex in-app browser. If automated screenshots or interactions require Playwright, use it only after the user grants explicit permission.

- [ ] **Step 2: Verify the 393 × 852 initial state**

Confirm `[data-phone-screen]` measures exactly 393 × 852 CSS pixels at device scale factor 1. Capture the app screen element only. Check console errors and confirm every generated art URL returns HTTP 200.

- [ ] **Step 3: Verify primary interaction states**

Capture and test:

1. initial idle loop;
2. bottle 1 selected and cast animation visibly changing frames;
3. bottle 1 poured into bottle 2, celebration frames playing;
4. bottle 2 complete burst and fly-away;
5. slot 2 inactive with all other poses unchanged;
6. reward bottle activates slot 15;
7. Undo and Restart remain functional;
8. message enter, replacement, and exit phases;
9. button normal, pressed, and disabled images;
10. reduced-motion static-frame fallback.

- [ ] **Step 4: Verify deterministic bottle geometry**

Record every active bottle's visual bounding box and logical hit area. Fail when a visible outline overlaps another outline, crosses the 10px horizontal safety edge, or when rerender/restart changes the same level seed's pose. Confirm departed bottles do not change any surviving pose.

- [ ] **Step 5: Verify Pixel 10**

Switch the protected device picker to Pixel 10, confirm a 427 × 952 screen, capture the content, and check that the camera cutout, Android navigation bar, board, messages, and bottom controls do not collide.

- [ ] **Step 6: Compare reference and implementation together**

Create one comparison input containing the first Q-room reference and `chibi-initial-393x852.png`. Inspect at least:

- Q-style line weight and rounded shapes;
- deep-purple versus warm-orange color temperature;
- witch three-head proportion and stable anchor;
- background desk crop and visual quietness;
- controlled-random bottle boundaries;
- eight-color and eight-particle readability;
- image-backed control depth and press state;
- message panel style and text contrast;
- safe-area and bottom-control reachability.

- [ ] **Step 7: Iterate until design QA passes**

Update `design-qa.md` with source paths, capture paths, dimensions, density, state, full-view evidence, focused-region evidence, comparison history, interaction checks, console status, intentional code-native liquid deviation, and all fixes. Fix every P0/P1/P2 finding, recapture the same state, and compare again. The last line must be exactly:

```text
final result: passed
```

- [ ] **Step 8: Final verification checkpoint**

Run all tests, art validation, protected runtime check, and Vite build one final time. Keep the local preview running and open in the Codex in-app browser for user inspection.
