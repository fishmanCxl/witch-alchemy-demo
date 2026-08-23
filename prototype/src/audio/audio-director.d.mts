import type { AudioCue as AudioCueDefinition, AudioCueId, AudioPreferences } from './audio-cues.mjs';

export interface AudioVoice {
  readonly id: string;
  setGain(gain: number, durationMs: number): void;
  stop(durationMs: number): void;
}

export interface AudioDriver {
  unlock(): Promise<void>;
  preload(cueIds: readonly AudioCueId[]): Promise<void>;
  play(cue: AudioCueDefinition, onEnded: () => void): Promise<AudioVoice | null>;
  setTrackGain(track: 'music' | 'sfx', gain: number, durationMs: number): void;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  dispose(): void;
}

export interface CreateAudioDirectorOptions {
  readonly driver: AudioDriver;
  readonly now?: () => number;
  readonly setTimer?: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimer?: (timer: unknown) => void;
  readonly initialPreferences?: AudioPreferences;
}

export interface AudioDirector {
  unlock(): Promise<void>;
  preload(cueIds?: readonly AudioCueId[]): Promise<void>;
  play(id: AudioCueId): void;
  startBgm(): void;
  setMusicEnabled(enabled: boolean): void;
  setSfxEnabled(enabled: boolean): void;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  getPreferences(): AudioPreferences;
  dispose(): void;
}

export declare function createAudioDirector(options: CreateAudioDirectorOptions): AudioDirector;
