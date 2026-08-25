import {
  countColorSegments,
  type CompletionRule,
} from '../assets/scripts/core/level-config.ts';
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

interface HeapEntry {
  readonly nodeIndex: number;
  readonly estimate: number;
  readonly depth: number;
  readonly insertionOrder: number;
}

function comesBefore(left: HeapEntry, right: HeapEntry): boolean {
  if (left.estimate !== right.estimate) return left.estimate < right.estimate;
  if (left.depth !== right.depth) return left.depth < right.depth;
  return left.insertionOrder < right.insertionOrder;
}

class MinHeap {
  private readonly entries: HeapEntry[] = [];

  get size(): number {
    return this.entries.length;
  }

  push(entry: HeapEntry): void {
    this.entries.push(entry);
    let index = this.entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!comesBefore(this.entries[index], this.entries[parent])) break;
      [this.entries[index], this.entries[parent]] = [this.entries[parent], this.entries[index]];
      index = parent;
    }
  }

  pop(): HeapEntry {
    const first = this.entries[0];
    const last = this.entries.pop() as HeapEntry;
    if (this.entries.length === 0) return first;

    this.entries[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.entries.length && comesBefore(this.entries[left], this.entries[smallest])) {
        smallest = left;
      }
      if (right < this.entries.length && comesBefore(this.entries[right], this.entries[smallest])) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.entries[index], this.entries[smallest]] = [
        this.entries[smallest],
        this.entries[index],
      ];
      index = smallest;
    }
    return first;
  }
}

function mergeLowerBound(state: GameState): number {
  const segments = countColorSegments(state);
  const unfinishedColors = new Set(
    state.bottles.flatMap((bottle) => bottle.layers),
  ).size;
  return Math.max(0, segments - unfinishedColors);
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
  const frontier = new MinHeap();
  frontier.push({
    nodeIndex: 0,
    estimate: options.completionRule.type === 'all-colors' ? mergeLowerBound(state) : 0,
    depth: 0,
    insertionOrder: 0,
  });
  const bestDepth = new Map<string, number>([[initialKey, 0]]);
  let insertionOrder = 1;
  let exploredStates = 0;

  while (frontier.size > 0) {
    const entry = frontier.pop();
    const node = nodes[entry.nodeIndex];
    const nodeKey = canonicalStateKey(node.state);
    if (bestDepth.get(nodeKey) !== node.depth) continue;

    if (isSolved(node.state, options.completionRule, node.depth)) {
      return {
        solved: true,
        moves: reconstructMoves(nodes, entry.nodeIndex),
        exploredStates,
        openingMoves,
      };
    }
    if (exploredStates >= maxExploredStates) break;
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
      const nextDepth = node.depth + 1;
      const knownDepth = bestDepth.get(nextKey);
      if (nextKey === node.parentKey || (knownDepth !== undefined && knownDepth <= nextDepth)) {
        continue;
      }

      const nextIndex = nodes.length;
      nodes.push({
        state: nextState,
        parentIndex: entry.nodeIndex,
        parentKey: nodeKey,
        move,
        depth: nextDepth,
      });
      bestDepth.set(nextKey, nextDepth);
      const lowerBound = options.completionRule.type === 'all-colors'
        ? mergeLowerBound(nextState)
        : 0;
      frontier.push({
        nodeIndex: nextIndex,
        estimate: nextDepth + lowerBound,
        depth: nextDepth,
        insertionOrder,
      });
      insertionOrder += 1;
    }
  }

  return { solved: false, moves: [], exploredStates, openingMoves };
}

export interface OpeningBranchAnalysis {
  readonly totalBranches: number;
  readonly misleadingBranches: number;
  readonly ratio: number;
}

export function analyzeOpeningBranches(
  state: GameState,
  rule: CompletionRule,
  optimalMoves: number,
  maxExploredStates: number,
): OpeningBranchAnalysis {
  const openings = legalMoves(state);
  let misleadingBranches = 0;

  for (const move of openings) {
    if (rule.type === 'first-valid-pour') continue;
    const child = applyMoveAndVanish(state, move);
    const result = solveLevel(child, {
      completionRule: rule,
      maxExploredStates,
    });
    if (!result.solved || 1 + result.moves.length > optimalMoves) {
      misleadingBranches += 1;
    }
  }

  return {
    totalBranches: openings.length,
    misleadingBranches,
    ratio: openings.length === 0 ? 0 : misleadingBranches / openings.length,
  };
}
