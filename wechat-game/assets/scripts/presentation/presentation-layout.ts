import type { BottleStatus, GameState } from '../core/types.ts';
import { chapterForLevel, getChapter } from '../core/chapter-catalog.ts';
import { getPotionCollection } from '../core/potion-collection-catalog.ts';

export interface RectLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ButtonBaseLayout {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly sourceInset: number;
  readonly renderMode: 'simple' | 'sliced';
}

export interface BottleFeedbackVisual {
  readonly yOffset: number;
  readonly scale: number;
  readonly auraVisible: boolean;
}

export interface SelectedBottleAuraVisual {
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
}

export type PotionParticleState = 'idle' | 'selected' | 'pouring' | 'complete';

export interface PotionParticleVisual {
  readonly seed: number;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly opacity: number;
  readonly duration: number;
  readonly delay: number;
}

export interface PotionParticleFrame {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly opacity: number;
  readonly finished: boolean;
}

export const ART_FONT_RESOURCE = 'game/fonts/noto-serif-sc-ui';
export const RESTART_LABEL = '重来';

const CHAPTER_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const;

export function chapterLabel(chapterId: number): string {
  const chapter = getChapter(chapterId);
  if (!chapter) throw new RangeError('chapter ID must be an integer from 1 to 10');
  return `第${CHAPTER_NUMERALS[chapter.id - 1]}章`;
}

export function completionPrimaryLabel(currentLevel: number, nextLevel: number | null): string {
  if (nextLevel === null) return '返回选关';
  const currentChapter = chapterForLevel(currentLevel);
  const nextChapter = chapterForLevel(nextLevel);
  return currentChapter && nextChapter && currentChapter.id !== nextChapter.id
    ? `进入${chapterLabel(nextChapter.id)}`
    : '下一关';
}

export function completionOptimalLabel(moves: number, optimalMoves: number): string {
  return moves <= optimalMoves
    ? '✦ 完美炼成'
    : `本关最少 ${optimalMoves} 步 · 还可优化 ${moves - optimalMoves} 步`;
}

export function collectionRewardLabel(chapterId: number, piece: number): string {
  return `获得${getPotionCollection(chapterId)?.name ?? '稀有药水'}拼图 ${piece}/6`;
}

export function collectionCompleteLabel(chapterId: number): string {
  return `${getPotionCollection(chapterId)?.name ?? '稀有药水'}已收入图鉴`;
}

export const HEALTHY_GAME_ADVICE_LINES = Object.freeze([
  '抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。',
  '适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。',
] as const);

export const LAUNCH_LAYOUT = Object.freeze({
  ageBadge: Object.freeze({ x: -155, y: 376, width: 42, height: 42 }),
  title: Object.freeze({ x: 0, y: 235, width: 306, height: 229.5 }),
  witch: Object.freeze({ x: 0, y: 22, width: 260, height: 260 }),
  progressTrack: Object.freeze({ x: 0, y: -230, width: 300, height: 18 }),
  percent: Object.freeze({ x: 0, y: -265, width: 120, height: 32 }),
  status: Object.freeze({ x: 0, y: -290, width: 330, height: 32 }),
  retryButton: Object.freeze({ x: 0, y: -334, width: 224, height: 56 }),
  adviceCenters: Object.freeze([-374, -394] as const),
});

export function proportionalHeightForWidth(
  width: number,
  sourceWidth: number,
  sourceHeight: number,
): number {
  return width * sourceHeight / sourceWidth;
}

export function launchProgressFill(progress: number): Readonly<{ x: number; width: number }> {
  const normalized = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const fullWidth = LAUNCH_LAYOUT.progressTrack.width - 4;
  const width = fullWidth * normalized;
  return Object.freeze({
    x: -fullWidth / 2 + width / 2,
    width,
  });
}

export const HOME_LAYOUT = Object.freeze({
  titleBadge: Object.freeze({ x: 0, y: 101, width: 168 }),
  titleFloat: Object.freeze({ distance: 6, duration: 1.6 }),
  settingsButton: Object.freeze({ x: 150, y: 270, width: 48, height: 48 }),
  dailyCommissionButton: Object.freeze({ x: -150, y: 270, width: 64, height: 64 }),
  endlessButton: Object.freeze({ x: -150, y: 198, width: 64, height: 64, hitWidth: 96, hitHeight: 96 }),
  dailyCommissionBubble: Object.freeze({
    x: 56, y: 12, width: 64, height: 32, contentY: 3,
    floatDistance: 3, floatDuration: 1.2,
  }),
  collectionButton: Object.freeze({ x: 150, y: 198, width: 64, height: 64 }),
  shareButton: Object.freeze({ x: 150, y: 126, width: 64, height: 64 }),
  witch: Object.freeze({ x: 0, y: 0, width: 246, height: 304 }),
  continueButton: Object.freeze({ x: 0, y: -348, width: 286, height: 72 }),
  selectButton: Object.freeze({ x: 0, y: -266, width: 224, height: 56 }),
  showsProgressCard: false,
});

export function endlessHudText(stage: number, streak: number, remainingMoves: number): Readonly<{
  title: string;
  streak: string;
  moves: string;
}> {
  return Object.freeze({
    title: `无尽 · 第${stage}关`,
    streak: `连胜 ${streak}`,
    moves: `剩余 ${Math.max(0, remainingMoves)} 步`,
  });
}

export const STAMINA_LAYOUT = Object.freeze({
  homeBar: Object.freeze({ x: -118, y: 365, width: 136, height: 34, padding: Object.freeze({ horizontal: 4, vertical: 2 }), gap: 2, addSize: 18, addTrailingPadding: 10, iconCenterFromLeft: 22 }),
  dialog: Object.freeze({ x: 0, y: -8, width: 321, height: 430 }),
  dialogRows: Object.freeze({ title: 148, icon: 86, value: 40, status: 0, note: -34, message: -148 }),
  close: Object.freeze({ x: 124.5, y: 179, width: 48, height: 48 }),
  adButton: Object.freeze({ x: 0, y: -92, width: 240, height: 72 }),
  exitDialog: Object.freeze({ x: 0, y: -12, width: 304, height: 350 }),
  exitConfirm: Object.freeze({ x: 0, y: -48, width: 224, height: 64 }),
  exitCancel: Object.freeze({ x: 0, y: -120, width: 224, height: 56 }),
});

export function staminaBarYForMenu(viewportHeight: number, menuButtonCenterRatio: number | null): number {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0 || menuButtonCenterRatio === null
    || !Number.isFinite(menuButtonCenterRatio) || menuButtonCenterRatio < 0 || menuButtonCenterRatio > 1) {
    return STAMINA_LAYOUT.homeBar.y;
  }
  return viewportHeight * (0.5 - menuButtonCenterRatio);
}

export const DAILY_COMMISSION_LAYOUT = Object.freeze({
  dialog: Object.freeze({ x: 0, y: -8, width: 321, height: 430 }),
  close: Object.freeze({ x: 124.5, y: 179, width: 48, height: 48 }),
  titleY: 144,
  rewardY: 58,
  action: Object.freeze({ x: 0, y: -38, width: 240, height: 72 }),
  noteY: -156,
});

export const DIALOG_TRANSITION = Object.freeze({
  enter: Object.freeze({ duration: 0.28, fromScale: 0.92 }),
  exit: Object.freeze({ duration: 0.26, toScale: 0.96 }),
});

export function staminaBarContentLayout(): Readonly<{
  width: number;
  height: number;
  icon: RectLayout;
  value: RectLayout;
  status: RectLayout;
}> {
  const { homeBar } = STAMINA_LAYOUT;
  const height = 30;
  const iconWidth = 30;
  const valueWidth = 36;
  const statusWidth = 58;
  const width = iconWidth + homeBar.gap + valueWidth + homeBar.gap + statusWidth;
  const left = -width / 2;
  const icon = Object.freeze({ x: left, y: 0, width: iconWidth, height });
  const value = Object.freeze({ x: icon.x + icon.width + homeBar.gap, y: 0, width: valueWidth, height });
  const status = Object.freeze({ x: value.x + value.width + homeBar.gap, y: 0, width: statusWidth, height });
  return Object.freeze({ width, height, icon, value, status });
}
export function formatRecoveryCountdown(ms: number): string {
  const seconds = Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 1000)) : 0;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export const LEVEL_LAYOUT = Object.freeze({
  witch: Object.freeze({ x: 0, y: 213, width: 174, height: 182 }),
  bottle: Object.freeze({ width: 48, height: 104 }),
  liquid: Object.freeze({ x: 0, y: -8.5, width: 36, height: 61, radius: 11 }),
  slotColumns: Object.freeze([-136, -68, 0, 68, 136] as const),
  bottleRows: Object.freeze([70, -52, -174] as const),
  message: Object.freeze({ x: 0, y: -270, width: 321, height: 46 }),
  controlCenters: Object.freeze([-122, 0, 122] as const),
  controlY: -338,
  controlLabelY: -18,
  controlAllowanceBubble: HOME_LAYOUT.dailyCommissionBubble,
  controlAdBadge: Object.freeze({ x: 26, y: 27, width: 22, height: 18 }),
});

export function controlAllowanceVisual(remaining: number): Readonly<{ text: string; showAdBadge: boolean }> {
  return Object.freeze({ text: remaining === 0 ? '' : String(remaining), showAdBadge: remaining === 0 });
}

export const LEVEL_SELECT_LAYOUT = Object.freeze({
  header: Object.freeze({ x: 0, y: 320, width: 321, height: 44 }),
  starTotalY: 255,
  starTotalFontSize: 44,
  starTotalWidth: 260,
  previousChapterButton: Object.freeze({ x: -158, y: 320, width: 44, height: 44 }),
  nextChapterButton: Object.freeze({ x: 158, y: 320, width: 44, height: 44 }),
  columns: 5,
  rows: 6,
  buttonSize: 48,
  columnCenters: Object.freeze([-136, -68, 0, 68, 136] as const),
  rowCenters: Object.freeze([180, 112, 44, -24, -92, -160] as const),
  starY: -32,
  starSize: 15,
  starGap: 18,
  backButton: Object.freeze({ x: 0, y: -342, width: 224, height: 72 }),
});

export const COLLECTION_LAYOUT = Object.freeze({
  title: Object.freeze({ x: 0, y: 334, width: 300, height: 48 }),
  puzzle: Object.freeze({ x: 0, y: 58, width: 252, height: 252, columns: 2, rows: 3 }),
  progressY: -96,
  description: Object.freeze({ x: 0, y: -174, width: 300, height: 92 }),
  backButton: Object.freeze({ x: -72, y: -342, width: 132, height: 56 }),
  shareButton: Object.freeze({ x: 72, y: -342, width: 132, height: 56 }),
});

export const COLLECTION_OVERVIEW_LAYOUT = Object.freeze({
  title: Object.freeze({ x: 0, y: 350, width: 300, height: 48 }),
  viewport: Object.freeze({ x: 0, y: -4, width: 360, height: 636 }),
  card: Object.freeze({ width: 158, height: 180 }),
  columns: 2,
  rows: 5,
  columnCenters: Object.freeze([-87, 87] as const),
  rowGap: 18,
  contentPadding: 18,
  contentHeight: 1008,
  lockedTipY: -330,
  backButton: Object.freeze({ x: 0, y: -374, width: 224, height: 48 }),
});

export const COLLECTION_LOCK_VISUAL = Object.freeze({
  width: 30,
  height: 38.5,
  assetWidth: 60,
  assetHeight: 77,
});

export const LEVEL_COMPLETE_LAYOUT = Object.freeze({
  panel: Object.freeze({ x: 0, y: -5, width: 321, height: 470 }),
  title: Object.freeze({ x: 0, y: 174, width: 260, height: 52 }),
  starsY: -8,
  info: Object.freeze({ x: 0, width: 280, top: 118, bottom: 34, maxLineGap: 42 }),
  primaryButton: Object.freeze({ x: 0, y: -164, width: 240, height: 64 }),
  shareButton: Object.freeze({ x: 62, y: -82, width: 116, height: 64 }),
  replayButton: Object.freeze({ x: -62, y: -82, width: 116, height: 64 }),
});

export function completionInfoRowY(index: number, rowCount: number): number {
  const info = LEVEL_COMPLETE_LAYOUT.info;
  const gap = rowCount <= 1 ? 0 : Math.min(
    info.maxLineGap,
    (info.top - info.bottom) / (rowCount - 1),
  );
  return (info.top + info.bottom + gap * (rowCount - 1)) / 2 - gap * index;
}

export const SETTINGS_LAYOUT = Object.freeze({
  trigger: Object.freeze({ x: -155, y: 378, width: 48, height: 48 }),
  dialog: Object.freeze({ x: 0, y: -21, width: 304, height: 360 }),
  close: Object.freeze({ x: 116, y: 144, width: 48, height: 48 }),
  soundButton: Object.freeze({ x: 0, y: 14, width: 224, height: 72 }),
  homeButton: Object.freeze({ x: 0, y: -81, width: 224, height: 72 }),
  qaButton: Object.freeze({ x: -58, y: -146, width: 108, height: 48 }),
  qaAdButton: Object.freeze({ x: 58, y: -146, width: 108, height: 48 }),
});

export function levelSelectContentOffset(settingsButtonY: number): number {
  const safeGap = 12;
  const settingsBottom = settingsButtonY - SETTINGS_LAYOUT.trigger.height / 2;
  const chapterArrowTop = LEVEL_SELECT_LAYOUT.previousChapterButton.y
    + LEVEL_SELECT_LAYOUT.previousChapterButton.height / 2;
  return Math.min(0, settingsBottom - safeGap - chapterArrowTop);
}

export function levelSelectButton(index: number): RectLayout {
  const total = LEVEL_SELECT_LAYOUT.columns * LEVEL_SELECT_LAYOUT.rows;
  if (!Number.isInteger(index) || index < 0 || index >= total) {
    throw new RangeError(`level selector index must be from 0 to ${total - 1}`);
  }
  return Object.freeze({
    x: LEVEL_SELECT_LAYOUT.columnCenters[index % LEVEL_SELECT_LAYOUT.columns],
    y: LEVEL_SELECT_LAYOUT.rowCenters[Math.floor(index / LEVEL_SELECT_LAYOUT.columns)],
    width: LEVEL_SELECT_LAYOUT.buttonSize,
    height: LEVEL_SELECT_LAYOUT.buttonSize,
  });
}

export interface CollectionPuzzlePiece {
  readonly column: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly artOffsetX: number;
  readonly artOffsetY: number;
}

export function collectionPuzzlePiece(index: number): CollectionPuzzlePiece {
  const { puzzle } = COLLECTION_LAYOUT;
  const total = puzzle.columns * puzzle.rows;
  if (!Number.isInteger(index) || index < 0 || index >= total) {
    throw new RangeError(`collection puzzle index must be from 0 to ${total - 1}`);
  }

  const column = index % puzzle.columns;
  const row = Math.floor(index / puzzle.columns);
  const width = puzzle.width / puzzle.columns;
  const height = puzzle.height / puzzle.rows;
  const x = puzzle.x - puzzle.width / 2 + width * (column + 0.5);
  const y = puzzle.y + puzzle.height / 2 - height * (row + 0.5);
  return Object.freeze({
    column,
    row,
    x,
    y,
    width,
    height,
    artOffsetX: puzzle.x - x,
    artOffsetY: puzzle.y - y,
  });
}

export interface CollectionCardLayout extends RectLayout {
  readonly column: number;
  readonly row: number;
}

export function collectionCardLayout(index: number): CollectionCardLayout {
  const total = COLLECTION_OVERVIEW_LAYOUT.columns * COLLECTION_OVERVIEW_LAYOUT.rows;
  if (!Number.isInteger(index) || index < 0 || index >= total) {
    throw new RangeError(`collection card index must be from 0 to ${total - 1}`);
  }

  const column = index % COLLECTION_OVERVIEW_LAYOUT.columns;
  const row = Math.floor(index / COLLECTION_OVERVIEW_LAYOUT.columns);
  const { card } = COLLECTION_OVERVIEW_LAYOUT;
  return Object.freeze({
    column,
    row,
    x: COLLECTION_OVERVIEW_LAYOUT.columnCenters[column],
    y: COLLECTION_OVERVIEW_LAYOUT.contentHeight / 2 - COLLECTION_OVERVIEW_LAYOUT.contentPadding
      - card.height / 2 - row * (card.height + COLLECTION_OVERVIEW_LAYOUT.rowGap),
    width: card.width,
    height: card.height,
  });
}

export interface MysteryPotionSheetCell {
  readonly path: string;
  readonly size: number;
  readonly x: number;
  readonly y: number;
}

export function mysteryPotionSheetCell(index: number): MysteryPotionSheetCell {
  if (!Number.isInteger(index) || index < 0 || index >= 9) {
    throw new RangeError('mystery potion index must be from 0 to 8');
  }
  const column = index % 3;
  const row = Math.floor(index / 3);
  return Object.freeze({
    path: 'game/chibi/collection/mystery-potions/spriteFrame',
    size: 288,
    x: (1 - column) * 96,
    y: (row - 1) * 96,
  });
}

export interface TitleBadgeSheetCell {
  readonly path: string;
  readonly sourceX: number;
  readonly sourceY: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
}

export function titleBadgeSheetCell(chapterId: number): TitleBadgeSheetCell {
  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > 10) {
    throw new RangeError('title chapter ID must be from 1 to 10');
  }
  const index = chapterId - 1;
  const column = index % 2;
  const row = Math.floor(index / 2);
  return Object.freeze({
    path: 'game/chibi/titles/title-badges/spriteFrame',
    sourceX: column * 336,
    sourceY: row * 90,
    sourceWidth: 336,
    sourceHeight: 90,
    displayWidth: 168,
    displayHeight: 45,
  });
}
function hash32(value: number): number {
  let hash = value | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function bottleFeedbackVisual(selected: boolean, pouring: boolean): BottleFeedbackVisual {
  if (selected) return Object.freeze({ yOffset: 10, scale: 1.04, auraVisible: true });
  if (pouring) return Object.freeze({ yOffset: 0, scale: 1.06, auraVisible: false });
  return Object.freeze({ yOffset: 0, scale: 1, auraVisible: false });
}

export function bottlePourAngle(baseAngle: number, sourceIndex: number, targetIndex: number): number {
  const sourceColumn = sourceIndex % LEVEL_LAYOUT.slotColumns.length;
  const targetColumn = targetIndex % LEVEL_LAYOUT.slotColumns.length;
  return baseAngle + (targetColumn > sourceColumn ? -28 : 28);
}

export function selectedBottleAuraVisual(): readonly SelectedBottleAuraVisual[] {
  return Object.freeze([
    Object.freeze({ width: 52, height: 112, opacity: 0.35 }),
    Object.freeze({ width: 56, height: 116, opacity: 0.2 }),
    Object.freeze({ width: 60, height: 120, opacity: 0.1 }),
  ]);
}

export interface LevelInteractionRefreshPlan {
  readonly mode: 'feedback' | 'bottles';
  readonly indices: readonly number[];
}

export function levelInteractionRefreshMode(before: GameState, after: GameState): LevelInteractionRefreshPlan {
  const indices = before.bottles.flatMap((bottle, index) => (
    bottle === after.bottles[index] ? [] : [index]
  ));
  return indices.length > 0 ? { mode: 'bottles', indices } : { mode: 'feedback', indices };
}

const POTION_PARTICLE_STYLE = Object.freeze({
  idle: Object.freeze({ opacity: 0.36, duration: 2.2 }),
  selected: Object.freeze({ opacity: 0.45, duration: 1.76 }),
  pouring: Object.freeze({ opacity: 0.45, duration: 0.52 }),
  complete: Object.freeze({ opacity: 0.52, duration: 0.36 }),
});

export function potionParticleVisuals(
  levelSeed: number,
  slotIndex: number,
  layerIndex: number,
  state: PotionParticleState,
): readonly PotionParticleVisual[] {
  const seed = levelSeed * 131 + slotIndex * 977 + layerIndex * 6971;
  const seeds = [hash32(seed) / 0xffffffff, hash32(seed + 1) / 0xffffffff];
  const style = POTION_PARTICLE_STYLE[state];
  return Object.freeze(seeds.map((particleSeed) => Object.freeze({
    seed: particleSeed,
    x: -11.52 + 23.04 * particleSeed,
    y: -5,
    size: 14,
    opacity: style.opacity,
    duration: style.duration,
    delay: -particleSeed * 1.4,
  })));
}

export function potionParticleState(
  pendingCompletion: boolean,
  pouring: boolean,
  selected: boolean,
): PotionParticleState {
  if (pendingCompletion) return 'complete';
  if (pouring) return 'pouring';
  return selected ? 'selected' : 'idle';
}

function cubicBezierCoordinate(t: number, first: number, second: number): number {
  const remaining = 1 - t;
  return 3 * remaining * remaining * t * first
    + 3 * remaining * t * t * second
    + t * t * t;
}

function cubicBezierAt(progress: number, x1: number, y1: number, x2: number, y2: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (cubicBezierCoordinate(midpoint, x1, x2) < progress) lower = midpoint;
    else upper = midpoint;
  }
  return cubicBezierCoordinate((lower + upper) / 2, y1, y2);
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function potionParticleFrame(
  visual: PotionParticleVisual,
  state: PotionParticleState,
  elapsed: number,
): PotionParticleFrame {
  const duration = POTION_PARTICLE_STYLE[state].duration;
  const animationTime = Math.max(0, elapsed - visual.delay);

  if (state === 'idle' || state === 'selected') {
    const progress = (animationTime % duration) / duration;
    const rising = progress <= 0.48;
    const segmentProgress = rising ? progress / 0.48 : (progress - 0.48) / 0.52;
    const eased = cubicBezierAt(segmentProgress, 0.42, 0, 0.58, 1);
    const amount = rising ? eased : 1 - eased;
    return Object.freeze({
      x: visual.x + 3 * amount,
      y: visual.y + 17 * amount,
      scale: interpolate(0.78, 1, amount),
      opacity: interpolate(0.2, 0.46, amount),
      finished: false,
    });
  }

  const progress = Math.min(1, animationTime / duration);
  const eased = cubicBezierAt(progress, 0, 0, 0.58, 1);
  if (state === 'pouring') {
    return Object.freeze({
      x: visual.x + 34 * eased,
      y: visual.y - 18 * eased,
      scale: interpolate(0.88, 0.64, eased),
      opacity: interpolate(0.4, 0, eased),
      finished: progress >= 1,
    });
  }
  return Object.freeze({
    x: visual.x + 12 * eased,
    y: visual.y + 36 * eased,
    scale: interpolate(0.75, 1.12, eased),
    opacity: interpolate(0.54, 0, eased),
    finished: progress >= 1,
  });
}

export function potionProgressLabel(completed: number, target: number): string {
  return `魔药 ${completed}/${target}`;
}

export function seededBottlePose(levelSeed: number, slotIndex: number): Readonly<{ x: number; y: number; rotate: number }> {
  const hash = hash32(levelSeed * 131 + slotIndex * 977);
  return Object.freeze({
    x: (hash % 11) - 5,
    y: ((hash >>> 8) % 21) - 10,
    rotate: (((hash >>> 16) % 41) - 20) / 10,
  });
}

export function bottlePlacement(levelSeed: number, slotIndex: number): Readonly<{ x: number; y: number; angle: number }> {
  const column = LEVEL_LAYOUT.slotColumns[slotIndex % 5] ?? 0;
  const row = LEVEL_LAYOUT.bottleRows[Math.floor(slotIndex / 5)] ?? LEVEL_LAYOUT.bottleRows.at(-1)!;
  const firstRowTightening = slotIndex < 5 ? [10, 5, 0, -5, -10][slotIndex] ?? 0 : 0;
  const pose = seededBottlePose(levelSeed, slotIndex);
  return Object.freeze({
    x: column + firstRowTightening + pose.x,
    y: row - pose.y,
    angle: -pose.rotate,
  });
}

export function shouldRenderBottle(status: BottleStatus): boolean {
  return status === 'active';
}

export type ButtonVariant = 'purple' | 'gold';
export type LevelButtonState = 'completed' | 'current' | 'unlocked' | 'locked';

export interface LevelButtonVisual {
  readonly variant: ButtonVariant;
  readonly disabled: boolean;
  readonly highlighted: boolean;
}

export function levelButtonVisual(state: LevelButtonState): LevelButtonVisual {
  if (state === 'completed') {
    return Object.freeze({ variant: 'gold', disabled: false, highlighted: false });
  }
  if (state === 'current') {
    return Object.freeze({ variant: 'gold', disabled: false, highlighted: true });
  }
  if (state === 'locked') {
    return Object.freeze({ variant: 'purple', disabled: true, highlighted: false });
  }
  return Object.freeze({ variant: 'purple', disabled: false, highlighted: false });
}

export function buttonSpritePath(variant: ButtonVariant, disabled: boolean, pressed: boolean): string {
  const state = disabled ? 'disabled' : pressed ? 'pressed' : 'normal';
  return `game/chibi/ui/button-${variant}-${state}/spriteFrame`;
}

export function buttonBaseLayout(stage: RectLayout, mode: 'contain' | 'sliced'): ButtonBaseLayout {
  if (mode === 'contain') {
    const size = Math.min(stage.width, stage.height);
    return Object.freeze({
      width: size,
      height: size,
      x: 0,
      y: 0,
      scale: 1,
      sourceInset: 0,
      renderMode: 'simple' as const,
    });
  }

  const scale = 1 / 3;
  return Object.freeze({
    width: stage.width / scale,
    height: stage.height / scale,
    x: 0,
    y: 0,
    scale,
    sourceInset: 72,
    renderMode: 'sliced' as const,
  });
}

export function squareBottomFit(stage: RectLayout): Readonly<{ width: number; height: number; y: number }> {
  const size = Math.min(stage.width, stage.height);
  return Object.freeze({ width: size, height: size, y: -(stage.height - size) / 2 });
}
