import { createDemoState } from './demo-level.ts';
import { canPour, isCompleteBottle } from './water-sort.ts';
import type { GameState, PotionColor } from './types.ts';

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
  readonly misleadingBranchRatio: number;
  readonly difficultyRating: number;
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

const POTION_COLORS = new Set<string>([
  'rose',
  'violet',
  'amber',
  'cyan',
  'mint',
  'blue',
  'gold',
  'lilac',
  'scarlet',
  'chartreuse',
  'indigo',
  'pearl',
]);

export function levelId(number: number): string {
  if (!Number.isInteger(number) || number < 1 || number > 999) {
    throw new RangeError('level number must be an integer from 1 to 999');
  }
  return `level-${String(number).padStart(3, '0')}`;
}

export function levelNumber(id: string): number | null {
  const match = /^level-([0-9]{3})$/.exec(id);
  if (!match) return null;
  const number = Number(match[1]);
  return number >= 1 ? number : null;
}

export function countColorSegments(state: GameState): number {
  let total = 0;
  for (const bottle of state.bottles) {
    let previous: PotionColor | undefined;
    for (const color of bottle.layers) {
      if (color !== previous) total += 1;
      previous = color;
    }
  }
  return total;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round3 = (value: number): number => Math.round(value * 1_000) / 1_000;

export function difficultyRating(
  metrics: Omit<LevelMetrics, 'difficultyRating' | 'difficultyScore'>,
): number {
  const solution = clamp01((metrics.optimalMoves - 5) / 30);
  const segments = clamp01(
    (metrics.segmentCount - metrics.colorCount) / (metrics.colorCount * 2.5),
  );
  const search = clamp01(Math.log10(metrics.exploredStates + 1) / 6);
  const openingConstraint = clamp01(1 - Math.abs(metrics.openingMoves - 8) / 20);
  return round3(
    0.36 * solution
      + 0.22 * segments
      + 0.18 * search
      + 0.10 * openingConstraint
      + 0.14 * metrics.misleadingBranchRatio,
  );
}

function countLegalOpeningMoves(state: GameState): number {
  let moves = 0;
  for (let from = 0; from < state.bottles.length; from += 1) {
    for (let to = 0; to < state.bottles.length; to += 1) {
      if (canPour(state, from, to)) moves += 1;
    }
  }
  return moves;
}

export function validateLevelConfig(config: LevelConfig): readonly string[] {
  const errors: string[] = [];
  const expectedId = Number.isInteger(config.number)
    && config.number >= 1
    && config.number <= 999
    ? levelId(config.number)
    : null;

  if (expectedId === null) {
    errors.push('number must be an integer from 1 to 999');
  } else if (config.id !== expectedId) {
    errors.push(`id must match number as ${expectedId}`);
  }
  if (config.capacity !== 4) errors.push('capacity must be 4');
  if (config.slotCount !== 15) errors.push('slotCount must be 15');
  if (config.rewardSlotIndex !== 14) errors.push('rewardSlotIndex must be 14');
  if (
    !Number.isFinite(config.metrics?.misleadingBranchRatio)
    || config.metrics.misleadingBranchRatio < 0
    || config.metrics.misleadingBranchRatio > 1
  ) {
    errors.push('metrics.misleadingBranchRatio must be finite and from 0 to 1');
  }
  if (
    !Number.isFinite(config.metrics?.difficultyRating)
    || config.metrics.difficultyRating < 0
    || config.metrics.difficultyRating > 1
  ) {
    errors.push('metrics.difficultyRating must be finite and from 0 to 1');
  }

  const bottles = config.initialState?.bottles;
  if (!Array.isArray(bottles) || bottles.length !== 15) {
    errors.push('initial state must contain exactly 15 slots');
  }

  const colorTotals = new Map<PotionColor, number>();
  let activeEmptyBottles = 0;
  for (const [index, bottle] of (bottles ?? []).entries()) {
    if (bottle.layers.length > 4) {
      errors.push(`bottle ${index} exceeds capacity 4`);
    }
    if (bottle.status === 'active' && bottle.layers.length === 0) {
      activeEmptyBottles += 1;
    }
    if (isCompleteBottle(bottle)) {
      errors.push(`bottle ${index} is an initial completed bottle`);
    }
    for (const color of bottle.layers) {
      if (!POTION_COLORS.has(color)) {
        errors.push(`bottle ${index} contains unknown color ${String(color)}`);
        continue;
      }
      colorTotals.set(color, (colorTotals.get(color) ?? 0) + 1);
    }
  }

  const rewardSlot = bottles?.[14];
  if (rewardSlot?.status !== 'reserved' || rewardSlot.layers.length !== 0) {
    errors.push('reward slot 14 must be empty and reserved');
  }

  for (const [color, total] of [...colorTotals].sort(([left], [right]) => (
    left.localeCompare(right)
  ))) {
    if (total !== 4) errors.push(`color ${color} must total 4 layers; received ${total}`);
  }

  const tutorial = config.completionRule.type !== 'all-colors';
  if (config.number !== 12 && !tutorial && activeEmptyBottles < 2) {
    errors.push('non-legacy levels require at least 2 active empty bottles');
  }
  if (!tutorial && bottles?.length === 15 && countLegalOpeningMoves(config.initialState) < 2) {
    errors.push('non-tutorial levels require at least 2 legal opening moves');
  }

  return errors;
}

export const DEMO_LEVEL_CONFIG: LevelConfig = Object.freeze({
  id: 'level-012',
  number: 12,
  configVersion: '2026.08.23.1',
  presentationSeed: 12,
  capacity: 4,
  slotCount: 15,
  rewardSlotIndex: 14,
  completionRule: Object.freeze({ type: 'all-colors', targetCount: 8 }),
  metrics: Object.freeze({
    colorCount: 8,
    optimalMoves: 23,
    segmentCount: 30,
    exploredStates: 1_075,
    openingMoves: 20,
    misleadingBranchRatio: 0.7,
    difficultyRating: 0.665,
    difficultyScore: 6_650,
  }),
  initialState: createDemoState(),
});
