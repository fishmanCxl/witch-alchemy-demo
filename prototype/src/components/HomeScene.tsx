import type { ReactNode } from "react";

import { WitchAnimator } from "./WitchAnimator";

interface HomeSceneProps {
  completedCount: number;
  onContinue(): void;
  settings: ReactNode;
}

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
