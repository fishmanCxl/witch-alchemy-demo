import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const homeUrl = new URL('../src/components/HomeScene.tsx', import.meta.url);
const settingsUrl = new URL('../src/components/GameSettings.tsx', import.meta.url);
const cssUrl = new URL('../src/prototype.css', import.meta.url);
const publicUiUrl = new URL('../public/assets/game/chibi/ui/', import.meta.url);
const publicTitlesUrl = new URL('../public/assets/game/chibi/titles/', import.meta.url);

function sourceOrEmpty(fileUrl) {
  return existsSync(fileUrl) ? readFileSync(fileUrl, 'utf8') : '';
}

function parseRgbaPng(fileUrl) {
  const bytes = readFileSync(fileUrl);
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${fileURLToPath(fileUrl)} must be a PNG`);

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes.readUInt8(24);
  const colorType = bytes.readUInt8(25);
  assert.equal(bitDepth, 8, `${fileURLToPath(fileUrl)} must use 8-bit channels`);
  assert.equal(colorType, 6, `${fileURLToPath(fileUrl)} must retain an RGBA alpha channel`);

  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }

  const filtered = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = filtered[inputOffset];
    inputOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const raw = filtered[inputOffset + x];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const leftDistance = Math.abs(estimate - left);
        const upDistance = Math.abs(estimate - up);
        const diagonalDistance = Math.abs(estimate - upLeft);
        value = raw + (leftDistance <= upDistance && leftDistance <= diagonalDistance
          ? left
          : upDistance <= diagonalDistance ? up : upLeft);
      } else throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = value & 0xff;
    }
    inputOffset += stride;
  }

  return { width, height, pixels };
}

test('home and settings expose the approved accessible contract', () => {
  const homeSource = sourceOrEmpty(homeUrl);
  const settingsSource = sourceOrEmpty(settingsUrl);

  assert.match(homeSource, /继续炼金 · 第 12 关/);
  assert.match(homeSource, /<WitchAnimator mood="idle"/);
  assert.match(settingsSource, /role="dialog"/);
  assert.match(settingsSource, /aria-modal="true"/);
  assert.match(settingsSource, /aria-label=\{`声音：\$\{soundEnabled \? "已开启" : "已关闭"\}`\}/);
  assert.equal((settingsSource.match(/aria-pressed=/g) ?? []).length, 1);
  assert.match(settingsSource, /返回主页/);
  assert.match(settingsSource, /event\.key === "Escape"/);
  assert.doesNotMatch(settingsSource, /背景音乐|游戏音效|<svg|[🔊🔇⚙️]/u);
});

test('settings keeps the full-screen mask interactive throughout its exit phase', () => {
  const source = sourceOrEmpty(settingsUrl);
  const css = sourceOrEmpty(cssUrl);
  const layer = css.match(/\.game-settings-layer\s*\{([^}]*)\}/s)?.[1] ?? '';
  const exiting = css.match(/\.game-settings-layer\.is-exiting\s*\{([^}]*)\}/s)?.[1] ?? '';

  assert.match(source, /const EXIT_DURATION_MS = 160;/);
  assert.match(source, /window\.setTimeout\([^]*EXIT_DURATION_MS/s);
  assert.match(source, /disabled=\{isExiting\}/);
  assert.match(layer, /pointer-events:\s*auto;/);
  assert.match(exiting, /pointer-events:\s*auto;/);
  assert.doesNotMatch(exiting, /pointer-events:\s*none;/);
});

test('home and settings CSS preserves the approved geometry and reduced-motion fallback', () => {
  const css = sourceOrEmpty(cssUrl);
  const root = css.match(/\.game-settings\s*\{([^}]*)\}/s)?.[1] ?? '';
  const trigger = css.match(/\.game-settings-trigger\s*\{([^}]*)\}/s)?.[1] ?? '';
  const layer = css.match(/\.game-settings-layer\s*\{([^}]*)\}/s)?.[1] ?? '';
  const dialog = css.match(/\.game-settings-dialog\s*\{([^}]*)\}/s)?.[1] ?? '';
  const continueButton = css.match(/\.home-continue\s*\{([^}]*)\}/s)?.[1] ?? '';

  assert.match(root, /position:\s*absolute;/);
  assert.match(root, /z-index:\s*12;/);
  assert.match(root, /top:\s*62px;/);
  assert.match(root, /right:\s*18px;/);
  assert.match(trigger, /width:\s*48px;/);
  assert.match(trigger, /height:\s*48px;/);
  assert.match(layer, /position:\s*absolute;/);
  assert.match(layer, /inset:\s*0;/);
  assert.match(layer, /z-index:\s*20;/);
  assert.match(dialog, /width:\s*min\(304px,\s*calc\(100% - 36px\)\);/);
  assert.match(dialog, /min-height:\s*360px;/);
  assert.match(continueButton, /min-width:\s*286px;/);
  assert.match(continueButton, /min-height:\s*72px;/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[^]*\.game-settings-layer/s);
  assert.match(css, /animation-duration:\s*1ms;/);
});

test('settings raster assets have exact RGBA dimensions and transparent outer edges', () => {
  const expected = {
    'icon-settings-gear.png': { width: 96, height: 96 },
    'settings-dialog-panel.png': { width: 600, height: 720 },
    'icon-settings-close.png': { width: 96, height: 96 },
    'icon-settings-home.png': { width: 96, height: 96 },
    'home-collection-button.png': { width: 128, height: 128 },
    'home-share-button.png': { width: 128, height: 128 },
  };

  for (const [name, dimensions] of Object.entries(expected)) {
    const fileUrl = new URL(name, publicUiUrl);
    assert.equal(existsSync(fileUrl), true, `${name} must exist`);
    const { width, height, pixels } = parseRgbaPng(fileUrl);
    assert.deepEqual({ width, height }, dimensions, `${name} has the wrong dimensions`);

    for (let x = 0; x < width; x += 1) {
      assert.equal(pixels[x * 4 + 3], 0, `${name} top edge must be transparent`);
      assert.equal(pixels[((height - 1) * width + x) * 4 + 3], 0, `${name} bottom edge must be transparent`);
    }
    for (let y = 0; y < height; y += 1) {
      assert.equal(pixels[(y * width) * 4 + 3], 0, `${name} left edge must be transparent`);
      assert.equal(pixels[(y * width + width - 1) * 4 + 3], 0, `${name} right edge must be transparent`);
    }
  }
});

test('title badge sheet contains ten transparent double-resolution cells', () => {
  const fileUrl = new URL('title-badges.png', publicTitlesUrl);
  assert.equal(existsSync(fileUrl), true, 'title-badges.png must exist');
  const { width, height, pixels } = parseRgbaPng(fileUrl);
  assert.deepEqual({ width, height }, { width: 672, height: 450 });

  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      let opaquePixels = 0;
      for (let y = row * 90; y < (row + 1) * 90; y += 1) {
        for (let x = column * 336; x < (column + 1) * 336; x += 1) {
          if (pixels[(y * width + x) * 4 + 3] > 0) opaquePixels += 1;
        }
      }
      assert.ok(opaquePixels > 500, `title cell ${row * 2 + column + 1} must contain artwork`);
    }
  }
});
