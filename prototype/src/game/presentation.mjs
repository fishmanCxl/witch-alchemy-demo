function hash32(value) {
  let hash = value | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export const POTION_VISUALS = Object.freeze({
  rose: Object.freeze({ color: '#f05b9d', particleUrl: '/assets/game/chibi/effects/particle-rose-heart.png' }),
  violet: Object.freeze({ color: '#8f4de8', particleUrl: '/assets/game/chibi/effects/particle-violet-star.png' }),
  amber: Object.freeze({ color: '#f0a43b', particleUrl: '/assets/game/chibi/effects/particle-amber-spark.png' }),
  cyan: Object.freeze({ color: '#36bad1', particleUrl: '/assets/game/chibi/effects/particle-cyan-bubble.png' }),
  mint: Object.freeze({ color: '#56caa0', particleUrl: '/assets/game/chibi/effects/particle-mint-leaf.png' }),
  blue: Object.freeze({ color: '#4566d8', particleUrl: '/assets/game/chibi/effects/particle-blue-snow.png' }),
  gold: Object.freeze({ color: '#f2c94c', particleUrl: '/assets/game/chibi/effects/particle-gold-dust.png' }),
  lilac: Object.freeze({ color: '#b176d6', particleUrl: '/assets/game/chibi/effects/particle-lilac-moon.png' }),
});

export const WITCH_ANIMATIONS = Object.freeze({
  idle: Object.freeze({ frames: 18, durationMs: 3600, loop: true }),
  prepare: Object.freeze({ frames: 12, durationMs: 720, loop: false }),
  raise: Object.freeze({ frames: 12, durationMs: 720, loop: false }),
  cast: Object.freeze({ frames: 20, durationMs: 1200, loop: false }),
  celebrate: Object.freeze({ frames: 14, durationMs: 1120, loop: false, minInterruptMs: 840 }),
  return: Object.freeze({ frames: 18, durationMs: 1080, loop: false }),
  oops: Object.freeze({ frames: 12, durationMs: 960, loop: false }),
});

export function witchFrameUrl(mood, index) {
  return `/assets/game/chibi/character/${mood}/${mood}-${String(index).padStart(2, '0')}.png?v=3`;
}

export function witchMagicFrameUrl(mood, index) {
  return `/assets/game/chibi/effects/witch-magic/${mood}/${mood}-${String(index).padStart(2, '0')}.png?v=3`;
}

export function controlAssetUrl(variant, state) {
  return `/assets/game/chibi/ui/button-${variant}-${state}.png`;
}

export function messagePanelUrl() {
  return '/assets/game/chibi/ui/message-panel.png';
}

export function seededBottlePose(levelSeed, slotIndex) {
  const hash = hash32(levelSeed * 131 + slotIndex * 977);

  return {
    x: (hash % 11) - 5,
    y: ((hash >>> 8) % 21) - 10,
    rotate: (((hash >>> 16) % 41) - 20) / 10,
  };
}

export function bottleVisualModel({ bottle, levelSeed, slotIndex, selected = false, pouring = false, invalid = false, departing = false }) {
  const rendersBottle = bottle.status === 'active';

  return {
    slot: { width: 64, height: 112 },
    rendersBottle,
    pose: seededBottlePose(levelSeed, slotIndex),
    state: { selected, pouring, invalid, departing },
    layers: rendersBottle
      ? bottle.layers.map((color, layerIndex) => ({ color, particleSeeds: particleSeeds(levelSeed, slotIndex, layerIndex) }))
      : [],
  };
}

export function createWitchPlayback(mood, startedAt) {
  return { mood, startedAt };
}

export function witchFrameAt(playback, now) {
  const animation = WITCH_ANIMATIONS[playback.mood];
  const elapsed = Math.max(0, now - playback.startedAt);

  if (animation.loop) {
    return {
      index: Math.floor((elapsed % animation.durationMs) / (animation.durationMs / animation.frames)),
      done: false,
    };
  }

  if (elapsed >= animation.durationMs) {
    return { index: animation.frames - 1, done: true };
  }

  return {
    index: Math.floor(elapsed / (animation.durationMs / animation.frames)),
    done: false,
  };
}

export function canInterruptWitch(playback, nextMood, now) {
  if (playback.mood === nextMood) return false;

  const { minInterruptMs = 0 } = WITCH_ANIMATIONS[playback.mood];
  return Math.max(0, now - playback.startedAt) >= minInterruptMs;
}

export function requestWitchPlayback(playback, nextMood, now) {
  if (playback.mood === nextMood) {
    return { playback, frame: null, retryAt: null };
  }

  if (canInterruptWitch(playback, nextMood, now)) {
    return {
      playback: createWitchPlayback(nextMood, now),
      frame: 0,
      retryAt: null,
    };
  }

  const { minInterruptMs = 0 } = WITCH_ANIMATIONS[playback.mood];
  return {
    playback,
    frame: null,
    retryAt: playback.startedAt + minInterruptMs,
  };
}

export function createMessagePlayback(id, text, startedAt) {
  return { id, text, startedAt, phase: 'enter' };
}

export function replaceMessagePlayback(previous, id, text, startedAt) {
  return { id, text, startedAt, phase: 'replace' };
}

export function messagePhase(startedAt, now, initialPhase = 'enter') {
  const elapsed = Math.max(0, now - startedAt);

  if (initialPhase === 'replace') {
    if (elapsed < 120) return 'replace';
    if (elapsed < 1520) return 'hold';
    if (elapsed < 1760) return 'exit';
    return 'done';
  }

  if (elapsed < 180) return 'enter';
  if (elapsed < 1580) return 'hold';
  if (elapsed < 1820) return 'exit';
  return 'done';
}

export function particleSeeds(levelSeed, slotIndex, layerIndex) {
  const seed = levelSeed * 131 + slotIndex * 977 + layerIndex * 6971;

  return [hash32(seed) / 0xffffffff, hash32(seed + 1) / 0xffffffff];
}
