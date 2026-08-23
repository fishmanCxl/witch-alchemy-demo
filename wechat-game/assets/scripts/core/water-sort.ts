import type { BottleState, GameState, PourResult, PotionColor } from './types.ts';

export const CAPACITY = 4 as const;

export function isCompleteBottle(bottle: BottleState | undefined): boolean {
  return Boolean(
    bottle
      && bottle.status === 'active'
      && bottle.layers.length === CAPACITY
      && bottle.layers.every((layer) => layer === bottle.layers[0]),
  );
}

export function canPour(state: GameState, from: number, to: number): boolean {
  const source = state.bottles[from];
  const target = state.bottles[to];

  if (!source || !target || from === to) return false;
  if (source.status !== 'active' || target.status !== 'active') return false;
  if (source.layers.length === 0 || target.layers.length >= CAPACITY) return false;

  const sourceColor = source.layers.at(-1);
  return target.layers.length === 0 || target.layers.at(-1) === sourceColor;
}

export function pour(state: GameState, from: number, to: number): PourResult {
  if (!canPour(state, from, to)) {
    return { state, moved: 0, completed: [] };
  }

  const source = state.bottles[from];
  const target = state.bottles[to];
  const color = source.layers.at(-1) as PotionColor;
  let runLength = 1;

  for (let index = source.layers.length - 2; index >= 0; index -= 1) {
    if (source.layers[index] !== color) break;
    runLength += 1;
  }

  const moved = Math.min(runLength, CAPACITY - target.layers.length);
  const bottles = state.bottles.map((bottle, index): BottleState => {
    if (index === from) {
      return { ...bottle, layers: bottle.layers.slice(0, -moved) };
    }
    if (index === to) {
      return {
        ...bottle,
        layers: [...bottle.layers, ...Array<PotionColor>(moved).fill(color)],
      };
    }
    return bottle;
  });

  return {
    state: { ...state, bottles, moves: state.moves + 1 },
    moved,
    completed: isCompleteBottle(bottles[to]) ? [to] : [],
  };
}

export function vanishBottle(state: GameState, index: number): GameState {
  if (!isCompleteBottle(state.bottles[index])) return state;

  return {
    ...state,
    bottles: state.bottles.map((bottle, bottleIndex): BottleState => (
      bottleIndex === index ? { layers: [], status: 'vanished' } : bottle
    )),
  };
}

export function addRewardBottle(state: GameState): GameState {
  const rewardSlot = state.bottles[14];
  if (state.rewardBottleUsed || rewardSlot?.status !== 'reserved') return state;

  return {
    ...state,
    rewardBottleUsed: true,
    bottles: state.bottles.map((bottle, index): BottleState => (
      index === 14 ? { layers: [], status: 'active' } : bottle
    )),
  };
}

