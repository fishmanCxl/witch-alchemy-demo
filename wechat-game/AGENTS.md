# WeChat Mini Game Production Guide

## Architecture boundaries

- `assets/scripts/core/` is framework-free TypeScript. It must never import `cc`, reference `wx`, access storage, play audio, or schedule presentation timers.
- `assets/scripts/presentation/` owns Cocos nodes, input, animation, particles, audio timing, and scene transitions. It consumes immutable results from `core`.
- `assets/scripts/platform/` is the only client directory allowed to reference WeChat APIs, rewarded video, network state, Storage, or CloudBase.
- `assets/resources/game/` is generated from approved prototype runtime assets by `tools/sync-approved-assets.mjs`. Never copy from `prototype/artifacts/chibi-raw`.
- `cloudbase/` owns trusted identity, progress revision, reward idempotency, configuration, and result telemetry. Never accept OPENID from client input.

## Product invariants

- Fixed 5×3 slots; regular content uses at most 14 and slot index 14 is the one-time rewarded empty bottle.
- Completed bottles fly away and become `vanished`; slots never reflow or become reusable.
- When a selected bottle cannot pour into another active filled bottle, keep the invalid feedback on both bottles but transfer selection and the cyan highlight to the newly tapped bottle immediately.
- Bottle interactions must refresh the mounted level nodes; never destroy and rebuild the full production surface for selection, invalid feedback, pouring, or witch-state settling.
- Bottle capacity is four and only a contiguous matching top run can pour.
- Witch runtime states and frame counts are idle 18, prepare 12, raise 12, cast 20, celebrate 14, return 18, and oops 12.
- Wide raster buttons must match the approved prototype with nine-slice rendering: preserve the 72px source corners at one-third display scale and stretch only the center. Bottom control bases remain square and centered inside their wider 110×72 hit targets; never SIMPLE-stretch square button artwork into a rectangle.
- Ordinary play and local save work offline. Reward claims require a successful online cloud response.
- Chapter one publishes exactly levels 1–15 from checked static data. Runtime code must never generate or solve levels; use `tools/generate-levels.ts` and commit its deterministic output/report.
- Levels 1–3 are authored tutorials, level 12 keeps the legacy board byte-for-byte, and generated difficulty scores are nondecreasing around that anchor.
- Global v2 progress and per-level v2 board snapshots remain separate. A stale/corrupt board resets only that level; it must not erase unlocks or best moves.
- Local completion progress must be saved before clearing the per-level snapshot or rendering results. Cloud sync/telemetry is opportunistic and cannot roll back a successful local completion.
- No environment IDs, secrets, ad unit IDs, or admin credentials are committed.

## Verification

- Run `node --experimental-strip-types tools/generate-levels.ts --check` and `node --experimental-strip-types --test tests/*.test.ts` after core/data changes.
- Run CloudBase tests and `tools/prepare-functions.mjs` after changing shared progress, rewards, telemetry, or cloud functions; all copied runtime hashes must match.
- Open the project in Cocos Creator 3.8.8 before claiming scene or WeChat build compatibility. Cocos generates `.meta` files on first import; retain those generated metadata files afterward.
- After every WeChat build, run `tools/prepare-wechat-build.mjs` and preview from a fresh Developer Tools process. The uploaded `resources` subpackage must contain the complete Cocos bundle rather than only its JavaScript entry; restart the IDE service after changing `project.config.json` packaging rules.
