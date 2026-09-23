import type { BottleState, BottleStatus, GameState, PotionColor } from './types.ts';
import type { LevelConfig } from './level-config.ts';
import { RESTART_ALLOWANCE, UNDO_ALLOWANCE } from './game-session.ts';

export const CURRENT_SNAPSHOT_VERSION = 2 as const;

export interface LocalSnapshotInput {
  readonly levelId: string;
  readonly configVersion: string;
  readonly revision: number;
  readonly state: GameState;
  readonly history: readonly GameState[];
  readonly selected: number | null;
  readonly updatedAt: number;
  readonly undoRemaining?: number;
  readonly restartRemaining?: number;
}

export interface LocalSnapshot extends LocalSnapshotInput {
  readonly schemaVersion: typeof CURRENT_SNAPSHOT_VERSION;
  readonly undoRemaining: number;
  readonly restartRemaining: number;
}

const POTION_COLORS = new Set<PotionColor>([
  'rose', 'violet', 'amber', 'cyan', 'mint', 'blue', 'gold', 'lilac',
  'scarlet', 'chartreuse', 'indigo', 'pearl',
]);
const BOTTLE_STATUSES = new Set<BottleStatus>(['active', 'inactive', 'reserved', 'vanished']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBottle(value: unknown): value is BottleState {
  if (!isRecord(value) || !Array.isArray(value.layers)) return false;
  if (!BOTTLE_STATUSES.has(value.status as BottleStatus) || value.layers.length > 4) return false;
  if (!value.layers.every((layer) => POTION_COLORS.has(layer as PotionColor))) return false;
  return value.status === 'active' || value.layers.length === 0;
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || !Array.isArray(value.bottles) || value.bottles.length !== 15) return false;
  return value.bottles.every(isBottle)
    && typeof value.rewardBottleUsed === 'boolean'
    && Number.isInteger(value.moves)
    && Number(value.moves) >= 0;
}

export function createLocalSnapshot(input: LocalSnapshotInput): LocalSnapshot {
  return {
    schemaVersion: CURRENT_SNAPSHOT_VERSION,
    ...input,
    undoRemaining: input.undoRemaining ?? UNDO_ALLOWANCE,
    restartRemaining: input.restartRemaining ?? RESTART_ALLOWANCE,
  };
}

export function decodeLocalSnapshot(
  serialized: string | null | undefined,
  level: LevelConfig,
): LocalSnapshot | null {
  if (!serialized) return null;

  try {
    const value: unknown = JSON.parse(serialized);
    if (!isRecord(value) || value.schemaVersion !== CURRENT_SNAPSHOT_VERSION) return null;
    if (value.levelId !== level.id || value.configVersion !== level.configVersion) return null;
    if (!Number.isInteger(value.revision) || Number(value.revision) < 0) return null;
    if (!Number.isFinite(value.updatedAt) || Number(value.updatedAt) < 0) return null;
    if (value.undoRemaining !== undefined
      && (!Number.isInteger(value.undoRemaining) || Number(value.undoRemaining) < 0
        || Number(value.undoRemaining) > UNDO_ALLOWANCE)) return null;
    if (value.restartRemaining !== undefined
      && (!Number.isInteger(value.restartRemaining) || Number(value.restartRemaining) < 0
        || Number(value.restartRemaining) > RESTART_ALLOWANCE)) return null;
    if (!isGameState(value.state)) return null;
    if (!Array.isArray(value.history) || !value.history.every(isGameState)) return null;
    if (
      value.selected !== null
      && (!Number.isInteger(value.selected) || Number(value.selected) < 0 || Number(value.selected) >= 15)
    ) return null;
    return {
      ...(value as unknown as LocalSnapshot),
      undoRemaining: value.undoRemaining === undefined ? UNDO_ALLOWANCE : Number(value.undoRemaining),
      restartRemaining: value.restartRemaining === undefined ? RESTART_ALLOWANCE : Number(value.restartRemaining),
    };
  } catch {
    return null;
  }
}
