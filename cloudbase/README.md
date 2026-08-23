# CloudBase backend

This folder contains the five phase-one cloud functions. No environment ID, AppID, OPENID, or secret is committed.

Before deploying, run `npm run prepare:functions` so each function receives its self-contained `_shared/runtime.js`, then install production dependencies inside each function directory. Configure the CloudBase environment in the WeChat DevTools or deployment command, not in source control.

Collections: `users`, `player_progress`, `reward_claims`, `level_configs`, and `level_results`. Direct client writes to all five collections should be disabled; mutations go through cloud functions.
