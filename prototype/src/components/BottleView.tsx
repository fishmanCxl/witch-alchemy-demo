import type { CSSProperties } from "react";

import type { Bottle } from "../game/engine.mjs";
import { bottleVisualModel, POTION_VISUALS, type PotionColor } from "../game/presentation.mjs";
import { PotionParticles } from "./PotionParticles";

interface BottleViewProps {
  bottle: Bottle;
  index: number;
  levelSeed: number;
  selected: boolean;
  pouring: boolean;
  departing: boolean;
  invalid: boolean;
  onPress: (index: number) => void;
}

export function BottleView({
  bottle,
  index,
  levelSeed,
  selected,
  pouring,
  departing,
  invalid,
  onPress,
}: BottleViewProps) {
  const model = bottleVisualModel({
    bottle,
    levelSeed,
    slotIndex: index,
    selected,
    pouring,
    invalid,
    departing,
  });

  if (!model.rendersBottle) {
    return <div className="bottle-slot" aria-hidden="true" />;
  }

  const className = [
    "potion-bottle",
    model.state.selected ? "is-selected" : "",
    model.state.departing ? "is-departing" : "",
    model.state.invalid ? "is-invalid" : "",
  ].filter(Boolean).join(" ");
  const particleState = model.state.departing ? "complete" : model.state.pouring ? "pouring" : model.state.selected ? "selected" : "idle";
  const poseStyle = {
    "--pose-x": `${model.pose.x}px`,
    "--pose-y": `${model.pose.y}px`,
    "--pose-rotate": `${model.pose.rotate}deg`,
  } as CSSProperties;

  return (
    <button
      className="bottle-slot"
      type="button"
      aria-label={`药瓶 ${index + 1}${model.layers.length === 0 ? "，空瓶" : ""}`}
      aria-pressed={model.state.selected}
      disabled={model.state.departing}
      onClick={() => onPress(index)}
    >
      <span className={className} data-testid={`bottle-${index}`} style={poseStyle}>
        <span className="liquid-stack" aria-hidden="true">
          {model.layers.map(({ color, particleSeeds }, layerIndex) => (
            <span
              className="liquid-layer"
              key={`${color}-${layerIndex}`}
              style={{ backgroundColor: POTION_VISUALS[color as PotionColor]?.color }}
            >
              <PotionParticles color={color} state={particleState} seeds={particleSeeds} />
            </span>
          ))}
        </span>
        {model.state.departing && (
          <img
            className="completion-burst"
            src="/assets/game/chibi/effects/completion-burst.png"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        )}
        <img className="bottle-frame" src="/assets/game/chibi/items/bottle-frame.png" alt="" draggable={false} />
      </span>
    </button>
  );
}
