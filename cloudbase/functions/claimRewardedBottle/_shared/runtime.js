'use strict';

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const LEVEL_ID = /^level-(\d{3})$/;
const CLAIM_ID = /^[A-Za-z0-9_-]{8,128}$/;
const FIRST_LEVEL = 1;
const LAST_LEVEL = 180;

function getOpenId() {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) throw new Error('missing trusted OPENID');
  return openid;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asInteger(value, name, min, max) {
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

function asLevelId(value, name = 'levelId') {
  return levelId(levelNumber(value, name));
}

function normalizedCompleted(value) {
  if (!Array.isArray(value)) throw new TypeError('invalid completedLevels');
  return [...new Set(value.map((id) => asLevelId(id)))].sort();
}

function normalizedBestMoves(value) {
  const result = {};
  for (const [id, moves] of Object.entries(asObject(value))) {
    const validId = asLevelId(id, 'bestMoves levelId');
    result[validId] = asInteger(moves, 'bestMoves', 1, 100000);
  }
  return result;
}

function defaultProgress(configVersion) {
  return {
    schemaVersion: 3,
    revision: 0,
    currentLevel: 'level-001',
    completedThrough: 0,
    bestMoves: {},
    configVersion,
  };
}

function normalizeStoredProgress(value, configVersion) {
  const input = asObject(value);
  if (!Object.keys(input).length) return defaultProgress(configVersion);
  if (input.schemaVersion === 2) {
    const currentLevel = asLevelId(input.currentLevel || 'level-001', 'currentLevel');
    const highestUnlockedLevel = asLevelId(
      input.highestUnlockedLevel || currentLevel,
      'highestUnlockedLevel',
    );
    const highestNumber = levelNumber(highestUnlockedLevel);
    const completed = normalizedCompleted(input.completedLevels || []);
    return {
      schemaVersion: 3,
      revision: asInteger(input.revision || 0, 'revision', 0, Number.MAX_SAFE_INTEGER),
      currentLevel: levelNumber(currentLevel) <= highestNumber ? currentLevel : highestUnlockedLevel,
      completedThrough: completed.includes(highestUnlockedLevel) ? highestNumber : highestNumber - 1,
      bestMoves: normalizedBestMoves(input.bestMoves),
      configVersion: String(input.configVersion || configVersion || ''),
    };
  }
  if (input.schemaVersion !== 3) throw new TypeError('invalid schemaVersion');
  const completedThrough = asInteger(input.completedThrough, 'completedThrough', 0, LAST_LEVEL);
  const highestNumber = Math.min(completedThrough + 1, LAST_LEVEL);
  const requestedCurrent = asLevelId(input.currentLevel || 'level-001', 'currentLevel');
  return {
    schemaVersion: 3,
    revision: asInteger(input.revision || 0, 'revision', 0, Number.MAX_SAFE_INTEGER),
    currentLevel: levelNumber(requestedCurrent) <= highestNumber
      ? requestedCurrent
      : levelId(highestNumber),
    completedThrough,
    bestMoves: normalizedBestMoves(input.bestMoves),
    configVersion: String(input.configVersion || configVersion || ''),
  };
}

function normalizeIncomingProgress(value) {
  const input = asObject(value);
  if (input.schemaVersion !== 3) throw new TypeError('invalid schemaVersion');
  return {
    schemaVersion: 3,
    revision: asInteger(input.revision, 'revision', 0, Number.MAX_SAFE_INTEGER),
    currentLevel: asLevelId(input.currentLevel, 'currentLevel'),
    completedThrough: asInteger(input.completedThrough, 'completedThrough', 0, LAST_LEVEL),
    bestMoves: normalizedBestMoves(input.bestMoves),
    configVersion: String(input.configVersion || ''),
  };
}

function createBootstrapPayload({ progress, configVersion, serverTime }) {
  return {
    progress: normalizeStoredProgress(progress, configVersion),
    configVersion,
    serverTime,
  };
}

function validateRewardRequest(event) {
  const input = asObject(event);
  const validLevelId = asLevelId(input.levelId);
  if (typeof input.claimId !== 'string' || !CLAIM_ID.test(input.claimId)) {
    throw new TypeError('invalid claimId');
  }
  return { levelId: validLevelId, claimId: input.claimId };
}

function normalizeLevelResult(event) {
  const input = asObject(event);
  return {
    levelId: asLevelId(input.levelId),
    moves: asInteger(input.moves, 'moves', 0, 100000),
    durationMs: asInteger(input.durationMs, 'durationMs', 1, 86400000),
    undoCount: asInteger(input.undoCount, 'undoCount', 0, 100000),
    rewardedBottleUsed: input.rewardedBottleUsed === true,
  };
}

function mergeProgress(currentValue, incomingValue) {
  const incoming = normalizeIncomingProgress(incomingValue);
  const current = normalizeStoredProgress(currentValue, incoming.configVersion);
  const completedThrough = Math.max(current.completedThrough, incoming.completedThrough);
  const highestNumber = Math.min(LAST_LEVEL, completedThrough + 1);
  const incomingCurrent = levelNumber(incoming.currentLevel);
  const storedCurrent = levelNumber(current.currentLevel);
  const currentLevel = incomingCurrent <= highestNumber
    ? incoming.currentLevel
    : storedCurrent <= highestNumber
      ? current.currentLevel
      : levelId(highestNumber);
  const bestMoves = {};
  const ids = new Set([...Object.keys(current.bestMoves), ...Object.keys(incoming.bestMoves)]);
  for (const id of ids) {
    const values = [current.bestMoves[id], incoming.bestMoves[id]].filter((value) => (
      Number.isInteger(value) && value > 0
    ));
    if (values.length) bestMoves[id] = Math.min(...values);
  }
  return {
    schemaVersion: 3,
    revision: current.revision + 1,
    currentLevel,
    completedThrough,
    bestMoves,
    configVersion: incoming.configVersion || current.configVersion,
    conflict: incoming.revision !== current.revision,
  };
}

function safeMain(handler) {
  return async (event) => {
    try {
      return await handler(asObject(event));
    } catch (error) {
      console.error(JSON.stringify({ kind: 'cloud-function-error', message: error?.message || String(error) }));
      return { ok: false, error: 'REQUEST_REJECTED' };
    }
  };
}

module.exports = {
  cloud,
  createBootstrapPayload,
  db,
  getOpenId,
  mergeProgress,
  normalizeLevelResult,
  safeMain,
  validateRewardRequest,
};
