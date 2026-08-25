export type PotionColor =
  | 'rose'
  | 'violet'
  | 'amber'
  | 'cyan'
  | 'mint'
  | 'blue'
  | 'gold'
  | 'lilac'
  | 'scarlet'
  | 'chartreuse'
  | 'indigo'
  | 'pearl';

export type BottleStatus = 'active' | 'inactive' | 'reserved' | 'vanished';

export interface BottleState {
  readonly layers: readonly PotionColor[];
  readonly status: BottleStatus;
}

export interface GameState {
  readonly bottles: readonly BottleState[];
  readonly rewardBottleUsed: boolean;
  readonly moves: number;
}

export interface PourResult {
  readonly state: GameState;
  readonly moved: number;
  readonly completed: readonly number[];
}

