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
- Chapters one and two publish exactly levels 1–60 from checked static data, with 30 levels per chapter. Runtime code must never generate or solve levels; use `tools/generate-levels.ts` and `tools/generate-chapter-two.ts` and commit their deterministic outputs/reports.
- Level 1 is the only authored tutorial; levels 2–30 use the full all-colors rules, level 12 keeps the legacy board byte-for-byte, and generated difficulty rises sharply from level 2 before the approved late-chapter peak and easing.
- Chapter two starts hard at target 0.88 on level 31, rises through 0.96/0.97 on levels 32/33, peaks at 1.05 on levels 55–57, and eases to 0.98 on level 60; accepted boards still pass the configured optimal-move, segment, explored-state, opening-move, and misleading-branch gates.
- Each chapter selector shows all 30 levels in one fixed 5×6 page with no scrolling or pagination. Chapter arrows switch between published chapters, and chapter two remains disabled until level 31 is unlocked.
- Completing level 30 unlocks and advances to level 31. Completing level 60 caps progress at level 60, returns to the second-chapter selector, and never opens chapter three.
- The six-piece chapter collection and automatic highest title are derived only from `PlayerProgress.completedLevels`: reveal one 2×3 puzzle piece per five distinct completions, never persist collection/title fields, and never offer title equipment or switching.
- Chapter two unlocks the Forest Potion collection only; it never adds a board color, gameplay item, or consumable. Five distinct chapter-two completions reveal each piece, level 60 completes the collection, and the existing junior title badge displays the automatic “初级魔女” title after chapter one is complete.
- Home and level select expose one unified collection entry. The collection scene shows exactly ten chapter cards in a two-column vertical ScrollView; chapter one opens the existing six-piece puzzle, while locked cards use code-native Graphics frames, locks, and nine distinct silhouettes without new raster assets.
- On the home scene, center the automatic title above the lowered witch with a subtle vertical float and keep settings above collection in one lowered right-side column. Every non-home scene places the 48×48 settings trigger at the fixed top-left safe position `(-155, 378)`, clear of the WeChat menu capsule and chapter navigation arrows.
- Global v2 progress and per-level v2 board snapshots remain separate. A stale/corrupt board resets only that level; it must not erase unlocks or best moves.
- Local completion progress must be saved before clearing the per-level snapshot or rendering results. Cloud sync/telemetry is opportunistic and cannot roll back a successful local completion.
- No environment IDs, secrets, ad unit IDs, or admin credentials are committed.

## Verification

- Run `node --experimental-strip-types tools/generate-levels.ts --check` and `node --experimental-strip-types --test tests/*.test.ts` after core/data changes.
- Run CloudBase tests and `tools/prepare-functions.mjs` after changing shared progress, rewards, telemetry, or cloud functions; all copied runtime hashes must match.
- Open the project in Cocos Creator 3.8.8 before claiming scene or WeChat build compatibility. Cocos generates `.meta` files on first import; retain those generated metadata files afterward.
- After every WeChat build, run `tools/prepare-wechat-build.mjs` and preview from a fresh Developer Tools process. The uploaded `resources` subpackage must contain the complete Cocos bundle rather than only its JavaScript entry; restart the IDE service after changing `project.config.json` packaging rules.
