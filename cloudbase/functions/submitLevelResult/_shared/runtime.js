'use strict';

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const LEVEL_ID = /^level-\d{3}$/;
const CLAIM_ID = /^[A-Za-z0-9_-]{8,128}$/;

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

function asLevelId(value) {
  if (typeof value !== 'string' || !LEVEL_ID.test(value)) throw new TypeError('invalid levelId');
  return value;
}

function validateRewardRequest(event) {
  const input = asObject(event);
  const levelId = asLevelId(input.levelId);
  if (levelId !== 'level-012') throw new TypeError('reward not enabled');
  if (typeof input.claimId !== 'string' || !CLAIM_ID.test(input.claimId)) throw new TypeError('invalid claimId');
  return { levelId, claimId: input.claimId };
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
  const current = asObject(currentValue);
  const incoming = asObject(incomingValue);
  const currentRevision = asInteger(current.revision || 0, 'revision', 0, Number.MAX_SAFE_INTEGER);
  const baseRevision = asInteger(incoming.baseRevision, 'baseRevision', 0, Number.MAX_SAFE_INTEGER);
  const completedLevels = [...new Set([
    ...(Array.isArray(current.completedLevels) ? current.completedLevels : []),
    ...(Array.isArray(incoming.completedLevels) ? incoming.completedLevels : []),
  ].map(asLevelId))].sort();
  const currentBest = asObject(current.bestMoves);
  const incomingBest = asObject(incoming.bestMoves);
  const bestMoves = {};
  for (const id of new Set([...Object.keys(currentBest), ...Object.keys(incomingBest)])) {
    asLevelId(id);
    const values = [currentBest[id], incomingBest[id]].filter((value) => Number.isInteger(value) && value > 0);
    if (values.length) bestMoves[id] = Math.min(...values);
  }
  return {
    revision: currentRevision + 1,
    currentLevel: asLevelId(incoming.currentLevel || current.currentLevel || 'level-012'),
    completedLevels,
    bestMoves,
    configVersion: String(incoming.configVersion || current.configVersion || ''),
    conflict: baseRevision !== currentRevision,
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
  cloud, db, getOpenId, mergeProgress, normalizeLevelResult, safeMain, validateRewardRequest,
};
