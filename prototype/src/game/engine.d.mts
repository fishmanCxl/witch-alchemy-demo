export type BottleStatus = 'active' | 'inactive' | 'reserved' | 'vanished';

export interface Bottle {
  layers: string[];
  status: BottleStatus;
}

export interface GameState {
  bottles: Bottle[];
  rewardBottleUsed: boolean;
  moves: number;
}

export interface PourResult {
  state: GameState;
  moved: number;
  completed: number[];
}

export const CAPACITY: 4;
export function canPour(state: GameState, from: number, to: number): boolean;
export function pour(state: GameState, from: number, to: number): PourResult;
export function isCompleteBottle(bottle: Bottle): boolean;
export function vanishBottle(state: GameState, index: number): GameState;
export function addRewardBottle(state: GameState): GameState;
export function createDemoState(): GameState;
