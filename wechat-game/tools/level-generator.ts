import {
  countColorSegments,
  difficultyRating,
  type CompletionRule,
  type LevelMetrics,
} from '../assets/scripts/core/level-config.ts';
import type { BottleState, GameState, PotionColor } from '../assets/scripts/core/types.ts';
import { canPour, isCompleteBottle, pour } from '../assets/scripts/core/water-sort.ts';
import {
  analyzeOpeningBranches,
  applyMoveAndVanish,
  solveLevel,
  type Move,
} from './level-solver.ts';

export interface GenerationSpec {
  readonly number: number;
  readonly colorCount: number;
  readonly emptyBottleCount: number;
  readonly reverseMoves: number;
  readonly targetDifficulty: number;
  readonly minimumOptimalMoves: number;
  readonly maximumOptimalMoves: number;
  readonly minimumSegments: number;
  readonly minimumExploredStates: number;
  readonly minimumOpeningMoves: number;
  readonly maximumOpeningMoves: number;
  readonly minimumMisleadingBranchRatio: number;
  readonly maxAttempts: number;
}

export interface GenerationScoreComponents {
  readonly color: number;
  readonly solution: number;
  readonly segments: number;
  readonly search: number;
  readonly openingConstraint: number;
  readonly wrongBranchPenalty: number;
}

export interface GeneratedCandidate {
  readonly seed: number;
  readonly attempt: number;
  readonly initialState: GameState;
  readonly inverseMoves: readonly Move[];
  readonly metrics: LevelMetrics;
  readonly scoreComponents: GenerationScoreComponents;
}

export function generatedOutputMatches(actual: string, expected: string): boolean {
  const normalizeLineEndings = (value: string): string => value.replace(/\r\n?/g, '\n');
  return normalizeLineEndings(actual) === normalizeLineEndings(expected);
}

interface ReverseTransition {
  readonly from: number;
  readonly to: number;
  readonly amount: number;
}

const COLORS: readonly PotionColor[] = [
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
];

function active(layers: readonly PotionColor[]): BottleState {
  return { layers: [...layers], status: 'active' };
}

function createSolvedState(spec: GenerationSpec): GameState {
  const activeBottles: BottleState[] = COLORS
    .slice(0, spec.colorCount)
    .map((color) => active([color, color, color, color]));
  for (let index = 0; index < spec.emptyBottleCount; index += 1) {
    activeBottles.push(active([]));
  }
  while (activeBottles.length < 14) {
    activeBottles.push({ layers: [], status: 'inactive' });
  }
  activeBottles.push({ layers: [], status: 'reserved' });
  return { bottles: activeBottles, rewardBottleUsed: false, moves: 0 };
}

function topRunLength(bottle: BottleState): number {
  const top = bottle.layers.at(-1);
  if (top === undefined) return 0;
  let length = 1;
  for (let index = bottle.layers.length - 2; index >= 0; index -= 1) {
    if (bottle.layers[index] !== top) break;
    length += 1;
  }
  return length;
}

function reverseTransitions(state: GameState): readonly ReverseTransition[] {
  const transitions: ReverseTransition[] = [];
  for (let from = 0; from < state.bottles.length; from += 1) {
    const source = state.bottles[from];
    if (source.status !== 'active' || source.layers.length === 0) continue;
    const color = source.layers.at(-1) as PotionColor;
    const runLength = topRunLength(source);
    for (let amount = 1; amount <= runLength; amount += 1) {
      const remainingLength = source.layers.length - amount;
      if (amount === runLength && remainingLength > 0) continue;
      for (let to = 0; to < state.bottles.length; to += 1) {
        const target = state.bottles[to];
        if (from === to || target.status !== 'active') continue;
        if (target.layers.length + amount > 4) continue;
        const targetTop = target.layers.at(-1);
        if (targetTop === color) continue;
        transitions.push({ from, to, amount });
      }
    }
  }
  return transitions;
}

function applyReverseMove(state: GameState, move: ReverseTransition): GameState | null {
  const source = state.bottles[move.from];
  const target = state.bottles[move.to];
  const color = source.layers.at(-1) as PotionColor;
  const bottles = state.bottles.map((bottle, index): BottleState => {
    if (index === move.from) {
      return { ...bottle, layers: bottle.layers.slice(0, -move.amount) };
    }
    if (index === move.to) {
      return {
        ...bottle,
        layers: [...bottle.layers, ...Array<PotionColor>(move.amount).fill(color)],
      };
    }
    return bottle;
  });
  const next: GameState = { ...state, bottles, moves: 0 };
  const inverse = pour(next, move.to, move.from);
  if (inverse.moved !== move.amount) return null;
  const restoredLayers = inverse.state.bottles.map((bottle) => bottle.layers);
  const previousLayers = state.bottles.map((bottle) => bottle.layers);
  return JSON.stringify(restoredLayers) === JSON.stringify(previousLayers) ? next : null;
}

function stateKey(state: GameState): string {
  return state.bottles.map((bottle) => `${bottle.status}:${bottle.layers.join(',')}`).join('|');
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function scramble(spec: GenerationSpec, seed: number): {
  readonly state: GameState;
  readonly inverseMoves: readonly Move[];
} | null {
  const random = mulberry32(seed);
  let state = createSolvedState(spec);
  const visited = new Set<string>([stateKey(state)]);
  const inverses: Move[] = [];

  for (let step = 0; step < spec.reverseMoves; step += 1) {
    const transitions = reverseTransitions(state)
      .map((transition) => ({
        transition,
        next: applyReverseMove(state, transition),
      }))
      .filter((entry): entry is { transition: ReverseTransition; next: GameState } => (
        entry.next !== null && !visited.has(stateKey(entry.next))
      ));
    if (transitions.length === 0) return null;

    const selected = transitions[Math.floor(random() * transitions.length)];
    state = selected.next;
    visited.add(stateKey(state));
    inverses.push({ from: selected.transition.to, to: selected.transition.from });
  }

  return { state, inverseMoves: inverses.reverse() };
}

function replayIsValid(
  state: GameState,
  inverseMoves: readonly Move[],
  colorCount: number,
): boolean {
  let current = state;
  for (const move of inverseMoves) {
    if (!canPour(current, move.from, move.to)) return false;
    current = applyMoveAndVanish(current, move);
  }
  return current.bottles.filter((bottle) => bottle.status === 'vanished').length === colorCount;
}

export function scoreCandidate(
  colorCount: number,
  optimalMoves: number,
  segments: number,
  exploredStates: number,
  openingMoves: number,
  misleadingBranchRatio = 0,
): { readonly difficultyScore: number; readonly components: GenerationScoreComponents } {
  const components: GenerationScoreComponents = {
    color: Math.max(0, colorCount - 1) * 100,
    solution: optimalMoves * 24,
    segments: segments * 10,
    search: Math.floor(Math.log2(Math.max(1, exploredStates))) * 18,
    openingConstraint: Math.max(0, 24 - openingMoves) * 60,
    wrongBranchPenalty: Math.max(0, openingMoves - 2) * 3,
  };
  const rating = difficultyRating({
    colorCount,
    optimalMoves,
    segmentCount: segments,
    exploredStates,
    openingMoves,
    misleadingBranchRatio,
  });
  return {
    difficultyScore: Math.round(rating * 10_000),
    components,
  };
}

export function analyzeState(
  state: GameState,
  colorCount: number,
  completionRule: CompletionRule,
  maxExploredStates = 250_000,
): {
  readonly metrics: LevelMetrics;
  readonly scoreComponents: GenerationScoreComponents;
  readonly solution: readonly Move[];
} | null {
  const result = solveLevel(state, { completionRule, maxExploredStates });
  if (!result.solved) return null;
  const segments = countColorSegments(state);
  const openingAnalysis = analyzeOpeningBranches(
    state,
    completionRule,
    result.moves.length,
    maxExploredStates,
  );
  const rating = difficultyRating({
    colorCount,
    optimalMoves: result.moves.length,
    segmentCount: segments,
    exploredStates: result.exploredStates,
    openingMoves: result.openingMoves,
    misleadingBranchRatio: openingAnalysis.ratio,
  });
  const score = scoreCandidate(
    colorCount,
    result.moves.length,
    segments,
    result.exploredStates,
    result.openingMoves,
    openingAnalysis.ratio,
  );
  return {
    metrics: {
      colorCount,
      optimalMoves: result.moves.length,
      segmentCount: segments,
      exploredStates: result.exploredStates,
      openingMoves: result.openingMoves,
      misleadingBranchRatio: openingAnalysis.ratio,
      difficultyRating: rating,
      difficultyScore: Math.round(rating * 10_000),
    },
    scoreComponents: score.components,
    solution: result.moves,
  };
}

function validShape(state: GameState, spec: GenerationSpec): boolean {
  if (state.bottles.some(isCompleteBottle)) return false;
  const activeEmptyCount = state.bottles.filter((bottle) => (
    bottle.status === 'active' && bottle.layers.length === 0
  )).length;
  return activeEmptyCount >= spec.emptyBottleCount
    && state.bottles[14]?.status === 'reserved'
    && state.bottles[14].layers.length === 0;
}

function validateSpec(spec: GenerationSpec): void {
  if (!Number.isInteger(spec.number) || spec.number < 1) throw new RangeError('number must be positive');
  if (!Number.isInteger(spec.colorCount) || spec.colorCount < 1 || spec.colorCount > COLORS.length) {
    throw new RangeError(`colorCount must be from 1 to ${COLORS.length}`);
  }
  if (!Number.isInteger(spec.emptyBottleCount) || spec.emptyBottleCount < 2) {
    throw new RangeError('emptyBottleCount must be at least 2');
  }
  if (spec.colorCount + spec.emptyBottleCount > 14) {
    throw new RangeError('colors and empty bottles must fit in the 14 ordinary slots');
  }
  if (!Number.isInteger(spec.reverseMoves) || spec.reverseMoves < 1) {
    throw new RangeError('reverseMoves must be positive');
  }
  if (!Number.isInteger(spec.maxAttempts) || spec.maxAttempts < 1) {
    throw new RangeError('maxAttempts must be positive');
  }
}

export function generateCandidate(spec: GenerationSpec, seed: number): GeneratedCandidate {
  validateSpec(spec);
  let bestCandidate: GeneratedCandidate | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < spec.maxAttempts; attempt += 1) {
    const attemptSeed = (seed + Math.imul(attempt, 0x9E3779B1)) >>> 0;
    const scrambled = scramble(spec, attemptSeed);
    if (!scrambled || !validShape(scrambled.state, spec)) continue;
    if (!replayIsValid(scrambled.state, scrambled.inverseMoves, spec.colorCount)) continue;

    const analysis = analyzeState(
      scrambled.state,
      spec.colorCount,
      { type: 'all-colors', targetCount: spec.colorCount },
    );
    if (!analysis) continue;
    const metrics = analysis.metrics;
    if (metrics.optimalMoves < spec.minimumOptimalMoves) continue;
    if (metrics.optimalMoves > spec.maximumOptimalMoves) continue;
    if (metrics.segmentCount < spec.minimumSegments) continue;
    if (metrics.exploredStates < spec.minimumExploredStates) continue;
    if (metrics.openingMoves < spec.minimumOpeningMoves) continue;
    if (metrics.openingMoves > spec.maximumOpeningMoves) continue;
    if (metrics.misleadingBranchRatio < spec.minimumMisleadingBranchRatio) continue;

    const candidate: GeneratedCandidate = {
      seed: attemptSeed,
      attempt: attempt + 1,
      initialState: scrambled.state,
      inverseMoves: scrambled.inverseMoves,
      metrics,
      scoreComponents: analysis.scoreComponents,
    };
    const distance = Math.abs(metrics.difficultyRating - spec.targetDifficulty);
    if (distance < bestDistance) {
      bestCandidate = candidate;
      bestDistance = distance;
      if (distance === 0) break;
    }
  }

  if (bestCandidate) return bestCandidate;
  throw new Error(
    `Unable to generate level ${spec.number} from seed ${seed} after ${spec.maxAttempts} attempts`,
  );
}
