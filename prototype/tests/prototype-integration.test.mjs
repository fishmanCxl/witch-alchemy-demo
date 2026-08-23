import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const prototypeSource = readFileSync(new URL('../src/Prototype.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../src/prototype.css', import.meta.url), 'utf8');

// Catches a regression that leaves the playable screen on legacy art instead of
// connecting the tested chibi presentation components to real game transitions.
test('playable level uses the chibi component system and deterministic board seed', () => {
  assert.match(prototypeSource, /import\s+\{\s*BottleView\s*\}\s+from\s+["']\.\/components\/BottleView["']/);
  assert.match(prototypeSource, /import\s+\{\s*ControlButton\s*\}\s+from\s+["']\.\/components\/ControlButton["']/);
  assert.match(prototypeSource, /import\s+\{\s*GameMessage\s*\}\s+from\s+["']\.\/components\/GameMessage["']/);
  assert.match(prototypeSource, /import\s+\{\s*WitchAnimator\s*\}\s+from\s+["']\.\/components\/WitchAnimator["']/);
  assert.match(prototypeSource, /const LEVEL_SEED = 12;/);
  assert.match(prototypeSource, /levelSeed=\{LEVEL_SEED\}/);
  assert.doesNotMatch(prototypeSource, /const POTION_COLORS/);
  assert.doesNotMatch(prototypeSource, /const WITCH_ART/);
  assert.doesNotMatch(prototypeSource, /function BottleView\(/);
  assert.doesNotMatch(prototypeSource, /function ControlButton\(/);
  assert.doesNotMatch(prototypeSource, /@radix-ui\/react-icons/);
});

// Catches a timer regression where a pour remains animated too long, a completed
// bottle vanishes before its 300ms burst plus 780ms flight, or restart leaves old
// asynchronous effects alive to mutate a fresh level.
test('transient game effects use the approved durations and restart-safe timer registry', () => {
  assert.match(prototypeSource, /const transientTimers = useRef\(new Set<number>\(\)\);/);
  assert.match(prototypeSource, /scheduleLatestTransient\("pouring", \(\) => setPouring\(new Set\(\)\), 520\)/);
  assert.match(prototypeSource, /scheduleLatestTransient\("invalid", \(\) => setInvalid\(new Set\(\)\), 520\)/);
  assert.match(prototypeSource, /vanishBottle\(state, bottleIndex\)[\s\S]*?\}, 1080\)/);
  assert.match(prototypeSource, /clearTransientTimers\(\);[\s\S]*?setGame\(createDemoState\(\)\)/);
  assert.match(prototypeSource, /useEffect\(\(\) => \(\) => \{[\s\S]*?clearTransientTimers\(\)/);
});

// Catches the P1 race where an older 520ms invalid/pouring callback clears a newer
// feedback window. The source contract is intentional because this prototype has no
// React timer harness: it verifies cancellation and registry removal, not a helper name.
test('latest invalid and pouring feedback windows cancel their prior timer before scheduling a replacement', () => {
  assert.match(prototypeSource, /const latestTransientTimers = useRef\(new Map<LatestTransientChannel, number>\(\)\);/);
  assert.match(
    prototypeSource,
    /const previousTimer = latestTransientTimers\.current\.get\(channel\);[\s\S]*?if \(previousTimer !== undefined\) \{[\s\S]*?window\.clearTimeout\(previousTimer\);[\s\S]*?transientTimers\.current\.delete\(previousTimer\);[\s\S]*?\}/,
  );
  assert.match(
    prototypeSource,
    /if \(latestTransientTimers\.current\.get\(channel\) !== timer\) return;[\s\S]*?latestTransientTimers\.current\.delete\(channel\);[\s\S]*?callback\(\);/,
  );
  assert.match(prototypeSource, /latestTransientTimers\.current\.clear\(\);/);
  assert.match(prototypeSource, /scheduleLatestTransient\("invalid", \(\) => setInvalid\(new Set\(\)\), 520\)/);
  assert.match(prototypeSource, /scheduleLatestTransient\("pouring", \(\) => setPouring\(new Set\(\)\), 520\)/);
  assert.match(prototypeSource, /scheduleTransient\(\(\) => \{[\s\S]*?vanishBottle\(state, bottleIndex\)[\s\S]*?\}, 1080\)/);
});

// Catches interaction copy and state regressions that otherwise make the witch
// feedback disagree with the actual engine outcome or reuse a stale message panel.
test('game interactions announce exact copy with a fresh message id and reserve slot fourteen for the reward', () => {
  for (const message of [
    '法杖已锁定，再点目标瓶',
    '空瓶不能作为起点',
    '只能倒入空瓶或同色药液',
    '魔药合成成功！',
    '广告奖励完成，空瓶已加入',
  ]) {
    assert.match(prototypeSource, new RegExp(message));
  }
  assert.match(prototypeSource, /const messageSequence = useRef\(0\);/);
  assert.match(prototypeSource, /messageSequence\.current \+= 1;[\s\S]*?setMessage\(\{ id: messageSequence\.current, text \}\)/);
  assert.match(prototypeSource, /const REWARD_SLOT_INDEX = 14;/);
  assert.match(prototypeSource, /game\.bottles\[REWARD_SLOT_INDEX\]/);
  assert.match(prototypeSource, /<GameMessage message=\{message\} \/>/);
});

// Catches returning to the obsolete flat assets after the component integration.
test('level shell uses the approved room backdrop and excludes obsolete art URLs', () => {
  assert.match(cssSource, /\/assets\/game\/chibi\/background\/alchemy-room\.png/);
  assert.doesNotMatch(prototypeSource, /\/assets\/game\/witch-(idle|cast|celebrate)\.png/);
  assert.doesNotMatch(prototypeSource, /\/assets\/game\/bottle-frame\.png/);
  assert.doesNotMatch(cssSource, /\/assets\/game\/alchemy-lab-bg\.png/);
});

// Catches the scene-default mutation `home -> level` and a disconnected home
// action. Both scenes must share the same top-level level state instead of
// constructing a new game when the player continues.
test('scene starts on home and continue enters the retained level', () => {
  assert.match(prototypeSource, /const \[scene, setScene\] = useState<"home" \| "level">\("home"\);/);
  assert.match(prototypeSource, /import\s+\{\s*HomeScene\s*\}\s+from\s+["']\.\/components\/HomeScene["']/);
  assert.match(
    prototypeSource,
    /scene === "home"[\s\S]*?<HomeScene[\s\S]*?completedCount=\{completedCount\}[\s\S]*?onContinue=\{\(\) => \{[\s\S]*?audio\.unlockFromGesture\(\);[\s\S]*?setScene\("level"\);[\s\S]*?\}\}/,
  );
  assert.equal((prototypeSource.match(/useState<GameState>\(\(\) => createDemoState\(\)\)/g) ?? []).length, 1);
});

// Catches the return-home mutation that calls restart or clears top-level state.
// The handler is deliberately constrained to a scene change so bottles, moves,
// completion, reward state, selection, and undo history remain owned by Prototype.
test('returning home only changes scene and preserves all level state owners', () => {
  const returnHomeHandler = prototypeSource.match(
    /onReturnHome=\{\(\) => \{([\s\S]*?)\}\}/,
  )?.[1] ?? '';
  const sceneEffect = prototypeSource.match(
    /useEffect\(\(\) => \{([\s\S]*?)\}, \[scene\]\);/,
  )?.[1] ?? '';

  assert.match(returnHomeHandler, /setScene\("home"\);/);
  assert.doesNotMatch(
    returnHomeHandler,
    /handleRestart|createDemoState|clearTransientTimers|setGame|setHistory|setSelected|setPouring|setDeparting|setInvalid/,
  );
  assert.doesNotMatch(
    sceneEffect,
    /handleRestart|createDemoState|clearTransientTimers|setGame|setHistory|setSelected|setPouring|setDeparting|setInvalid/,
  );
  for (const owner of ['game', 'history', 'selected']) {
    assert.match(prototypeSource, new RegExp(`const \\[${owner}, set${owner[0].toUpperCase()}${owner.slice(1)}\\] = useState`));
  }
  assert.match(prototypeSource, /<HomeScene[\s\S]*?completedCount=\{completedCount\}/);
  assert.match(prototypeSource, /步数 \{game\.moves\}/);
});

// Catches regressions that map settings to the obsolete independent switches,
// skip gesture unlock, or stack gameplay cues on top of the settings-only tap.
test('home and level settings use the atomic sound controller and settings-only ui tap', () => {
  const homeBranchStart = prototypeSource.indexOf('{scene === "home"');
  const levelBranchStart = prototypeSource.indexOf(') : (', homeBranchStart);
  const renderEnd = prototypeSource.indexOf('</MobileScroll>', levelBranchStart);
  assert.notEqual(homeBranchStart, -1);
  assert.notEqual(levelBranchStart, -1);
  assert.notEqual(renderEnd, -1);
  const homeBranch = prototypeSource.slice(homeBranchStart, levelBranchStart);
  const levelBranch = prototypeSource.slice(levelBranchStart, renderEnd);

  assert.match(prototypeSource, /import\s+\{\s*GameSettings\s*\}\s+from\s+["']\.\/components\/GameSettings["']/);
  assert.match(prototypeSource, /const audio = useGameAudio\(\);/);
  assert.match(homeBranch, /<GameSettings[\s\S]*?soundEnabled=\{audio\.soundEnabled\}[\s\S]*?canReturnHome=\{false\}[\s\S]*?onSoundChange=\{audio\.setSoundEnabled\}[\s\S]*?onReturnHome=\{\(\) => undefined\}/);
  assert.match(levelBranch, /<GameSettings[\s\S]*?soundEnabled=\{audio\.soundEnabled\}[\s\S]*?\n\s*canReturnHome\s*\n[\s\S]*?onSoundChange=\{audio\.setSoundEnabled\}[\s\S]*?onReturnHome=\{\(\) => \{\s*setScene\("home"\);\s*\}\}/);
  for (const branch of [homeBranch, levelBranch]) {
    assert.match(
      branch,
      /onUiPress=\{\(\) => \{\s*audio\.unlockFromGesture\(\);\s*playGameAudio\("ui-pressed"\);\s*\}\}/,
    );
  }
  assert.doesNotMatch(prototypeSource, /<AudioSettings|onMusicChange|onSfxChange/);
  assert.equal((prototypeSource.match(/soundEnabled=\{audio\.soundEnabled\}/g) ?? []).length, 2);
  assert.equal((prototypeSource.match(/onSoundChange=\{audio\.setSoundEnabled\}/g) ?? []).length, 2);
  assert.equal((prototypeSource.match(/playGameAudio\("ui-pressed"\)/g) ?? []).length, 2);
});

// Catches wrong or eager bottle cues. Every cue is asserted inside the existing
// confirmed result branch so rejected/inactive operations cannot sound successful.
test('bottle result branches unlock first and emit their dedicated audio cues', () => {
  assert.match(
    prototypeSource,
    /if \(!bottle \|\| bottle\.status !== "active"\) return;\s*audio\.unlockFromGesture\(\);/,
  );
  assert.match(prototypeSource, /if \(bottle\.layers\.length === 0\) \{[\s\S]*?playGameAudio\("pour-invalid"\);[\s\S]*?return;/);
  assert.match(prototypeSource, /setSelected\(index\);[\s\S]*?playGameAudio\("bottle-selected"\);[\s\S]*?return;/);
  assert.match(prototypeSource, /if \(selected === index\) \{[\s\S]*?playGameAudio\("bottle-deselected"\);[\s\S]*?return;/);
  assert.match(prototypeSource, /if \(result\.moved === 0\) \{[\s\S]*?playGameAudio\("pour-invalid"\);[\s\S]*?return;/);
  assert.match(prototypeSource, /setGame\(result\.state\);[\s\S]*?playGameAudio\("pour-valid"\);/);
});

// Catches the vanish-delay mutation `300 -> 0` while separately preserving the
// established 1080ms state disappearance. Restart/unmount share the timer registry.
test('completed potion plays immediately then schedules vanish audio at 300ms', () => {
  assert.match(
    prototypeSource,
    /if \(result\.completed\.length > 0\) \{[\s\S]*?playGameAudio\("potion-completed"\);[\s\S]*?scheduleTransient\(\(\) => playGameAudio\("potion-vanish"\), 300\);/,
  );
  assert.match(prototypeSource, /scheduleTransient\(\(\) => \{[\s\S]*?vanishBottle\(state, bottleIndex\)[\s\S]*?\}, 1080\);/);
  assert.match(prototypeSource, /clearTransientTimers\(\);[\s\S]*?setGame\(createDemoState\(\)\)/);
  assert.match(prototypeSource, /useEffect\(\(\) => \(\) => \{[\s\S]*?clearTransientTimers\(\)/);
});

// Catches a missing success gate or generic ui.tap replacement on controls.
test('successful undo restart and reward actions emit dedicated cues after unlock', () => {
  assert.match(prototypeSource, /const handleUndo[\s\S]*?if \(!previous \|\| departing\.size > 0\) return;[\s\S]*?audio\.unlockFromGesture\(\);[\s\S]*?playGameAudio\("undo-succeeded"\);/);
  assert.match(prototypeSource, /const handleRestart[\s\S]*?audio\.unlockFromGesture\(\);[\s\S]*?playGameAudio\("restart-succeeded"\);/);
  assert.match(prototypeSource, /const handleRewardBottle[\s\S]*?if \(game\.rewardBottleUsed \|\| departing\.size > 0 \|\| rewardSlot\?\.status !== "reserved"\) return;[\s\S]*?audio\.unlockFromGesture\(\);[\s\S]*?playGameAudio\("reward-bottle-granted"\);/);
});
