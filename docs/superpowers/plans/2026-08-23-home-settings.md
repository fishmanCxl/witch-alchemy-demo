# 魔女炼金首页与设置菜单实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不重置水排序关卡的前提下增加首页、居中设置菜单和一个同时控制 BGM/SFX 的总声音开关，并完成尚未接入的游戏事件音效。

**Architecture:** `Prototype` 保持关卡状态的唯一所有者，通过 `home | level` 场景状态切换可见界面，不引入路由或卸载关卡状态。底层 `AudioDirector` 继续保留 music/sfx 两条轨道；React 控制器新增一个原子 `setSoundEnabled()`，设置菜单只暴露该总开关。设置弹窗和首页是独立表现组件，游戏引擎保持纯净。

**Tech Stack:** React 19、TypeScript、Vite 8、Web Audio API、Node.js test runner、Playwright、ImageGen 位图资产。

**Spec:** `docs/superpowers/specs/2026-08-23-home-settings-design.md`

## Global Constraints

- 首次打开显示首页；点击“继续炼金”进入第 12 关。
- 从设置菜单返回首页时保留瓶子内容、位置、步数、完成数量、奖励空瓶与撤销历史。
- 设置齿轮固定在首页和关卡页右上角，点击后显示带遮罩的居中紫金 Q 版弹窗。
- 设置弹窗只显示一个总声音开关、返回主页按钮和关闭按钮。
- 总声音开关同时更新 `musicEnabled` 与 `sfxEnabled`，并继续使用 `witch-water-sort.audio.v1` 持久化。
- 底层仍保留 music/sfx 两个轨道、默认增益 `0.36/0.78`、四声部限制、完成/奖励 ducking。
- 保持固定 5×3 棋盘、seed `12`、奖励槽 `14`、520ms 反馈和 300ms burst + 780ms departure/1080ms vanish 时序。
- 音频或资源加载失败不能阻止首页、设置或游戏操作。
- 所有可见设置图标和面板必须使用真实 PNG 位图，不得使用 emoji、文本符号、内联 SVG 或 CSS 绘图。
- 不加入礼包、排行榜、收藏、体力、货币、振动、跳关、真实广告 SDK 或 CloudBase。
- 当前工作区没有 Git 元数据；每个任务以测试证据和 `prototype/audio-qa.md` 检查点替代提交。

---

## File Map

### New files

- `prototype/src/components/HomeScene.tsx` — 首页标题、进度、等待魔女和继续按钮。
- `prototype/src/components/GameSettings.tsx` — 齿轮入口、模态遮罩、总声音开关、返回主页和关闭行为。
- `prototype/tests/home-settings.test.mjs` — 首页、设置、位图资产、可访问性与 CSS 合同测试。
- `prototype/tests/home-settings-runtime.spec.ts` — 真实浏览器中的场景切换、状态保留、弹窗和总声音持久化。
- `prototype/scripts/prepare-game-settings-assets.py` — 将 ImageGen 原图转为真透明、等比居中的固定尺寸 PNG。
- `prototype/artifacts/game-settings-ui-raw/**` — 设置齿轮、弹窗、关闭、主页图标的原始生成图与支持图。
- `prototype/public/assets/game/chibi/ui/icon-settings-gear.png` — 96×96 齿轮图标。
- `prototype/public/assets/game/chibi/ui/settings-dialog-panel.png` — 600×720 居中弹窗面板。
- `prototype/public/assets/game/chibi/ui/icon-settings-close.png` — 96×96 关闭图标。
- `prototype/public/assets/game/chibi/ui/icon-settings-home.png` — 96×96 返回主页图标。

### Modified files

- `prototype/src/audio/useGameAudio.ts` — 新增总声音状态和原子 setter。
- `prototype/src/components/AudioSettings.tsx` — 由旧双开关横向 popover 迁移后删除；调用方改用 `GameSettings`。
- `prototype/src/Prototype.tsx` — 接入场景状态、首页、设置菜单和全部游戏音效事件。
- `prototype/src/prototype.css` — 首页、遮罩、居中弹窗、设置入口、主按钮与响应式样式。
- `prototype/tests/audio-settings.test.mjs` — 改为总声音控制器合同或被新测试替代。
- `prototype/tests/prototype-integration.test.mjs` — 增加场景保留和音频事件断言。
- `prototype/AGENTS.md` — 记录首页和总声音开关的持久产品决定。
- `prototype/audio-qa.md` — 最终资源、浏览器、听感和 Cocos 交接证据。

---

### Task 1: 增加原子总声音控制器

**Files:**
- Modify: `prototype/src/audio/useGameAudio.ts`
- Modify: `prototype/tests/web-audio-driver.test.mjs`
- Create: `prototype/tests/game-audio-controller.test.mjs`
- Modify: `prototype/audio-qa.md`

**Interfaces:**
- Consumes: `AudioPreferences`, `AudioDirector.setMusicEnabled`, `AudioDirector.setSfxEnabled`。
- Produces:

```ts
export interface GameAudioController {
  readonly preferences: AudioPreferences;
  readonly soundEnabled: boolean;
  unlockFromGesture(): void;
  play(cueId: AudioCueId): void;
  setSoundEnabled(enabled: boolean): void;
}
```

- [ ] **Step 1: 写总声音控制器 RED 测试**

创建 `tests/game-audio-controller.test.mjs`，读取 `useGameAudio.ts` 并锁定单一原子更新路径：

```js
test('master sound state updates and persists both tracks atomically', () => {
  const source = readFileSync(new URL('../src/audio/useGameAudio.ts', import.meta.url), 'utf8');
  assert.match(source, /soundEnabled:\s*preferences\.musicEnabled\s*&&\s*preferences\.sfxEnabled/);
  assert.match(source, /setSoundEnabled\(enabled:\s*boolean\)/);
  assert.match(source, /musicEnabled:\s*Boolean\(enabled\)/);
  assert.match(source, /sfxEnabled:\s*Boolean\(enabled\)/);
  assert.match(source, /persistPreferences\(next\)/);
  assert.match(source, /director\.setMusicEnabled\(next\.musicEnabled\)/);
  assert.match(source, /director\.setSfxEnabled\(next\.sfxEnabled\)/);
});
```

- [ ] **Step 2: 运行 RED**

Run:

```powershell
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/game-audio-controller.test.mjs
```

Expected: FAIL，指出 `soundEnabled` 或 `setSoundEnabled` 缺失。

- [ ] **Step 3: 最小实现总开关**

在 `useGameAudio.ts` 中保留底层两个轨道 setter 的内部能力，但只向 UI 返回总开关：

```ts
const setSoundEnabled = useCallback((enabled: boolean) => {
  const next = {
    musicEnabled: Boolean(enabled),
    sfxEnabled: Boolean(enabled),
  };
  preferencesRef.current = next;
  setPreferences(next);
  persistPreferences(next);
  try {
    runtimeRef.current?.director.setMusicEnabled(next.musicEnabled);
    runtimeRef.current?.director.setSfxEnabled(next.sfxEnabled);
  } catch {
    // Browser audio failure never changes the stored preference.
  }
}, []);

return {
  preferences,
  soundEnabled: preferences.musicEnabled && preferences.sfxEnabled,
  unlockFromGesture,
  play,
  setSoundEnabled,
};
```

如果现有调用仍需要单轨 setter，将它们保留为内部函数但不传给设置 UI；Task 3 集成后再删除无调用导出。

- [ ] **Step 4: 运行 GREEN 与音频回归**

Run:

```powershell
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/game-audio-controller.test.mjs tests/audio-cues.test.mjs tests/audio-director.test.mjs tests/audio-assets.test.mjs tests/web-audio-driver.test.mjs
```

Expected: 全部 PASS；`witch-water-sort.audio.v1` 与默认值不变。

- [ ] **Step 5: 记录 Checkpoint 1**

在 `audio-qa.md` 记录总开关同时设置两个轨道、持久化一次、重新开启只恢复一个 BGM 的合同和测试计数。

---

### Task 2: 生成设置资产并实现首页与设置组件

**Files:**
- Create: `prototype/src/components/HomeScene.tsx`
- Create: `prototype/src/components/GameSettings.tsx`
- Create: `prototype/tests/home-settings.test.mjs`
- Create: `prototype/scripts/prepare-game-settings-assets.py`
- Create: `prototype/artifacts/game-settings-ui-raw/**`
- Create: `prototype/public/assets/game/chibi/ui/icon-settings-gear.png`
- Create: `prototype/public/assets/game/chibi/ui/settings-dialog-panel.png`
- Create: `prototype/public/assets/game/chibi/ui/icon-settings-close.png`
- Create: `prototype/public/assets/game/chibi/ui/icon-settings-home.png`
- Modify: `prototype/src/prototype.css`
- Modify: `prototype/AGENTS.md`
- Modify: `prototype/audio-qa.md`

**Interfaces:**
- Consumes: `WitchAnimator`,现有房间背景、`button-purple-normal.png`、`button-gold-normal.png`、`message-panel.png`、`icon-audio-settings.png`、`icon-sfx-off.png`。
- Produces:

```ts
interface HomeSceneProps {
  completedCount: number;
  onContinue(): void;
  settings: ReactNode;
}

interface GameSettingsProps {
  soundEnabled: boolean;
  canReturnHome: boolean;
  onSoundChange(enabled: boolean): void;
  onReturnHome(): void;
  onUiPress(): void;
}
```

- [ ] **Step 1: 写组件和资产 RED 测试**

创建 `tests/home-settings.test.mjs`，断言：

```js
test('home and settings expose the approved accessible contract', () => {
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
```

资产断言固定为：gear/close/home `96×96 RGBA`，dialog `600×720 RGBA`，所有外边 alpha 为 0。

- [ ] **Step 2: 运行 RED**

Run:

```powershell
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/home-settings.test.mjs
```

Expected: FAIL，指出组件或第一张新资产缺失。

- [ ] **Step 3: 使用 ImageGen 生成 4 张新位图**

以 `button-purple-normal.png`、`message-panel.png` 和现有炼金房间截图为风格参考，逐资产调用内置 ImageGen。统一提示要求：

```text
Use case: ui-mockup
Asset type: Q-style witch-alchemy mobile game settings asset
Primary request: create exactly one requested gear / centered settings dialog panel / close icon / home icon
Style: polished 2D storybook raster, deep eggplant purple enamel, warm gold rim, thick cream outline, tiny lavender glass sparkles
Constraints: no text, no letters, no emoji, no inline symbols, no perspective, no watermark, all decoration inside bounds, true transparent background
```

原图分别保存到 `artifacts/game-settings-ui-raw/*-raw.png`，不得只留在生成工具目录。

- [ ] **Step 4: 写确定性资产规范化脚本**

`prepare-game-settings-assets.py` 必须：

- 对烘焙棋盘背景执行边缘连通中性色清理；
- 保留主体内部高光与柔光；
- 等比缩放并居中，四边至少 4px 真透明；
- 输出 gear/close/home 96×96，dialog 600×720；
- 二次运行得到相同 SHA-256；
- 生成 `artifacts/game-settings-ui-raw/supporting-sheet.png`。

- [ ] **Step 5: 实现 `HomeScene`**

```tsx
export function HomeScene({ completedCount, onContinue, settings }: HomeSceneProps) {
  return (
    <main className="home-scene" aria-label="暮影炼金室首页">
      <header className="home-header">
        <p>暮影炼金室</p>
        <h1>第 12 关</h1>
        <span>魔药 {completedCount}/8</span>
      </header>
      {settings}
      <section className="home-hero" aria-label="魔女等待炼金">
        <WitchAnimator mood="idle" onSettled={() => undefined} />
        <div className="home-cauldron-glow" aria-hidden="true" />
      </section>
      <button className="home-continue" type="button" onClick={onContinue}>
        继续炼金 · 第 12 关
      </button>
    </main>
  );
}
```

- [ ] **Step 6: 实现 `GameSettings`**

组件必须用 portal 或覆盖整个 `.alchemy-screen` 的绝对层，包含：遮罩、`role="dialog"`、标题、一个 `aria-pressed` 开关、返回主页、关闭按钮。打开时保存触发器引用并将焦点移入弹窗；Escape、遮罩、关闭按钮关闭并恢复焦点。160ms 退出期间遮罩保持 `pointer-events:auto`，内部按钮 disabled，结束后才卸载。

总开关处理顺序：

```ts
onUiPress();
onSoundChange(!soundEnabled);
```

返回主页处理顺序：

```ts
onUiPress();
closeDialog(false);
onReturnHome();
```

当 `canReturnHome === false` 时不渲染返回主页按钮。

- [ ] **Step 7: 添加首页与弹窗 CSS**

关键合同：

```css
.game-settings { position: absolute; z-index: 12; top: 62px; right: 18px; }
.game-settings-trigger { width: 48px; height: 48px; }
.game-settings-layer { position: absolute; inset: 0; z-index: 20; pointer-events: auto; }
.game-settings-dialog { width: min(304px, calc(100% - 36px)); min-height: 360px; }
.home-continue { min-width: 286px; min-height: 72px; }
```

393×852 和 427×952 下弹窗不得越过安全边缘；`prefers-reduced-motion` 下 enter/exit 动画为 1ms。

- [ ] **Step 8: 运行 GREEN 与视觉门禁**

运行 home-settings、presentation、runtime integrity 和 Vite build。逐张查看最终 PNG 与 supporting sheet；确认无棋盘、裁切、拉伸、假透明和风格漂移。

- [ ] **Step 9: 记录 Checkpoint 2**

在 `AGENTS.md` 追加首页、右上角设置、总声音开关、保留关卡状态四项决定；在 `audio-qa.md` 记录素材路径、尺寸、哈希和测试计数。

---

### Task 3: 集成场景切换、游戏音效和进度保留

**Files:**
- Modify: `prototype/src/Prototype.tsx`
- Modify: `prototype/tests/prototype-integration.test.mjs`
- Modify: `prototype/src/components/AudioSettings.tsx`（删除旧实现，确认零引用后删除文件）
- Modify: `prototype/audio-qa.md`

**Interfaces:**
- Consumes: `HomeScene`, `GameSettings`, `useGameAudio`, `gameAudioCue(event)`。
- Produces: 首页/关卡双场景、设置总开关、完整 gameplay→audio event 接入。

- [ ] **Step 1: 写集成 RED 断言**

扩展 `prototype-integration.test.mjs`，要求：

```text
scene 初值 -> home
继续炼金 -> level
返回主页 -> home，但不调用 createDemoState/reset setters
HomeScene 与 level 读取同一个 completedCount/game
first enabled bottle/settings gesture -> audio.unlockFromGesture()
empty start 或 moved===0 -> pour-invalid
first valid selection -> bottle-selected
selected===index -> bottle-deselected
moved>0 -> pour-valid
completed -> potion-completed 立即 + potion-vanish 300ms
successful undo/restart/reward -> dedicated cue
总声音 UI -> audio.setSoundEnabled
```

断言旧 `<AudioSettings`、`onMusicChange`、`onSfxChange` 在 `Prototype.tsx` 中不存在。

- [ ] **Step 2: 运行 RED**

Run:

```powershell
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/prototype-integration.test.mjs
```

Expected: 原有 5 项 PASS，新场景/音频断言 FAIL。

- [ ] **Step 3: 在 `Prototype` 创建稳定场景和音频控制器**

```tsx
const [scene, setScene] = useState<"home" | "level">("home");
const audio = useGameAudio();
const playGameAudio = useCallback((event: GameAudioEvent) => {
  audio.play(gameAudioCue(event));
}, [audio]);
```

不要把 `game`、`history`、`selected` 或计时器移动到条件渲染的子组件中。

- [ ] **Step 4: 接入设置与首页**

首页分支传入：

```tsx
<HomeScene
  completedCount={completedCount}
  onContinue={() => {
    audio.unlockFromGesture();
    setScene("level");
  }}
  settings={<GameSettings
    soundEnabled={audio.soundEnabled}
    canReturnHome={false}
    onSoundChange={audio.setSoundEnabled}
    onReturnHome={() => undefined}
    onUiPress={() => { audio.unlockFromGesture(); playGameAudio("ui-pressed"); }}
  />}
/>
```

关卡设置的 `onReturnHome` 只执行 `setScene("home")`；不得调用 `handleRestart`、`clearTransientTimers`、`setGame` 或 `setHistory`。

- [ ] **Step 5: 接入每个确认结果的音效**

所有已启用的瓶子/控制动作先调用 `audio.unlockFromGesture()`；随后仅在现有结果分支确定后发 cue。完成分支保留 1080ms disappear，并新增：

```ts
playGameAudio("potion-completed");
scheduleTransient(() => playGameAudio("potion-vanish"), 300);
```

restart/unmount 使用现有 registry 清除 delayed vanish cue。设置开关专用 `ui.tap`；撤销、重来、奖励和瓶子操作不得额外叠加 `ui.tap`。

- [ ] **Step 6: 做三个 mutation RED/GREEN**

逐个临时变更并确认命名断言失败，再恢复：

1. `scene` 初值 `home → level`；
2. `potion-vanish` 延时 `300 → 0`；
3. 返回主页处理器中加入 `handleRestart()`。

- [ ] **Step 7: 跑完整非浏览器回归**

Run:

```powershell
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/audio-cues.test.mjs tests/audio-director.test.mjs tests/audio-assets.test.mjs tests/web-audio-driver.test.mjs tests/game-audio-controller.test.mjs tests/home-settings.test.mjs tests/game-engine.test.mjs tests/presentation.test.mjs tests/bottle-animation.test.mjs tests/prototype-integration.test.mjs
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/validate-audio-assets.mjs
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/check-mobile-runtime.mjs
& 'C:\Users\cxl\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/vite/bin/vite.js build
```

Expected: 全部测试、资产 validator、28 个 protected files 和 Vite transform/build PASS。

- [ ] **Step 8: 记录 Checkpoint 3**

在 `audio-qa.md` 记录场景保留、全部 cue 分支、三个 mutation、回归计数和 build module 数。

---

### Task 4: 浏览器视觉、交互与听感 QA

**Files:**
- Create: `prototype/tests/home-settings-runtime.spec.ts`
- Modify: `prototype/audio-qa.md`
- Create: `prototype/artifacts/home-393x852.png`
- Create: `prototype/artifacts/settings-level-393x852.png`
- Create: `prototype/artifacts/settings-home-427x952.png`
- Create: `prototype/artifacts/home-settings-reference-comparison.png`

**Interfaces:**
- Consumes: 完整首页、设置、关卡与音频系统。
- Produces: 真实浏览器证据和 Cocos Creator 场景迁移说明。

- [ ] **Step 1: 写 Playwright 浏览器测试**

`home-settings-runtime.spec.ts` 必须验证：

- 初次加载显示首页且魔女 idle 帧变化；
- 继续按钮进入关卡；
- 完成至少一次有效选择或浇注后记录步数/瓶子文本；
- 设置→返回主页→继续后步数与瓶子状态相同；
- 右上角设置按钮在安全区内；
- 弹窗只有一个 `aria-pressed` 声音开关；
- 关闭声音后 BGM/SFX 均不再创建播放实例，重载后仍关闭；
- 开启后仅恢复一个 BGM 请求/实例路径；
- 首页无礼包、排行榜、收藏、体力或货币入口；
- 393×852、427×952 无安全边缘、主视觉、弹窗或按钮裁切；
- reduced motion 下弹窗动画为 1ms；
- 控制台无应用 warning/error，所有 PNG/MP3 请求 HTTP 200。

- [ ] **Step 2: 启动本地预览并运行自动化**

优先使用可用的浏览器插件；若不可用，记录原因并使用项目 Playwright。运行 `test:runtime` 并保存精确 app-screen clip，PNG header 必须分别为 393×852 与 427×952。

- [ ] **Step 3: 做视觉对比**

把用户提供的首页参考图作为结构参考，把现有 `chibi-initial-393x852.png` 作为真实项目风格基线。生成等比对比图，确认：首页只有一个中央主视觉和一个底部主按钮、齿轮位于右上角、未复制参考图的甜品或未实现入口、紫金炼金风格一致。

- [ ] **Step 4: 完成听感验收**

固定流程：进入首页、开关总声音、进入关卡、选择/取消、两类无效倒液、有效倒液、完成、300ms vanish、撤销、重来、奖励瓶、返回首页、重新进入、后台/前台、BGM 循环 3 分钟。逐项确认无重复 BGM、无残留 SFX、无爆音、无 seam、无音画错位。

- [ ] **Step 5: 写 Cocos Creator 交接**

在 `audio-qa.md` 明确：

- `home/level` 对应两个 UI 场景或同场景层；共享 `GameState` 服务持有局面；
- 总声音设置映射到 BGM `AudioSource` 与 SFX pool 的 enabled 状态；
- 可复用 cue、manifest、MP3、偏好 key 与 PNG；
- 不复制 React hook、Web Audio driver 或 DOM 组件；
- 微信小游戏第一次用户输入完成音频 unlock；真实广告成功才发 `reward.empty_bottle`。

- [ ] **Step 6: 最终新鲜验证**

重新运行 Task 3 的完整非浏览器命令、Playwright、音频 validator 和 Sites build 检查。只有当全部通过且听感列表无失败时，`audio-qa.md` 最后一行写：

```text
final result: passed
```

---

## Plan Self-Review Checklist

- 首页、右上角齿轮、中央魔女主视觉、底部继续按钮和未实现入口排除均由 Tasks 2/4 覆盖。
- 返回主页保留局面和撤销历史由 Task 3 源合同与 Task 4 浏览器流程双重覆盖。
- 单一总声音开关、持久化、双轨底层、单 BGM 恢复由 Tasks 1/3/4 覆盖。
- 设置弹窗遮罩、焦点、Escape、退出防穿透、44px 点击区和 reduced motion 由 Tasks 2/4 覆盖。
- 现有全部游戏 cue、300ms vanish 与 1080ms 消失时序由 Task 3 覆盖。
- PNG 真透明、固定尺寸、确定性规范化、视觉一致性由 Task 2 覆盖。
- Cocos/微信小游戏迁移边界与最终听感由 Task 4 覆盖。
