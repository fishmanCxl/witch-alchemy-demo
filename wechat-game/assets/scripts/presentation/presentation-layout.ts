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
