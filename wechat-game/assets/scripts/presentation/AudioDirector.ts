import { _decorator, AudioClip, AudioSource, Component, Node, resources } from 'cc';

import type { GameCue } from '../core/game-session.ts';

const { ccclass } = _decorator;

@ccclass('AudioDirector')
export class AudioDirector extends Component {
  private enabled = true;
  private unlocked = false;
  private foreground = true;
  private bgm: AudioSource | null = null;
  private clips = new Map<GameCue, AudioClip>();

  initialize(enabled: boolean): void {
    this.enabled = enabled;
    const bgmNode = new Node('BgmAudio');
    this.node.addChild(bgmNode);
    this.bgm = bgmNode.addComponent(AudioSource);
    this.bgm.loop = true;
    this.bgm.volume = 0.34;
    resources.load('game/audio/bgm/alchemy-room-loop', AudioClip, (error, clip) => {
      if (error || !this.bgm) return;
      this.bgm.clip = clip;
      this.syncBgm();
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.syncBgm();
  }

  unlockFromGesture(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.syncBgm();
  }

  setForeground(foreground: boolean): void {
    this.foreground = foreground;
    this.syncBgm();
  }

  play(cue: GameCue | null): void {
    if (!cue || !this.enabled || !this.unlocked || !this.foreground) return;
    const cached = this.clips.get(cue);
    if (cached) {
      this.playClip(cached);
      return;
    }

    resources.load(`game/audio/sfx/${cue}`, AudioClip, (error, clip) => {
      if (error || !this.enabled) return;
      this.clips.set(cue, clip);
      this.playClip(clip);
    });
  }

  private playClip(clip: AudioClip): void {
    const node = new Node(`Sfx-${clip.name}`);
    this.node.addChild(node);
    const source = node.addComponent(AudioSource);
    source.clip = clip;
    source.volume = 0.78;
    source.play();
    this.scheduleOnce(() => node.isValid && node.destroy(), Math.max(0.5, clip.getDuration() + 0.1));
  }

  private syncBgm(): void {
    if (!this.bgm?.clip) return;
    if (!this.unlocked) return;
    if (this.enabled && this.foreground) {
      if (!this.bgm.playing) this.bgm.play();
    } else {
      this.bgm.stop();
    }
  }
}
