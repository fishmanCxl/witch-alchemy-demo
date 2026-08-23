'use strict';
const { db, getOpenId, safeMain } = require('./_shared/runtime');

exports.main = safeMain(async () => {
  const openid = getOpenId();
  const now = Date.now();
  await db.collection('users').doc(openid).set({ data: { lastLoginAt: db.serverDate() } });
  const [progressResult, configResult] = await Promise.all([
    db.collection('player_progress').doc(openid).get().catch(() => ({ data: null })),
    db.collection('level_configs').where({ enabled: true }).orderBy('publishedAt', 'desc').limit(1).get(),
  ]);
  const configVersion = configResult.data[0]?.version || '2026.08.23.1';
  const progress = progressResult.data || {
    revision: 0, currentLevel: 'level-012', completedLevels: [], bestMoves: {}, configVersion,
  };
  return { ok: true, progress, configVersion, serverTime: now };
});
