import type { CompletionRule } from '../assets/scripts/core/level-config.ts';
import type { BottleState, GameState } from '../assets/scripts/core/types.ts';
import {
  canPour,
  pour,
  vanishBottle,
} from '../assets/scripts/core/water-sort.ts';

export interface Move {
  readonly from: number;
  readonly to: number;
}

export interface SolveOptions {
  readonly completionRule: CompletionRule;
  readonly maxExploredStates: number;
}

export interface SolveResult {
  readonly solved: boolean;
  readonly moves: readonly Move[];
  readonly exploredStates: number;
  readonly openingMoves: number;
}

interface SearchNode {
  readonly state: GameState;
  readonly parentIndex: number | null;
  readonly parentKey: string | null;
  readonly move: Move | null;
  readonly depth: number;
}

function bottleKey(bottle: BottleState): string {
  return `${bottle.status}:${bottle.layers.join(',')}`;
}

export function canonicalStateKey(state: GameState): string {
  const reservedIndex = state.bottles.length === 15
    ? 14
    : state.bottles.findIndex((bottle) => bottle.status === 'reserved');
  const ordinary = state.bottles
    .filter((_, index) => index !== reservedIndex)
    .map(bottleKey)
    .sort();
  const reserved = reservedIndex >= 0
    ? `${reservedIndex}=${bottleKey(state.bottles[reservedIndex])}`
    : 'none';
  return `${ordinary.join('|')}#reward:${reserved}#used:${state.rewardBottleUsed ? 1 : 0}`;
}

export function legalMoves(state: GameState): readonly Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < state.bottles.length; from += 1) {
    for (let to = 0; to < state.bottles.length; to += 1) {
      if (canPour(state, from, to)) moves.push({ from, to });
    }
  }
  return moves;
}

export function applyMoveAndVanish(state: GameState, move: Move): GameState {
  const result = pour(state, move.from, move.to);
  let next = result.state;
  for (const completedIndex of result.completed) {
    next = vanishBottle(next, completedIndex);
  }
  return next;
}

function vanishedCount(state: GameState): number {
  return state.bottles.filter((bottle) => bottle.status === 'vanished').length;
}

function isSolved(state: GameState, rule: CompletionRule, depth: number): boolean {
  if (rule.type === 'first-valid-pour') return depth >= 1;
  if (rule.type === 'first-bottle-complete') return vanishedCount(state) >= 1;
  return vanishedCount(state) >= rule.targetCount;
}

function relocatesMonochromeBottleToEmpty(state: GameState, move: Move): boolean {
  const source = state.bottles[move.from];
  const target = state.bottles[move.to];
  return target.layers.length === 0
    && source.layers.every((color) => color === source.layers[0]);
}

function reconstructMoves(nodes: readonly SearchNode[], index: number): readonly Move[] {
  const moves: Move[] = [];
  let cursor: number | null = index;
  while (cursor !== null) {
    const node: SearchNode = nodes[cursor];
    if (node.move) moves.push(node.move);
    cursor = node.parentIndex;
  }
  return moves.reverse();
}

export function solveLevel(state: GameState, options: SolveOptions): SolveResult {
  const openingMoves = legalMoves(state).length;
  const maxExploredStates = Math.max(0, Math.floor(options.maxExploredStates));
  if (isSolved(state, options.completionRule, 0)) {
    return { solved: true, moves: [], exploredStates: 0, openingMoves };
  }
  if (maxExploredStates === 0) {
    return { solved: false, moves: [], exploredStates: 0, openingMoves };
  }

  const initialKey = canonicalStateKey(state);
  const nodes: SearchNode[] = [{
    state,
    parentIndex: null,
    parentKey: null,
    move: null,
    depth: 0,
  }];
  const queue: number[] = [0];
  const visited = new Set<string>([initialKey]);
  let queueIndex = 0;
  let exploredStates = 0;

  while (queueIndex < queue.length && exploredStates < maxExploredStates) {
    const nodeIndex = queue[queueIndex];
    queueIndex += 1;
    const node = nodes[nodeIndex];
    exploredStates += 1;

    for (const move of legalMoves(node.state)) {
      if (
        options.completionRule.type !== 'first-valid-pour'
        && relocatesMonochromeBottleToEmpty(node.state, move)
      ) {
        continue;
      }

      const nextState = applyMoveAndVanish(node.state, move);
      const nextKey = canonicalStateKey(nextState);
      if (nextKey === node.parentKey || visited.has(nextKey)) continue;

      const nextIndex = nodes.length;
      nodes.push({
        state: nextState,
        parentIndex: nodeIndex,
        parentKey: canonicalStateKey(node.state),
        move,
        depth: node.depth + 1,
      });
      visited.add(nextKey);

      if (isSolved(nextState, options.completionRule, node.depth + 1)) {
        return {
          solved: true,
          moves: reconstructMoves(nodes, nextIndex),
          exploredStates,
          openingMoves,
        };
      }
      queue.push(nextIndex);
    }
  }

  return { solved: false, moves: [], exploredStates, openingMoves };
}

