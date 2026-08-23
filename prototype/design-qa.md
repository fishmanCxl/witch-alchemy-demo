# Chibi alchemy water-sort design QA

## Comparison target

- Source visual truth: `C:\Users\cxl\AppData\Local\Temp\codex-clipboard-8c225351-7190-4063-b9fe-c54c8d77af6d.png` (dark Q-style alchemy room) and `C:\Users\cxl\AppData\Local\Temp\codex-clipboard-c6bbd6b4-3b69-48e7-8265-8a62a22a518f.png` (button treatment).
- Implementation evidence: `artifacts/chibi-initial-393x852.png`, recaptured as an explicit 393 × 852 px Playwright clip from `[data-phone-screen]` at device scale factor 1.
- Combined evidence: `artifacts/chibi-reference-comparison.png`; targeted follow-up evidence: `artifacts/chibi-followup-comparison.png`, `artifacts/chibi-followup-reference-comparison.png`, `artifacts/chibi-followup-fine-comparison.png`, and `artifacts/chibi-witch-frame-edge-comparison.png`.
- State: initial Level 12, no bottle selected; the reference is an art-direction reference rather than an exact game-state layout.

## Normalization and evidence

The room reference is 460 × 967 px and the implementation capture is exactly 393 × 852 px at 1×. They are shown side-by-side at preserved aspect ratio; the iPhone template's device chrome is intentionally retained by the protected mobile runtime. The focused control row pairs the provided 578 × 126 px button reference with an implementation crop from the same initial 393 × 852 capture. No claim is based on unnormalized browser-canvas padding.

Full-view comparison confirms the same deep-purple ambient room, walnut table, arched moon window, shelf potion framing, and warm candle contrast. The implementation uses the approved chibi witch in the user-marked center area, readable high-separation liquid layers, and an irregular but bounded 5 × 3 bottle composition. The control crop confirms real raster-backed Q-style buttons rather than CSS approximations.

## Required fidelity surfaces

- **Fonts and typography:** level title has deliberate storybook serif hierarchy; compact Chinese status/copy remains readable and untruncated at both tested device sizes.
- **Spacing and layout rhythm:** header, witch, board, message, and controls are vertically separated; 15 logical slots measure 64 × 112 px and persistent controls remain outside the board.
- **Colors and visual tokens:** dark purple room and warm wood/candle palette match the room reference; violet/gold controls are an intentional magic-system variation of the reference's yellow/gray controls.
- **Image quality and asset fidelity:** backdrop, witch, bottles, particles, burst, panel, and control images all load as raster art with no visible placeholder or transparency halo issue.
- **Copy and content:** action messages are concise Chinese gameplay feedback; the page title is `魔女炼金水排序`.

## Findings and comparison history

Iteration 1 found one P2 delivery issue: the browser requested a missing `/favicon.ico`, producing a console 404, and the generic browser title was still visible. The fix added a real bottle-frame PNG favicon and a localized title in `index.html`. A fresh Playwright run then showed zero console warnings/errors and no failed generated-art requests.

Iteration 2 corrected QA evidence only: the prior element screenshots rasterized to 394 × 852 px because the 393 px screen began at a half-pixel x-coordinate. Initial, cast, and completion states were recaptured with explicit Playwright clips at `x 504, y 174, width 393, height 852`; each PNG header verified 393 × 852 px. The Pixel capture remains exactly 427 × 952 px. The comparison sheet was rebuilt from the true 460 × 967 room reference and 578 × 126 button reference, preserving both reference aspect ratios. Visual inspection found no crop of the phone chrome, bottle outlines, controls, or safe-area edge.

Iteration 3 addressed the marked follow-up screenshots. The witch stage moved from the upper-right shelf to the marked center area (`x 109`, `y 122`, `174 × 182` relative to the 393px phone screen), and the board begins at `y 296` so the character remains visually separated from the first bottle row. The liquid well now begins about 30px below the bottle visual top, measures 66px high, and uses `overflow: hidden` with `11px 11px 12px 12px` rounding. The idle loop is 1500ms; an 800ms browser sample showed four visible frame transitions rather than the prior rapid cycling. Fresh Playwright QA passed at 393 × 852 and 427 × 952 with no console/network failures, bottle overlap, message/control collision, or completion-flow regression. `artifacts/chibi-followup-comparison.png` places both user-marked references beside the corrected implementation.

Iteration 4 addresses the tighter table/liquid/pacing follow-up. The board now has a 28px horizontal tabletop inset and a 4px column gap; at 393 × 852 the rendered board spans x=28–365 while every transformed bottle stays inside x=32.54–357.67. The liquid well widens from 28px to 36px so color layers sit under the glass wall, while `overflow: hidden` and `12px 12px 14px 14px` rounding preserve the body silhouette. Animation timings are now idle 2400ms, cast 1440ms, celebration 1600ms, and oops 1320ms; the idle handoff waits 1800ms. Browser evidence confirmed cast frame 00 remains visible after 105ms and advances by 210ms, with zero console or failed-request output. `artifacts/chibi-followup-reference-comparison.png` places the two new user references beside the exact 393 × 852 capture and focused liquid crop.

Iteration 5 tightens only the first bottle row, preserving the irregular lower rows. Its five logical centers now have a uniform 63px separation, with the outer bottles shifted inward by 10px and the inner pair by 5px. At 393 × 852 their transformed visual bounds remain x=42.54–347.67 relative to the screen, leaving at least 14.54px inside the board's tabletop-safe edge. The liquid well keeps its top at about 30px but changes from bottom 8px / height 66px to bottom 9px / height 65px, removing the reported 1px bottom overrun. All 28 witch frames retain at least 41px of transparent source margin; runtime uses `object-fit: contain` in a 174 × 182 stage with explicit visible overflow. The cast arc frame was recaptured in `artifacts/chibi-followup-fine-cast-393x852.png` and is fully visible.

Iteration 6 identifies the remaining right-side cut as a source-strip defect rather than a runtime container defect. The old equal-width crop crossed through adjacent poses; idle-00 alone had a 45px continuous opaque run on its right bbox edge. `idle` and `oops` were rebuilt from two built-in image edits as versioned, wide-gutter strips (`artifacts/witch-idle-strip-v2.png`, `artifacts/witch-oops-strip-v2.png`) with exactly six centered poses and no overlap. The normalizer reads 12% neighboring safety area, while the validator now rejects any vertical subject-edge run above 20px. All 28 frames pass, the runtime URL uses `?v=2` to avoid stale public-asset cache, and fresh 393 × 852 idle/oops captures load the new URLs without console or network errors. `artifacts/chibi-witch-frame-edge-comparison.png` makes the old clipped hat/wand edge and the complete replacement directly comparable.

No actionable P0/P1/P2 visual mismatches remain. The retained protected phone chrome and the purple/gold control palette are intentional product constraints, not fidelity defects. A P3 future polish option is to create a dedicated app icon rather than reuse the existing bottle-frame asset for the favicon.

## Implementation checklist

- [x] Compare reference and rendered implementation in a combined sheet.
- [x] Inspect full composition and focused control region.
- [x] Verify typography, layout, colors, imagery, and copy at 393 × 852 and 427 × 952.
- [x] Fix the favicon/title delivery issue and recapture browser evidence.
- [x] Match the marked witch area and clip rounded liquid below the bottle neck.
- [x] Keep transformed bottles within the tabletop safe inset, widen the liquid well, and verify the slower frame cadence.
- [x] Pack only the first row, remove the 1px liquid overrun, and verify every witch frame plus a rendered cast extreme for clipping.
- [x] Replace overlapping idle/oops source strips with wide-gutter versions and guard against future hard subject-edge cuts.

final result: passed
