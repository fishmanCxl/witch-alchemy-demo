export type AudioTrack = 'music' | 'sfx';

export type AudioCueId =
  | 'bgm.alchemy_room'
  | 'ui.tap'
  | 'bottle.select'
  | 'bottle.deselect'
  | 'pour.valid'
  | 'pour.invalid'
  | 'potion.complete'
  | 'potion.vanish'
  | 'history.undo'
  | 'level.restart'
  | 'reward.empty_bottle';

export type GameAudioEvent =
  | 'ui-pressed'
  | 'bottle-selected'
  | 'bottle-deselected'
  | 'pour-valid'
  | 'pour-invalid'
  | 'potion-completed'
  | 'potion-vanish'
  | 'undo-succeeded'
  | 'restart-succeeded'
  | 'reward-bottle-granted';

export interface AudioCue {
  readonly id: AudioCueId;
  readonly track: AudioTrack;
  readonly url: string;
  readonly gain: number;
  readonly cooldownMs: number;
  readonly maxVoices: number;
  readonly priority: number;
  readonly loop: boolean;
  readonly duckMusic: boolean;
  readonly loopStartMs?: number;
  readonly loopEndMs?: number;
}

export interface AudioPreferences {
  readonly musicEnabled: boolean;
  readonly sfxEnabled: boolean;
}

export declare const AUDIO_PREFERENCES_KEY: 'witch-water-sort.audio.v1';
export declare const DEFAULT_TRACK_GAINS: Readonly<{
  readonly music: 0.36;
  readonly sfx: 0.78;
}>;
export declare const DEFAULT_AUDIO_PREFERENCES: Readonly<AudioPreferences>;
export declare const AUDIO_CUES: Readonly<Record<AudioCueId, AudioCue>>;
export declare const GAME_AUDIO_EVENT_TO_CUE: Readonly<Record<GameAudioEvent, AudioCueId>>;
export declare function gameAudioCue(event: GameAudioEvent): AudioCueId;
export declare function parseAudioPreferences(raw: unknown): AudioPreferences;
export declare function serializeAudioPreferences(value: unknown): string;
