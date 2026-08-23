const LEVEL_ID = /^level-\d{3}$/;
const CLAIM_ID = /^[A-Za-z0-9_-]{8,128}$/;

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function string(value, name, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new TypeError(`invalid ${name}`);
  return value;
}

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new TypeError(`invalid ${name}`);
  return value;
}

function defaultProgress(configVersion) {
  return {
    revision: 0,
    currentLevel: 'level-012',
    completedLevels: [],
    bestMoves: {},
    configVersion,
  };
}

export function createBootstrapPayload({ progress, configVersion, serverTime }) {
  return {
    progress: progress ?? defaultProgress(configVersion),
    configVersion,
    serverTime,
  };
}

export function mergeProgress(currentValue, incomingValue) {
  const current = record(currentValue);
  const incoming = record(incomingValue);
  const currentRevision = integer(current.revision ?? 0, 'revision', 0, Number.MAX_SAFE_INTEGER);
  const baseRevision = integer(incoming.baseRevision, 'baseRevision', 0, Number.MAX_SAFE_INTEGER);
  const currentCompleted = Array.isArray(current.completedLevels) ? current.completedLevels : [];
  const incomingCompleted = Array.isArray(incoming.completedLevels) ? incoming.completedLevels : [];
  const completedLevels = [...new Set([...currentCompleted, ...incomingCompleted].map((id) => string(id, 'levelId', LEVEL_ID)))].sort();
  const bestMoves = {};
  for (const [id, moves] of Object.entries({ ...record(current.bestMoves), ...record(incoming.bestMoves) })) {
    string(id, 'bestMoves levelId', LEVEL_ID);
    const existing = record(current.bestMoves)[id];
    const candidate = record(incoming.bestMoves)[id];
    const values = [existing, candidate].filter((value) => Number.isInteger(value) && value > 0);
    if (values.length) bestMoves[id] = Math.min(...values);
  }
  return {
    revision: currentRevision + 1,
    currentLevel: string(incoming.currentLevel ?? current.currentLevel ?? 'level-012', 'currentLevel', LEVEL_ID),
    completedLevels,
    bestMoves,
    configVersion: String(incoming.configVersion ?? current.configVersion ?? ''),
    conflict: baseRevision !== currentRevision,
  };
}

export function validateRewardRequest(value) {
  const input = record(value);
  const levelId = string(input.levelId, 'levelId', LEVEL_ID);
  if (levelId !== 'level-012') throw new TypeError('reward is not enabled for this level');
  return { levelId, claimId: string(input.claimId, 'claimId', CLAIM_ID) };
}

export function normalizeLevelResult(value) {
  const input = record(value);
  return {
    levelId: string(input.levelId, 'levelId', LEVEL_ID),
    moves: integer(input.moves, 'moves', 0, 100_000),
    durationMs: integer(input.durationMs, 'durationMs', 1, 86_400_000),
    undoCount: integer(input.undoCount, 'undoCount', 0, 100_000),
    rewardedBottleUsed: input.rewardedBottleUsed === true,
  };
}
