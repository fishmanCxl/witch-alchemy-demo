import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateAudioAssets } from '../scripts/validate-audio-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeAudioFixture(t) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'witch-audio-assets-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));

  const publicAudio = path.join(fixture, 'public', 'assets', 'game', 'audio');
  fs.mkdirSync(path.dirname(publicAudio), { recursive: true });
  fs.cpSync(path.join(root, 'public', 'assets', 'game', 'audio'), publicAudio, { recursive: true });

  const masters = path.join(fixture, 'artifacts', 'audio-masters');
  fs.mkdirSync(path.dirname(masters), { recursive: true });
  fs.cpSync(path.join(root, 'artifacts', 'audio-masters'), masters, { recursive: true });
  return fixture;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function updateManifest(fixture, mutate) {
  const manifestPath = path.join(fixture, 'public', 'assets', 'game', 'audio', 'audio-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  mutate(manifest);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

test('validation rejects an MP3 in the runtime audio directory that the manifest does not register', (t) => {
  const fixture = makeAudioFixture(t);
  const stalePath = path.join(fixture, 'public', 'assets', 'game', 'audio', 'sfx', 'stale.mp3');
  fs.copyFileSync(path.join(fixture, 'public', 'assets', 'game', 'audio', 'sfx', 'ui-tap.mp3'), stalePath);

  assert.throws(
    () => validateAudioAssets(fixture),
    /unregistered runtime MP3 files: assets\/game\/audio\/sfx\/stale\.mp3/,
  );
});

test('runtime byte budget counts every MP3 in the published audio directory', (t) => {
  const fixture = makeAudioFixture(t);
  const stalePath = path.join(fixture, 'public', 'assets', 'game', 'audio', 'sfx', 'oversized-stale.mp3');
  fs.writeFileSync(stalePath, Buffer.alloc(2_500_001));

  assert.throws(
    () => validateAudioAssets(fixture),
    /runtime bytes \d+ exceed 2500000/,
  );
});

test('validation derives MP3 duration from frame headers instead of trusting the manifest', (t) => {
  const fixture = makeAudioFixture(t);
  const audioRoot = path.join(fixture, 'public', 'assets', 'game', 'audio');
  const bgmPath = path.join(audioRoot, 'bgm', 'alchemy-room-loop.mp3');
  const shortMp3 = fs.readFileSync(path.join(audioRoot, 'sfx', 'ui-tap.mp3'));
  fs.writeFileSync(bgmPath, shortMp3);
  updateManifest(fixture, (manifest) => {
    const bgm = manifest.entries.find((entry) => entry.id === 'bgm.alchemy_room');
    bgm.runtimeBytes = shortMp3.length;
    bgm.sha256 = sha256(shortMp3);
  });

  assert.throws(
    () => validateAudioAssets(fixture),
    /bgm\.alchemy_room: actual MP3 duration .* differs from manifest 48000ms/,
  );
});

test('validation rejects a missing WAV master', (t) => {
  const fixture = makeAudioFixture(t);
  fs.unlinkSync(path.join(fixture, 'artifacts', 'audio-masters', 'ui-tap.wav'));

  assert.throws(
    () => validateAudioAssets(fixture),
    /missing WAV masters: ui\.tap/,
  );
});

test('validation reads the WAV header instead of trusting manifest audio metadata', (t) => {
  const fixture = makeAudioFixture(t);
  const masterPath = path.join(fixture, 'artifacts', 'audio-masters', 'ui-tap.wav');
  const wav = fs.readFileSync(masterPath);
  wav.writeUInt16LE(2, 22);
  fs.writeFileSync(masterPath, wav);

  assert.throws(
    () => validateAudioAssets(fixture),
    /ui\.tap: expected PCM mono 44100Hz WAV master/,
  );
});

test('validation derives WAV duration from the PCM data chunk', (t) => {
  const fixture = makeAudioFixture(t);
  const masterPath = path.join(fixture, 'artifacts', 'audio-masters', 'ui-tap.wav');
  const fullWav = fs.readFileSync(masterPath);
  const shortWav = Buffer.from(fullWav.subarray(0, 44 + 882));
  shortWav.writeUInt32LE(shortWav.length - 8, 4);
  shortWav.writeUInt32LE(shortWav.length - 44, 40);
  fs.writeFileSync(masterPath, shortWav);

  assert.throws(
    () => validateAudioAssets(fixture),
    /ui\.tap: WAV duration .* differs from manifest 120ms/,
  );
});

test('validation treats generation-report WAV hashes as authoritative', (t) => {
  const fixture = makeAudioFixture(t);
  const masterPath = path.join(fixture, 'artifacts', 'audio-masters', 'ui-tap.wav');
  const wav = fs.readFileSync(masterPath);
  wav[wav.length - 1] ^= 0x01;
  fs.writeFileSync(masterPath, wav);

  assert.throws(
    () => validateAudioAssets(fixture),
    /ui\.tap: WAV hash differs from generation report/,
  );
});

test('validation enforces loop start and end values from the cue contract', (t) => {
  const fixture = makeAudioFixture(t);
  updateManifest(fixture, (manifest) => {
    const bgm = manifest.entries.find((entry) => entry.id === 'bgm.alchemy_room');
    bgm.loopStartMs = 0;
    bgm.loopEndMs = 48_000;
  });

  assert.throws(
    () => validateAudioAssets(fixture),
    /bgm\.alchemy_room: loopStartMs 0; bgm\.alchemy_room: loopEndMs 48000/,
  );
});

test('the generated audio pack satisfies the runtime asset contract', () => {
  const result = validateAudioAssets(root);

  assert.equal(result.cueCount, 11);
  assert.equal(result.bgmCount, 1);
  assert.equal(result.sfxCount, 10);
  assert.ok(result.runtimeBytes <= 2_500_000);
  assert.deepEqual(result.missingCueIds, []);
  assert.deepEqual(result.hashMismatches, []);
  assert.deepEqual(result.runtimeMasterReferences, []);
  assert.ok(result.bgmDurationSeconds >= 45 && result.bgmDurationSeconds <= 60);
});

test('the UI tap keeps enough tail for the approved magic droplet sound', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'assets', 'game', 'audio', 'audio-manifest.json'), 'utf8'));
  const uiTap = manifest.entries.find((entry) => entry.id === 'ui.tap');

  assert.ok(uiTap.durationMs >= 100 && uiTap.durationMs <= 140);
});
