import { useEffect, useRef, useState } from "react";

import {
  WITCH_ANIMATIONS,
  createWitchPlayback,
  requestWitchPlayback,
  witchFrameAt,
  witchFrameUrl,
  witchMagicFrameUrl,
  type WitchMagicMood,
  type WitchMood,
  type WitchPlayback,
} from "../game/presentation.mjs";

interface Props {
  mood: WitchMood;
  onSettled: () => void;
}

function isReducedMotionPreferred() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isMagicMood(mood: WitchMood): mood is WitchMagicMood {
  return mood === "cast" || mood === "celebrate";
}

export function WitchAnimator({ mood, onSettled }: Props) {
  const [playback, setPlayback] = useState<WitchPlayback>(() => createWitchPlayback(mood, performance.now()));
  const [frame, setFrame] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(isReducedMotionPreferred);
  const [failedFrameUrl, setFailedFrameUrl] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const lastGoodFrameUrl = useRef(witchFrameUrl(mood, 0));
  const onSettledRef = useRef(onSettled);
  const settledPlayback = useRef<number | null>(null);

  onSettledRef.current = onSettled;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const now = performance.now();
    const request = requestWitchPlayback(playback, mood, now);

    if (request.playback !== playback) {
      setFrame(request.frame ?? 0);
      setPlayback(request.playback);
      return;
    }

    if (request.retryAt === null) return;

    const retryDelay = Math.max(0, request.retryAt - now);
    const timeout = window.setTimeout(() => setRetryTick((current) => current + 1), retryDelay);
    return () => window.clearTimeout(timeout);
  }, [mood, playback, retryTick]);

  useEffect(() => {
    const animation = WITCH_ANIMATIONS[playback.mood];

    for (let index = 0; index < animation.frames; index += 1) {
      const image = new Image();
      image.src = witchFrameUrl(playback.mood, index);
      if (isMagicMood(playback.mood)) {
        const magicImage = new Image();
        magicImage.src = witchMagicFrameUrl(playback.mood, index);
      }
    }
  }, [playback.mood]);

  useEffect(() => {
    const animation = WITCH_ANIMATIONS[playback.mood];
    const settle = () => {
      if (playback.mood === "idle" || settledPlayback.current === playback.startedAt) return;
      settledPlayback.current = playback.startedAt;
      onSettledRef.current();
    };

    if (reducedMotion) {
      setFrame(playback.mood === "idle" ? 0 : animation.frames - 1);
      settle();
      return;
    }

    let request = 0;
    const tick = (now: number) => {
      const result = witchFrameAt(playback, now);
      setFrame((current) => (current === result.index ? current : result.index));

      if (result.done) {
        settle();
        return;
      }

      request = requestAnimationFrame(tick);
    };

    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playback, reducedMotion]);

  const requestedSrc = witchFrameUrl(playback.mood, frame);
  const src = failedFrameUrl === requestedSrc ? lastGoodFrameUrl.current : requestedSrc;

  return (
    <section className={`witch-stage mood-${playback.mood}`} aria-label="魔女助手">
      <img
        className="witch-frame"
        src={src}
        alt="正在协助炼金的魔女"
        draggable={false}
        onLoad={(event) => {
          if (event.currentTarget.getAttribute("src") !== requestedSrc) return;
          lastGoodFrameUrl.current = requestedSrc;
          setFailedFrameUrl((current) => (current === requestedSrc ? null : current));
        }}
        onError={(event) => {
          if (event.currentTarget.getAttribute("src") === requestedSrc) {
            setFailedFrameUrl(requestedSrc);
          }
        }}
      />
      {isMagicMood(playback.mood) ? (
        <img
          className="witch-magic-frame"
          src={witchMagicFrameUrl(playback.mood, frame)}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      ) : null}
      <span className="witch-shadow" aria-hidden="true" />
    </section>
  );
}
