import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ART_FONT_RESOURCE,
  COLLECTION_LAYOUT,
  HEALTHY_GAME_ADVICE_LINES,
  HOME_LAYOUT,
  LAUNCH_LAYOUT,
  LEVEL_COMPLETE_LAYOUT,
  LEVEL_LAYOUT,
  LEVEL_SELECT_LAYOUT,
  SETTINGS_LAYOUT,
  RESTART_LABEL,
  bottleFeedbackVisual,
  bottlePlacement,
  buttonBaseLayout,
  buttonSpritePath,
  levelButtonVisual,
  levelSelectButton,
  collectionPuzzlePiece,
  launchProgressFill,
  potionParticleVisuals,
  potionProgressLabel,
  shouldRenderBottle,
  squareBottomFit,
} from '../assets/scripts/presentation/presentation-layout.ts';
import * as presentationLayout from '../assets/scripts/presentation/presentation-layout.ts';

test('launch screen keeps every required element inside the 393 by 852 safe frame', () => {
  assert.deepEqual(LAUNCH_LAYOUT.ageBadge, { x: -155, y: 376, width: 42, height: 42 });
  assert.deepEqual(LAUNCH_LAYOUT.title, { x: 0, y: 235, width: 330, height: 74 });
  assert.deepEqual(LAUNCH_LAYOUT.witch, { x: 0, y: 22, width: 260, height: 260 });
  assert.deepEqual(LAUNCH_LAYOUT.progressTrack, { x: 0, y: -230, width: 300, height: 18 });
  assert.deepEqual(LAUNCH_LAYOUT.percent, { x: 0, y: -265, width: 120, height: 32 });
  assert.deepEqual(LAUNCH_LAYOUT.status, { x: 0, y: -290, width: 330, height: 32 });
  assert.deepEqual(LAUNCH_LAYOUT.retryButton, { x: 0, y: -334, width: 224, height: 56 });
  assert.deepEqual(LAUNCH_LAYOUT.adviceCenters, [-374, -394]);
  assert.equal(HEALTHY_GAME_ADVICE_LINES.join(''),
    '抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。');

  for (const rect of [LAUNCH_LAYOUT.ageBadge, LAUNCH_LAYOUT.title, LAUNCH_LAYOUT.witch,
    LAUNCH_LAYOUT.progressTrack, LAUNCH_LAYOUT.percent, LAUNCH_LAYOUT.status, LAUNCH_LAYOUT.retryButton]) {
    assert.ok(Math.abs(rect.x) + rect.width / 2 <= 393 / 2);
    assert.ok(Math.abs(rect.y) + rect.height / 2 <= 852 / 2);
  }
});

test('launch progress fill grows from the left edge and clamps to the track', () => {
  assert.deepEqual(launchProgressFill(-1), { x: -148, width: 0 });
  assert.deepEqual(launchProgressFill(0), { x: -148, width: 0 });
  assert.deepEqual(launchProgressFill(0.5), { x: -74, width: 148 });
  assert.deepEqual(launchProgressFill(1), { x: 0, width: 296 });
  assert.deepEqual(launchProgressFill(2), { x: 0, width: 296 });
  assert.deepEqual(launchProgressFill(Number.NaN), { x: -148, width: 0 });
});

test('selector maps completed, current, unlocked, and locked states to approved artwork', () => {
  assert.deepEqual(levelButtonVisual('completed'), {
    variant: 'gold',
    disabled: false,
    highlighted: false,
  });
  assert.deepEqual(levelButtonVisual('current'), {
    variant: 'gold',
    disabled: false,
    highlighted: true,
  });
  assert.deepEqual(levelButtonVisual('unlocked'), {
    variant: 'purple',
    disabled: false,
    highlighted: false,
  });
  assert.deepEqual(levelButtonVisual('locked'), {
    variant: 'purple',
    disabled: true,
    highlighted: false,
  });
});

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

test('collection artwork is divided into six gapless two by three masks', () => {
  const pieces = Array.from({ length: 6 }, (_, index) => collectionPuzzlePiece(index));
  assert.equal(COLLECTION_LAYOUT.puzzle.columns, 2);
  assert.equal(COLLECTION_LAYOUT.puzzle.rows, 3);
  assert.deepEqual(pieces.map((piece) => [piece.column, piece.row]), [
    [0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2],
  ]);
  assert.equal(pieces.reduce((sum, piece) => sum + piece.width * piece.height, 0),
    COLLECTION_LAYOUT.puzzle.width * COLLECTION_LAYOUT.puzzle.height);
  assert.deepEqual(pieces.map((piece) => [piece.width, piece.height]), [
    [126, 84], [126, 84], [126, 84], [126, 84], [126, 84], [126, 84],
  ]);
  assert.deepEqual(pieces.map((piece) => [piece.x, piece.y, piece.artOffsetX, piece.artOffsetY]), [
    [-63, 142, 63, -84], [63, 142, -63, -84],
    [-63, 58, 63, 0], [63, 58, -63, 0],
    [-63, -26, 63, 84], [63, -26, -63, 84],
  ]);
  assert.throws(() => collectionPuzzlePiece(6), RangeError);
});

test('home layout preserves the accepted prototype hierarchy without a progress card', () => {
  assert.deepEqual(HOME_LAYOUT.header, { x: -86, y: 326, width: 176, align: 'left' });
  assert.deepEqual(HOME_LAYOUT.witch, { x: 0, y: 51, width: 246, height: 304 });
  assert.deepEqual(HOME_LAYOUT.continueButton, { x: 0, y: -348, width: 286, height: 72 });
  assert.equal(HOME_LAYOUT.showsProgressCard, false);
  assert.deepEqual(HOME_LAYOUT.selectButton, { x: 0, y: -266, width: 224, height: 56 });
});

test('level layout keeps the witch, board, message, and controls in the accepted 393 by 852 frame', () => {
  assert.deepEqual(LEVEL_LAYOUT.witch, { x: 0, y: 213, width: 174, height: 182 });
  assert.deepEqual(LEVEL_LAYOUT.slotColumns, [-136, -68, 0, 68, 136]);
  assert.deepEqual(LEVEL_LAYOUT.bottleRows, [70, -52, -174]);
  assert.deepEqual(LEVEL_LAYOUT.message, { x: 0, y: -270, width: 321, height: 46 });
  assert.deepEqual(LEVEL_LAYOUT.controlCenters, [-122, 0, 122]);
  assert.equal(LEVEL_LAYOUT.controlY, -338);
});

test('witch artwork keeps square proportions and aligns to the bottom of each prototype stage', () => {
  assert.deepEqual(squareBottomFit(HOME_LAYOUT.witch), { width: 246, height: 246, y: -29 });
  assert.deepEqual(squareBottomFit(LEVEL_LAYOUT.witch), { width: 174, height: 174, y: -4 });
});

test('bottle placement reproduces the approved controlled-random seed and first-row edge tightening', () => {
  assert.deepEqual(bottlePlacement(12, 0), { x: -129, y: 61, angle: 0.6 });
  assert.deepEqual(bottlePlacement(12, 4), { x: 127, y: 71, angle: 0.8 });
  assert.deepEqual(bottlePlacement(12, 5), { x: -131, y: -43, angle: -0.7 });
  assert.deepEqual(bottlePlacement(12, 10), { x: -132, y: -174, angle: 0.6 });
});

test('reserved rewarded slot stays visually empty until the reward is granted', () => {
  assert.equal(shouldRenderBottle('active'), true);
  assert.equal(shouldRenderBottle('reserved'), false);
  assert.equal(shouldRenderBottle('inactive'), false);
  assert.equal(shouldRenderBottle('vanished'), false);
});

test('raster button state chooses the accepted normal, pressed, and disabled artwork', () => {
  assert.equal(buttonSpritePath('purple', false, false), 'game/chibi/ui/button-purple-normal/spriteFrame');
  assert.equal(buttonSpritePath('purple', false, true), 'game/chibi/ui/button-purple-pressed/spriteFrame');
  assert.equal(buttonSpritePath('gold', true, true), 'game/chibi/ui/button-gold-disabled/spriteFrame');
});

test('wide raster buttons preserve their corners with the prototype nine-slice geometry', () => {
  assert.deepEqual(buttonBaseLayout(HOME_LAYOUT.continueButton, 'sliced'), {
    width: 858,
    height: 216,
    x: 0,
    y: 0,
    scale: 1 / 3,
    sourceInset: 72,
    renderMode: 'sliced',
  });
  assert.deepEqual(buttonBaseLayout(SETTINGS_LAYOUT.soundButton, 'sliced'), {
    width: 672,
    height: 216,
    x: 0,
    y: 0,
    scale: 1 / 3,
    sourceInset: 72,
    renderMode: 'sliced',
  });
  assert.equal(
    buttonBaseLayout(LEVEL_COMPLETE_LAYOUT.primaryButton, 'sliced').renderMode,
    'sliced',
  );
  assert.equal(
    buttonBaseLayout(LEVEL_COMPLETE_LAYOUT.secondaryButton, 'sliced').renderMode,
    'sliced',
  );
});

test('selector and completion actions use wide sliced buttons inside safe bounds', () => {
  assert.deepEqual(LEVEL_SELECT_LAYOUT.backButton, { x: 0, y: -342, width: 224, height: 72 });
  assert.deepEqual(LEVEL_COMPLETE_LAYOUT.primaryButton, { x: 0, y: -72, width: 240, height: 72 });
  assert.deepEqual(LEVEL_COMPLETE_LAYOUT.secondaryButton, { x: 0, y: -164, width: 240, height: 72 });
  for (const button of [
    LEVEL_SELECT_LAYOUT.backButton,
    LEVEL_COMPLETE_LAYOUT.primaryButton,
    LEVEL_COMPLETE_LAYOUT.secondaryButton,
  ]) {
    assert.ok(Math.abs(button.x) + button.width / 2 <= 393 / 2);
    assert.ok(Math.abs(button.y) + button.height / 2 <= 852 / 2);
  }
});

test('bottom control artwork stays square and centered inside its wider hit target', () => {
  assert.deepEqual(buttonBaseLayout({ x: 0, y: 0, width: 110, height: 72 }, 'contain'), {
    width: 72,
    height: 72,
    x: 0,
    y: 0,
    scale: 1,
    sourceInset: 0,
    renderMode: 'simple',
  });
});

test('bottle and liquid geometry matches the prototype clipping boundary', () => {
  assert.deepEqual(LEVEL_LAYOUT.bottle, { width: 48, height: 104 });
  assert.deepEqual(LEVEL_LAYOUT.liquid, { x: 0, y: -8.5, width: 36, height: 61, radius: 11 });
});

test('selected bottle feedback matches the prototype lift without moving its hit target', () => {
  assert.deepEqual(bottleFeedbackVisual(false, false), { yOffset: 0, scale: 1, auraVisible: false });
  assert.deepEqual(bottleFeedbackVisual(true, false), { yOffset: 10, scale: 1.04, auraVisible: true });
  assert.deepEqual(bottleFeedbackVisual(false, true), { yOffset: 0, scale: 1.06, auraVisible: false });
});

test('selected bottle aura reproduces the prototype cyan drop shadow with three soft layers', () => {
  const aura = (presentationLayout as unknown as {
    selectedBottleAuraVisual?: () => readonly Readonly<{
      width: number;
      height: number;
      opacity: number;
    }>[];
  }).selectedBottleAuraVisual;
  assert.equal(typeof aura, 'function');
  if (!aura) return;

  assert.deepEqual(aura(), [
    { width: 52, height: 112, opacity: 0.35 },
    { width: 56, height: 116, opacity: 0.2 },
    { width: 60, height: 120, opacity: 0.1 },
  ]);
});

test('bottle-only session changes never require rebuilding the full production surface', () => {
  const mode = (presentationLayout as unknown as {
    levelInteractionRefreshMode?: (gameChanged: boolean) => 'feedback' | 'content';
  }).levelInteractionRefreshMode;
  assert.equal(typeof mode, 'function');
  if (!mode) return;

  assert.equal(mode(false), 'feedback');
  assert.equal(mode(true), 'content');
});

test('potion particles reproduce the prototype deterministic two-motif layout', () => {
  assert.deepEqual(potionParticleVisuals(12, 2, 3, 'idle'), [
    {
      seed: 0.09787367193444485,
      x: -9.26499059863039,
      y: -5,
      size: 14,
      opacity: 0.36,
      duration: 2.2,
      delay: -0.13702314070822277,
    },
    {
      seed: 0.35327189307503215,
      x: -3.3806155835512595,
      y: -5,
      size: 14,
      opacity: 0.36,
      duration: 2.2,
      delay: -0.494580650305045,
    },
  ]);
  assert.deepEqual(
    potionParticleVisuals(12, 2, 3, 'selected').map((particle) => [particle.opacity, particle.duration]),
    [[0.45, 1.76], [0.45, 1.76]],
  );
});

test('potion particle timeline reproduces every prototype keyframe and negative delay', () => {
  const evaluate = (presentationLayout as unknown as {
    potionParticleFrame?: (
      visual: {
        seed: number;
        x: number;
        y: number;
        size: number;
        opacity: number;
        duration: number;
        delay: number;
      },
      state: 'idle' | 'selected' | 'pouring' | 'complete',
      elapsed: number,
    ) => { x: number; y: number; scale: number; opacity: number; finished: boolean };
  }).potionParticleFrame;
  assert.equal(typeof evaluate, 'function');
  if (!evaluate) return;

  const idle = {
    seed: 0,
    x: -10,
    y: -5,
    size: 14,
    opacity: 0.36,
    duration: 2.2,
    delay: 0,
  };
  assert.deepEqual(evaluate(idle, 'idle', 0), {
    x: -10,
    y: -5,
    scale: 0.78,
    opacity: 0.2,
    finished: false,
  });
  assert.deepEqual(evaluate(idle, 'idle', 1.056), {
    x: -7,
    y: 12,
    scale: 1,
    opacity: 0.46,
    finished: false,
  });
  const idleQuarter = evaluate(idle, 'idle', 0.264);
  assert.ok(Math.abs(idleQuarter.x - (-9.61251420685804)) < 1e-9);
  assert.ok(Math.abs(idleQuarter.y - (-2.80424717219556)) < 1e-9);
  assert.ok(Math.abs(idleQuarter.scale - 0.8084156248304104) < 1e-9);
  assert.ok(Math.abs(idleQuarter.opacity - 0.23358210207230316) < 1e-9);
  assert.equal(idleQuarter.finished, false);
  assert.deepEqual(evaluate({ ...idle, duration: 1.76, delay: -0.8448 }, 'selected', 0), {
    x: -7,
    y: 12,
    scale: 1,
    opacity: 0.46,
    finished: false,
  });

  const pouring = { ...idle, duration: 0.52 };
  assert.deepEqual(evaluate(pouring, 'pouring', 0), {
    x: -10,
    y: -5,
    scale: 0.88,
    opacity: 0.4,
    finished: false,
  });
  assert.deepEqual(evaluate(pouring, 'pouring', 0.52), {
    x: 24,
    y: -23,
    scale: 0.64,
    opacity: 0,
    finished: true,
  });
  const pouringHalf = evaluate(pouring, 'pouring', 0.26);
  assert.ok(Math.abs(pouringHalf.x - 13.27786837253366) < 1e-9);
  assert.ok(Math.abs(pouringHalf.y - (-17.32357737369429)) < 1e-9);
  assert.ok(Math.abs(pouringHalf.scale - 0.7156856350174095) < 1e-9);
  assert.ok(Math.abs(pouringHalf.opacity - 0.12614272502901578) < 1e-9);
  assert.equal(pouringHalf.finished, false);
  assert.deepEqual(evaluate({ ...pouring, delay: -0.7 }, 'pouring', 0), {
    x: 24,
    y: -23,
    scale: 0.64,
    opacity: 0,
    finished: true,
  });

  const complete = { ...idle, duration: 0.36 };
  assert.deepEqual(evaluate(complete, 'complete', 0), {
    x: -10,
    y: -5,
    scale: 0.75,
    opacity: 0.54,
    finished: false,
  });
  assert.deepEqual(evaluate(complete, 'complete', 0.36), {
    x: 2,
    y: 31,
    scale: 1.12,
    opacity: 0,
    finished: true,
  });
});

test('potion particles return to the correct persistent state after pouring ends', () => {
  const resolveState = (presentationLayout as unknown as {
    potionParticleState?: (
      pendingCompletion: boolean,
      pouring: boolean,
      selected: boolean,
    ) => 'idle' | 'selected' | 'pouring' | 'complete';
  }).potionParticleState;
  assert.equal(typeof resolveState, 'function');
  if (!resolveState) return;

  assert.equal(resolveState(false, false, false), 'idle');
  assert.equal(resolveState(false, false, true), 'selected');
  assert.equal(resolveState(false, true, false), 'pouring');
  assert.equal(resolveState(true, true, false), 'complete');
  assert.equal(resolveState(false, false, false), 'idle');
});

test('pouring particles restore the idle cycle duration after the state changes', () => {
  const evaluate = (presentationLayout as unknown as {
    potionParticleFrame: (
      visual: { seed: number; x: number; y: number; size: number; opacity: number; duration: number; delay: number },
      state: 'idle' | 'selected' | 'pouring' | 'complete',
      elapsed: number,
    ) => { x: number; y: number; scale: number; opacity: number; finished: boolean };
  }).potionParticleFrame;
  const pouringVisual = {
    seed: 0,
    x: -10,
    y: -5,
    size: 14,
    opacity: 0.45,
    duration: 0.52,
    delay: 0,
  };

  const frame = evaluate(pouringVisual, 'idle', 0.52);
  assert.ok(frame.x > pouringVisual.x);
  assert.ok(frame.y > pouringVisual.y);
  assert.equal(frame.finished, false);
});

test('pouring particles restore the selected cycle duration after the state changes', () => {
  const evaluate = (presentationLayout as unknown as {
    potionParticleFrame: (
      visual: { seed: number; x: number; y: number; size: number; opacity: number; duration: number; delay: number },
      state: 'idle' | 'selected' | 'pouring' | 'complete',
      elapsed: number,
    ) => { x: number; y: number; scale: number; opacity: number; finished: boolean };
  }).potionParticleFrame;
  const pouringVisual = {
    seed: 0,
    x: -10,
    y: -5,
    size: 14,
    opacity: 0.45,
    duration: 0.52,
    delay: 0,
  };

  const frame = evaluate(pouringVisual, 'selected', 0.52);
  assert.ok(frame.x > pouringVisual.x);
  assert.ok(frame.y > pouringVisual.y);
  assert.equal(frame.finished, false);
});

test('production copy and art-font contract match the approved prototype', () => {
  assert.equal(potionProgressLabel(3, 8), '魔药 3/8');
  assert.equal(RESTART_LABEL, '重来');
  assert.equal(ART_FONT_RESOURCE, 'game/fonts/noto-serif-sc-ui');
});

test('settings layout uses the accepted raster-backed dialog geometry', () => {
  assert.deepEqual(SETTINGS_LAYOUT.trigger, { x: 155, y: 340, width: 48, height: 48 });
  assert.deepEqual(SETTINGS_LAYOUT.dialog, { x: 0, y: -21, width: 304, height: 360 });
  assert.deepEqual(SETTINGS_LAYOUT.close, { x: 110, y: 138, width: 48, height: 48 });
  assert.deepEqual(SETTINGS_LAYOUT.soundButton, { x: 0, y: 14, width: 224, height: 72 });
  assert.deepEqual(SETTINGS_LAYOUT.homeButton, { x: 0, y: -81, width: 224, height: 72 });
});
