# Mobile Prototype Agent Guide

## Prototype Instructions

## Confirmed Witch Water-Sort Product Decisions

- Sharing uses the native WeChat share card without a custom image or reward. Home keeps a third square share entry below settings and collection; level completion uses compact replay and share actions on the top row plus one wide primary action below; regular completion advances to the next level/chapter or returns to level select, while daily completion returns home. Collection detail keeps return and share actions side by side.
- The home collection and share entries each use one complete 128×128 transparent SpriteFrame, displayed inside the existing 64×64 hit area; their labels and symbols are baked into the approved artwork, so never layer the legacy raster base, glyph, or code-rendered text over them.
- Home titles select one double-resolution 336×90 cell from the shared transparent 672×450 title-badge SpriteFrame, display it at a fixed 168px width with proportional automatic height, and never crop it or overlay runtime text. Collection detail does not repeat the player's title.
- Level completion keeps its title at the top of the panel, distributes the three information rows and star row evenly below it, and renders the shared 80×80 earned/empty star SpriteFrames at 44px with 68px center spacing. Selector stars use the same SpriteFrames at 15px with 18px center spacing, and the chapter total uses the earned SpriteFrame at 44px instead of a text glyph.
- All interface text rendered through the shared label path uses a crisp 1px lower-right deep-purple shadow at roughly 55% opacity.

- Art direction is a dark witch-alchemy workshop with a warm walnut sorting board and vivid potion colors.
- The core board uses a fixed 5 × 3 slot geometry. Regular level content uses at most 14 slots; slot 15 is reserved for a one-time rewarded empty bottle.
- Completed four-layer single-color bottles seal, celebrate, fly away, and leave an inactive slot. Bottles never reflow and the inactive slot cannot be reused as an empty bottle.
- The witch has idle, casting, and completed-potion celebration states. Bottle interaction triggers casting; one second without interaction returns her to idle.
- The prototype simulates rewarded-ad completion locally and does not integrate an advertising SDK.
- Each regular or daily challenge starts with three undos and one restart. Successful uses consume only their own allowance; restarting never refills undo. Regular allowances persist with the active level snapshot, while daily allowances live only for that daily attempt. At zero, the corresponding control shows the rewarded-ad badge; a completed ad refills that allowance to its maximum and immediately performs the requested action. The undo and restart controls always show their remaining allowance as a single digit in the shared speech-bubble style. The add-empty-bottle control always shows the rewarded-ad badge. Endless mode keeps undo and extra bottles disabled.
- Stamina is an independent local record capped at 10, recovers 1 point every 30 minutes, and gains 5 points (still capped at 10) only after the prototype's locally simulated rewarded ad completes. Entering a level costs nothing, while successful completion and confirmed exit each spend exactly 1 point. Cancelled exit, restart, undo, background/foreground transitions, and force-close never spend stamina.
- The home stamina pill uses 4px horizontal and 2px vertical content padding with a 2px row gap. When stamina is below 10, append the existing 18px plus badge and keep the whole pill as the single trigger for the stamina dialog; hide the badge and shrink the pill immediately at full stamina.
- The approved art direction is cute chibi storybook alchemy: approximately three-head-tall witch proportions, rounded silhouettes, clean thick outlines, deep-purple ambient light, and warm-orange candlelight.
- The chapter-two rare collection is the Forest Potion: a centered leaf-bud glass bottle with emerald-to-teal liquid, cork, small vines, a gold leaf pendant, sparse fireflies, and a soft green magic halo. Its approved PNG is 512×512 with real transparency, stays under 300 KiB, and keeps key details clear of the 2×3 puzzle seams.
- The chapter-three rare collection is the Moon Glow Potion: a centered crescent-shaped glass bottle with silver-blue liquid, a crescent pendant, sparse moon dust, and a soft moonlight ring. Its approved PNG is 512×512 with real transparency, stays under 300 KiB, and keeps key details clear of the 2×3 puzzle seams.
- The chapter-four rare collection is the Flame Potion: a centered flame-shaped glass bottle with scarlet-to-gold liquid, a gold flame pendant, sparse embers, and a soft fire-magic ring. Its approved PNG is 512×512 with real transparency, stays under 300 KiB, and keeps key details clear of the 2×3 puzzle seams.
- The chapter-five rare collection is the Ice Crystal Potion: a centered crystal-cluster glass bottle with ice-blue liquid, a silver snowflake pendant, sparse snow dust, and a soft cyan cold-magic halo. Its approved PNG is 512×512 with real transparency, stays under 300 KiB, and keeps key details clear of the 2×3 puzzle seams.
- The chapter-six rare collection is the Wind Spirit Potion: a centered round winged glass bottle with a spherical crystal stopper, cyan-to-indigo swirling liquid, a silver feather pendant, sparse feathers and wind traces, and a soft aurora halo. Its approved PNG is 512×512 with real transparency, stays under 300 KiB, and keeps key details clear of the 2×3 puzzle seams.
- Witch animation uses seven production states: idle 18, prepare 12, raise 12, cast 20, celebrate 14, return 18, and invalid feedback 12. Every runtime frame is 512×512, independently normalized to a 370±3px character height, and uses the fixed foot anchor `(256,470)`; cast/celebrate magic remains a separate synchronized overlay.
- For chapters eight through ten, rare-potion artwork is temporary placeholder content only: add one simple image that satisfies the required resource path, dimensions, transparency, size, and 2x3 puzzle contract, without generating multiple candidates or spending time on visual polish. The user will replace all later potion artwork.
- Potion readability uses both high-separation hues and a unique particle language per potion color.
- Bottle placement uses deterministic controlled randomness inside the fixed 5 × 3 safety grid: x offset within ±5px, y offset within ±10px, and rotation within ±2 degrees. A level never rerolls positions while active.
- Chapters one through eight publish exactly levels 1–240; level 1 is the only tutorial, level 2 immediately uses the full all-colors rules, and level 12 keeps its legacy board byte-for-byte. Chapter eight covers levels 211–240, completes at 240, and keeps level 241 unpublished.
- Chapter eight is “星辰炼金”, uses eleven colors, two initial empty bottles, ordinary slots 0–13, and reserved rewarded-bottle slot 14. Its approved target coefficients are 1.30/1.38/1.41/1.43/1.46 at levels 211/212/215/220/230, 1.47 at levels 235–237, and 1.40 at level 240 with piecewise-linear interpolation; difficulty must come from optimal-move, segment, explored-state, opening, and misleading-branch gates rather than more colors.
- Chapter eight unlocks Stellar Potion puzzle pieces at levels 215/220/225/230/235/240 and promotes “星辉魔女” to “月之魔女” at level 240. Its Stellar Potion artwork is one simple 512×512 transparent placeholder satisfying the 2×3 puzzle and SpriteFrame contract; do not generate candidates or visually refine it because the user will replace it.
- Level generation and exact solving happen only in the offline deterministic toolchain. Runtime presentation consumes committed static level data and never generates or solves a board.
- The chapter-one selector fits all 30 levels on one fixed 5×6 page with no scrolling, pagination, or chapter arrows.
- The level selector has no collection entry because collection remains available from home. It shows only the enlarged `chapterLabel · themeTitle` heading without the witch title or level range, renders the chapter star total at 44px above the grid, and keeps the wide return-home button centered at the bottom.
- Each published chapter collection is one 2×3 puzzle derived from continuous completed progress, revealing one piece per five chapter completions. Collection progress is not a gameplay item and is not stored separately.
- Level stars are derived rather than persisted: 3 stars at the static theoretical optimum, 2 stars through `optimalMoves + max(2, ceil(optimalMoves × 15%))`, and 1 star for any completion or legacy completion without a best-move record. The selector renders stars below completed level buttons, keeps all 30 levels on one widened 5×6 page, and shows the chapter total out of 90.
- Daily alchemy commissions unlock after level 5, choose one deterministic already-completed non-tutorial level per local day, use a fresh temporary session, and never spend stamina or overwrite the formal level snapshot. The first daily completion grants exactly 1 stamina up to 10; a reward reached at full stamina remains claimable after stamina drops. Daily best, claim state, and completion streak live in one separate v1 local record while formal `bestMoves` may improve without advancing `completedThrough`.
- The home daily-commission entry uses one complete 128×128 transparent Sprite displayed in the existing 64×64 hit area. Its “每日委托” label is baked into the artwork, so never overlay the legacy button base or title text. Before level 5, keep the icon at full opacity without a “5关解锁” caption and keep it clickable so the dialog explains the requirement. Actionable unlocked states use a horizontally centered stamina icon plus `+1` inside a gently floating 64×32 speech bubble backed by a 128×64 2× Sprite; its arrow points 5px beyond the button's right edge, and the bubble disappears when there is no message.
- Endless mode unlocks after level 5 and reads only published static levels after the tutorial. Its visible 128×128 home artwork renders at 64×64; one independent v1 local state owns resumable boards, failed state, one rewarded-ad reset per stage, and best streak. It never spends stamina or reads/writes main progress, stars, collection, titles, daily commission, cloud sync, undo, or extra bottles; abandoning a failed run requires confirmation.
- The displayed witch title is always the highest title derived from completed chapters; players cannot equip, switch, or persist a chosen title.
- Locked collection cards reuse one transparent 3×3 potion-silhouette sprite sheet, mapped left-to-right and top-to-bottom across chapters 2–10, with a compact purple-and-gold magical seal lock overlay.
- When a selected bottle cannot pour into another active filled bottle, invalid feedback remains visible on the pair while selection and the cyan highlight transfer immediately to the newly tapped bottle.
- A selected bottle keeps its lifted cyan-highlight state and sways by 5 degrees left and right without moving its hit target. A valid pour pauses the sway, keeps the source lifted, and holds a 28-degree tilt toward the target column until the 520ms pour state ends, defaulting to a left tilt when both bottles share one column.
- Both launch stages replace the product-name text with the same transparent 612×222 double-resolution logo, render it at a fixed 306px width with proportional automatic height, and never stretch or crop it.
- Bottom controls and game messages use image-backed Q-style UI assets with normal, pressed, disabled, enter, replace, and exit states.
- The React/Vite mobile prototype is the visual and interaction-validation target only. The production WeChat Mini Game target is Cocos Creator 3.x with TypeScript, reusing the pure game engine and level data rather than the React presentation layer.
- Phase-one backend uses WeChat Cloud Development / Tencent CloudBase. It owns cloud save, remotely versioned level configuration, idempotent rewarded-empty-bottle claims, and basic completion telemetry. The current React prototype must keep rewarded-ad completion local and must not connect to a real CloudBase environment.
- In production, animation/input remain client-side; identity, reward claims, cloud progress revisions, and remote configuration are server-owned. Cloud functions derive OPENID from the trusted WeChat invocation context instead of accepting a client-supplied identity.

- Audio BGM and SFX are original local assets, stored and served from the prototype without external commercial sound libraries.
- The stable cue contract is the boundary between gameplay events and the audio driver; gameplay emits approved event names while the driver owns playback behavior.
- Music and SFX switches are independent preferences persisted under the versioned audio preferences key, with both switches enabled by default.
- The first bottle or UI gesture unlocks audio even for invalid operations; background or lock interruptions suspend playback and foreground resumes a single BGM instance when music remains enabled.

In ChatGPT Work Mode, run `sites-preview start "$PWD"`, open `http://terminal.local:4173/` in the cloud browser, and verify the rendered app and its primary interactions. Keep that preview open and tell the user to inspect it in the cloud browser; do not present the local URL as a user-facing chat link. In Codex Desktop, run the local server yourself, open the preview in the in-app browser, and provide the clickable local URL. Do not deploy to Sites unless the user explicitly asks to share, publish, or deploy. Do not give the user server-start instructions when you can run it.

Before planning or implementing any mobile-app change, read this `AGENTS.md` in full. It is the source of truth for the template's runtime and component guidance.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Editing Boundary

- Build app-specific UI in `src/Prototype.tsx` and `src/prototype.css`.
- Treat `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `src/mobile/`, `public/assets/iphone/`, `public/assets/android/`, `public/assets/status/`, `vite.config.ts`, `worker/index.js`, and `scripts/prepare-sites-build.mjs` as protected runtime files. Do not edit, replace, remove, or recreate them unless the user explicitly asks to change the mobile runtime itself. For an explicit runtime change, update the affected lock hashes only after verifying the new runtime behavior.
- Run `npm run check:runtime` before preview or handoff. If it fails, restore the protected runtime instead of weakening or bypassing the check.
- `npm run build` preserves the mobile runtime and prepares the static Cloudflare Worker output required by Sites. Before a Sites handoff, confirm `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`, and source `.openai/hosting.json` exist, then run `npm run test:sites`. Do not replace this project with a Vinext starter.

## Runtime Contract

- Preserve the mobile device runtime unless the user's task explicitly asks otherwise. Do not replace it with a standalone page. Visual fidelity applies to app-owned content inside the device screen, not to template-owned device chrome.
- Keep `App` composed around `PhoneFrame` -> `KeyboardProvider`, with `StatusBar`, app content, `HomeIndicator`, and `KeyboardDock` mounted inside the phone frame. `StatusBar` and the iOS home indicator are overlaid device chrome. When the Android keyboard is closed, the app viewport reserves the protected navigation-bar region instead of painting behind it. When the Android keyboard is open, preserve the current full-screen keyboard layout: its asset includes the IME navigation strip and the separate black navigation bar is hidden. iOS screens continue to paint behind the home-indicator area and own their safe-area content padding.
- Preserve the `iPhone` / `Pixel 10` device picker and both calibrated device presets. The Pixel screen is `427 x 952`; its `32 x 32` camera circle and `public/assets/android/navigation-bar.svg` bottom navigation bar are protected device chrome, not app content.
- Preserve the device picker's intentionally lightweight Codex styling in the top-right corner: its trigger wrapper is borderless and transparent, its trigger sizes to content, and its right-aligned menu uses the compact 3px inset plus the specified hairline and elevation shadow layers. Keep the prototype root and default app screen white.
- Preserve `StatusBar` as live device chrome, including its platform-specific typography, source status-icon assets, and spacing. Pixel 10 uses Roboto, Android indicators, and 32px top, left, and right padding. iPhone uses its iOS indicators, system typography, and calibrated spacing. Do not hardcode screenshot times like `9:41` into the status bar, replace its real-time clock, or move status bar content into app markup unless the user explicitly asks for a fixed/mock device time.
- `PhoneFrame` owns the calibrated device frame, screen portal, device picker, camera cutout, and custom cursor. Keep device assets in `public/assets/iphone/` and `public/assets/android/`; if an asset fails to load, repair the asset path or restore the asset instead of removing the frame, keyboard, or image render.
- Use `MobileScroll` directly for simple single-screen prototypes. Use `FlowStack` for conventional multi-screen flows whose routes can own their fixed header and footer; when using it, define each route as a `FlowScreen`: `{ id, header?, headerHeight?, footer?, footerHeight?, render }`, and use `flow.push(screen)`, `flow.pop()`, and `flow.replace(screen)` from `FlowStack` render callbacks or `useFlow()` instead of introducing another router.
- Use `Carousel` for a carousel, horizontal rail, swipeable cards, image or media strip, horizontally scrollable cards, chip rail, or other horizontal collection.
- For a layered app shell—such as a persistent composer, independently presented sheet, pushed/peek sidebar, or app-wide transition—compose directly in `Prototype.tsx` rather than forcing it through `FlowStack`. Keep app-owned fixed chrome as sibling layers outside `MobileScroll`.
- When using `FlowScreen`, put route-owned fixed headers or footers in `FlowScreen.header` or `FlowScreen.footer`. Set `headerHeight` to the visible app-toolbar height; `FlowStack` adds the device's top safe-area/status-bar inset automatically. Do not include `StatusBar` or its height in the header. Set `footerHeight` to the full app-footer height. `FlowScreen.footer` is an overlay, not reserved layout space; screens using it must add their own bottom content padding such as `padding-bottom: calc(var(--flow-footer-height) + var(--mobile-safe-area-height) + 24px)` so final content can scroll above the footer while still painting behind it.
- Render only scrollable content inside `MobileScroll`; it is for content that should move with scroll and rubber-band overscroll. Keep app-owned headers, nav bars, tabs, composers, and overlays outside it. This keeps scroll physics, safe areas, keyboard insets, scrollbars, and drag click suppression active without letting content paint under fixed chrome.
- Buttons, links, cards, and images inside `MobileScroll` should still allow drag scrolling when the pointer moves beyond tap slop. Use `data-scroll-drag="ignore"` only for rare controls that must own the drag gesture themselves.
- Do not add `var(--keyboard-height)` to ordinary screen/content padding inside `MobileScroll`; the scroll viewport already shrinks above the simulated keyboard. For custom fixed composers, search bars, or toast chrome, use `useKeyboardInsets().bottomInset`. It is relative to the app viewport: Android returns `0` while the closed-keyboard viewport already reserves navigation, then returns the keyboard height while open; iOS continues to clear the home indicator while closed and ride directly above the keyboard while open. Do not pin custom bottom chrome to `bottom: 0` or only `keyboardHeight`.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for every text-entry control. A raw `input` or `textarea` disconnects focus, keyboard animation, safe-area insets, and attached surfaces.
- Use `BottomSheet` for phone-scoped sheets. Its props are `open`, `onOpenChange`, `title`, optional `description`, optional `snap`, and `children`; it renders through the phone screen portal and dismisses the keyboard before opening.

## Horizontal Carousels

- Use `Carousel` for horizontally draggable cards, images, media, chips, or other horizontal collections. Do not recreate these with `overflow-x`, custom pointer handlers, or a generic div.
- `Carousel` can be nested directly inside `MobileScroll`. It owns horizontal gestures and automatically yields vertical gestures to the parent.
- Never put `data-scroll-drag="ignore"` on or around a `Carousel`; doing so prevents vertical parent scrolling when a gesture begins inside it.
- Do not add CSS scroll snapping to `Carousel`; its runtime owns momentum and release motion.
- Use `data-scroll-drag="ignore"` only when a control must prevent parent scrolling in every drag direction.

See `src/mobile/COMPONENTS.md` for the full component and gesture contract.

## Keyboard Rule

The simulated keyboard is a separate top-layer component. Before presenting anything that behaves like iOS navigation or modal UI, dismiss it first.

Call `keyboard.hide()` before:

- pushing, popping, or replacing FlowStack routes
- opening bottom sheets, action sheets, dialogs, menus, or navigation sheets
- starting transitions where the destination should not inherit text-input focus

`FlowStack` already hides the keyboard for `push`, `pop`, and `replace`. `BottomSheet` already hides it before opening. If you add new modal/sheet/navigation primitives, follow the same rule.

When a composer, search surface, or other keyboard-attached component closes, call `keyboard.hide()` in the same event before changing that component's open state. Position attached surfaces from `useKeyboardInsets()` rather than a separate timer or visibility flag so both dismiss together.

When any text-entry control loses focus, dismiss the simulated keyboard. If the control is custom or does not use the runtime's keyboard-aware fields, handle its blur event and call `keyboard.hide()` explicitly. Keep the keyboard open only when focus is moving directly to another text-entry control that should share the same keyboard session.

## Interaction Rules

- Do not trigger buttons or inputs after a pointer has become a drag. Preserve the drag suppression behavior in `MobileScroll`.
- Do not allow native browser image/file dragging inside the phone frame. Preserve the phone-level `dragstart` suppression and non-draggable image styles so scroll drags that begin on images still scroll the prototype.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for text entry so the simulated keyboard and safe-area insets stay connected.
- Fixed phone chrome should not animate with pushed screens. Screen content can animate; the status bar, camera cutout, and preview chrome should stay put.
- Keep the keyboard below the home indicator/safe area layer in z-index, and above ordinary app UI while visible.
- Keep the home indicator as the topmost safe-area layer in the z-index above everything else in the prototype.

## Home and Unified Settings Decisions

- The first app-owned scene is the witch-alchemy home screen, structured as top progress information, one centered idle-witch focal area, and one bottom `继续炼金 · 第 12 关` action.
- The production WeChat launch must replace the default Cocos logo screen with a branded pre-engine rendering of the approved launch page. Engine initialization owns 0–60% of the visible progress, and the Cocos resource preload continues from 60–100% without resetting the bar.
- Production alchemy-room backgrounds use CSS-like `background-size: cover` against the actual fixed-width visible viewport. Backgrounds and modal shields fill tall phone screens while app UI keeps its centered 393×852 coordinates.
- The 48×48 raster gear control stays in the right-side settings/collection column on the home scene. Every non-home scene places it in the fixed top-left safe area, clear of the WeChat menu capsule and chapter navigation arrows; it opens the same centered, modal purple-and-gold settings panel whose mask continues intercepting input through its 160ms exit.
- Settings, stamina, daily commission, and exit-confirm dialogs share a subtle 180ms fade-and-scale entrance from 92% and a 160ms fade-and-scale exit to 96%. Their modal shields keep intercepting input until exit completes, and in-dialog state refreshes must not replay the entrance.
- Settings expose exactly one master sound switch. The UI changes `musicEnabled` and `sfxEnabled` atomically through the versioned `witch-water-sort.audio.v1` preference while the audio director retains its two internal tracks, default gains, voice cap, and ducking behavior.
- Returning home changes only the top-level scene. The active level instance retains bottle contents and seeded positions, move count, completed count, rewarded empty-bottle state, and undo history so continuing resumes the same stable board.
