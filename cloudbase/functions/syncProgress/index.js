'use strict';
const { db, getOpenId, mergeProgress, safeMain } = require('./_shared/runtime');

exports.main = safeMain(async (event) => {
  const openid = getOpenId();
  const progress = await db.runTransaction(async (transaction) => {
    const ref = transaction.collection('player_progress').doc(openid);
    const result = await ref.get().catch(() => ({ data: null }));
    const merged = mergeProgress(result.data || {}, event);
    await ref.set({ data: { ...merged, playerId: openid, updatedAt: db.serverDate() } });
    return merged;
  });
  return { ok: true, progress };
});
