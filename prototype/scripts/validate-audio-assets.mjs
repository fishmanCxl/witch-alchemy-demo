import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AUDIO_CUES } from '../src/audio/audio-cues.mjs';

const MAX_RUNTIME_BYTES = 2_500_000;
const MP3_DURATION_TOLERANCE_MS = 55;
const WAV_DURATION_TOLERANCE_MS = 0.1;
const REQUIRED_FIELDS = Object.freeze([
  'id', 'path', 'sha256', 'durationMs', 'sampleRate', 'channels',
  'runtimeBytes', 'track', 'gain', 'cooldownMs', 'maxVoices', 'priority',
  'loop', 'loopStartMs', 'loopEndMs', 'duckMusic', 'generatorVersion', 'seed',
]);
const SFX_DURATION_RANGES = Object.freeze({
  'ui.tap': [70, 70],
  'bottle.select': [160, 160],
  'bottle.deselect': [140, 140],
  'pour.valid': [500, 500],
  'pour.invalid': [310, 310],
  'potion.complete': [1_000, 1_000],
  'potion.vanish': [620, 620],
  'history.undo': [230, 230],
  'level.restart': [410, 410],
  'reward.empty_bottle': [850, 850],
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function collectFiles(directory, predicate) {
  const files = [];
  const visit = (current) => {
    if (!fs.existsSync(current)) return;
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, item.name);
      if (item.isDirectory()) visit(absolute);
      else if (predicate(absolute)) files.push(absolute);
    }
  };
  visit(directory);
  return files.sort();
}

function parseMp3DurationMs(bytes) {
  const mpeg1Layer3Kbps = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const mpeg2Layer3Kbps = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const baseSampleRates = [44_100, 48_000, 32_000];
  let offset = 0;
  let durationSeconds = 0;
  let frameCount = 0;

  if (bytes.length >= 10 && bytes.subarray(0, 3).toString('ascii') === 'ID3') {
    const tagBytes = ((bytes[6] & 0x7f) << 21)
      | ((bytes[7] & 0x7f) << 14)
      | ((bytes[8] & 0x7f) << 7)
      | (bytes[9] & 0x7f);
    offset = 10 + tagBytes + ((bytes[5] & 0x10) ? 10 : 0);
  }

  while (offset + 4 <= bytes.length) {
    if (bytes.length - offset === 128 && bytes.subarray(offset, offset + 3).toString('ascii') === 'TAG') {
      offset = bytes.length;
      break;
    }

    const header = bytes.readUInt32BE(offset);
    if (((header & 0xffe00000) >>> 0) !== 0xffe00000) {
      throw new Error(`invalid MPEG frame sync at byte ${offset}`);
    }
    const versionBits = (header >>> 19) & 0x3;
    const layerBits = (header >>> 17) & 0x3;
    const bitrateIndex = (header >>> 12) & 0xf;
    const sampleRateIndex = (header >>> 10) & 0x3;
    const padding = (header >>> 9) & 0x1;
    if (versionBits === 1 || layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
      throw new Error(`unsupported MPEG Layer III header at byte ${offset}`);
    }

    const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;
    const sampleRate = baseSampleRates[sampleRateIndex] / (version === 1 ? 1 : version === 2 ? 2 : 4);
    const bitrateKbps = (version === 1 ? mpeg1Layer3Kbps : mpeg2Layer3Kbps)[bitrateIndex];
    const samplesPerFrame = version === 1 ? 1_152 : 576;
    const frameBytes = Math.floor(((version === 1 ? 144 : 72) * bitrateKbps * 1_000) / sampleRate + padding);
    if (offset + frameBytes > bytes.length) throw new Error(`truncated MPEG frame at byte ${offset}`);
    durationSeconds += samplesPerFrame / sampleRate;
    frameCount += 1;
    offset += frameBytes;
  }

  if (frameCount === 0) throw new Error('no MPEG Layer III frames');
  if (offset !== bytes.length) throw new Error(`trailing bytes after MPEG frames at byte ${offset}`);
  return durationSeconds * 1_000;
}

function parseWav(bytes) {
  if (bytes.length < 12 || bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WAVE') {
    throw new Error('missing RIFF/WAVE header');
  }
  let format = null;
  let dataBytes = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkId = bytes.subarray(offset, offset + 4).toString('ascii');
    const chunkBytes = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkBytes > bytes.length) throw new Error(`truncated ${chunkId} chunk`);
    if (chunkId === 'fmt ') {
      if (chunkBytes < 16) throw new Error('short fmt chunk');
      format = {
        audioFormat: bytes.readUInt16LE(dataOffset),
        channels: bytes.readUInt16LE(dataOffset + 2),
        sampleRate: bytes.readUInt32LE(dataOffset + 4),
        byteRate: bytes.readUInt32LE(dataOffset + 8),
        blockAlign: bytes.readUInt16LE(dataOffset + 12),
        bitsPerSample: bytes.readUInt16LE(dataOffset + 14),
      };
    } else if (chunkId === 'data') {
      dataBytes = chunkBytes;
    }
    offset = dataOffset + chunkBytes + (chunkBytes % 2);
  }
  if (!format) throw new Error('missing fmt chunk');
  if (dataBytes === null) throw new Error('missing data chunk');
  if (format.byteRate <= 0 || format.blockAlign <= 0) throw new Error('invalid PCM byte rate');
  return { ...format, durationMs: (dataBytes / format.byteRate) * 1_000 };
}

function parseGenerationReport(text) {
  const entries = new Map();
  const row = /^\| `([^`]+)` \| (\d+) \| (\d+) \| `([0-9a-f]{64})` \| `([0-9a-f]{64})` \|$/gm;
  for (const match of text.matchAll(row)) {
    entries.set(match[1], {
      durationMs: Number(match[2]),
      runtimeBytes: Number(match[3]),
      mp3Sha256: match[4],
      wavSha256: match[5],
    });
  }
  return entries;
}

function runtimeMasterReferences(root) {
  const hits = [];
  const sourceRoot = path.join(root, 'src');
  const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.mts', '.ts', '.tsx']);

  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) {
        visit(absolute);
      } else if (textExtensions.has(path.extname(item.name))) {
        const text = fs.readFileSync(absolute, 'utf8').replaceAll('\\\\', '/');
        if (text.includes('artifacts/audio-masters')) {
          hits.push(path.relative(root, absolute).replaceAll('\\\\', '/'));
        }
      }
    }
  };

  visit(sourceRoot);
  return hits.sort();
}

export function validateAudioAssets(root) {
  const manifestPath = path.join(root, 'public', 'assets', 'game', 'audio', 'audio-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing audio manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.entries)) {
    throw new Error('Audio manifest must contain an entries array');
  }

  const expectedIds = Object.keys(AUDIO_CUES).sort();
  const entries = [...manifest.entries].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const reportPath = path.join(root, 'artifacts', 'audio-masters', 'generation-report.md');
  const reportProblems = [];
  const reportEntries = fs.existsSync(reportPath)
    ? parseGenerationReport(fs.readFileSync(reportPath, 'utf8'))
    : new Map();
  if (!fs.existsSync(reportPath)) reportProblems.push(`missing generation report: ${reportPath}`);
  const actualIds = entries.map((entry) => entry.id);
  const missingCueIds = expectedIds.filter((id) => !actualIds.includes(id));
  const extraCueIds = actualIds.filter((id) => !expectedIds.includes(id));
  const duplicateCueIds = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
  const runtimeAudioRoot = path.join(root, 'public', 'assets', 'game', 'audio');
  const publishedMp3Files = collectFiles(runtimeAudioRoot, (file) => path.extname(file).toLowerCase() === '.mp3');
  const publishedMp3Paths = publishedMp3Files.map((file) => path.relative(path.join(root, 'public'), file).replaceAll('\\', '/'));
  const registeredMp3Paths = entries.map((entry) => entry.path);
  const unregisteredMp3Files = publishedMp3Paths.filter((file) => !registeredMp3Paths.includes(file));
  const missingFiles = [];
  const missingMasters = [];
  const hashMismatches = [];
  const contractMismatches = [];
  const runtimeBytes = publishedMp3Files.reduce((sum, file) => sum + fs.statSync(file).size, 0);

  for (const entry of entries) {
    const cue = AUDIO_CUES[entry.id];
    const missingFields = REQUIRED_FIELDS.filter((field) => !Object.hasOwn(entry, field));
    if (missingFields.length > 0) {
      contractMismatches.push(`${entry.id}: missing fields ${missingFields.join(', ')}`);
    }
    if (!cue) continue;

    const expectedPath = cue.url.replace(/^\//, '');
    if (entry.path !== expectedPath) contractMismatches.push(`${entry.id}: path ${entry.path}`);
    for (const field of ['track', 'gain', 'cooldownMs', 'maxVoices', 'priority', 'loop', 'duckMusic']) {
      if (entry[field] !== cue[field]) contractMismatches.push(`${entry.id}: ${field} ${entry[field]}`);
    }
    for (const field of ['loopStartMs', 'loopEndMs']) {
      const expectedValue = cue[field] ?? null;
      if (entry[field] !== expectedValue) contractMismatches.push(`${entry.id}: ${field} ${entry[field]}`);
    }
    if (entry.sampleRate !== 44_100 || entry.channels !== 1) {
      contractMismatches.push(`${entry.id}: expected 44100 Hz mono`);
    }
    if (entry.track === 'music') {
      if (entry.durationMs < 45_000 || entry.durationMs > 60_000) {
        contractMismatches.push(`${entry.id}: BGM duration ${entry.durationMs}ms outside 45000-60000ms`);
      }
    } else {
      const [minimum, maximum] = SFX_DURATION_RANGES[entry.id] ?? [-1, -1];
      if (entry.durationMs < minimum || entry.durationMs > maximum) {
        contractMismatches.push(`${entry.id}: SFX duration ${entry.durationMs}ms outside ${minimum}-${maximum}ms`);
      }
    }

    const runtimePath = path.join(root, 'public', entry.path);
    const reportEntry = reportEntries.get(entry.id);
    if (!reportEntry) {
      reportProblems.push(`${entry.id}: missing generation report entry`);
    } else {
      if (reportEntry.mp3Sha256 !== entry.sha256) reportProblems.push(`${entry.id}: MP3 hash differs from generation report`);
      if (reportEntry.durationMs !== entry.durationMs) reportProblems.push(`${entry.id}: duration differs from generation report`);
      if (reportEntry.runtimeBytes !== entry.runtimeBytes) reportProblems.push(`${entry.id}: runtime bytes differ from generation report`);
    }

    const masterName = `${path.basename(expectedPath, '.mp3')}.wav`;
    const masterPath = path.join(root, 'artifacts', 'audio-masters', masterName);
    if (!fs.existsSync(masterPath)) {
      missingMasters.push(entry.id);
    } else {
      const masterBytes = fs.readFileSync(masterPath);
      if (reportEntry && reportEntry.wavSha256 !== sha256(masterBytes)) {
        reportProblems.push(`${entry.id}: WAV hash differs from generation report`);
      }
      try {
        const wav = parseWav(masterBytes);
        if (wav.audioFormat !== 1 || wav.channels !== 1 || wav.sampleRate !== 44_100 || wav.bitsPerSample !== 16) {
          contractMismatches.push(`${entry.id}: expected PCM mono 44100Hz WAV master`);
        }
        if (Math.abs(wav.durationMs - entry.durationMs) > WAV_DURATION_TOLERANCE_MS) {
          contractMismatches.push(`${entry.id}: WAV duration ${wav.durationMs.toFixed(3)}ms differs from manifest ${entry.durationMs}ms`);
        }
      } catch (error) {
        contractMismatches.push(`${entry.id}: invalid WAV master (${error.message})`);
      }
    }

    if (!fs.existsSync(runtimePath)) {
      missingFiles.push(entry.id);
      continue;
    }
    const bytes = fs.readFileSync(runtimePath);
    if (entry.runtimeBytes !== bytes.length) contractMismatches.push(`${entry.id}: byte count mismatch`);
    if (entry.sha256 !== sha256(bytes)) hashMismatches.push(entry.id);
    try {
      const actualDurationMs = parseMp3DurationMs(bytes);
      if (Math.abs(actualDurationMs - entry.durationMs) > MP3_DURATION_TOLERANCE_MS) {
        contractMismatches.push(`${entry.id}: actual MP3 duration ${actualDurationMs.toFixed(3)}ms differs from manifest ${entry.durationMs}ms`);
      }
      const [minimum, maximum] = entry.track === 'music'
        ? [45_000, 60_000]
        : (SFX_DURATION_RANGES[entry.id] ?? [-1, -1]);
      if (actualDurationMs < minimum - MP3_DURATION_TOLERANCE_MS || actualDurationMs > maximum + MP3_DURATION_TOLERANCE_MS) {
        contractMismatches.push(`${entry.id}: actual MP3 duration ${actualDurationMs.toFixed(3)}ms outside ${minimum}-${maximum}ms with ${MP3_DURATION_TOLERANCE_MS}ms tolerance`);
      }
    } catch (error) {
      contractMismatches.push(`${entry.id}: invalid MP3 (${error.message})`);
    }
  }

  const masterReferences = runtimeMasterReferences(root);
  const bgmEntries = entries.filter((entry) => entry.track === 'music');
  const sfxEntries = entries.filter((entry) => entry.track === 'sfx');
  const problems = [];
  if (missingCueIds.length) problems.push(`missing cue IDs: ${missingCueIds.join(', ')}`);
  if (extraCueIds.length) problems.push(`extra cue IDs: ${extraCueIds.join(', ')}`);
  if (duplicateCueIds.length) problems.push(`duplicate cue IDs: ${duplicateCueIds.join(', ')}`);
  if (unregisteredMp3Files.length) problems.push(`unregistered runtime MP3 files: ${unregisteredMp3Files.join(', ')}`);
  if (missingFiles.length) problems.push(`missing runtime files: ${missingFiles.join(', ')}`);
  if (missingMasters.length) problems.push(`missing WAV masters: ${missingMasters.join(', ')}`);
  if (hashMismatches.length) problems.push(`hash mismatches: ${hashMismatches.join(', ')}`);
  if (contractMismatches.length) problems.push(`contract mismatches: ${contractMismatches.join('; ')}`);
  if (reportProblems.length) problems.push(`generation report mismatches: ${reportProblems.join('; ')}`);
  if (masterReferences.length) problems.push(`runtime WAV-master references: ${masterReferences.join(', ')}`);
  if (runtimeBytes > MAX_RUNTIME_BYTES) problems.push(`runtime bytes ${runtimeBytes} exceed ${MAX_RUNTIME_BYTES}`);
  if (bgmEntries.length !== 1) problems.push(`expected 1 BGM, found ${bgmEntries.length}`);
  if (sfxEntries.length !== 10) problems.push(`expected 10 SFX, found ${sfxEntries.length}`);
  if (problems.length > 0) throw new Error(`Audio asset validation failed: ${problems.join(' | ')}`);

  return {
    cueCount: entries.length,
    bgmCount: bgmEntries.length,
    sfxCount: sfxEntries.length,
    runtimeBytes,
    missingCueIds,
    hashMismatches,
    runtimeMasterReferences: masterReferences,
    bgmDurationSeconds: bgmEntries[0].durationMs / 1_000,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = validateAudioAssets(root);
  console.log(`${result.cueCount} cues, ${result.bgmCount} BGM, ${result.sfxCount} SFX; ${result.runtimeBytes} runtime bytes; zero mismatches`);
}
