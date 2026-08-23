import type { BottleState, BottleStatus, GameState, PotionColor } from './types.ts';

export const CURRENT_SNAPSHOT_VERSION = 1 as const;

export interface LocalSnapshotInput {
  readonly levelId: string;
  readonly configVersion: string;
  readonly revision: number;
  readonly state: GameState;
  readonly history: readonly GameState[];
  readonly selected: number | null;
  readonly updatedAt: number;
}

export interface LocalSnapshot extends LocalSnapshotInput {
  readonly schemaVersion: typeof CURRENT_SNAPSHOT_VERSION;
}

const POTION_COLORS = new Set<PotionColor>([
  'rose', 'violet', 'amber', 'cyan', 'mint', 'blue', 'gold', 'lilac',
]);
const BOTTLE_STATUSES = new Set<BottleStatus>(['active', 'inactive', 'reserved', 'vanished']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBottle(value: unknown): value is BottleState {
  if (!isRecord(value) || !Array.isArray(value.layers)) return false;
  return BOTTLE_STATUSES.has(value.status as BottleStatus)
    && value.layers.every((layer) => POTION_COLORS.has(layer as PotionColor));
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || !Array.isArray(value.bottles)) return false;
  return value.bottles.every(isBottle)
    && typeof value.rewardBottleUsed === 'boolean'
    && Number.isInteger(value.moves)
    && Number(value.moves) >= 0;
}

export function createLocalSnapshot(input: LocalSnapshotInput): LocalSnapshot {
  return { schemaVersion: CURRENT_SNAPSHOT_VERSION, ...input };
}

export function decodeLocalSnapshot(serialized: string | null | undefined): LocalSnapshot | null {
  if (!serialized) return null;

  try {
    const value: unknown = JSON.parse(serialized);
    if (!isRecord(value) || value.schemaVersion !== CURRENT_SNAPSHOT_VERSION) return null;
    if (typeof value.levelId !== 'string' || typeof value.configVersion !== 'string') return null;
    if (!Number.isInteger(value.revision) || Number(value.revision) < 0) return null;
    if (!Number.isFinite(value.updatedAt) || Number(value.updatedAt) < 0) return null;
    if (!isGameState(value.state)) return null;
    if (!Array.isArray(value.history) || !value.history.every(isGameState)) return null;
    if (value.selected !== null && (!Number.isInteger(value.selected) || Number(value.selected) < 0)) return null;
    return value as unknown as LocalSnapshot;
  } catch {
    return null;
  }
}

