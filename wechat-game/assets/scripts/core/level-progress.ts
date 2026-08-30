import {
  GAME_CONFIG_VERSION,
  PUBLISHED_LEVELS,
  getLevelConfig,
  nextLevelConfig,
} from './level-catalog.ts';

export interface PlayerProgress {
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly currentLevel: string;
  readonly highestUnlockedLevel: string;
  readonly completedLevels: readonly string[];
  readonly bestMoves: Readonly<Record<string, number>>;
  readonly configVersion: string;
}

export function createDefaultProgress(): PlayerProgress {
  return {
    schemaVersion: 2,
    revision: 0,
    currentLevel: 'level-001',
    highestUnlockedLevel: 'level-001',
    completedLevels: [],
    bestMoves: {},
    configVersion: GAME_CONFIG_VERSION,
  };
}

export function encodePlayerProgress(progress: PlayerProgress): string {
  return JSON.stringify({
    schemaVersion: 2,
    revision: progress.revision,
    currentLevel: progress.currentLevel,
    highestUnlockedLevel: progress.highestUnlockedLevel,
    completedLevels: progress.completedLevels,
    bestMoves: progress.bestMoves,
    configVersion: GAME_CONFIG_VERSION,
  });
}

function publishedNumber(id: string): number | null {
  return getLevelConfig(id)?.number ?? null;
}

export function isLevelUnlocked(progress: PlayerProgress, id: string): boolean {
  const requested = publishedNumber(id);
  const highest = publishedNumber(progress.highestUnlockedLevel);
  return requested !== null && highest !== null && requested <= highest;
}

export function selectCurrentLevel(
  progress: PlayerProgress,
  id: string,
): PlayerProgress | null {
  if (!isLevelUnlocked(progress, id)) return null;
  if (progress.currentLevel === id) return progress;
  return { ...progress, revision: progress.revision + 1, currentLevel: id };
}

function sortedPublishedIds(ids: Iterable<string>): readonly string[] {
  return [...new Set(ids)]
    .filter((id) => getLevelConfig(id) !== null)
    .sort((left, right) => (
      (publishedNumber(left) ?? 0) - (publishedNumber(right) ?? 0)
    ));
}

export function completeLevel(
  progress: PlayerProgress,
  id: string,
  moves: number,
): PlayerProgress | null {
  const level = getLevelConfig(id);
  if (!level || !isLevelUnlocked(progress, id)) return null;
  if (!Number.isInteger(moves) || moves < 1) return null;

  const next = nextLevelConfig(id);
  const highestNumber = publishedNumber(progress.highestUnlockedLevel) ?? 1;
  const unlocked = next && next.number > highestNumber ? next : null;
  const previousBest = progress.bestMoves[id];
  const bestMoves = {
    ...progress.bestMoves,
    [id]: previousBest === undefined ? moves : Math.min(previousBest, moves),
  };

  return {
    ...progress,
    revision: progress.revision + 1,
    currentLevel: next?.id ?? id,
    highestUnlockedLevel: unlocked?.id ?? progress.highestUnlockedLevel,
    completedLevels: sortedPublishedIds([...progress.completedLevels, id]),
    bestMoves,
    configVersion: GAME_CONFIG_VERSION,
  };
}

function legalHighest(...ids: readonly string[]): string {
  let highest = PUBLISHED_LEVELS[0];
  for (const id of ids) {
    const level = getLevelConfig(id);
    if (level && level.number > highest.number) highest = level;
  }
  return highest.id;
}

function mergedBestMoves(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const merged: Record<string, number> = {};
  const ids = sortedPublishedIds([...Object.keys(left), ...Object.keys(right)]);
  for (const id of ids) {
    const values = [left[id], right[id]].filter((value): value is number => (
      Number.isInteger(value) && value > 0
    ));
    if (values.length > 0) merged[id] = Math.min(...values);
  }
  return merged;
}

export function mergePlayerProgress(
  local: PlayerProgress,
  remote: PlayerProgress,
): PlayerProgress {
  const highestUnlockedLevel = legalHighest(
    local.highestUnlockedLevel,
    remote.highestUnlockedLevel,
  );
  const preferredCurrent = remote.revision > local.revision
    ? remote.currentLevel
    : local.currentLevel;
  const fallbackCurrent = preferredCurrent === remote.currentLevel
    ? local.currentLevel
    : remote.currentLevel;
  const boundary: PlayerProgress = {
    ...local,
    highestUnlockedLevel,
  };
  const currentLevel = isLevelUnlocked(boundary, preferredCurrent)
    ? preferredCurrent
    : isLevelUnlocked(boundary, fallbackCurrent)
      ? fallbackCurrent
      : highestUnlockedLevel;

  return {
    schemaVersion: 2,
    revision: Math.max(local.revision, remote.revision) + 1,
    currentLevel,
    highestUnlockedLevel,
    completedLevels: sortedPublishedIds([
      ...local.completedLevels,
      ...remote.completedLevels,
    ]),
    bestMoves: mergedBestMoves(local.bestMoves, remote.bestMoves),
    configVersion: GAME_CONFIG_VERSION,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function decodePlayerProgress(serialized: string | null | undefined): PlayerProgress | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!isRecord(value) || value.schemaVersion !== 2) return null;
    if (!Number.isInteger(value.revision) || Number(value.revision) < 0) return null;
    if (typeof value.currentLevel !== 'string' || typeof value.highestUnlockedLevel !== 'string') {
      return null;
    }
    if (!getLevelConfig(value.currentLevel) || !getLevelConfig(value.highestUnlockedLevel)) return null;
    if (!Array.isArray(value.completedLevels) || !value.completedLevels.every((id) => (
      typeof id === 'string' && getLevelConfig(id) !== null
    ))) return null;
    if (new Set(value.completedLevels).size !== value.completedLevels.length) return null;
    if (!isRecord(value.bestMoves) || !Object.entries(value.bestMoves).every(([id, moves]) => (
      getLevelConfig(id) !== null && Number.isInteger(moves) && Number(moves) > 0
    ))) return null;
    if (typeof value.configVersion !== 'string' || value.configVersion.length === 0) return null;

    const progress: PlayerProgress = {
      schemaVersion: 2,
      revision: Number(value.revision),
      currentLevel: value.currentLevel,
      highestUnlockedLevel: value.highestUnlockedLevel,
      completedLevels: sortedPublishedIds(value.completedLevels as string[]),
      bestMoves: mergedBestMoves(value.bestMoves as Record<string, number>, {}),
      configVersion: GAME_CONFIG_VERSION,
    };
    if (!isLevelUnlocked(progress, progress.currentLevel)) return null;
    return progress;
  } catch {
    return null;
  }
}
