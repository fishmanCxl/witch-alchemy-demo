import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

const SETTINGS_GEAR_ICON = "/assets/game/chibi/ui/icon-settings-gear.png";
const SETTINGS_CLOSE_ICON = "/assets/game/chibi/ui/icon-settings-close.png";
const SETTINGS_HOME_ICON = "/assets/game/chibi/ui/icon-settings-home.png";
const SOUND_ON_ICON = "/assets/game/chibi/ui/icon-audio-settings.png";
const SOUND_OFF_ICON = "/assets/game/chibi/ui/icon-sfx-off.png";
const EXIT_DURATION_MS = 160;

interface GameSettingsProps {
  soundEnabled: boolean;
  canReturnHome: boolean;
  onSoundChange(enabled: boolean): void;
  onReturnHome(): void;
  onUiPress(): void;
}

export function GameSettings({
  soundEnabled,
  canReturnHome,
  onSoundChange,
  onReturnHome,
  onUiPress,
}: GameSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const savedTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const exitTimerRef = useRef<number | null>(null);

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current === null) return;
    window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = null;
  }, []);

  const openDialog = useCallback(() => {
    clearExitTimer();
    savedTriggerRef.current = triggerRef.current;
    const host = triggerRef.current?.closest(".alchemy-screen");
    setPortalHost(host instanceof HTMLElement ? host : document.body);
    setIsMounted(true);
    setIsExiting(false);
    setIsOpen(true);
  }, [clearExitTimer]);

  const closeDialog = useCallback((restoreFocus = true) => {
    clearExitTimer();
    setIsOpen(false);
    setIsExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      setIsMounted(false);
      setIsExiting(false);
      setPortalHost(null);
      exitTimerRef.current = null;
      if (restoreFocus) {
        window.requestAnimationFrame(() => savedTriggerRef.current?.focus());
      }
    }, EXIT_DURATION_MS);
  }, [clearExitTimer]);

  useEffect(() => clearExitTimer, [clearExitTimer]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog(true);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDialog, isOpen]);

  const handleTrigger = () => {
    onUiPress();
    if (isOpen) closeDialog(true);
    else openDialog();
  };

  const handleMaskPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || isExiting) return;
    onUiPress();
    closeDialog(true);
  };

  const layer = isMounted ? (
    <div
      className={`game-settings-layer ${isExiting ? "is-exiting" : "is-entering"}`}
      onPointerDown={handleMaskPointerDown}
    >
      <div
        ref={dialogRef}
        id="game-settings-dialog"
        className="game-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-settings-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <h2 id="game-settings-title">设置</h2>
        <button
          className="game-settings-close"
          type="button"
          aria-label="关闭设置"
          disabled={isExiting}
          onClick={() => {
            onUiPress();
            closeDialog(true);
          }}
        >
          <img src={SETTINGS_CLOSE_ICON} alt="" draggable={false} />
        </button>
        <button
          className="game-settings-sound"
          type="button"
          aria-label={`声音：${soundEnabled ? "已开启" : "已关闭"}`}
          aria-pressed={soundEnabled}
          disabled={isExiting}
          onClick={() => {
            onUiPress();
            onSoundChange(!soundEnabled);
          }}
        >
          <img src={soundEnabled ? SOUND_ON_ICON : SOUND_OFF_ICON} alt="" draggable={false} />
          <span>声音</span>
          <strong>{soundEnabled ? "已开启" : "已关闭"}</strong>
        </button>
        {canReturnHome && (
          <button
            className="game-settings-home"
            type="button"
            disabled={isExiting}
            onClick={() => {
              onUiPress();
              closeDialog(false);
              onReturnHome();
            }}
          >
            <img src={SETTINGS_HOME_ICON} alt="" draggable={false} />
            <span>返回主页</span>
          </button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="game-settings">
      <button
        ref={triggerRef}
        className="game-settings-trigger"
        type="button"
        aria-label="打开设置"
        aria-expanded={isOpen}
        aria-controls="game-settings-dialog"
        onClick={handleTrigger}
      >
        <img src={SETTINGS_GEAR_ICON} alt="" draggable={false} />
      </button>
      {portalHost && layer ? createPortal(layer, portalHost) : layer}
    </div>
  );
}
