const LEVEL_ID = /^level-(\d{3})$/;
const CLAIM_ID = /^[A-Za-z0-9_-]{8,128}$/;
const FIRST_LEVEL = 1;
const LAST_LEVEL = 15;

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new TypeError(`invalid ${name}`);
  return value;
}

function levelNumber(value, name = 'levelId') {
  if (typeof value !== 'string') throw new TypeError(`invalid ${name}`);
  const match = LEVEL_ID.exec(value);
  const number = match ? Number(match[1]) : 0;
  if (number < FIRST_LEVEL || number > LAST_LEVEL) throw new TypeError(`invalid ${name}`);
  return number;
}

function levelId(number) {
  return `level-${String(number).padStart(3, '0')}`;
}

function publishedLevel(value, name = 'levelId') {
  return levelId(levelNumber(value, name));
}

function completedLevels(value) {
  if (!Array.isArray(value)) throw new TypeError('invalid completedLevels');
  return [...new Set(value.map((id) => publishedLevel(id)))].sort();
}

function bestMoves(value) {
  const result = {};
  for (const [id, moves] of Object.entries(record(value))) {
    const validId = publishedLevel(id, 'bestMoves levelId');
    result[validId] = integer(moves, 'bestMoves', 1, 100_000);
  }
  return result;
}

function defaultProgress(configVersion) {
  return {
    schemaVersion: 2,
    revision: 0,
    currentLevel: 'level-001',
    highestUnlockedLevel: 'level-001',
    completedLevels: [],
    bestMoves: {},
    configVersion,
  };
}

function normalizeStoredProgress(value, configVersion) {
  const input = record(value);
  if (Object.keys(input).length === 0) return defaultProgress(configVersion);
  const currentLevel = publishedLevel(input.currentLevel ?? 'level-001', 'currentLevel');
  const highestUnlockedLevel = publishedLevel(
    input.highestUnlockedLevel ?? currentLevel,
    'highestUnlockedLevel',
  );
  return {
    schemaVersion: 2,
    revision: integer(input.revision ?? 0, 'revision', 0, Number.MAX_SAFE_INTEGER),
    currentLevel: levelNumber(currentLevel) <= levelNumber(highestUnlockedLevel)
      ? currentLevel
      : highestUnlockedLevel,
    highestUnlockedLevel,
    completedLevels: completedLevels(input.completedLevels ?? []),
    bestMoves: bestMoves(input.bestMoves),
    configVersion: String(input.configVersion ?? configVersion ?? ''),
  };
}

function normalizeIncomingProgress(value) {
  const input = record(value);
  if (input.schemaVersion !== 2) throw new TypeError('invalid schemaVersion');
  return {
    schemaVersion: 2,
    revision: integer(input.revision, 'revision', 0, Number.MAX_SAFE_INTEGER),
    currentLevel: publishedLevel(input.currentLevel, 'currentLevel'),
    highestUnlockedLevel: publishedLevel(input.highestUnlockedLevel, 'highestUnlockedLevel'),
    completedLevels: completedLevels(input.completedLevels),
    bestMoves: bestMoves(input.bestMoves),
    configVersion: String(input.configVersion ?? ''),
  };
}

export function createBootstrapPayload({ progress, configVersion, serverTime }) {
  return {
    progress: normalizeStoredProgress(progress, configVersion),
    configVersion,
    serverTime,
  };
}

export function mergeProgress(currentValue, incomingValue) {
  const incoming = normalizeIncomingProgress(incomingValue);
  const current = normalizeStoredProgress(currentValue, incoming.configVersion);
  const highestNumber = Math.max(
    levelNumber(current.highestUnlockedLevel),
    levelNumber(incoming.highestUnlockedLevel),
  );
  const highestUnlockedLevel = levelId(Math.min(LAST_LEVEL, highestNumber));
  const incomingCurrentNumber = levelNumber(incoming.currentLevel);
  const currentCurrentNumber = levelNumber(current.currentLevel);
  const currentLevel = incomingCurrentNumber <= highestNumber
    ? incoming.currentLevel
    : currentCurrentNumber <= highestNumber
      ? current.currentLevel
      : highestUnlockedLevel;
  const mergedBest = {};
  const ids = new Set([...Object.keys(current.bestMoves), ...Object.keys(incoming.bestMoves)]);
  for (const id of ids) {
    const values = [current.bestMoves[id], incoming.bestMoves[id]].filter((value) => (
      Number.isInteger(value) && value > 0
    ));
    if (values.length > 0) mergedBest[id] = Math.min(...values);
  }

  return {
    schemaVersion: 2,
    revision: current.revision + 1,
    currentLevel,
    highestUnlockedLevel,
    completedLevels: [...new Set([
      ...current.completedLevels,
      ...incoming.completedLevels,
    ])].sort(),
    bestMoves: mergedBest,
    configVersion: incoming.configVersion || current.configVersion,
    conflict: incoming.revision !== current.revision,
  };
}

export function validateRewardRequest(value) {
  const input = record(value);
  const validLevelId = publishedLevel(input.levelId);
  if (typeof input.claimId !== 'string' || !CLAIM_ID.test(input.claimId)) {
    throw new TypeError('invalid claimId');
  }
  return { levelId: validLevelId, claimId: input.claimId };
}

export function normalizeLevelResult(value) {
  const input = record(value);
  return {
    levelId: publishedLevel(input.levelId),
    moves: integer(input.moves, 'moves', 0, 100_000),
    durationMs: integer(input.durationMs, 'durationMs', 1, 86_400_000),
    undoCount: integer(input.undoCount, 'undoCount', 0, 100_000),
    rewardedBottleUsed: input.rewardedBottleUsed === true,
  };
}
