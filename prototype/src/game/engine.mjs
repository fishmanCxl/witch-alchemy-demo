export const CAPACITY = 4;

export function isCompleteBottle(bottle) {
  return (
    bottle?.status === 'active' &&
    bottle.layers.length === CAPACITY &&
    bottle.layers.every((layer) => layer === bottle.layers[0])
  );
}

export function canPour(state, from, to) {
  const source = state.bottles[from];
  const target = state.bottles[to];

  if (!source || !target || from === to) return false;
  if (source.status !== 'active' || target.status !== 'active') return false;
  if (source.layers.length === 0 || target.layers.length >= CAPACITY) return false;

  const sourceColor = source.layers.at(-1);
  return target.layers.length === 0 || target.layers.at(-1) === sourceColor;
}

export function pour(state, from, to) {
  if (!canPour(state, from, to)) {
    return { state, moved: 0, completed: [] };
  }

  const source = state.bottles[from];
  const target = state.bottles[to];
  const color = source.layers.at(-1);
  let runLength = 1;

  for (let index = source.layers.length - 2; index >= 0; index -= 1) {
    if (source.layers[index] !== color) break;
    runLength += 1;
  }

  const moved = Math.min(runLength, CAPACITY - target.layers.length);
  const bottles = state.bottles.map((bottle, index) => {
    if (index === from) {
      return { ...bottle, layers: bottle.layers.slice(0, -moved) };
    }
    if (index === to) {
      return { ...bottle, layers: [...bottle.layers, ...Array(moved).fill(color)] };
    }
    return bottle;
  });

  return {
    state: { ...state, bottles, moves: state.moves + 1 },
    moved,
    completed: isCompleteBottle(bottles[to]) ? [to] : [],
  };
}

export function vanishBottle(state, index) {
  const bottle = state.bottles[index];
  if (!isCompleteBottle(bottle)) return state;

  return {
    ...state,
    bottles: state.bottles.map((candidate, bottleIndex) =>
      bottleIndex === index ? { layers: [], status: 'vanished' } : candidate,
    ),
  };
}

export function addRewardBottle(state) {
  const rewardSlot = state.bottles[14];
  if (state.rewardBottleUsed || rewardSlot?.status !== 'reserved') return state;

  return {
    ...state,
    rewardBottleUsed: true,
    bottles: state.bottles.map((bottle, index) =>
      index === 14 ? { layers: [], status: 'active' } : bottle,
    ),
  };
}

export function createDemoState() {
  const active = (layers) => ({ layers, status: 'active' });
  const inactive = () => ({ layers: [], status: 'inactive' });

  return {
    bottles: [
      active(['violet', 'amber', 'violet', 'rose']),
      active(['rose', 'rose', 'rose']),
      active(['amber', 'cyan', 'mint', 'blue']),
      active(['gold', 'lilac', 'cyan', 'mint']),
      active(['blue', 'gold', 'lilac', 'amber']),
      active(['cyan', 'mint', 'blue', 'gold']),
      active(['lilac', 'amber', 'cyan', 'mint']),
      active(['blue', 'gold', 'lilac', 'violet']),
      active(['violet']),
      active([]),
      active([]),
      inactive(),
      inactive(),
      inactive(),
      { layers: [], status: 'reserved' },
    ],
    rewardBottleUsed: false,
    moves: 0,
  };
}
