import type { AudioDriver } from './audio-director.mjs';

export interface CreateWebAudioDriverOptions {
  readonly createAudioContext?: () => AudioContext;
  readonly fetchAudio?: typeof fetch;
}

export declare function createWebAudioDriver(options?: CreateWebAudioDriverOptions): AudioDriver;
