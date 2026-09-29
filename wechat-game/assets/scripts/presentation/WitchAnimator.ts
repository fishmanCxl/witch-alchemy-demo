import { _decorator, Component, Node, resources, Sprite, SpriteFrame, UITransform } from 'cc';

import type { WitchMood } from '../core/game-session.ts';
import { squareBottomFit } from './presentation-layout.ts';

const { ccclass } = _decorator;

interface AnimationSpec {
  readonly frames: number;
  readonly durationMs: number;
  readonly loop: boolean;
}

const ANIMATIONS: Record<WitchMood, AnimationSpec> = {
  idle: { frames: 18, durationMs: 3600, loop: true },
  prepare: { frames: 12, durationMs: 720, loop: false },
  raise: { frames: 12, durationMs: 720, loop: false },
  cast: { frames: 20, durationMs: 1200, loop: false },
  celebrate: { frames: 14, durationMs: 1120, loop: false },
  return: { frames: 18, durationMs: 1080, loop: false },
  oops: { frames: 12, durationMs: 960, loop: false },
};

@ccclass('WitchAnimator')
export class WitchAnimator extends Component {
  private character: Sprite | null = null;
  private magic: Sprite | null = null;
  private playToken = 0;
  private tick: (() => void) | null = null;
  private static frameCache = new Map<string, Promise<readonly SpriteFrame[]>>();

  static async preloadPourFrames(): Promise<void> {
    for (const mood of ['cast', 'celebrate'] as const) {
      const count = ANIMATIONS[mood].frames;
      await Promise.all([
        WitchAnimator.loadFrames(`game/chibi/character/${mood}/${mood}`, count),
        WitchAnimator.loadFrames(`game/chibi/effects/witch-magic/${mood}/${mood}`, count),
      ]);
    }
  }

  onLoad(): void {
    const stage = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    if (stage.width <= 0 || stage.height <= 0) stage.setContentSize(184, 184);
    const fit = squareBottomFit({ x: 0, y: 0, width: stage.width, height: stage.height });

    const characterNode = new Node('WitchCharacter');
    characterNode.setPosition(0, fit.y);
    characterNode.addComponent(UITransform).setContentSize(fit.width, fit.height);
    this.node.addChild(characterNode);
    this.character = characterNode.addComponent(Sprite);
    this.character.sizeMode = Sprite.SizeMode.CUSTOM;
    this.character.trim = false;

    const magicNode = new Node('WitchMagic');
    magicNode.setPosition(0, fit.y);
    magicNode.addComponent(UITransform).setContentSize(fit.width, fit.height);
    this.node.addChild(magicNode);
    this.magic = magicNode.addComponent(Sprite);
    this.magic.sizeMode = Sprite.SizeMode.CUSTOM;
    this.magic.trim = false;
  }

  play(mood: WitchMood, onSettled: () => void): void {
    this.playToken += 1;
    const token = this.playToken;
    if (this.tick) this.unschedule(this.tick);
    this.tick = null;
    if (this.magic) this.magic.spriteFrame = null;

    const spec = ANIMATIONS[mood];
    Promise.all([
      WitchAnimator.loadFrames(`game/chibi/character/${mood}/${mood}`, spec.frames),
      mood === 'cast' || mood === 'celebrate'
        ? WitchAnimator.loadFrames(`game/chibi/effects/witch-magic/${mood}/${mood}`, spec.frames)
        : Promise.resolve([] as readonly SpriteFrame[]),
    ]).then(([frames, magicFrames]) => {
      if (token !== this.playToken || !this.character || frames.length === 0) return;
      let index = 0;
      const showFrame = (): void => {
        this.character!.spriteFrame = frames[index] ?? frames.at(-1) ?? null;
        if (this.magic) this.magic.spriteFrame = magicFrames[index] ?? null;
      };
      showFrame();

      this.tick = () => {
        index += 1;
        if (index >= frames.length) {
          if (spec.loop) {
            index = 0;
          } else {
            if (this.tick) this.unschedule(this.tick);
            this.tick = null;
            if (mood !== 'raise') onSettled();
            return;
          }
        }
        showFrame();
      };
      this.schedule(this.tick, spec.durationMs / spec.frames / 1000);
    }).catch(() => undefined);
  }

  private static loadFrames(prefix: string, count: number): Promise<readonly SpriteFrame[]> {
    const key = `${prefix}:${count}`;
    const cached = WitchAnimator.frameCache.get(key);
    if (cached) return cached;

    const loading = Promise.all(Array.from({ length: count }, (_, index) => new Promise<SpriteFrame>((resolve, reject) => {
      const frameName = String(index).padStart(2, '0');
      resources.load(`${prefix}-${frameName}/spriteFrame`, SpriteFrame, (error, frame) => {
        if (error) reject(error);
        else resolve(frame);
      });
    }))).catch((error) => {
      WitchAnimator.frameCache.delete(key);
      throw error;
    });
    WitchAnimator.frameCache.set(key, loading);
    return loading;
  }
}
