import { _decorator, Color, Component, Sprite, Vec3 } from 'cc';

import {
  potionParticleFrame,
  type PotionParticleState,
  type PotionParticleVisual,
} from './presentation-layout.ts';

const { ccclass } = _decorator;

@ccclass('PotionParticleAnimator')
export class PotionParticleAnimator extends Component {
  private visual: PotionParticleVisual | null = null;
  private state: PotionParticleState = 'idle';
  private sprite: Sprite | null = null;
  private elapsed = 0;

  configure(visual: PotionParticleVisual, state: PotionParticleState, sprite: Sprite): void {
    this.visual = visual;
    this.state = state;
    this.sprite = sprite;
    this.elapsed = 0;
    this.applyFrame();
  }

  setState(state: PotionParticleState): void {
    if (state === this.state) return;
    this.state = state;
    this.elapsed = 0;
    this.applyFrame();
  }

  update(deltaTime: number): void {
    this.elapsed += Math.max(0, deltaTime);
    this.applyFrame();
  }

  private applyFrame(): void {
    if (!this.visual || !this.sprite || !this.node.isValid) return;
    const frame = potionParticleFrame(this.visual, this.state, this.elapsed);
    this.node.setPosition(frame.x, frame.y);
    this.node.setScale(new Vec3(frame.scale, frame.scale, 1));
    this.sprite.color = new Color(255, 255, 255, Math.round(frame.opacity * 255));
  }
}
