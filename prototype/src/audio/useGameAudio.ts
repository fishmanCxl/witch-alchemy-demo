import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AUDIO_PREFERENCES_KEY,
  DEFAULT_AUDIO_PREFERENCES,
  parseAudioPreferences,
  serializeAudioPreferences,
  type AudioCueId,
  type AudioPreferences,
} from './audio-cues.mjs';
import { createAudioDirector, type AudioDirector } from './audio-director.mjs';
import { createWebAudioDriver } from './web-audio-driver.mjs';

const ESSENTIAL_PRELOAD_CUES: readonly AudioCueId[] = [
  'ui.tap',
  'bottle.select',
  'pour.valid',
  'pour.invalid',
];

interface AudioRuntime {
  readonly director: AudioDirector;
}

export interface GameAudioController {
  readonly preferences: AudioPreferences;
  readonly soundEnabled: boolean;
  unlockFromGesture(): void;
  play(cueId: AudioCueId): void;
  setSoundEnabled(enabled: boolean): void;
}

function readInitialPreferences(): AudioPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_AUDIO_PREFERENCES };
  try {
    return parseAudioPreferences(window.localStorage.getItem(AUDIO_PREFERENCES_KEY));
  } catch {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }
}

function persistPreferences(preferences: AudioPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUDIO_PREFERENCES_KEY, serializeAudioPreferences(preferences));
  } catch {
    // Storage may be blocked in private browsing; audio remains usable for this session.
  }
}

function createRuntime(preferences: AudioPreferences): AudioRuntime {
  const driver = createWebAudioDriver();
  return {
    director: createAudioDirector({ driver, initialPreferences: preferences }),
  };
}

export function useGameAudio(): GameAudioController {
  const [preferences, setPreferences] = useState<AudioPreferences>(readInitialPreferences);
  const preferencesRef = useRef(preferences);
  const runtimeRef = useRef<AudioRuntime | null>(null);
  const lifecycleGenerationRef = useRef(0);

  if (!runtimeRef.current) {
    runtimeRef.current = createRuntime(preferencesRef.current);
  }

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return undefined;
    const generation = lifecycleGenerationRef.current + 1;
    lifecycleGenerationRef.current = generation;

    void runtime.director.preload(ESSENTIAL_PRELOAD_CUES);
    void runtime.director.preload(['bgm.alchemy_room']);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        void runtime.director.suspend();
      } else {
        void runtime.director.resume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      queueMicrotask(() => {
        if (
          lifecycleGenerationRef.current === generation
          && runtimeRef.current === runtime
        ) {
          runtime.director.dispose();
          runtimeRef.current = null;
        }
      });
    };
  }, []);

  const unlockFromGesture = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    try {
      void runtime.director.unlock();
    } catch {
      // Audio rejection must never block the gesture that unlocked gameplay.
    }
  }, []);

  const play = useCallback((cueId: AudioCueId) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    try {
      runtime.director.play(cueId);
    } catch {
      // A missing or rejected cue is intentionally silent.
    }
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    const next = {
      musicEnabled: Boolean(enabled),
      sfxEnabled: Boolean(enabled),
    };
    preferencesRef.current = next;
    setPreferences(next);
    persistPreferences(next);
    try {
      runtimeRef.current?.director.setMusicEnabled(next.musicEnabled);
      runtimeRef.current?.director.setSfxEnabled(next.sfxEnabled);
    } catch {
      // Preference state remains valid even if the browser audio layer fails.
    }
  }, []);

  return {
    preferences,
    soundEnabled: preferences.musicEnabled && preferences.sfxEnabled,
    unlockFromGesture,
    play,
    setSoundEnabled,
  };
}
