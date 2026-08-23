import { useEffect, useState } from "react";

import {
  createMessagePlayback,
  messagePanelUrl,
  messagePhase,
  replaceMessagePlayback,
  type MessagePhase,
  type MessagePlayback,
} from "../game/presentation.mjs";

interface GameMessageProps {
  message: { id: number; text: string };
}

function isReducedMotionPreferred() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function nextPhaseBoundary(playback: MessagePlayback, elapsed: number) {
  const boundaries = playback.phase === "replace" ? [120, 1520, 1760] : [180, 1580, 1820];
  return boundaries.find((boundary) => boundary > elapsed) ?? null;
}

export function GameMessage({ message }: GameMessageProps) {
  const [playback, setPlayback] = useState<MessagePlayback>(() => createMessagePlayback(message.id, message.text, performance.now()));
  const [phase, setPhase] = useState<MessagePhase>("enter");
  const [reducedMotion, setReducedMotion] = useState(isReducedMotionPreferred);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    setPlayback((previous) => (
      previous.id === message.id
        ? previous
        : replaceMessagePlayback(previous, message.id, message.text, performance.now())
    ));
  }, [message.id, message.text]);

  useEffect(() => {
    if (reducedMotion) {
      setPhase("hold");
      return;
    }

    let timeout = 0;
    const updatePhase = () => {
      const elapsed = Math.max(0, performance.now() - playback.startedAt);
      setPhase(messagePhase(playback.startedAt, playback.startedAt + elapsed, playback.phase));

      const boundary = nextPhaseBoundary(playback, elapsed);
      if (boundary !== null) {
        timeout = window.setTimeout(updatePhase, Math.max(0, boundary - elapsed));
      }
    };

    updatePhase();
    return () => window.clearTimeout(timeout);
  }, [playback, reducedMotion]);

  return (
    <div
      className={`game-message is-${reducedMotion ? "hold" : phase}`}
      role="status"
      aria-live="polite"
      style={{ backgroundImage: `url(${messagePanelUrl()})` }}
    >
      <span key={message.id} className="game-message-text">{message.text}</span>
    </div>
  );
}
