import {
  FIRST_CHAPTER_CONFIG_VERSION,
  FIRST_CHAPTER_LEVELS,
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
    configVersion: FIRST_CHAPTER_CONFIG_VERSION,
  };
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
    configVersion: FIRST_CHAPTER_CONFIG_VERSION,
  };
}

function legalHighest(...ids: readonly string[]): string {
  let highest = FIRST_CHAPTER_LEVELS[0];
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
    configVersion: FIRST_CHAPTER_CONFIG_VERSION,
  };
}

