import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_LAYOUT,
  LEVEL_COMPLETE_LAYOUT,
  LEVEL_LAYOUT,
  LEVEL_SELECT_LAYOUT,
  SETTINGS_LAYOUT,
  bottlePlacement,
  buttonBaseLayout,
  buttonSpritePath,
  levelButtonVisual,
  levelSelectButton,
  shouldRenderBottle,
  squareBottomFit,
} from '../assets/scripts/presentation/presentation-layout.ts';

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

test('level selector fits fifteen square buttons inside the 393 by 852 safe frame', () => {
  const cells = Array.from({ length: 15 }, (_, index) => levelSelectButton(index));
  assert.equal(LEVEL_SELECT_LAYOUT.columns, 5);
  assert.equal(LEVEL_SELECT_LAYOUT.rows, 3);
  assert.equal(cells.length, 15);
  for (const cell of cells) {
    assert.equal(cell.width, cell.height);
    assert.ok(cell.x - cell.width / 2 >= -393 / 2);
    assert.ok(cell.x + cell.width / 2 <= 393 / 2);
    assert.ok(cell.y - cell.height / 2 >= -852 / 2);
    assert.ok(cell.y + cell.height / 2 <= 852 / 2);
  }
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
  assert.deepEqual(LEVEL_LAYOUT.liquid, { x: 0, y: -10.5, width: 36, height: 65, radius: 13 });
});

test('settings layout uses the accepted raster-backed dialog geometry', () => {
  assert.deepEqual(SETTINGS_LAYOUT.trigger, { x: 155, y: 340, width: 48, height: 48 });
  assert.deepEqual(SETTINGS_LAYOUT.dialog, { x: 0, y: -21, width: 304, height: 360 });
  assert.deepEqual(SETTINGS_LAYOUT.close, { x: 110, y: 138, width: 48, height: 48 });
  assert.deepEqual(SETTINGS_LAYOUT.soundButton, { x: 0, y: 14, width: 224, height: 72 });
  assert.deepEqual(SETTINGS_LAYOUT.homeButton, { x: 0, y: -81, width: 224, height: 72 });
});
