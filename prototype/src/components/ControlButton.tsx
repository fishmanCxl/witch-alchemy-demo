import { useState, type PointerEvent } from "react";

import { controlAssetUrl } from "../game/presentation.mjs";

type ControlVariant = "purple" | "gold";

interface ControlButtonProps {
  variant: ControlVariant;
  iconUrl: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
  showAddBadge?: boolean;
}

export function ControlButton({
  variant,
  iconUrl,
  label,
  disabled = false,
  onPress,
  showAddBadge = false,
}: ControlButtonProps) {
  const [pressed, setPressed] = useState(false);
  const state = disabled ? "disabled" : pressed ? "pressed" : "normal";

  const clearPressed = (event: PointerEvent<HTMLButtonElement>) => {
    setPressed(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressed(true);
  };

  return (
    <button
      className={`chibi-control-button ${showAddBadge ? "chibi-control-has-add-badge" : ""}`}
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      onPointerDown={handlePointerDown}
      onPointerUp={clearPressed}
      onPointerCancel={clearPressed}
      onLostPointerCapture={clearPressed}
    >
      <img className="chibi-control-base" src={controlAssetUrl(variant, state)} alt="" draggable={false} />
      <img className="chibi-control-icon" src={iconUrl} alt="" draggable={false} />
      {showAddBadge && (
        <img className="chibi-control-badge" src="/assets/game/chibi/ui/badge-plus.png" alt="" draggable={false} />
      )}
      <span className="chibi-control-label">{label}</span>
    </button>
  );
}
