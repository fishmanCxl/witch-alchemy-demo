'use strict';
const { db, getOpenId, safeMain, validateRewardRequest } = require('./_shared/runtime');

exports.main = safeMain(async (event) => {
  const openid = getOpenId();
  const request = validateRewardRequest(event);
  const documentId = `${openid}_${request.levelId}_rewarded-bottle`;
  const status = await db.runTransaction(async (transaction) => {
    const claim = transaction.collection('reward_claims').doc(documentId);
    const existing = await claim.get().catch(() => ({ data: null }));
    if (existing.data?.status === 'granted') return 'alreadyGranted';

    await claim.set({ data: {
      playerId: openid,
      levelId: request.levelId,
      rewardType: 'empty-bottle',
      claimId: request.claimId,
      status: 'granted',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    } });
    return 'granted';
  });
  return { ok: true, status, levelId: request.levelId };
});
