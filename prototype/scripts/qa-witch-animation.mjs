import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const baseURL = process.env.WITCH_QA_URL ?? 'http://127.0.0.1:4175';
const outputRoot = new URL('../artifacts/', import.meta.url);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
const consoleProblems = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(message.text());
});
page.on('pageerror', (error) => consoleProblems.push(error.message));

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续炼金 · 第 12 关' }).click();
  const stage = page.locator('.witch-stage');
  const frame = page.locator('.witch-frame');

  await page.waitForFunction(() => document.querySelector('.witch-frame')?.getAttribute('src')?.includes('/idle/'));
  const idleStart = await frame.getAttribute('src');
  await page.waitForTimeout(460);
  const idleLater = await frame.getAttribute('src');
  if (idleStart === idleLater) throw new Error('idle animation did not advance');
  await page.screenshot({ path: fileURLToPath(new URL('witch-v3-idle.png', outputRoot)) });

  await page.getByRole('button', { name: '药瓶 1', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.witch-stage')?.classList.contains('mood-prepare'));
  await page.screenshot({ path: fileURLToPath(new URL('witch-v3-prepare.png', outputRoot)) });

  await page.waitForFunction(() => document.querySelector('.witch-stage')?.classList.contains('mood-raise'));
  await page.screenshot({ path: fileURLToPath(new URL('witch-v3-raise.png', outputRoot)) });

  await page.getByRole('button', { name: '药瓶 2', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.witch-stage')?.classList.contains('mood-celebrate'));
  await page.waitForTimeout(360);
  const magic = page.locator('.witch-magic-frame');
  if (await magic.count() !== 1) throw new Error('celebration magic overlay missing');
  const magicSource = await magic.getAttribute('src');
  if (!magicSource?.includes('/witch-magic/celebrate/')) throw new Error(`wrong magic source: ${magicSource}`);
  await page.screenshot({ path: fileURLToPath(new URL('witch-v3-celebrate.png', outputRoot)) });

  await page.waitForFunction(() => document.querySelector('.witch-stage')?.classList.contains('mood-return'), null, { timeout: 2500 });
  await page.screenshot({ path: fileURLToPath(new URL('witch-v3-return.png', outputRoot)) });
  await page.waitForFunction(() => document.querySelector('.witch-stage')?.classList.contains('mood-idle'), null, { timeout: 1800 });

  const geometry = await stage.evaluate((element) => {
    const stageRect = element.getBoundingClientRect();
    const imageRect = element.querySelector('.witch-frame')?.getBoundingClientRect();
    const image = element.querySelector('.witch-frame');
    return {
      stage: [stageRect.x, stageRect.y, stageRect.width, stageRect.height],
      image: imageRect ? [imageRect.x, imageRect.y, imageRect.width, imageRect.height] : null,
      natural: image instanceof HTMLImageElement ? [image.naturalWidth, image.naturalHeight] : null,
    };
  });
  if (JSON.stringify(geometry.natural) !== JSON.stringify([512, 512])) {
    throw new Error(`unexpected frame dimensions: ${JSON.stringify(geometry.natural)}`);
  }
  if (consoleProblems.length) throw new Error(`console problems: ${consoleProblems.join(' | ')}`);
  console.log(JSON.stringify({ result: 'passed', idleStart, idleLater, magicSource, geometry }, null, 2));
} finally {
  await browser.close();
}
