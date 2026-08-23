import type { CSSProperties } from "react";

import { POTION_VISUALS, type PotionColor } from "../game/presentation.mjs";

type ParticleState = "idle" | "selected" | "pouring" | "complete";

interface Props {
  color: string;
  state: ParticleState;
  seeds: readonly number[];
}

export function PotionParticles({ color, state, seeds }: Props) {
  const visual = POTION_VISUALS[color as PotionColor];

  if (!visual) return null;

  return (
    <span className={`potion-particles is-${state}`} aria-hidden="true">
      {seeds.slice(0, 2).map((seed, index) => (
        <img
          key={index}
          src={visual.particleUrl}
          alt=""
          draggable={false}
          style={{
            "--particle-x": `${18 + seed * 64}%`,
            "--particle-delay": `${-seed * 1.4}s`,
          } as CSSProperties}
        />
      ))}
    </span>
  );
}
