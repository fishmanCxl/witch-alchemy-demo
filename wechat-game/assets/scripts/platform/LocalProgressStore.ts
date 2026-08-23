import { sys } from 'cc';

import { createGameSession, type GameSession } from '../core/game-session.ts';
import { DEMO_LEVEL_CONFIG } from '../core/level-config.ts';
import { createLocalSnapshot, decodeLocalSnapshot } from '../core/save-schema.ts';

const PROGRESS_KEY = 'witch-water-sort:level-012:v1';
const SOUND_KEY = 'witch-water-sort:sound-enabled';

interface StorageApi {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
}

function wechatStorage(): StorageApi | null {
  return (globalThis as typeof globalThis & { wx?: StorageApi }).wx ?? null;
}

function getStored(key: string): string | null {
  const api = wechatStorage();
  if (!api) return sys.localStorage.getItem(key);
  const value = api.getStorageSync(key);
  return typeof value === 'string' ? value : null;
}

function setStored(key: string, value: string): void {
  const api = wechatStorage();
  if (api) api.setStorageSync(key, value);
  else sys.localStorage.setItem(key, value);
}

export class LocalProgressStore {
  loadSession(): GameSession {
    const snapshot = decodeLocalSnapshot(getStored(PROGRESS_KEY), DEMO_LEVEL_CONFIG);
    if (!snapshot) return createGameSession(DEMO_LEVEL_CONFIG);
    return {
      ...createGameSession(DEMO_LEVEL_CONFIG, snapshot.state),
      history: snapshot.history,
      selected: snapshot.selected,
      message: snapshot.selected === null ? '进度已恢复' : '法杖已锁定，再点目标瓶',
    };
  }

  saveSession(session: GameSession): void {
    const snapshot = createLocalSnapshot({
      levelId: session.levelId,
      configVersion: session.configVersion,
      revision: session.game.moves,
      state: session.game,
      history: session.history,
      selected: session.selected,
      updatedAt: Date.now(),
    });
    setStored(PROGRESS_KEY, JSON.stringify(snapshot));
  }

  loadSoundEnabled(): boolean {
    return getStored(SOUND_KEY) !== 'false';
  }

  saveSoundEnabled(enabled: boolean): void {
    setStored(SOUND_KEY, String(enabled));
  }
}
