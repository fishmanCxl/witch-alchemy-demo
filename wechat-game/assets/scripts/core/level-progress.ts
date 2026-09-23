import {
  GAME_CONFIG_VERSION,
  PUBLISHED_LEVELS,
  getLevelConfig,
  nextLevelConfig,
} from './level-catalog.ts';

export interface PlayerProgress {
  readonly schemaVersion: 3;
  readonly revision: number;
  readonly currentLevel: string;
  readonly completedThrough: number;
  readonly bestMoves: Readonly<Record<string, number>>;
  readonly configVersion: string;
}

export function createDefaultProgress(): PlayerProgress {
  return {
    schemaVersion: 3,
    revision: 0,
    currentLevel: 'level-001',
    completedThrough: 0,
    bestMoves: {},
    configVersion: GAME_CONFIG_VERSION,
  };
}

export function encodePlayerProgress(progress: PlayerProgress): string {
  return JSON.stringify({
    schemaVersion: 3,
    revision: progress.revision,
    currentLevel: progress.currentLevel,
    completedThrough: progress.completedThrough,
    bestMoves: progress.bestMoves,
    configVersion: GAME_CONFIG_VERSION,
  });
}

function publishedNumber(id: string): number | null {
  return getLevelConfig(id)?.number ?? null;
}

export function isLevelUnlocked(progress: PlayerProgress, id: string): boolean {
  const requested = publishedNumber(id);
  const highest = Math.min(progress.completedThrough + 1, PUBLISHED_LEVELS.length);
  return requested !== null && requested <= highest;
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
  return Array.from(new Set(ids))
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
  const completedThrough = level.number === progress.completedThrough + 1
    ? level.number
    : progress.completedThrough;
  const previousBest = progress.bestMoves[id];
  const bestMoves = {
    ...progress.bestMoves,
    [id]: previousBest === undefined ? moves : Math.min(previousBest, moves),
  };

  return {
    ...progress,
    revision: progress.revision + 1,
    currentLevel: next?.id ?? id,
    completedThrough,
    bestMoves,
    configVersion: GAME_CONFIG_VERSION,
  };
}

export function recordBestMoves(
  progress: PlayerProgress,
  id: string,
  moves: number,
): PlayerProgress | null {
  const level = getLevelConfig(id);
  if (!level || level.number > progress.completedThrough) return null;
  if (!Number.isInteger(moves) || moves < 1) return null;
  const previousBest = progress.bestMoves[id];
  if (previousBest !== undefined && previousBest <= moves) return progress;
  return {
    ...progress,
    revision: progress.revision + 1,
    bestMoves: { ...progress.bestMoves, [id]: moves },
  };
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
  const completedThrough = Math.max(local.completedThrough, remote.completedThrough);
  const preferredCurrent = remote.revision > local.revision
    ? remote.currentLevel
    : local.currentLevel;
  const fallbackCurrent = preferredCurrent === remote.currentLevel
    ? local.currentLevel
    : remote.currentLevel;
  const boundary: PlayerProgress = {
    ...local,
    completedThrough,
  };
  const currentLevel = isLevelUnlocked(boundary, preferredCurrent)
    ? preferredCurrent
    : isLevelUnlocked(boundary, fallbackCurrent)
      ? fallbackCurrent
      : PUBLISHED_LEVELS[Math.min(completedThrough, PUBLISHED_LEVELS.length - 1)].id;

  return {
    schemaVersion: 3,
    revision: Math.max(local.revision, remote.revision) + 1,
    currentLevel,
    completedThrough,
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
    if (!isRecord(value) || (value.schemaVersion !== 2 && value.schemaVersion !== 3)) return null;
    if (!Number.isInteger(value.revision) || Number(value.revision) < 0) return null;
    if (typeof value.currentLevel !== 'string' || !getLevelConfig(value.currentLevel)) return null;
    if (!isRecord(value.bestMoves) || !Object.entries(value.bestMoves).every(([id, moves]) => (
      getLevelConfig(id) !== null && Number.isInteger(moves) && Number(moves) > 0
    ))) return null;
    if (typeof value.configVersion !== 'string' || value.configVersion.length === 0) return null;

    let completedThrough: number;
    if (value.schemaVersion === 3) {
      if (!Number.isInteger(value.completedThrough)) return null;
      completedThrough = Number(value.completedThrough);
      if (completedThrough < 0 || completedThrough > PUBLISHED_LEVELS.length) return null;
    } else {
      if (typeof value.highestUnlockedLevel !== 'string') return null;
      const highest = getLevelConfig(value.highestUnlockedLevel);
      if (!highest || !Array.isArray(value.completedLevels) || !value.completedLevels.every((id) => (
        typeof id === 'string' && getLevelConfig(id) !== null
      ))) return null;
      if (new Set(value.completedLevels).size !== value.completedLevels.length) return null;
      completedThrough = highest.number - 1;
      if (value.completedLevels.includes(highest.id)) {
        completedThrough = highest.number;
      }
    }

    const progress: PlayerProgress = {
      schemaVersion: 3,
      revision: Number(value.revision),
      currentLevel: value.currentLevel,
      completedThrough,
      bestMoves: mergedBestMoves(value.bestMoves as Record<string, number>, {}),
      configVersion: GAME_CONFIG_VERSION,
    };
    if (!isLevelUnlocked(progress, progress.currentLevel)) return null;
    return progress;
  } catch {
    return null;
  }
}
