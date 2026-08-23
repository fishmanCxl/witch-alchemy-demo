'use strict';
const { db, safeMain } = require('./_shared/runtime');

exports.main = safeMain(async (event) => {
  const query = { enabled: true };
  if (typeof event.version === 'string' && event.version.length <= 64) query.version = event.version;
  const result = await db.collection('level_configs').where(query).orderBy('publishedAt', 'desc').limit(20).get();
  return { ok: true, configs: result.data.map(({ _id, ...config }) => config) };
});
