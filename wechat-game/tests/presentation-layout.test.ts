import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ART_FONT_RESOURCE,
  COLLECTION_LAYOUT,
  COLLECTION_OVERVIEW_LAYOUT,
  DAILY_COMMISSION_LAYOUT,
  HEALTHY_GAME_ADVICE_LINES,
  HOME_LAYOUT,
  LAUNCH_LAYOUT,
  LEVEL_COMPLETE_LAYOUT,
  LEVEL_LAYOUT,
  LEVEL_SELECT_LAYOUT,
  SETTINGS_LAYOUT,
  STAMINA_LAYOUT,
  RESTART_LABEL,
  bottleFeedbackVisual,
  bottlePourAngle,
  bottlePlacement,
  buttonBaseLayout,
  buttonSpritePath,
  collectionCompleteLabel,
  collectionRewardLabel,
  chapterLabel,
  completionInfoRowY,
  completionOptimalLabel,
  completionPrimaryLabel,
  controlAllowanceVisual,
  formatRecoveryCountdown,
  endlessHudText,
  levelButtonVisual,
  levelInteractionRefreshMode,
  levelSelectButton,
  collectionPuzzlePiece,
  collectionCardLayout,
  launchProgressFill,
  proportionalHeightForWidth,
  potionParticleVisuals,
  potionProgressLabel,
  shouldRenderBottle,
  squareBottomFit,
  staminaBarYForMenu,
  staminaBarContentLayout,
} from '../assets/scripts/presentation/presentation-layout.ts';
import * as presentationLayout from '../assets/scripts/presentation/presentation-layout.ts';
import { createDemoState } from '../assets/scripts/core/demo-level.ts';
import { pour, vanishBottle } from '../assets/scripts/core/water-sort.ts';

test('launch screen keeps every required element inside the 393 by 852 safe frame', () => {
  assert.deepEqual(LAUNCH_LAYOUT.ageBadge, { x: -155, y: 376, width: 42, height: 42 });
  assert.deepEqual(LAUNCH_LAYOUT.title, { x: 0, y: 235, width: 306, height: 111 });
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

test('home stamina bar stays in the left safe area aligned with the WeChat capsule', () => {
  assert.equal(formatRecoveryCountdown(1_800_000), '30:00');
  assert.equal(formatRecoveryCountdown(1), '00:01');
  assert.equal(STAMINA_LAYOUT.homeBar.x, -118);
  assert.equal(STAMINA_LAYOUT.homeBar.y, 365);
  assert.ok(STAMINA_LAYOUT.homeBar.x - STAMINA_LAYOUT.homeBar.width / 2 >= -393 / 2 + 4);
  assert.ok(STAMINA_LAYOUT.homeBar.x + STAMINA_LAYOUT.homeBar.width / 2 < 0);
});

test('launch logo derives its height from the fixed display width without distortion', () => {
  assert.equal(proportionalHeightForWidth(306, 612, 222), 111);
});

test('home stamina bar converts the WeChat capsule center into Cocos coordinates', () => {
  assert.equal(staminaBarYForMenu(852, 45 / 852), 381);
  assert.equal(staminaBarYForMenu(852, null), 365);
});

test('endless entry keeps its 64px artwork inside a larger phone hit target', () => {
  assert.deepEqual(HOME_LAYOUT.endlessButton, {
    x: -150, y: 198, width: 64, height: 64, hitWidth: 96, hitHeight: 96,
  });
  assert.equal(HOME_LAYOUT.endlessButton.y, HOME_LAYOUT.collectionButton.y);
  assert.deepEqual(endlessHudText(7, 4, -3), {
    title: '无尽 · 第7关',
    streak: '连胜 4',
    moves: '剩余 0 步',
  });
});

test('home stamina content uses a centered flex-like row within padded bar bounds', () => {
  assert.deepEqual(STAMINA_LAYOUT.homeBar.padding, { horizontal: 4, vertical: 2 });
  assert.equal(STAMINA_LAYOUT.homeBar.gap, 2);
  assert.equal(STAMINA_LAYOUT.homeBar.addSize, 18);
  assert.equal(STAMINA_LAYOUT.homeBar.addTrailingPadding, 10);
  assert.equal(STAMINA_LAYOUT.homeBar.width + STAMINA_LAYOUT.homeBar.gap
    + STAMINA_LAYOUT.homeBar.addSize + STAMINA_LAYOUT.homeBar.addTrailingPadding, 166);
  const content = staminaBarContentLayout();
  assert.deepEqual(content, {
    width: 128,
    height: 30,
    icon: { x: -64, y: 0, width: 30, height: 30 },
    value: { x: -32, y: 0, width: 36, height: 30 },
    status: { x: 6, y: 0, width: 58, height: 30 },
  });
  assert.equal(content.icon.y, content.value.y);
  assert.equal(content.value.y, content.status.y);
  assert.equal(content.value.x - (content.icon.x + content.icon.width), 2);
  assert.equal(content.status.x - (content.value.x + content.value.width), 2);
  assert.equal(content.width <= STAMINA_LAYOUT.homeBar.width - 8, true);
  assert.equal(content.height <= STAMINA_LAYOUT.homeBar.height - 4, true);
  assert.equal(content.icon.x + content.width / 2, 0);
  assert.equal(content.status.x + content.status.width / 2, 35);
});

test('stamina dialog rows keep balanced vertical breathing room', () => {
  const rows = [
    { y: STAMINA_LAYOUT.dialogRows.title, height: 43.2 },
    { y: STAMINA_LAYOUT.dialogRows.icon, height: 64 },
    { y: STAMINA_LAYOUT.dialogRows.value, height: 38.4 },
    { y: STAMINA_LAYOUT.dialogRows.status, height: 28 },
    { y: STAMINA_LAYOUT.dialogRows.note, height: 28 },
    { y: STAMINA_LAYOUT.adButton.y, height: STAMINA_LAYOUT.adButton.height },
    { y: STAMINA_LAYOUT.dialogRows.message, height: 28 },
  ];
  const gaps = rows.slice(0, -1).map((row, index) =>
    Number(Math.abs(row.y - row.height / 2 - rows[index + 1].y - rows[index + 1].height / 2).toFixed(1)));

  assert.deepEqual(gaps, [8.4, 5.2, 6.8, 6, 8, 6]);
  assert.equal(gaps.every((gap) => gap >= 5 && gap <= 9), true);
});

test('exit dialog keeps the cancel button inside its decorated bottom edge', () => {
  const dialogBottom = STAMINA_LAYOUT.exitDialog.y - STAMINA_LAYOUT.exitDialog.height / 2;
  const cancelBottom = STAMINA_LAYOUT.exitCancel.y - STAMINA_LAYOUT.exitCancel.height / 2;

  assert.ok(cancelBottom - dialogBottom >= 24);
});

test('modal dialogs use the approved subtle enter and exit timing', () => {
  const transition = (presentationLayout as unknown as {
    DIALOG_TRANSITION?: Readonly<{
      enter: Readonly<{ duration: number; fromScale: number }>;
      exit: Readonly<{ duration: number; toScale: number }>;
    }>;
  }).DIALOG_TRANSITION;
  assert.deepEqual(transition, {
    enter: { duration: 0.28, fromScale: 0.92 },
    exit: { duration: 0.26, toScale: 0.96 },
  });
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

test('selector leaves room below each button for three stars while keeping thirty levels on one page', () => {
  assert.deepEqual(LEVEL_SELECT_LAYOUT.rowCenters, [180, 112, 44, -24, -92, -160]);
  assert.equal(LEVEL_SELECT_LAYOUT.starY, -32);
  assert.equal(LEVEL_SELECT_LAYOUT.starSize, 15);
  assert.equal(LEVEL_SELECT_LAYOUT.starGap, 18);
  assert.equal(LEVEL_SELECT_LAYOUT.rowCenters.length * LEVEL_SELECT_LAYOUT.columns, 30);
  for (let index = 1; index < LEVEL_SELECT_LAYOUT.rowCenters.length; index += 1) {
    assert.equal(LEVEL_SELECT_LAYOUT.rowCenters[index - 1] - LEVEL_SELECT_LAYOUT.rowCenters[index], 68);
  }
});

test('selector fits thirty square buttons in one five by six page', () => {
  const cells = Array.from({ length: 30 }, (_, index) => levelSelectButton(index));
  assert.equal(LEVEL_SELECT_LAYOUT.columns, 5);
  assert.equal(LEVEL_SELECT_LAYOUT.rows, 6);
  assert.equal(LEVEL_SELECT_LAYOUT.starTotalY, 255);
  assert.equal(LEVEL_SELECT_LAYOUT.starTotalFontSize, 44);
  assert.equal(LEVEL_SELECT_LAYOUT.starTotalWidth, 260);
  assert.deepEqual(LEVEL_SELECT_LAYOUT.previousChapterButton, { x: -158, y: 320, width: 44, height: 44 });
  assert.deepEqual(LEVEL_SELECT_LAYOUT.nextChapterButton, { x: 158, y: 320, width: 44, height: 44 });
  assert.equal(cells.length, 30);
  assert.throws(() => levelSelectButton(30), RangeError);
  for (const cell of cells) {
    assert.equal(cell.width, 48);
    assert.equal(cell.height, 48);
    assert.ok(Math.abs(cell.x) + 24 <= 393 / 2);
    assert.ok(Math.abs(cell.y) + 24 <= 852 / 2);
    assert.ok(cell.y - cell.height / 2 >= -184);
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

test('collection overview fits ten cards in a two-column scroll content', () => {
  assert.deepEqual(COLLECTION_OVERVIEW_LAYOUT.viewport, {
    x: 0, y: -4, width: 360, height: 636,
  });
  assert.deepEqual(COLLECTION_OVERVIEW_LAYOUT.card, { width: 158, height: 180 });
  assert.equal(COLLECTION_OVERVIEW_LAYOUT.columns, 2);
  assert.equal(COLLECTION_OVERVIEW_LAYOUT.contentHeight, 1008);

  const cards = Array.from({ length: 10 }, (_, index) => collectionCardLayout(index));
  assert.deepEqual(cards.map((card) => [card.column, card.row]), [
    [0, 0], [1, 0], [0, 1], [1, 1], [0, 2],
    [1, 2], [0, 3], [1, 3], [0, 4], [1, 4],
  ]);
  assert.deepEqual(cards.map((card) => [card.x, card.y]), [
    [-87, 396], [87, 396], [-87, 198], [87, 198], [-87, 0],
    [87, 0], [-87, -198], [87, -198], [-87, -396], [87, -396],
  ]);
  assert.throws(() => collectionCardLayout(10), RangeError);
});

test('locked collection cards select all nine cells from one approved sprite sheet', () => {
  const sheetCell = (presentationLayout as unknown as {
    mysteryPotionSheetCell?: (index: number) => Readonly<{
      path: string; size: number; x: number; y: number;
    }>;
  }).mysteryPotionSheetCell;
  assert.equal(typeof sheetCell, 'function');
  if (!sheetCell) return;

  assert.deepEqual(Array.from({ length: 9 }, (_, index) => sheetCell(index)), [
    { path: 'game/chibi/collection/mystery-potions/spriteFrame', size: 288, x: 96, y: -96 },
    { path: 'game/chibi/collection/mystery-potions/spriteFrame', size: 288, x: 0, y: -96 },
    { path: 'game/chibi/collection/mystery-potions/spriteFrame', size: 288, x: -96, y: -96 },
    { path: 'game/chibi/collection/mystery-potions/spriteFrame', size: 288, x: 96, y: 0 },
    { path: 'game/chibi/collection/mystery-potions/spriteFrame', size: 288, x: 0, y: 0 },
    { path: 'game/chibi/collection/mystery-potions/spriteFrame', size: 288, x: -96, y: 0 },
    { path: 'game/chibi/collection/mystery-potions/spriteFrame', size: 288, x: 96, y: 96 },
    { path: 'game/chibi/collection/mystery-potions/spriteFrame', size: 288, x: 0, y: 96 },
    { path: 'game/chibi/collection/mystery-potions/spriteFrame', size: 288, x: -96, y: 96 },
  ]);
  assert.throws(() => sheetCell(9), RangeError);
});

test('home titles select all ten cells from one 168 by 84 sprite sheet', () => {
  const sheetCell = (presentationLayout as unknown as {
    titleBadgeSheetCell?: (chapterId: number) => Readonly<{
      path: string; sourceX: number; sourceY: number; sourceWidth: number; sourceHeight: number;
      displayWidth: number; displayHeight: number;
    }>;
  }).titleBadgeSheetCell;
  assert.equal(typeof sheetCell, 'function');
  if (!sheetCell) return;

  assert.deepEqual(Array.from({ length: 10 }, (_, index) => sheetCell(index + 1)), [
    { path: 'game/chibi/titles/title-badges/spriteFrame', sourceX: 0, sourceY: 0, sourceWidth: 336, sourceHeight: 90, displayWidth: 168, displayHeight: 45 },
    { path: 'game/chibi/titles/title-badges/spriteFrame', sourceX: 336, sourceY: 0, sourceWidth: 336, sourceHeight: 90, displayWidth: 168, displayHeight: 45 },
    { path: 'game/chibi/titles/title-badges/spriteFrame', sourceX: 0, sourceY: 90, sourceWidth: 336, sourceHeight: 90, displayWidth: 168, displayHeight: 45 },
    { path: 'game/chibi/titles/title-badges/spriteFrame', sourceX: 336, sourceY: 90, sourceWidth: 336, sourceHeight: 90, displayWidth: 168, displayHeight: 45 },
    { path: 'game/chibi/titles/title-badges/spriteFrame', sourceX: 0, sourceY: 180, sourceWidth: 336, sourceHeight: 90, displayWidth: 168, displayHeight: 45 },
    { path: 'game/chibi/titles/title-badges/spriteFrame', sourceX: 336, sourceY: 180, sourceWidth: 336, sourceHeight: 90, displayWidth: 168, displayHeight: 45 },
    { path: 'game/chibi/titles/title-badges/spriteFrame', sourceX: 0, sourceY: 270, sourceWidth: 336, sourceHeight: 90, displayWidth: 168, displayHeight: 45 },
    { path: 'game/chibi/titles/title-badges/spriteFrame', sourceX: 336, sourceY: 270, sourceWidth: 336, sourceHeight: 90, displayWidth: 168, displayHeight: 45 },
    { path: 'game/chibi/titles/title-badges/spriteFrame', sourceX: 0, sourceY: 360, sourceWidth: 336, sourceHeight: 90, displayWidth: 168, displayHeight: 45 },
    { path: 'game/chibi/titles/title-badges/spriteFrame', sourceX: 336, sourceY: 360, sourceWidth: 336, sourceHeight: 90, displayWidth: 168, displayHeight: 45 },
  ]);
  assert.throws(() => sheetCell(0), RangeError);
  assert.throws(() => sheetCell(11), RangeError);
});

test('collection lock keeps a 30px display width and the source aspect ratio', () => {
  const visual = (presentationLayout as unknown as {
    COLLECTION_LOCK_VISUAL?: Readonly<{
      width: number; height: number; assetWidth: number; assetHeight: number;
    }>;
  }).COLLECTION_LOCK_VISUAL;
  assert.ok(visual);
  assert.deepEqual(visual, {
    width: 30,
    height: 38.5,
    assetWidth: 60,
    assetHeight: 77,
  });
});

test('home layout preserves the accepted prototype hierarchy without a progress card', () => {
  assert.deepEqual(HOME_LAYOUT.titleBadge, { x: 0, y: 101, width: 168 });
  assert.deepEqual(HOME_LAYOUT.titleFloat, { distance: 6, duration: 1.6 });
  assert.deepEqual(HOME_LAYOUT.settingsButton, { x: 150, y: 270, width: 48, height: 48 });
  assert.deepEqual(HOME_LAYOUT.collectionButton, { x: 150, y: 198, width: 64, height: 64 });
  assert.deepEqual(HOME_LAYOUT.shareButton, { x: 150, y: 126, width: 64, height: 64 });
  assert.deepEqual(HOME_LAYOUT.witch, { x: 0, y: 0, width: 246, height: 304 });
  assert.deepEqual(HOME_LAYOUT.continueButton, { x: 0, y: -348, width: 286, height: 72 });
  assert.equal(HOME_LAYOUT.showsProgressCard, false);
  assert.deepEqual(HOME_LAYOUT.selectButton, { x: 0, y: -266, width: 224, height: 56 });

  assert.equal(HOME_LAYOUT.settingsButton.x, HOME_LAYOUT.collectionButton.x);
  assert.equal(HOME_LAYOUT.collectionButton.x, HOME_LAYOUT.shareButton.x);
  assert.ok(HOME_LAYOUT.settingsButton.y > HOME_LAYOUT.collectionButton.y);
  assert.ok(HOME_LAYOUT.collectionButton.y > HOME_LAYOUT.shareButton.y);
});

test('level layout keeps the witch, board, message, and controls in the accepted 393 by 852 frame', () => {
  assert.deepEqual(LEVEL_LAYOUT.witch, { x: 0, y: 213, width: 174, height: 182 });
  assert.deepEqual(LEVEL_LAYOUT.slotColumns, [-136, -68, 0, 68, 136]);
  assert.deepEqual(LEVEL_LAYOUT.bottleRows, [70, -52, -174]);
  assert.deepEqual(LEVEL_LAYOUT.message, { x: 0, y: -270, width: 321, height: 46 });
  assert.deepEqual(LEVEL_LAYOUT.controlCenters, [-122, 0, 122]);
  assert.equal(LEVEL_LAYOUT.controlY, -338);
  assert.equal(LEVEL_LAYOUT.controlLabelY, -18);
  assert.ok(LEVEL_LAYOUT.controlLabelY - 14 >= -36);
});

test('control allowance bubbles show only the compact number and reveal ads only at zero', () => {
  assert.deepEqual(LEVEL_LAYOUT.controlAllowanceBubble, HOME_LAYOUT.dailyCommissionBubble);
  assert.deepEqual(LEVEL_LAYOUT.controlAdBadge, { x: 26, y: 27, width: 22, height: 18 });
  assert.deepEqual(controlAllowanceVisual(3), { text: '3', showAdBadge: false });
  assert.deepEqual(controlAllowanceVisual(1), { text: '1', showAdBadge: false });
  assert.deepEqual(controlAllowanceVisual(0), { text: '', showAdBadge: true });
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
    buttonBaseLayout(LEVEL_COMPLETE_LAYOUT.shareButton, 'sliced').renderMode,
    'sliced',
  );
});

test('completion info rows distribute evenly between fixed bounds', () => {
  assert.deepEqual(LEVEL_COMPLETE_LAYOUT.info, { x: 0, width: 280, top: 118, bottom: 34, maxLineGap: 42 });
  assert.deepEqual([0, 1, 2].map((index) => completionInfoRowY(index, 3)), [118, 76, 34]);
  assert.deepEqual([0, 1, 2, 3].map((index) => completionInfoRowY(index, 4)), [118, 90, 62, 34]);
});

test('daily commission mirrors settings with a larger reward-led home entry', () => {
  assert.deepEqual(HOME_LAYOUT.dailyCommissionButton, { x: -150, y: 270, width: 64, height: 64 });
  assert.equal(HOME_LAYOUT.dailyCommissionButton.y, HOME_LAYOUT.settingsButton.y);
  assert.deepEqual(DAILY_COMMISSION_LAYOUT.action, { x: 0, y: -38, width: 240, height: 72 });
  const dialogBottom = DAILY_COMMISSION_LAYOUT.dialog.y - DAILY_COMMISSION_LAYOUT.dialog.height / 2;
  const actionBottom = DAILY_COMMISSION_LAYOUT.action.y - DAILY_COMMISSION_LAYOUT.action.height / 2;
  assert.ok(actionBottom - dialogBottom >= 24);
});

test('selector and completion actions use wide sliced buttons inside safe bounds', () => {
  assert.deepEqual(LEVEL_SELECT_LAYOUT.backButton, { x: 0, y: -342, width: 224, height: 72 });
  assert.deepEqual(LEVEL_COMPLETE_LAYOUT.primaryButton, { x: 0, y: -164, width: 240, height: 64 });
  assert.deepEqual(LEVEL_COMPLETE_LAYOUT.shareButton, { x: 62, y: -82, width: 116, height: 64 });
  assert.deepEqual(LEVEL_COMPLETE_LAYOUT.replayButton, { x: -62, y: -82, width: 116, height: 64 });
  assert.deepEqual(COLLECTION_LAYOUT.backButton, { x: -72, y: -342, width: 132, height: 56 });
  assert.deepEqual(COLLECTION_LAYOUT.shareButton, { x: 72, y: -342, width: 132, height: 56 });
  for (const button of [
    LEVEL_SELECT_LAYOUT.backButton,
    LEVEL_COMPLETE_LAYOUT.primaryButton,
    LEVEL_COMPLETE_LAYOUT.shareButton,
    LEVEL_COMPLETE_LAYOUT.replayButton,
    COLLECTION_LAYOUT.backButton,
    COLLECTION_LAYOUT.shareButton,
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

test('pour tilt follows the target column and defaults left within the same column', () => {
  assert.equal(bottlePourAngle(1, 0, 1), -27);
  assert.equal(bottlePourAngle(1, 4, 3), 29);
  assert.equal(bottlePourAngle(1, 0, 5), 29);
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
  const initial = createDemoState();
  const poured = pour(initial, 0, 1).state;
  const vanished = vanishBottle(poured, 1);

  assert.deepEqual(levelInteractionRefreshMode(initial, initial), { mode: 'feedback', indices: [] });
  assert.deepEqual(levelInteractionRefreshMode(initial, poured), { mode: 'bottles', indices: [0, 1] });
  assert.deepEqual(levelInteractionRefreshMode(poured, vanished), { mode: 'bottles', indices: [1] });
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

test('completion and collection copy follows chapter boundaries and potion catalog', () => {
  assert.equal(chapterLabel(1), '第一章');
  assert.equal(chapterLabel(2), '第二章');
  assert.equal(chapterLabel(3), '第三章');
  assert.equal(chapterLabel(4), '第四章');
  assert.equal(completionPrimaryLabel(30, 31), '进入第二章');
  assert.equal(completionPrimaryLabel(59, 60), '下一关');
  assert.equal(completionPrimaryLabel(60, 61), '进入第三章');
  assert.equal(completionPrimaryLabel(89, 90), '下一关');
  assert.equal(completionPrimaryLabel(90, 91), '进入第四章');
  assert.equal(completionPrimaryLabel(119, 120), '下一关');
  assert.equal(completionPrimaryLabel(120, null), '返回选关');
  assert.equal(completionOptimalLabel(22, 22), '✦ 完美炼成');
  assert.equal(completionOptimalLabel(25, 22), '本关最少 22 步 · 还可优化 3 步');
  assert.equal(collectionRewardLabel(2, 1), '获得森林药水拼图 1/6');
  assert.equal(collectionCompleteLabel(2), '森林药水已收入图鉴');
  assert.equal(collectionRewardLabel(3, 1), '获得月辉药水拼图 1/6');
  assert.equal(collectionCompleteLabel(3), '月辉药水已收入图鉴');
  assert.equal(collectionRewardLabel(4, 1), '获得火焰药水拼图 1/6');
  assert.equal(collectionCompleteLabel(4), '火焰药水已收入图鉴');
});

test('non-home settings trigger stays in the top-left safe area without overlapping chapter navigation', () => {
  assert.deepEqual(SETTINGS_LAYOUT.trigger, { x: -155, y: 378, width: 48, height: 48 });
  const triggerOverlapsPreviousChapter =
    Math.abs(SETTINGS_LAYOUT.trigger.x - LEVEL_SELECT_LAYOUT.previousChapterButton.x)
      < (SETTINGS_LAYOUT.trigger.width + LEVEL_SELECT_LAYOUT.previousChapterButton.width) / 2
    && Math.abs(SETTINGS_LAYOUT.trigger.y - LEVEL_SELECT_LAYOUT.previousChapterButton.y)
      < (SETTINGS_LAYOUT.trigger.height + LEVEL_SELECT_LAYOUT.previousChapterButton.height) / 2;
  assert.equal(triggerOverlapsPreviousChapter, false);
});

test('selector content moves below the runtime menu-aligned settings trigger with a 12px gap', () => {
  const offsetFor = (presentationLayout as typeof presentationLayout & {
    levelSelectContentOffset?: (settingsButtonY: number) => number;
  }).levelSelectContentOffset;
  assert.equal(typeof offsetFor, 'function');
  if (!offsetFor) return;

  assert.equal(offsetFor(381), 0);
  assert.equal(offsetFor(365), -13);
  const adjustedArrowY = LEVEL_SELECT_LAYOUT.previousChapterButton.y + offsetFor(350);
  const settingsBottom = 350 - SETTINGS_LAYOUT.trigger.height / 2;
  const arrowTop = adjustedArrowY + LEVEL_SELECT_LAYOUT.previousChapterButton.height / 2;
  assert.equal(settingsBottom - arrowTop, 12);
});

test('settings layout uses the accepted raster-backed dialog geometry', () => {
  assert.deepEqual(SETTINGS_LAYOUT.dialog, { x: 0, y: -21, width: 304, height: 360 });
  assert.deepEqual(SETTINGS_LAYOUT.close, { x: 116, y: 144, width: 48, height: 48 });
  assert.deepEqual(SETTINGS_LAYOUT.soundButton, { x: 0, y: 14, width: 224, height: 72 });
  assert.deepEqual(SETTINGS_LAYOUT.homeButton, { x: 0, y: -81, width: 224, height: 72 });
  assert.deepEqual(SETTINGS_LAYOUT.qaButton, { x: -58, y: -146, width: 108, height: 48 });
  assert.deepEqual(SETTINGS_LAYOUT.qaAdButton, { x: 58, y: -146, width: 108, height: 48 });
});
