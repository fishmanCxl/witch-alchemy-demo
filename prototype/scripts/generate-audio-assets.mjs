import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { AUDIO_CUES } from '../src/audio/audio-cues.mjs';

const require = createRequire(import.meta.url);
const { Mp3Encoder } = require('./vendor/lamejs/index.cjs');

const SAMPLE_RATE = 44_100;
const CHANNELS = 1;
const PEAK = 0.86;
const SAFETY_FADE_SECONDS = 0.012;
const GLOBAL_SEED = 0x0A1C4E57;
const GENERATOR_VERSION = 'witch-water-sort-audio-v1';
const ENCODER_VERSION = '1.2.7';
const ENCODER_INTEGRITY = 'sha512-6wc7ck65ctA75Hq7FYHTtTvGnYs6msgdxiSUICQ+A01nVOWg6rqouZB8IdyteRlfpYYiFovkf67dIeOgWIUzTA==';
const ENCODER_TARBALL_SHA256 = 'ab48c59fe29b7bfbd72dcc3515b04393dbe11459d165ecb85dd0547f3abd223c';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = path.join(root, 'public', 'assets', 'game', 'audio');
const mastersRoot = path.join(root, 'artifacts', 'audio-masters');

function sampleCount(durationSeconds) {
  return Math.round(durationSeconds * SAMPLE_RATE);
}

function xorshift32(seed) {
  let state = seed >>> 0 || 0x6D2B79F5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function stringHash(value) {
  let hash = 0x811C9DC5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function cueSeed(id) {
  return (GLOBAL_SEED ^ stringHash(id)) >>> 0;
}

export function sine(durationSeconds, frequency, amplitude = 1, phaseOffset = 0) {
  const output = new Float64Array(sampleCount(durationSeconds));
  let phase = phaseOffset;
  for (let index = 0; index < output.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const hz = typeof frequency === 'function' ? frequency(time, durationSeconds) : frequency;
    output[index] = Math.sin(phase) * amplitude;
    phase += (2 * Math.PI * hz) / SAMPLE_RATE;
  }
  return output;
}

export function triangle(durationSeconds, frequency, amplitude = 1, phaseOffset = 0) {
  const output = new Float64Array(sampleCount(durationSeconds));
  let phase = phaseOffset;
  for (let index = 0; index < output.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const hz = typeof frequency === 'function' ? frequency(time, durationSeconds) : frequency;
    output[index] = (2 / Math.PI) * Math.asin(Math.sin(phase)) * amplitude;
    phase += (2 * Math.PI * hz) / SAMPLE_RATE;
  }
  return output;
}

export function noise(durationSeconds, random, amplitude = 1) {
  const output = new Float64Array(sampleCount(durationSeconds));
  for (let index = 0; index < output.length; index += 1) {
    output[index] = (random() * 2 - 1) * amplitude;
  }
  return output;
}

export function adsr(input, attackSeconds, decaySeconds, sustainLevel, releaseSeconds) {
  const output = new Float64Array(input.length);
  const attack = sampleCount(attackSeconds);
  const decay = sampleCount(decaySeconds);
  const release = sampleCount(releaseSeconds);
  const releaseStart = Math.max(0, input.length - release);
  for (let index = 0; index < input.length; index += 1) {
    let envelope = sustainLevel;
    if (attack > 0 && index < attack) {
      envelope = index / attack;
    } else if (decay > 0 && index < attack + decay) {
      envelope = 1 - (1 - sustainLevel) * ((index - attack) / decay);
    }
    if (release > 0 && index >= releaseStart) {
      envelope *= Math.max(0, (input.length - 1 - index) / release);
    }
    output[index] = input[index] * envelope;
  }
  return output;
}

export function lowPass(input, cutoffHz) {
  const output = new Float64Array(input.length);
  let previous = 0;
  for (let index = 0; index < input.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const cutoff = typeof cutoffHz === 'function' ? cutoffHz(time, input.length / SAMPLE_RATE) : cutoffHz;
    const alpha = 1 - Math.exp((-2 * Math.PI * Math.max(20, cutoff)) / SAMPLE_RATE);
    previous += alpha * (input[index] - previous);
    output[index] = previous;
  }
  return output;
}

export function delay(input, delayMs, feedback = 0.3, repeats = 1) {
  const output = new Float64Array(input);
  const spacing = Math.round((delayMs / 1_000) * SAMPLE_RATE);
  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    const offset = spacing * repeat;
    const gain = feedback ** repeat;
    for (let index = offset; index < output.length; index += 1) {
      output[index] += input[index - offset] * gain;
    }
  }
  return output;
}

export function mixAt(target, source, offsetSeconds = 0, gain = 1) {
  const offset = Math.round(offsetSeconds * SAMPLE_RATE);
  for (let index = 0; index < source.length && offset + index < target.length; index += 1) {
    if (offset + index >= 0) target[offset + index] += source[index] * gain;
  }
  return target;
}

function finalize(input) {
  const output = new Float64Array(input);
  const fadeLength = Math.min(sampleCount(SAFETY_FADE_SECONDS), Math.floor(output.length / 2));
  for (let index = 0; index < fadeLength; index += 1) {
    const fadeIn = index / Math.max(1, fadeLength - 1);
    const fadeOut = (fadeLength - 1 - index) / Math.max(1, fadeLength - 1);
    output[index] *= fadeIn;
    output[output.length - fadeLength + index] *= fadeOut;
  }
  let maximum = 0;
  for (const value of output) maximum = Math.max(maximum, Math.abs(value));
  const scale = maximum > 0 ? PEAK / maximum : 1;
  for (let index = 0; index < output.length; index += 1) output[index] *= scale;
  return output;
}

function int16Samples(samples) {
  const output = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    output[index] = value < 0 ? Math.round(value * 32_768) : Math.round(value * 32_767);
  }
  return output;
}

export function writeWav(filePath, samples) {
  const pcm = int16Samples(samples);
  const dataBytes = pcm.length * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(CHANNELS, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * CHANNELS * 2, 28);
  wav.writeUInt16LE(CHANNELS * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < pcm.length; index += 1) wav.writeInt16LE(pcm[index], 44 + index * 2);
  fs.writeFileSync(filePath, wav);
  return wav;
}

export function encodeMp3(samples, kbps) {
  const pcm = int16Samples(samples);
  const encoder = new Mp3Encoder(CHANNELS, SAMPLE_RATE, kbps);
  const chunks = [];
  for (let offset = 0; offset < pcm.length; offset += 1_152) {
    const encoded = encoder.encodeBuffer(pcm.subarray(offset, Math.min(offset + 1_152, pcm.length)));
    if (encoded.length > 0) chunks.push(Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength));
  }
  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(Buffer.from(flushed.buffer, flushed.byteOffset, flushed.byteLength));
  return Buffer.concat(chunks);
}

function midi(number) {
  return 440 * (2 ** ((number - 69) / 12));
}

function addBell(target, start, duration, frequency, gain = 1, descendingTo = null) {
  const frequencyAt = descendingTo === null
    ? () => frequency
    : (time) => frequency + (descendingTo - frequency) * (time / duration);
  const fundamental = adsr(sine(duration, frequencyAt, 0.58), 0.004, duration * 0.12, 0.32, duration * 0.58);
  const partial276 = adsr(sine(duration, (time) => frequencyAt(time) * 2.76, 0.22), 0.002, duration * 0.08, 0.12, duration * 0.50);
  const partial54 = adsr(sine(duration, (time) => frequencyAt(time) * 5.4, 0.08), 0.001, duration * 0.06, 0.05, duration * 0.40);
  mixAt(target, fundamental, start, gain);
  mixAt(target, partial276, start, gain);
  mixAt(target, partial54, start, gain);
}

function synthesizeBgm(seed) {
  const random = xorshift32(seed);
  const rawDuration = 50;
  const raw = new Float64Array(sampleCount(rawDuration));
  const beat = 60 / 72;
  const roots = [midi(62), midi(58), midi(65), midi(60)];
  const degrees = [0, 7, 12, 15, 12, 7];

  for (let phrase = 0; phrase < 4; phrase += 1) {
    const phraseStart = phrase * 12;
    const rootFrequency = roots[phrase];
    const padDuration = phrase === 3 ? 14 : 12.4;
    const padRoot = adsr(sine(padDuration, rootFrequency / 2, 0.16), 1.4, 1.2, 0.72, 2.0);
    const padFifth = adsr(sine(padDuration, rootFrequency * 0.75, 0.11, Math.PI / 5), 1.7, 1.0, 0.70, 2.2);
    mixAt(raw, padRoot, phraseStart);
    mixAt(raw, padFifth, phraseStart);

    for (let note = 0; note * beat < padDuration; note += 1) {
      const frequency = rootFrequency * (2 ** (degrees[note % degrees.length] / 12));
      const noteStart = phraseStart + note * beat;
      const celesta = adsr(triangle(1.28, frequency, 0.20), 0.005, 0.11, 0.10, 0.88);
      mixAt(raw, celesta, noteStart);
      addBell(raw, noteStart, 1.38, frequency, 0.32);
    }
  }

  const ambience = noise(rawDuration, random, 1);
  const night = lowPass(ambience, 1_350);
  const candle = lowPass(noise(rawDuration, random, 1), 170);
  for (let index = 0; index < raw.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const flicker = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.37 * time + 0.4);
    raw[index] += night[index] * 0.010 + candle[index] * flicker * 0.018;
  }

  const output = new Float64Array(sampleCount(48));
  const bodySamples = sampleCount(46);
  output.set(raw.subarray(sampleCount(2), sampleCount(48)), 0);
  const overlapSamples = sampleCount(2);
  const tailStart = sampleCount(48);
  for (let index = 0; index < overlapSamples; index += 1) {
    const position = index / Math.max(1, overlapSamples - 1);
    const fadeOut = Math.cos(position * Math.PI / 2);
    const fadeIn = Math.sin(position * Math.PI / 2);
    output[bodySamples + index] = raw[tailStart + index] * fadeOut + raw[index] * fadeIn;
  }
  return finalize(output);
}

function synthesizeUiTap(seed) {
  const random = xorshift32(seed);
  const output = new Float64Array(sampleCount(0.070));
  const click = adsr(lowPass(noise(0.070, random), 1_600), 0.001, 0.012, 0.10, 0.045);
  mixAt(output, click, 0, 0.60);
  mixAt(output, adsr(sine(0.070, 220, 0.55), 0.001, 0.008, 0.08, 0.050));
  mixAt(output, adsr(sine(0.070, 330, 0.32), 0.001, 0.006, 0.05, 0.044));
  return finalize(output);
}

function synthesizeBottleSelect() {
  const output = new Float64Array(sampleCount(0.160));
  addBell(output, 0, 0.160, 880, 0.92);
  const shimmer = delay(adsr(sine(0.160, 2_420, 0.18), 0.002, 0.018, 0.08, 0.10), 24, 0.46, 2);
  mixAt(output, shimmer);
  return finalize(output);
}

function synthesizeBottleDeselect() {
  const output = new Float64Array(sampleCount(0.140));
  addBell(output, 0, 0.140, 740, 1, 554);
  return finalize(output);
}

function synthesizePourValid(seed) {
  const random = xorshift32(seed);
  const duration = 0.500;
  const output = new Float64Array(sampleCount(duration));
  const liquid = lowPass(noise(duration, random), (time) => 420 + 1_500 * Math.sin(Math.PI * time / duration) ** 2);
  const liquidEnvelope = adsr(liquid, 0.025, 0.07, 0.72, 0.11);
  mixAt(output, liquidEnvelope, 0, 0.45);
  for (let bubble = 0; bubble < 5; bubble += 1) {
    const start = 0.06 + bubble * 0.075 + random() * 0.018;
    const bubbleDuration = 0.070 + random() * 0.030;
    const base = 460 + random() * 540;
    const chirp = adsr(sine(bubbleDuration, (time) => base + 420 * (time / bubbleDuration) ** 2, 0.30), 0.003, 0.016, 0.25, 0.040);
    mixAt(output, chirp, start);
  }
  mixAt(output, adsr(sine(duration, 1_320, 0.10), 0.06, 0.10, 0.30, 0.16));
  return finalize(output);
}

function synthesizePourInvalid() {
  const duration = 0.310;
  const output = new Float64Array(sampleCount(duration));
  const thump = adsr(sine(duration, (time) => 180 + (120 - 180) * (time / duration), 0.75), 0.002, 0.035, 0.18, 0.18);
  const wobbleA = adsr(sine(duration, 310, 0.22), 0.005, 0.05, 0.35, 0.17);
  const wobbleB = adsr(sine(duration, 296, 0.22), 0.005, 0.05, 0.35, 0.17);
  mixAt(output, thump);
  mixAt(output, wobbleA, 0.020);
  mixAt(output, wobbleB, 0.020);
  return finalize(output);
}

function synthesizePotionComplete() {
  const output = new Float64Array(sampleCount(1.000));
  const notes = [midi(74), midi(77), midi(81)];
  notes.forEach((frequency, index) => {
    const start = index * 0.18;
    const celesta = adsr(triangle(0.64, frequency, 0.30), 0.004, 0.06, 0.16, 0.38);
    mixAt(output, celesta, start);
    addBell(output, start, 0.82, frequency, 0.54);
  });
  addBell(output, 0.48, 0.52, midi(86), 0.32);
  return finalize(output);
}

function synthesizePotionVanish(seed) {
  const random = xorshift32(seed);
  const duration = 0.620;
  const output = new Float64Array(sampleCount(duration));
  const rawNoise = noise(duration, random);
  const low = lowPass(rawNoise, (time) => 600 + 1_700 * (time / duration));
  for (let index = 0; index < output.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const highPassed = rawNoise[index] - low[index];
    const envelope = Math.sin(Math.PI * time / duration) ** 0.8;
    output[index] = highPassed * envelope * 0.42;
  }
  const resonance = adsr(sine(duration, (time) => 1_760 + (520 - 1_760) * (time / duration), 0.30), 0.015, 0.05, 0.36, 0.18);
  mixAt(output, resonance);
  return finalize(output);
}

function synthesizeUndo() {
  const duration = 0.230;
  const output = new Float64Array(sampleCount(duration));
  const shimmer = sine(duration, (time) => 1_100 + (660 - 1_100) * (time / duration), 0.55);
  for (let index = 0; index < shimmer.length; index += 1) {
    const position = index / Math.max(1, shimmer.length - 1);
    const reversedContour = position ** 1.8 * ((1 - position) ** 0.35);
    shimmer[index] *= reversedContour;
  }
  mixAt(output, delay(shimmer, 18, 0.38, 2));
  return finalize(output);
}

function synthesizeRestart(seed) {
  const random = xorshift32(seed);
  const duration = 0.410;
  const output = new Float64Array(sampleCount(duration));
  const stir = lowPass(noise(duration, random), 1_280);
  for (let index = 0; index < stir.length; index += 1) {
    const time = index / SAMPLE_RATE;
    stir[index] *= (0.45 + 0.55 * Math.sin(2 * Math.PI * 7.5 * time) ** 2) * Math.sin(Math.PI * time / duration);
  }
  mixAt(output, stir, 0, 0.38);
  mixAt(output, adsr(sine(duration, 392, 0.48), 0.08, 0.07, 0.35, 0.18), 0.055);
  return finalize(output);
}

function synthesizeReward() {
  const output = new Float64Array(sampleCount(0.850));
  const notes = [midi(74), midi(81), midi(86)];
  notes.forEach((frequency, index) => addBell(output, index * 0.125, 0.72, frequency, 0.84 - index * 0.10));
  mixAt(output, adsr(sine(0.850, midi(62), 0.18), 0.025, 0.08, 0.30, 0.38));
  return finalize(output);
}

const recipes = Object.freeze({
  'bgm.alchemy_room': { durationMs: 48_000, synthesize: synthesizeBgm },
  'ui.tap': { durationMs: 70, synthesize: synthesizeUiTap },
  'bottle.select': { durationMs: 160, synthesize: synthesizeBottleSelect },
  'bottle.deselect': { durationMs: 140, synthesize: synthesizeBottleDeselect },
  'pour.valid': { durationMs: 500, synthesize: synthesizePourValid },
  'pour.invalid': { durationMs: 310, synthesize: synthesizePourInvalid },
  'potion.complete': { durationMs: 1_000, synthesize: synthesizePotionComplete },
  'potion.vanish': { durationMs: 620, synthesize: synthesizePotionVanish },
  'history.undo': { durationMs: 230, synthesize: synthesizeUndo },
  'level.restart': { durationMs: 410, synthesize: synthesizeRestart },
  'reward.empty_bottle': { durationMs: 850, synthesize: synthesizeReward },
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function report(entries, masters) {
  const total = entries.reduce((sum, entry) => sum + entry.runtimeBytes, 0);
  const rows = entries.map((entry) => {
    const master = masters.get(entry.id);
    return `| \`${entry.id}\` | ${entry.durationMs} | ${entry.runtimeBytes} | \`${entry.sha256}\` | \`${master.sha256}\` |`;
  }).join('\n');
  return `# Deterministic Audio Generation Report

- Generator: \`${GENERATOR_VERSION}\`
- Global seed: \`0x${GLOBAL_SEED.toString(16).toUpperCase()}\`
- Synthesis: original local synthesis, ${SAMPLE_RATE} Hz mono, Float64 accumulation, xorshift32 cue seeds, 0.86 peak normalization, 12ms safety fades
- Encoder: \`@breezystack/lamejs@${ENCODER_VERSION}\` (LGPL-3.0), vendored for generation only
- Registry tarball integrity: \`${ENCODER_INTEGRITY}\`
- Repacked tarball SHA-256: \`${ENCODER_TARBALL_SHA256}\`
- Encoding: BGM 80kbps; SFX 96kbps
- BGM seam: four 12-second phrases are rendered with a 2-second continuation and equal-power wrap crossfade; the exported 48-second loop starts after the two-second pre-roll so its final head blend meets the same musical position at loop start.
- Runtime total: ${total} bytes

| Cue | Duration (ms) | MP3 bytes | MP3 SHA-256 | WAV SHA-256 |
| --- | ---: | ---: | --- | --- |
${rows}
`;
}

function generate() {
  fs.mkdirSync(path.join(runtimeRoot, 'bgm'), { recursive: true });
  fs.mkdirSync(path.join(runtimeRoot, 'sfx'), { recursive: true });
  fs.mkdirSync(mastersRoot, { recursive: true });

  const entries = [];
  const masters = new Map();
  for (const id of Object.keys(AUDIO_CUES).sort()) {
    const cue = AUDIO_CUES[id];
    const recipe = recipes[id];
    if (!recipe) throw new Error(`Missing synthesis recipe for ${id}`);
    const seed = cueSeed(id);
    const samples = recipe.synthesize(seed);
    if (samples.length !== sampleCount(recipe.durationMs / 1_000)) {
      throw new Error(`${id} produced ${samples.length} samples instead of ${sampleCount(recipe.durationMs / 1_000)}`);
    }

    const fileName = path.basename(cue.url, '.mp3');
    const wavPath = path.join(mastersRoot, `${fileName}.wav`);
    const wav = writeWav(wavPath, samples);
    const mp3 = encodeMp3(samples, cue.track === 'music' ? 80 : 96);
    const relativePath = cue.url.replace(/^\//, '');
    const runtimePath = path.join(root, 'public', relativePath);
    fs.writeFileSync(runtimePath, mp3);
    masters.set(id, { sha256: sha256(wav), bytes: wav.length });

    entries.push({
      id,
      path: relativePath.replaceAll('\\\\', '/'),
      sha256: sha256(mp3),
      durationMs: recipe.durationMs,
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      runtimeBytes: mp3.length,
      track: cue.track,
      gain: cue.gain,
      cooldownMs: cue.cooldownMs,
      maxVoices: cue.maxVoices,
      priority: cue.priority,
      loop: cue.loop,
      loopStartMs: cue.loopStartMs ?? null,
      loopEndMs: cue.loopEndMs ?? null,
      duckMusic: cue.duckMusic,
      generatorVersion: GENERATOR_VERSION,
      seed,
    });
  }

  const manifest = {
    generatorVersion: GENERATOR_VERSION,
    encoder: {
      name: '@breezystack/lamejs',
      version: ENCODER_VERSION,
      integrity: ENCODER_INTEGRITY,
      license: 'LGPL-3.0',
    },
    entries,
  };
  fs.writeFileSync(path.join(runtimeRoot, 'audio-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(mastersRoot, 'generation-report.md'), report(entries, masters));
  const total = entries.reduce((sum, entry) => sum + entry.runtimeBytes, 0);
  console.log(`Generated ${entries.length} original cues (${total} runtime bytes).`);
}

generate();
