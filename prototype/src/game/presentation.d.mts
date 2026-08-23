export type PotionColor = 'rose' | 'violet' | 'amber' | 'cyan' | 'mint' | 'blue' | 'gold' | 'lilac';
export type WitchMood = 'idle' | 'prepare' | 'raise' | 'cast' | 'celebrate' | 'return' | 'oops';
export type WitchMagicMood = 'cast' | 'celebrate';
export type MessagePhase = 'enter' | 'replace' | 'hold' | 'exit' | 'done';

export interface PotionVisual {
  readonly color: string;
  readonly particleUrl: string;
}

export interface WitchAnimation {
  readonly frames: number;
  readonly durationMs: number;
  readonly loop: boolean;
  readonly minInterruptMs?: number;
}

export interface BottlePose {
  readonly x: number;
  readonly y: number;
  readonly rotate: number;
}

export interface BottleVisualState {
  readonly selected: boolean;
  readonly pouring: boolean;
  readonly invalid: boolean;
  readonly departing: boolean;
}

export interface BottleVisualLayer {
  readonly color: string;
  readonly particleSeeds: readonly [number, number];
}

export interface BottleVisualModel {
  readonly slot: { readonly width: 64; readonly height: 112 };
  readonly rendersBottle: boolean;
  readonly pose: BottlePose;
  readonly state: BottleVisualState;
  readonly layers: readonly BottleVisualLayer[];
}

export interface BottleVisualInput {
  readonly bottle: { readonly status: string; readonly layers: readonly string[] };
  readonly levelSeed: number;
  readonly slotIndex: number;
  readonly selected?: boolean;
  readonly pouring?: boolean;
  readonly invalid?: boolean;
  readonly departing?: boolean;
}

export interface WitchPlayback {
  readonly mood: WitchMood;
  readonly startedAt: number;
}

export interface WitchFrame {
  readonly index: number;
  readonly done: boolean;
}

export interface WitchPlaybackRequest {
  readonly playback: WitchPlayback;
  readonly frame: number | null;
  readonly retryAt: number | null;
}

export interface MessagePlayback {
  readonly id: number;
  readonly text: string;
  readonly startedAt: number;
  readonly phase: 'enter' | 'replace';
}

export const POTION_VISUALS: Readonly<Record<PotionColor, PotionVisual>>;
export const WITCH_ANIMATIONS: Readonly<Record<WitchMood, WitchAnimation>>;

export function witchFrameUrl(mood: WitchMood, index: number): string;
export function witchMagicFrameUrl(mood: WitchMagicMood, index: number): string;
export function controlAssetUrl(variant: 'purple' | 'gold', state: 'normal' | 'pressed' | 'disabled'): string;
export function messagePanelUrl(): string;
export function seededBottlePose(levelSeed: number, slotIndex: number): BottlePose;
export function bottleVisualModel(input: BottleVisualInput): BottleVisualModel;
export function createWitchPlayback(mood: WitchMood, startedAt: number): WitchPlayback;
export function witchFrameAt(playback: WitchPlayback, now: number): WitchFrame;
export function canInterruptWitch(playback: WitchPlayback, nextMood: WitchMood, now: number): boolean;
export function requestWitchPlayback(playback: WitchPlayback, nextMood: WitchMood, now: number): WitchPlaybackRequest;
export function createMessagePlayback(id: number, text: string, startedAt: number): MessagePlayback;
export function replaceMessagePlayback(previous: MessagePlayback, id: number, text: string, startedAt: number): MessagePlayback;
export function messagePhase(startedAt: number, now: number, initialPhase?: 'enter' | 'replace'): MessagePhase;
export function particleSeeds(levelSeed: number, slotIndex: number, layerIndex: number): readonly [number, number];
