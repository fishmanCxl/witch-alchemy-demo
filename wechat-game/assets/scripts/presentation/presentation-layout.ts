import type { BottleStatus } from '../core/types.ts';

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

export const HEALTHY_GAME_ADVICE_LINES = Object.freeze([
  '抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。',
  '适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。',
] as const);

export const LAUNCH_LAYOUT = Object.freeze({
  ageBadge: Object.freeze({ x: -155, y: 376, width: 42, height: 42 }),
  title: Object.freeze({ x: 0, y: 235, width: 330, height: 74 }),
  witch: Object.freeze({ x: 0, y: 22, width: 260, height: 260 }),
  progressTrack: Object.freeze({ x: 0, y: -230, width: 300, height: 18 }),
  percent: Object.freeze({ x: 0, y: -265, width: 120, height: 32 }),
  status: Object.freeze({ x: 0, y: -290, width: 330, height: 32 }),
  retryButton: Object.freeze({ x: 0, y: -334, width: 224, height: 56 }),
  adviceCenters: Object.freeze([-374, -394] as const),
});

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
  header: Object.freeze({ x: -86, y: 326, width: 176, align: 'left' as const }),
  witch: Object.freeze({ x: 0, y: 51, width: 246, height: 304 }),
  continueButton: Object.freeze({ x: 0, y: -348, width: 286, height: 72 }),
  selectButton: Object.freeze({ x: 0, y: -266, width: 224, height: 56 }),
  showsProgressCard: false,
});

export const LEVEL_LAYOUT = Object.freeze({
  witch: Object.freeze({ x: 0, y: 213, width: 174, height: 182 }),
  bottle: Object.freeze({ width: 48, height: 104 }),
  liquid: Object.freeze({ x: 0, y: -10.5, width: 36, height: 65, radius: 13 }),
  slotColumns: Object.freeze([-136, -68, 0, 68, 136] as const),
  bottleRows: Object.freeze([70, -52, -174] as const),
  message: Object.freeze({ x: 0, y: -270, width: 321, height: 46 }),
  controlCenters: Object.freeze([-122, 0, 122] as const),
  controlY: -338,
});

export const LEVEL_SELECT_LAYOUT = Object.freeze({
  header: Object.freeze({ x: 0, y: 330, width: 321, height: 58 }),
  columns: 5,
  rows: 3,
  buttonSize: 56,
  columnCenters: Object.freeze([-136, -68, 0, 68, 136] as const),
  rowCenters: Object.freeze([138, 58, -22] as const),
  backButton: Object.freeze({ x: 0, y: -342, width: 224, height: 72 }),
});

export const LEVEL_COMPLETE_LAYOUT = Object.freeze({
  panel: Object.freeze({ x: 0, y: -5, width: 321, height: 470 }),
  title: Object.freeze({ x: 0, y: 142, width: 260, height: 52 }),
  stats: Object.freeze({ x: 0, y: 68, width: 250, height: 46 }),
  primaryButton: Object.freeze({ x: 0, y: -72, width: 240, height: 72 }),
  secondaryButton: Object.freeze({ x: 0, y: -164, width: 240, height: 72 }),
});

export const SETTINGS_LAYOUT = Object.freeze({
  trigger: Object.freeze({ x: 155, y: 340, width: 48, height: 48 }),
  dialog: Object.freeze({ x: 0, y: -21, width: 304, height: 360 }),
  close: Object.freeze({ x: 110, y: 138, width: 48, height: 48 }),
  soundButton: Object.freeze({ x: 0, y: 14, width: 224, height: 72 }),
  homeButton: Object.freeze({ x: 0, y: -81, width: 224, height: 72 }),
});

export function levelSelectButton(index: number): RectLayout {
  if (!Number.isInteger(index) || index < 0 || index >= 15) {
    throw new RangeError('level selector index must be from 0 to 14');
  }
  return Object.freeze({
    x: LEVEL_SELECT_LAYOUT.columnCenters[index % LEVEL_SELECT_LAYOUT.columns],
    y: LEVEL_SELECT_LAYOUT.rowCenters[Math.floor(index / LEVEL_SELECT_LAYOUT.columns)],
    width: LEVEL_SELECT_LAYOUT.buttonSize,
    height: LEVEL_SELECT_LAYOUT.buttonSize,
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

export function potionParticleVisuals(
  levelSeed: number,
  slotIndex: number,
  layerIndex: number,
  state: PotionParticleState,
): readonly PotionParticleVisual[] {
  const seed = levelSeed * 131 + slotIndex * 977 + layerIndex * 6971;
  const seeds = [hash32(seed) / 0xffffffff, hash32(seed + 1) / 0xffffffff];
  const style = {
    idle: { opacity: 0.36, duration: 2.2 },
    selected: { opacity: 0.45, duration: 1.76 },
    pouring: { opacity: 0.45, duration: 0.52 },
    complete: { opacity: 0.52, duration: 0.36 },
  }[state];
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
  const duration = Math.max(Number.EPSILON, visual.duration);
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
