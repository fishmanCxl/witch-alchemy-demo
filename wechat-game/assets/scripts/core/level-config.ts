import { createDemoState } from './demo-level.ts';
import type { GameState } from './types.ts';

export interface LevelConfig {
  readonly id: string;
  readonly configVersion: string;
  readonly presentationSeed: number;
  readonly capacity: 4;
  readonly slotCount: 15;
  readonly rewardSlotIndex: 14;
  readonly initialState: GameState;
}

export const DEMO_LEVEL_CONFIG: LevelConfig = Object.freeze({
  id: 'level-012',
  configVersion: '2026.08.23.1',
  presentationSeed: 12,
  capacity: 4,
  slotCount: 15,
  rewardSlotIndex: 14,
  initialState: createDemoState(),
});

