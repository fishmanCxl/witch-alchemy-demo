import { expect, test, type Page } from "@playwright/test";

const AUDIO_PREFERENCES_KEY = "witch-water-sort.audio.v1";

type TrackRamp = {
  track: "music" | "sfx";
  target: number;
  durationMs: number;
};

async function loadCleanHome(page: Page) {
  await page.goto("/");
  await page.evaluate((key) => window.localStorage.removeItem(key), AUDIO_PREFERENCES_KEY);
  await page.reload();
  await expect(page.getByRole("main", { name: "魔女炼金屋首页" })).toBeVisible();
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "打开设置" }).click();
  await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible();
}

test("returning home and continuing preserves the changed board, move count, and undo history", async ({ page }) => {
  await loadCleanHome(page);
  await page.getByRole("button", { name: "继续炼金 · 第 12 关" }).click();
  await expect(page.getByRole("main", { name: "魔女炼金水排序关卡" })).toBeVisible();
  await expect(page.getByText("步数 0", { exact: true })).toBeVisible();
  await expect(page.getByTestId("bottle-0").locator(".liquid-layer")).toHaveCount(4);

  await page.getByRole("button", { name: "药瓶 1", exact: true }).click();
  await page.getByRole("button", { name: "药瓶 2", exact: true }).click();
  await expect(page.getByText("步数 1", { exact: true })).toBeVisible();
  await expect(page.getByTestId("bottle-0").locator(".liquid-layer")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "撤销" })).toBeEnabled();

  await openSettings(page);
  await page.getByRole("button", { name: "返回主页" }).click();
  await expect(page.getByRole("main", { name: "魔女炼金屋首页" })).toBeVisible();

  await page.getByRole("button", { name: "继续炼金 · 第 12 关" }).click();
  await expect(page.getByText("步数 1", { exact: true })).toBeVisible();
  await expect(page.getByTestId("bottle-0").locator(".liquid-layer")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "撤销" })).toBeEnabled();
});

test("returning home and continuing preserves the selected bottle", async ({ page }) => {
  await loadCleanHome(page);
  await page.getByRole("button", { name: "继续炼金 · 第 12 关" }).click();
  const firstBottle = page.getByRole("button", { name: "药瓶 1", exact: true });

  await firstBottle.click();
  await expect(firstBottle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("bottle-0")).toHaveClass(/\bis-selected\b/);

  await openSettings(page);
  await page.getByRole("button", { name: "返回主页" }).click();
  await page.getByRole("button", { name: "继续炼金 · 第 12 关" }).click();

  await expect(page.getByRole("button", { name: "药瓶 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("bottle-0")).toHaveClass(/\bis-selected\b/);
});

test("home and level expose their distinct settings capabilities and return handler", async ({ page }) => {
  await loadCleanHome(page);
  await openSettings(page);
  await expect(page.getByRole("button", { name: "声音：已开启" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "返回主页" })).toHaveCount(0);
  await page.getByRole("button", { name: "关闭设置" }).click();
  await expect(page.getByRole("dialog", { name: "设置" })).toHaveCount(0);

  await page.getByRole("button", { name: "继续炼金 · 第 12 关" }).click();
  await openSettings(page);
  await expect(page.getByRole("button", { name: "声音：已开启" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "返回主页" })).toBeVisible();
  await page.getByRole("button", { name: "返回主页" }).click();
  await expect(page.getByRole("main", { name: "魔女炼金屋首页" })).toBeVisible();
});

test("master sound persists and drives both AudioDirector track gain ramps", async ({ page }) => {
  await page.addInitScript(() => {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;

    const probeWindow = window as typeof window & { __audioTrackRamps: TrackRamp[] };
    probeWindow.__audioTrackRamps = [];
    let gainIndex = 0;
    const originalCreateGain = AudioContextConstructor.prototype.createGain;

    AudioContextConstructor.prototype.createGain = function createProbedGain(this: AudioContext) {
      const node = originalCreateGain.call(this);
      const track = gainIndex === 0 ? "music" : gainIndex === 1 ? "sfx" : null;
      gainIndex += 1;
      if (!track) return node;

      const parameter = node.gain;
      const originalCancel = parameter.cancelScheduledValues.bind(parameter);
      const originalRamp = parameter.linearRampToValueAtTime.bind(parameter);
      let lastCancelTime = 0;
      parameter.cancelScheduledValues = (startTime) => {
        lastCancelTime = startTime;
        return originalCancel(startTime);
      };
      parameter.linearRampToValueAtTime = (target, endTime) => {
        probeWindow.__audioTrackRamps.push({
          track,
          target,
          durationMs: Math.round((endTime - lastCancelTime) * 1000),
        });
        return originalRamp(target, endTime);
      };
      return node;
    };
  });
  await loadCleanHome(page);
  await openSettings(page);
  await page.evaluate(() => {
    (window as typeof window & { __audioTrackRamps: TrackRamp[] }).__audioTrackRamps.length = 0;
  });
  await page.getByRole("button", { name: "声音：已开启" }).click();
  await expect(page.getByRole("button", { name: "声音：已关闭" })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), AUDIO_PREFERENCES_KEY)).toBe(
    '{"musicEnabled":false,"sfxEnabled":false}',
  );
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __audioTrackRamps: TrackRamp[] }).__audioTrackRamps,
  )).toEqual([
    { track: "music", target: 0, durationMs: 300 },
    { track: "sfx", target: 0, durationMs: 80 },
  ]);

  await page.reload();
  await expect(page.getByRole("main", { name: "魔女炼金屋首页" })).toBeVisible();
  await openSettings(page);
  await expect(page.getByRole("button", { name: "声音：已关闭" })).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(() => {
    (window as typeof window & { __audioTrackRamps: TrackRamp[] }).__audioTrackRamps.length = 0;
  });

  await page.getByRole("button", { name: "声音：已关闭" }).click();
  await expect(page.getByRole("button", { name: "声音：已开启" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), AUDIO_PREFERENCES_KEY)).toBe(
    '{"musicEnabled":true,"sfxEnabled":true}',
  );
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __audioTrackRamps: TrackRamp[] }).__audioTrackRamps,
  )).toEqual([
    { track: "music", target: 0.36, durationMs: 0 },
    { track: "sfx", target: 0.78, durationMs: 0 },
  ]);
});
