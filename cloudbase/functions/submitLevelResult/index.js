'use strict';
const { db, getOpenId, normalizeLevelResult, safeMain } = require('./_shared/runtime');

exports.main = safeMain(async (event) => {
  const openid = getOpenId();
  const result = normalizeLevelResult(event);
  const suspicious = result.moves < 1 || result.durationMs < 3000;
  const created = await db.collection('level_results').add({ data: {
    ...result,
    playerId: openid,
    suspicious,
    createdAt: db.serverDate(),
  } });
  return { ok: true, resultId: created._id, suspicious };
});
