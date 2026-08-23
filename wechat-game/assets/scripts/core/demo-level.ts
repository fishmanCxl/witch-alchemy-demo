import type { BottleState, GameState, PotionColor } from './types.ts';

function active(layers: readonly PotionColor[]): BottleState {
  return { layers: [...layers], status: 'active' };
}

function inactive(): BottleState {
  return { layers: [], status: 'inactive' };
}

export function stateOf(layerGroups: readonly (readonly PotionColor[])[]): GameState {
  return {
    bottles: layerGroups.map(active),
    rewardBottleUsed: false,
    moves: 0,
  };
}

export function createDemoState(): GameState {
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

