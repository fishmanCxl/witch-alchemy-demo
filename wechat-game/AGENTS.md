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
- Stamina is an independent local record capped at 10, recovers 1 point every 30 minutes, and gains 5 points (still capped at 10) only after a completed rewarded ad; that ad reward is local-only and does not make a cloud claim. Entering a level costs nothing, while successful completion and confirmed exit each spend exactly 1 point. Cancelled exit, restart, undo, background/foreground transitions, and force-close never spend stamina.
- The separate green plus badge beside the bottom add-bottle control is not rendered. Develop and trial builds expose an in-memory settings switch that lets QA make the existing add-bottle control grant directly; release builds always keep the rewarded-ad and cloud-claim path.
- Chapters one through four publish exactly levels 1–120 from checked static data, with 30 levels per chapter. Runtime code must never generate or solve levels; use the four chapter generation tools and commit their deterministic outputs/reports.
- Level 1 is the only authored tutorial; levels 2–30 use the full all-colors rules, level 12 keeps the legacy board byte-for-byte, and generated difficulty rises sharply from level 2 before the approved late-chapter peak and easing.
- Chapter two starts hard at target 0.88 on level 31, rises through 0.96/0.97 on levels 32/33, peaks at 1.05 on levels 55–57, and eases to 0.98 on level 60; accepted boards still pass the configured optimal-move, segment, explored-state, opening-move, and misleading-branch gates.
- Chapter three starts at target 0.95 on level 61, jumps to 1.03 on level 62, reaches 1.06/1.08/1.11 on levels 65/70/80, peaks at 1.12 on levels 85–87, and eases to 1.05 on level 90; non-anchor targets use piecewise-linear interpolation.
- Chapter four starts at target 1.02 on level 91, jumps to 1.10 on level 92, reaches 1.13/1.15/1.18 on levels 95/100/110, peaks at 1.19 on levels 115–117, and eases to 1.12 on level 120; non-anchor targets use piecewise-linear interpolation.
- Each chapter selector shows all 30 levels in one fixed 5×6 page with no scrolling or pagination. Chapter arrows switch between published chapters; chapters two through four remain disabled until levels 31, 61, and 91 are unlocked.
- Completing levels 30, 60, and 90 unlocks and advances to levels 31, 61, and 91. Completing level 120 caps progress at level 120 and returns to the fourth-chapter selector; chapter five remains unpublished.
- The six-piece chapter collection and automatic highest title are derived only from `PlayerProgress.completedThrough`: reveal one 2×3 puzzle piece per five continuous completions in that chapter, never persist collection/title fields, and never offer title equipment or switching.
- Chapters two through four unlock only the Forest Potion, Moon Glow Potion, and Flame Potion collections; none adds a board color, gameplay item, or consumable. Level 60 completes Forest Potion and displays “熟练魔女”; level 90 completes Moon Glow Potion and displays “高级魔女”; level 120 completes Flame Potion and advances to “炼金大师”.
- Home and level select expose one unified collection entry. The collection scene shows exactly ten chapter cards in a two-column vertical ScrollView; chapter one opens the existing six-piece puzzle, while locked cards select nine distinct silhouettes from one shared transparent 3×3 sprite sheet and overlay a compact code-native magical seal lock.
- On the home scene, center the automatic title above the lowered witch with a subtle vertical float and keep settings above collection in one lowered right-side column. Every non-home scene places the 48×48 settings trigger at the fixed top-left safe position `(-155, 378)`, clear of the WeChat menu capsule and chapter navigation arrows.
- Global v2 progress and per-level v2 board snapshots remain separate. A stale/corrupt board resets only that level; it must not erase unlocks or best moves.
- Local completion progress must be saved before clearing the per-level snapshot or rendering results. Cloud sync/telemetry is opportunistic and cannot roll back a successful local completion.
- No environment IDs, secrets, ad unit IDs, or admin credentials are committed.

## Verification

- Run `node --experimental-strip-types tools/generate-levels.ts --check` and `node --experimental-strip-types --test tests/*.test.ts` after core/data changes.
- Run CloudBase tests and `tools/prepare-functions.mjs` after changing shared progress, rewards, telemetry, or cloud functions; all copied runtime hashes must match.
- Open the project in Cocos Creator 3.8.8 before claiming scene or WeChat build compatibility. Cocos generates `.meta` files on first import; retain those generated metadata files afterward.
- After every WeChat build, run `tools/prepare-wechat-build.mjs` and preview from a fresh Developer Tools process. The uploaded `resources` subpackage must contain the complete Cocos bundle rather than only its JavaScript entry; its `game.js` must directly contain the Cocos `System.register` bundle entry, never `require('./index.js')`, because a fresh WeChat subpackage context does not register that sibling module before executing its entry. Restart the IDE service after changing `project.config.json` packaging rules.
