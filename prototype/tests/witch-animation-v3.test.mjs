import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  WITCH_ANIMATIONS,
  witchFrameUrl,
  witchMagicFrameUrl,
} from '../src/game/presentation.mjs';

const animatorSource = readFileSync(new URL('../src/components/WitchAnimator.tsx', import.meta.url), 'utf8');
const prototypeSource = readFileSync(new URL('../src/Prototype.tsx', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../public/assets/game/chibi/assets-manifest.json', import.meta.url), 'utf8'));

test('witch v3 exposes the approved slow seven-state animation contract', () => {
  assert.deepEqual(WITCH_ANIMATIONS, {
    idle: { frames: 18, durationMs: 3600, loop: true },
    prepare: { frames: 12, durationMs: 720, loop: false },
    raise: { frames: 12, durationMs: 720, loop: false },
    cast: { frames: 20, durationMs: 1200, loop: false },
    celebrate: { frames: 14, durationMs: 1120, loop: false, minInterruptMs: 840 },
    return: { frames: 18, durationMs: 1080, loop: false },
    oops: { frames: 12, durationMs: 960, loop: false },
  });
});

test('witch v3 URLs are cache-busted and magic overlays stay separate from character frames', () => {
  assert.equal(witchFrameUrl('prepare', 0), '/assets/game/chibi/character/prepare/prepare-00.png?v=3');
  assert.equal(witchFrameUrl('cast', 19), '/assets/game/chibi/character/cast/cast-19.png?v=3');
  assert.equal(witchMagicFrameUrl('cast', 0), '/assets/game/chibi/effects/witch-magic/cast/cast-00.png?v=3');
  assert.equal(witchMagicFrameUrl('celebrate', 13), '/assets/game/chibi/effects/witch-magic/celebrate/celebrate-13.png?v=3');
  assert.match(animatorSource, /className="witch-magic-frame"/);
  assert.match(animatorSource, /witchMagicFrameUrl\(playback\.mood, frame\)/);
});

test('first selection prepares then raises the wand, while inactivity returns to idle', () => {
  assert.match(prototypeSource, /setSelected\(index\);[\s\S]*?requestWitchMood\("prepare"\)/);
  assert.match(prototypeSource, /case "prepare":[\s\S]*?setWitchMood\("raise"\)/);
  assert.match(prototypeSource, /case "return":[\s\S]*?setWitchMood\("idle"\)/);
  assert.match(prototypeSource, /setTimeout\(\(\) => setWitchMood\("return"\), 1800\)/);
  assert.match(prototypeSource, /<WitchAnimator mood=\{witchMood\} onSettled=\{handleWitchSettled\} \/>/);
});

test('manifest publishes every character sequence and the synchronized magic overlays', () => {
  for (const [mood, animation] of Object.entries(WITCH_ANIMATIONS)) {
    assert.equal(manifest.witch[mood].frames, animation.frames);
    assert.equal(manifest.witch[mood].durationMs, animation.durationMs);
    assert.equal(manifest.witch[mood].loop, animation.loop);
  }
  assert.deepEqual(manifest.effects.witchMagic, {
    cast: {
      frames: 20,
      pattern: '/assets/game/chibi/effects/witch-magic/cast/cast-{index}.png',
    },
    celebrate: {
      frames: 14,
      pattern: '/assets/game/chibi/effects/witch-magic/celebrate/celebrate-{index}.png',
    },
  });
});
