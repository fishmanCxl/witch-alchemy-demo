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
- Bottle capacity is four and only a contiguous matching top run can pour.
- Witch runtime states and frame counts are idle 18, prepare 12, raise 12, cast 20, celebrate 14, return 18, and oops 12.
- Wide raster buttons must match the approved prototype with nine-slice rendering: preserve the 72px source corners at one-third display scale and stretch only the center. Bottom control bases remain square and centered inside their wider 110×72 hit targets; never SIMPLE-stretch square button artwork into a rectangle.
- Ordinary play and local save work offline. Reward claims require a successful online cloud response.
- No environment IDs, secrets, ad unit IDs, or admin credentials are committed.

## Verification

- Run `node --experimental-strip-types --test tests/water-sort.test.ts tests/production-contracts.test.ts` after core/data changes.
- Open the project in Cocos Creator 3.8.x before claiming scene or WeChat build compatibility. Cocos generates `.meta` files on first import; retain those generated metadata files afterward.
