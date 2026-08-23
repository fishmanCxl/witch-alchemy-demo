import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const componentUrl = new URL('../src/components/GameSettings.tsx', import.meta.url);
const publicUiUrl = new URL('../public/assets/game/chibi/ui/', import.meta.url);

function pngDimensions(fileUrl) {
  const bytes = readFileSync(fileUrl);
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25),
  };
}

// Catches restoring the obsolete independent music/SFX switches instead of the
// one user-facing master switch backed by GameAudioController.
test('sound settings expose one accessible master switch', () => {
  const source = readFileSync(componentUrl, 'utf8');

  assert.equal((source.match(/aria-pressed=/g) ?? []).length, 1);
  assert.match(source, /soundEnabled:\s*boolean/);
  assert.match(source, /onSoundChange\(enabled:\s*boolean\):\s*void/);
  assert.match(source, /onSoundChange\(!soundEnabled\)/);
  assert.match(source, /aria-label=\{`声音：\$\{soundEnabled \? "已开启" : "已关闭"\}`\}/);
  assert.doesNotMatch(source, /onMusicChange|onSfxChange|背景音乐|游戏音效/);
});

// Catches symbol/vector substitutions and missing binary states for the master
// sound control.
test('master sound settings use the approved raster states', () => {
  const source = readFileSync(componentUrl, 'utf8');

  assert.match(source, /\/assets\/game\/chibi\/ui\/icon-audio-settings\.png/);
  assert.match(source, /\/assets\/game\/chibi\/ui\/icon-sfx-off\.png/);
  assert.doesNotMatch(source, /<svg|@radix-ui\/react-icons|[🔊🔇🎵🎶🔈🔉]/u);

  for (const name of ['icon-audio-settings.png', 'icon-sfx-off.png']) {
    assert.deepEqual(
      pngDimensions(new URL(name, publicUiUrl)),
      { width: 96, height: 96, colorType: 6 },
      `${name} must remain a 96×96 RGBA PNG`,
    );
  }
});
