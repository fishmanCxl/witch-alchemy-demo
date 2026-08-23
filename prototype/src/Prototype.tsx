import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BottleView } from "./components/BottleView";
import { ControlButton } from "./components/ControlButton";
import { GameMessage } from "./components/GameMessage";
import { GameSettings } from "./components/GameSettings";
import { HomeScene } from "./components/HomeScene";
import { WitchAnimator } from "./components/WitchAnimator";
import { gameAudioCue, type GameAudioEvent } from "./audio/audio-cues.mjs";
import { useGameAudio } from "./audio/useGameAudio";
import {
  addRewardBottle,
  createDemoState,
  pour,
  vanishBottle,
  type GameState,
} from "./game/engine.mjs";
import type { WitchMood } from "./game/presentation.mjs";
import { MobileScroll } from "./mobile";

const LEVEL_SEED = 12;
const REWARD_SLOT_INDEX = 14;
type LatestTransientChannel = "invalid" | "pouring";

export default function Prototype() {
  const [scene, setScene] = useState<"home" | "level">("home");
  const [game, setGame] = useState<GameState>(() => createDemoState());
  const [history, setHistory] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [pouring, setPouring] = useState<Set<number>>(() => new Set());
  const [departing, setDeparting] = useState<Set<number>>(() => new Set());
  const [invalid, setInvalid] = useState<Set<number>>(() => new Set());
  const [witchMood, setWitchMood] = useState<WitchMood>("idle");
  const [message, setMessage] = useState({ id: 0, text: "选择一瓶，再选择目标瓶" });
  const idleTimer = useRef<number | undefined>(undefined);
  const transientTimers = useRef(new Set<number>());
  const latestTransientTimers = useRef(new Map<LatestTransientChannel, number>());
  const messageSequence = useRef(0);
  const audio = useGameAudio();
  const playGameAudio = useCallback((event: GameAudioEvent) => {
    audio.play(gameAudioCue(event));
  }, [audio]);

  const completedCount = useMemo(
    () => game.bottles.filter((bottle) => bottle.status === "vanished").length,
    [game.bottles],
  );

  const clearTransientTimers = useCallback(() => {
    transientTimers.current.forEach((timer) => window.clearTimeout(timer));
    transientTimers.current.clear();
    latestTransientTimers.current.clear();
  }, []);

  const scheduleTransient = useCallback((callback: () => void, duration: number) => {
    const timer = window.setTimeout(() => {
      transientTimers.current.delete(timer);
      callback();
    }, duration);
    transientTimers.current.add(timer);
  }, []);

  const scheduleLatestTransient = useCallback((
    channel: LatestTransientChannel,
    callback: () => void,
    duration: number,
  ) => {
    const previousTimer = latestTransientTimers.current.get(channel);
    if (previousTimer !== undefined) {
      window.clearTimeout(previousTimer);
      transientTimers.current.delete(previousTimer);
    }

    const timer = window.setTimeout(() => {
      transientTimers.current.delete(timer);
      if (latestTransientTimers.current.get(channel) !== timer) return;
      latestTransientTimers.current.delete(channel);
      callback();
    }, duration);

    transientTimers.current.add(timer);
    latestTransientTimers.current.set(channel, timer);
  }, []);

  const settleToIdle = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setWitchMood("return"), 1800);
  }, []);

  const announce = useCallback((text: string) => {
    messageSequence.current += 1;
    setMessage({ id: messageSequence.current, text });
  }, []);

  const requestWitchMood = useCallback((mood: WitchMood) => {
    setWitchMood(mood);
    settleToIdle();
  }, [settleToIdle]);

  const handleWitchSettled = useCallback(() => {
    switch (witchMood) {
      case "prepare":
        setWitchMood("raise");
        break;
      case "return":
        setWitchMood("idle");
        break;
      default:
        break;
    }
  }, [witchMood]);

  useEffect(() => () => {
    window.clearTimeout(idleTimer.current);
    clearTransientTimers();
  }, [clearTransientTimers]);

  const handleBottlePress = useCallback((index: number) => {
    if (departing.has(index)) return;
    const bottle = game.bottles[index];
    if (!bottle || bottle.status !== "active") return;
    audio.unlockFromGesture();

    if (selected === null) {
      if (bottle.layers.length === 0) {
        setInvalid(new Set([index]));
        requestWitchMood("oops");
        announce("空瓶不能作为起点");
        scheduleLatestTransient("invalid", () => setInvalid(new Set()), 520);
        playGameAudio("pour-invalid");
        return;
      }

      setSelected(index);
      requestWitchMood("prepare");
      announce("法杖已锁定，再点目标瓶");
      playGameAudio("bottle-selected");
      return;
    }

    if (selected === index) {
      setSelected(null);
      settleToIdle();
      announce("已取消选择");
      playGameAudio("bottle-deselected");
      return;
    }

    const result = pour(game, selected, index);
    if (result.moved === 0) {
      setInvalid(new Set([selected, index]));
      requestWitchMood("oops");
      announce("只能倒入空瓶或同色药液");
      scheduleLatestTransient("invalid", () => setInvalid(new Set()), 520);
      playGameAudio("pour-invalid");
      return;
    }

    setHistory((items) => [...items, game]);
    setGame(result.state);
    setSelected(null);
    setPouring(new Set([selected, index]));
    scheduleLatestTransient("pouring", () => setPouring(new Set()), 520);
    playGameAudio("pour-valid");

    if (result.completed.length > 0) {
      setDeparting((items) => new Set([...items, ...result.completed]));
      requestWitchMood("celebrate");
      announce("魔药合成成功！");
      playGameAudio("potion-completed");
      scheduleTransient(() => playGameAudio("potion-vanish"), 300);
      scheduleTransient(() => {
        setGame((current) => result.completed.reduce(
          (state, bottleIndex) => vanishBottle(state, bottleIndex),
          current,
        ));
        setDeparting((items) => {
          const next = new Set(items);
          result.completed.forEach((bottleIndex) => next.delete(bottleIndex));
          return next;
        });
      }, 1080);
      return;
    }

    requestWitchMood("cast");
    announce(`倒入 ${result.moved} 层药液`);
  }, [announce, audio, departing, game, playGameAudio, requestWitchMood, scheduleLatestTransient, scheduleTransient, selected, settleToIdle]);

  const handleUndo = useCallback(() => {
    const previous = history.at(-1);
    if (!previous || departing.size > 0) return;
    audio.unlockFromGesture();

    setGame(previous);
    setHistory((items) => items.slice(0, -1));
    setSelected(null);
    setPouring(new Set());
    setInvalid(new Set());
    requestWitchMood("cast");
    announce("已撤销上一步");
    playGameAudio("undo-succeeded");
  }, [announce, audio, departing.size, history, playGameAudio, requestWitchMood]);

  const handleRestart = useCallback(() => {
    audio.unlockFromGesture();
    window.clearTimeout(idleTimer.current);
    clearTransientTimers();
    setGame(createDemoState());
    setHistory([]);
    setSelected(null);
    setPouring(new Set());
    setDeparting(new Set());
    setInvalid(new Set());
    requestWitchMood("cast");
    announce("关卡已重新开始");
    playGameAudio("restart-succeeded");
  }, [announce, audio, clearTransientTimers, playGameAudio, requestWitchMood]);

  const handleRewardBottle = useCallback(() => {
    const rewardSlot = game.bottles[REWARD_SLOT_INDEX];
    if (game.rewardBottleUsed || departing.size > 0 || rewardSlot?.status !== "reserved") return;
    audio.unlockFromGesture();

    setHistory((items) => [...items, game]);
    setGame(addRewardBottle(game));
    setSelected(null);
    requestWitchMood("celebrate");
    announce("广告奖励完成，空瓶已加入");
    playGameAudio("reward-bottle-granted");
  }, [announce, audio, departing.size, game, playGameAudio, requestWitchMood]);

  return (
    <MobileScroll className="app-screen alchemy-scroll">
      {scene === "home" ? (
        <div className="alchemy-screen">
          <HomeScene
            completedCount={completedCount}
            onContinue={() => {
              audio.unlockFromGesture();
              setScene("level");
            }}
            settings={(
              <GameSettings
                soundEnabled={audio.soundEnabled}
                canReturnHome={false}
                onSoundChange={audio.setSoundEnabled}
                onReturnHome={() => undefined}
                onUiPress={() => {
                  audio.unlockFromGesture();
                  playGameAudio("ui-pressed");
                }}
              />
            )}
          />
        </div>
      ) : (
        <main className="alchemy-screen" aria-label="魔女炼金水排序关卡">
        <GameSettings
          soundEnabled={audio.soundEnabled}
          canReturnHome
          onSoundChange={audio.setSoundEnabled}
          onReturnHome={() => {
            setScene("home");
          }}
          onUiPress={() => {
            audio.unlockFromGesture();
            playGameAudio("ui-pressed");
          }}
        />
        <header className="level-header">
          <p className="chapter-label">暮影炼金室</p>
          <h1>第 12 关</h1>
          <div className="level-meta" aria-label={`步数 ${game.moves}，已完成 ${completedCount} 瓶`}>
            <span>步数 {game.moves}</span>
            <span>魔药 {completedCount}/8</span>
          </div>
        </header>

        <WitchAnimator mood={witchMood} onSettled={handleWitchSettled} />

        <section className="board-shell" aria-label="药瓶棋盘">
          <div className="bottle-grid" data-testid="bottle-grid">
            {game.bottles.map((bottle, index) => (
              <BottleView
                bottle={bottle}
                index={index}
                key={index}
                levelSeed={LEVEL_SEED}
                selected={selected === index}
                pouring={pouring.has(index)}
                departing={departing.has(index)}
                invalid={invalid.has(index)}
                onPress={handleBottlePress}
              />
            ))}
          </div>
        </section>

        <GameMessage message={message} />

        <nav className="game-controls" aria-label="关卡操作">
          <ControlButton
            variant="purple"
            iconUrl="/assets/game/chibi/ui/icon-undo.png"
            label="撤销"
            disabled={history.length === 0 || departing.size > 0}
            onPress={handleUndo}
          />
          <ControlButton
            variant="purple"
            iconUrl="/assets/game/chibi/ui/icon-restart.png"
            label="重来"
            onPress={handleRestart}
          />
          <ControlButton
            variant="gold"
            iconUrl="/assets/game/chibi/ui/icon-add-bottle.png"
            label={game.rewardBottleUsed ? "已加瓶" : "加空瓶"}
            disabled={game.rewardBottleUsed || departing.size > 0}
            showAddBadge
            onPress={handleRewardBottle}
          />
        </nav>
      </main>
      )}
    </MobileScroll>
  );
}
