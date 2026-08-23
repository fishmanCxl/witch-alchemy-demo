import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as presentation from '../src/game/presentation.mjs';

import {
  POTION_VISUALS,
  WITCH_ANIMATIONS,
  canInterruptWitch,
  createMessagePlayback,
  createWitchPlayback,
  messagePhase,
  particleSeeds,
  replaceMessagePlayback,
  requestWitchPlayback,
  seededBottlePose,
  witchFrameAt,
  witchFrameUrl,
} from '../src/game/presentation.mjs';

// Catches a wrong visual-state URL that makes a control lose its Q-style base,
// or sends the message panel to a non-public/missing asset.
test('control and message assets resolve to approved public URLs', () => {
  assert.equal(typeof presentation.controlAssetUrl, 'function');
  assert.equal(typeof presentation.messagePanelUrl, 'function');
  assert.equal(
    presentation.controlAssetUrl('gold', 'pressed'),
    '/assets/game/chibi/ui/button-gold-pressed.png',
  );
  assert.equal(
    presentation.controlAssetUrl('purple', 'disabled'),
    '/assets/game/chibi/ui/button-purple-disabled.png',
  );
  assert.equal(presentation.messagePanelUrl(), '/assets/game/chibi/ui/message-panel.png');
});

// The project has no DOM test runner. This narrowly guards the source branches that
// prevent duplicate live panels during replacement and reset a captured pressed state.
test('message replacement keeps one live panel and controls clear every pointer capture state', () => {
  const messageSource = readFileSync(new URL('../src/components/GameMessage.tsx', import.meta.url), 'utf8');
  const controlSource = readFileSync(new URL('../src/components/ControlButton.tsx', import.meta.url), 'utf8');

  assert.equal((messageSource.match(/role="status"/g) ?? []).length, 1);
  assert.match(messageSource, /aria-live="polite"/);
  assert.match(messageSource, /key=\{message\.id\}/);
  assert.match(messageSource, /messagePanelUrl\(\)/);
  assert.match(controlSource, /onPointerCancel=\{clearPressed\}/);
  assert.match(controlSource, /onLostPointerCapture=\{clearPressed\}/);
  assert.match(controlSource, /releasePointerCapture/);
  assert.match(controlSource, /disabled=\{disabled\}/);
  assert.match(controlSource, /controlAssetUrl\(variant, state\)/);
});

// Catches Task 6 reconnecting the local legacy controls after the raster-backed
// component has become the playable level's sole control surface.
test('raster controls replace the legacy control surface in the playable level', () => {
  const prototypeSource = readFileSync(new URL('../src/Prototype.tsx', import.meta.url), 'utf8');
  const controlSource = readFileSync(new URL('../src/components/ControlButton.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../src/prototype.css', import.meta.url), 'utf8');

  assert.match(prototypeSource, /import\s+\{\s*ControlButton\s*\}\s+from\s+["']\.\/components\/ControlButton["']/);
  assert.match(controlSource, /className=\{`chibi-control-button/);
  assert.doesNotMatch(controlSource, /className=\{`control-button/);
  assert.match(cssSource, /\.chibi-control-button\s*\{/);
  assert.doesNotMatch(cssSource, /\.control-button\s*\{/);
  assert.doesNotMatch(cssSource, /\.control-icon\s*\{/);
});

// Catches visual-slot regressions that collapse inactive grid cells, show art for unavailable
// bottles, or let interaction state overwrite the level's deterministic base pose.
test('bottle visual model preserves fixed hidden slots and state-independent base poses', () => {
  assert.equal(typeof presentation.bottleVisualModel, 'function');

  const flaggedActive = presentation.bottleVisualModel({
    bottle: { status: 'active', layers: ['rose', 'cyan'] },
    levelSeed: 12,
    slotIndex: 4,
    selected: true,
    pouring: true,
    invalid: true,
    departing: true,
  });

  assert.deepEqual(flaggedActive, {
    slot: { width: 64, height: 112 },
    rendersBottle: true,
    pose: { x: 1, y: -1, rotate: -0.8 },
    state: { selected: true, pouring: true, invalid: true, departing: true },
    layers: [
      { color: 'rose', particleSeeds: [0.9842816800773799, 0.6050575977668766] },
      { color: 'cyan', particleSeeds: [0.7921871428359736, 0.7539809811287516] },
    ],
  });

  for (const status of ['inactive', 'reserved', 'vanished']) {
    const hidden = presentation.bottleVisualModel({
      bottle: { status, layers: ['rose'] },
      levelSeed: 12,
      slotIndex: 4,
      selected: true,
      invalid: true,
      departing: true,
    });

    assert.deepEqual(hidden.slot, { width: 64, height: 112 });
    assert.equal(hidden.rendersBottle, false);
    assert.deepEqual(hidden.pose, { x: 1, y: -1, rotate: -0.8 });
    assert.deepEqual(hidden.layers, []);
  }
});

// Catches a future change that rerolls a bottle pose or lets it escape the approved grid-safe offsets.
test('seeded bottle pose is stable and stays inside approved bounds', () => {
  const first = seededBottlePose(12, 4);
  const second = seededBottlePose(12, 4);

  assert.deepEqual(first, second);
  assert.ok(first.x >= -5 && first.x <= 5);
  assert.ok(first.y >= -10 && first.y <= 10);
  assert.ok(first.rotate >= -2 && first.rotate <= 2);
});

// Catches a changed hash input, output range, or bit slice that would preserve bounds but alter approved poses.
test('seeded bottle pose uses the approved hash mapping', () => {
  assert.deepEqual(seededBottlePose(12, 4), { x: 1, y: -1, rotate: -0.8 });
  assert.deepEqual(seededBottlePose(37, 9), { x: 5, y: -1, rotate: 0.2 });
});

// Catches a hash/mapping regression that makes visible neighboring bottles look uniformly positioned.
test('visible neighboring slots receive varied poses', () => {
  const poses = Array.from({ length: 11 }, (_, index) => seededBottlePose(12, index));

  assert.ok(new Set(poses.map((pose) => `${pose.x},${pose.y},${pose.rotate}`)).size >= 8);
});

// Catches a frame-duration regression that makes the cast snap too quickly for the
// deliberately unhurried character direction.
test('cast uses twenty readable frames and finishes at 1200ms', () => {
  const playback = createWitchPlayback('cast', 1000);

  assert.equal(witchFrameAt(playback, 1000).index, 0);
  assert.deepEqual(witchFrameAt(playback, 2199), { index: 19, done: false });
  assert.equal(witchFrameAt(playback, 2200).done, true);
  assert.deepEqual(WITCH_ANIMATIONS.cast, { frames: 20, durationMs: 1200, loop: false });
});

// Catches URL formatting regressions that would make the frame animator request missing images.
test('frame URL pads indices to two digits', () => {
  assert.equal(witchFrameUrl('idle', 0), '/assets/game/chibi/character/idle/idle-00.png?v=3');
  assert.equal(witchFrameUrl('celebrate', 13), '/assets/game/chibi/character/celebrate/celebrate-13.png?v=3');
});

// Catches an early interruption that cuts off the mandatory first six celebration frames.
test('celebration cannot be interrupted before frame six', () => {
  const playback = createWitchPlayback('celebrate', 0);

  assert.equal(canInterruptWitch(playback, 'cast', 839), false);
  assert.equal(canInterruptWitch(playback, 'cast', 840), true);
  assert.deepEqual(WITCH_ANIMATIONS.celebrate, {
    frames: 14,
    durationMs: 1120,
    loop: false,
    minInterruptMs: 840,
  });
});

// Catches a mood request being dropped when celebration's non-interruptible window expires.
test('defers a mood request until the source interruption window has elapsed', () => {
  const playback = createWitchPlayback('celebrate', 1000);

  assert.deepEqual(requestWitchPlayback(playback, 'cast', 1200), {
    playback,
    frame: null,
    retryAt: 1840,
  });
});

// Catches a new animation briefly requesting a frame index inherited from its previous mood.
test('starts an accepted mood playback from frame zero', () => {
  assert.deepEqual(requestWitchPlayback(createWitchPlayback('cast', 1000), 'oops', 1200), {
    playback: { mood: 'oops', startedAt: 1200 },
    frame: 0,
    retryAt: null,
  });
});

// Catches a changed idle frame count, duration, or loop flag that would make the
// slower waiting gesture stutter or stop.
test('idle exposes eighteen frames over 3600ms and loops back to the first frame', () => {
  const playback = createWitchPlayback('idle', 5000);
  assert.deepEqual(witchFrameAt(playback, 5000), { index: 0, done: false });
  assert.deepEqual(witchFrameAt(playback, 5199), { index: 0, done: false });
  assert.deepEqual(witchFrameAt(playback, 5200), { index: 1, done: false });
  assert.deepEqual(witchFrameAt(playback, 8599), { index: 17, done: false });
  assert.deepEqual(witchFrameAt(playback, 8600), { index: 0, done: false });
  assert.deepEqual(WITCH_ANIMATIONS.idle, { frames: 18, durationMs: 3600, loop: true });
});

// Catches an oops frame-count, duration, or completion regression that makes
// invalid feedback flash too quickly or loop indefinitely.
test('oops exposes twelve frames and completes without looping at 960ms', () => {
  const playback = createWitchPlayback('oops', 5000);
  assert.deepEqual(witchFrameAt(playback, 5000), { index: 0, done: false });
  assert.deepEqual(witchFrameAt(playback, 5959), { index: 11, done: false });
  assert.deepEqual(witchFrameAt(playback, 5960), { index: 11, done: true });
  assert.deepEqual(WITCH_ANIMATIONS.oops, { frames: 12, durationMs: 960, loop: false });
});

// Catches the screenshot regressions reported after delivery: bottles drifting beyond
// the tabletop, and potion layers leaving a dry gap beside the inner glass wall.
test('board uses a tabletop safe inset and the potion well hugs the rounded bottle body', () => {
  const cssSource = readFileSync(new URL('../src/prototype.css', import.meta.url), 'utf8');
  const prototypeSource = readFileSync(new URL('../src/Prototype.tsx', import.meta.url), 'utf8');
  const witchRule = cssSource.match(/\.witch-stage\s*\{([^}]*)\}/s)?.[1] ?? '';
  const witchFrameRule = cssSource.match(/\.witch-frame\s*\{([^}]*)\}/s)?.[1] ?? '';
  const boardRule = cssSource.match(/\.board-shell\s*\{([^}]*)\}/s)?.[1] ?? '';
  const gridRule = cssSource.match(/\.bottle-grid\s*\{([^}]*)\}/s)?.[1] ?? '';
  const liquidRule = cssSource.match(/\.liquid-stack\s*\{([^}]*)\}/s)?.[1] ?? '';

  assert.match(witchRule, /top:\s*122px;/);
  assert.match(witchRule, /right:\s*110px;/);
  assert.match(witchRule, /overflow:\s*visible;/);
  assert.match(witchFrameRule, /object-fit:\s*contain;/);
  assert.match(boardRule, /top:\s*296px;/);
  assert.match(boardRule, /right:\s*28px;/);
  assert.match(boardRule, /left:\s*28px;/);
  assert.match(gridRule, /column-gap:\s*4px;/);
  assert.match(gridRule, /row-gap:\s*10px;/);
  assert.match(cssSource, /\.bottle-slot:nth-child\(1\)\s*\{[^}]*transform:\s*translateX\(10px\);/s);
  assert.match(cssSource, /\.bottle-slot:nth-child\(2\)\s*\{[^}]*transform:\s*translateX\(5px\);/s);
  assert.match(cssSource, /\.bottle-slot:nth-child\(4\)\s*\{[^}]*transform:\s*translateX\(-5px\);/s);
  assert.match(cssSource, /\.bottle-slot:nth-child\(5\)\s*\{[^}]*transform:\s*translateX\(-10px\);/s);
  assert.match(liquidRule, /right:\s*6px;/);
  assert.match(liquidRule, /bottom:\s*9px;/);
  assert.match(liquidRule, /left:\s*6px;/);
  assert.match(liquidRule, /height:\s*65px;/);
  assert.match(liquidRule, /overflow:\s*hidden;/);
  assert.match(liquidRule, /border-radius:\s*12px 12px 14px 14px;/);
  assert.match(prototypeSource, /setTimeout\(\(\) => setWitchMood\("return"\), 1800\)/);
});

// Catches off-by-one message boundaries that flash, shorten, or extend the panel phases.
test('message phases use 180ms enter, 1400ms hold, and 240ms exit', () => {
  assert.equal(messagePhase(0, 0), 'enter');
  assert.equal(messagePhase(0, 180), 'hold');
  assert.equal(messagePhase(0, 1579), 'hold');
  assert.equal(messagePhase(0, 1580), 'exit');
  assert.equal(messagePhase(0, 1820), 'done');
});

// Catches replacement text appearing without the required 120ms fade-out interval.
test('a replacement message fades text for 120ms before restarting hold', () => {
  const first = createMessagePlayback(1, 'A', 0);
  const replaced = replaceMessagePlayback(first, 2, 'B', 600);

  assert.equal(replaced.phase, 'replace');
  assert.equal(messagePhase(replaced.startedAt, 719, replaced.phase), 'replace');
  assert.equal(messagePhase(replaced.startedAt, 720, replaced.phase), 'hold');
});

// Catches a visual-metadata mapping that makes colors indistinguishable or pairs them with the wrong motif.
test('every approved potion color has its specified particle asset', () => {
  assert.deepEqual(POTION_VISUALS, {
    rose: { color: '#f05b9d', particleUrl: '/assets/game/chibi/effects/particle-rose-heart.png' },
    violet: { color: '#8f4de8', particleUrl: '/assets/game/chibi/effects/particle-violet-star.png' },
    amber: { color: '#f0a43b', particleUrl: '/assets/game/chibi/effects/particle-amber-spark.png' },
    cyan: { color: '#36bad1', particleUrl: '/assets/game/chibi/effects/particle-cyan-bubble.png' },
    mint: { color: '#56caa0', particleUrl: '/assets/game/chibi/effects/particle-mint-leaf.png' },
    blue: { color: '#4566d8', particleUrl: '/assets/game/chibi/effects/particle-blue-snow.png' },
    gold: { color: '#f2c94c', particleUrl: '/assets/game/chibi/effects/particle-gold-dust.png' },
    lilac: { color: '#b176d6', particleUrl: '/assets/game/chibi/effects/particle-lilac-moon.png' },
  });
});

// Catches particle jitter or out-of-range seeds that would place a layer's motifs outside its liquid.
test('particle seeds are stable and normalized for a visible liquid layer', () => {
  const seeds = particleSeeds(12, 2, 3);

  assert.deepEqual(seeds, particleSeeds(12, 2, 3));
  assert.equal(seeds.length, 2);
  assert.ok(seeds.every((value) => value >= 0 && value <= 1));
});

// Catches degenerate but normalized seed values and changes to the approved per-layer hash inputs.
test('particle seeds use the approved normalized hash outputs', () => {
  assert.deepEqual(particleSeeds(12, 2, 3), [0.09787367193444485, 0.35327189307503215]);
  assert.deepEqual(particleSeeds(5, 0, 1), [0.18928180848930073, 0.9125926147477218]);
});
