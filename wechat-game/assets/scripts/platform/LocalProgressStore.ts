import { createGameSession, type GameSession } from '../core/game-session.ts';
import { decodeStamina, encodeStamina, type StaminaState } from '../core/stamina.ts';
import { getLevelConfig, PUBLISHED_LEVELS } from '../core/level-catalog.ts';
import {
  createDefaultProgress,
  decodePlayerProgress,
  encodePlayerProgress,
  type PlayerProgress,
} from '../core/level-progress.ts';
import {
  createLocalSnapshot,
  decodeLocalSnapshot,
  type LocalSnapshot,
} from '../core/save-schema.ts';
import type { LevelConfig } from '../core/level-config.ts';
import type { KeyValueStorage } from './storage-port.ts';

const PROGRESS_KEY = 'witch-water-sort:progress:v2';
const QA_MODE_KEY = 'witch-water-sort:qa-mode:v1';
const QA_BACKUP_KEY = 'witch-water-sort:qa-backup:v1';
const LEGACY_LEVEL_12_KEY = 'witch-water-sort:level-012:v1';
const MIGRATION_MARKER_KEY = 'witch-water-sort:migration:level-012:v2';
const SOUND_KEY = 'witch-water-sort:sound-enabled';
const STAMINA_KEY = 'witch-water-sort:stamina:v1';

function sessionKey(levelId: string): string {
  return `witch-water-sort:session:${levelId}:v2`;
}

function decodeLegacyLevel12(
  serialized: string | null,
  level: LevelConfig,
): LocalSnapshot | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (record.schemaVersion !== 1) return null;
    return decodeLocalSnapshot(JSON.stringify({ ...record, schemaVersion: 2 }), level);
  } catch {
    return null;
  }
}

export class LocalProgressStore {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  loadProgress(): PlayerProgress {
    return decodePlayerProgress(this.storage.getItem(PROGRESS_KEY)) ?? createDefaultProgress();
  }

  saveProgress(progress: PlayerProgress): void {
    this.storage.setItem(PROGRESS_KEY, encodePlayerProgress(progress));
  }

  isQaMode(): boolean {
    return this.storage.getItem(QA_MODE_KEY) === 'enabled';
  }

  enableQaAllLevels(): PlayerProgress {
    if (!this.isQaMode()) {
      this.storage.setItem(QA_BACKUP_KEY, JSON.stringify({
        progress: this.storage.getItem(PROGRESS_KEY),
      }));
      this.storage.setItem(QA_MODE_KEY, 'enabled');
    }

    const previous = this.loadProgress();
    const lastLevel = PUBLISHED_LEVELS[PUBLISHED_LEVELS.length - 1];
    const qaProgress: PlayerProgress = {
      ...previous,
      revision: previous.revision + 1,
      currentLevel: lastLevel.id,
      highestUnlockedLevel: lastLevel.id,
      completedLevels: PUBLISHED_LEVELS.map((level) => level.id),
      bestMoves: {},
    };
    this.saveProgress(qaProgress);
    return qaProgress;
  }

  resetQaMode(): PlayerProgress {
    if (!this.isQaMode()) return this.loadProgress();

    const serializedBackup = this.storage.getItem(QA_BACKUP_KEY);
    let backup: unknown;
    try {
      backup = serializedBackup ? JSON.parse(serializedBackup) : null;
    } catch {
      backup = null;
    }
    if (
      typeof backup !== 'object'
      || backup === null
      || !('progress' in backup)
      || (backup.progress !== null && typeof backup.progress !== 'string')
    ) {
      throw new Error('QA progress backup is unavailable');
    }

    if (backup.progress === null) this.storage.removeItem(PROGRESS_KEY);
    else this.storage.setItem(PROGRESS_KEY, backup.progress);
    this.storage.removeItem(QA_MODE_KEY);
    this.storage.removeItem(QA_BACKUP_KEY);
    return this.loadProgress();
  }

  loadSession(level: LevelConfig): GameSession {
    const snapshot = decodeLocalSnapshot(this.storage.getItem(sessionKey(level.id)), level);
    if (!snapshot) return createGameSession(level);
    return {
      ...createGameSession(level, snapshot.state),
      history: snapshot.history,
      selected: snapshot.selected,
      message: snapshot.selected === null ? '进度已恢复' : '法杖已锁定，再点目标瓶',
    };
  }

  saveSession(session: GameSession): void {
    if (session.pendingCompletion.length > 0 || session.levelComplete) return;
    const level = getLevelConfig(session.levelId);
    if (!level || level.configVersion !== session.configVersion) return;
    const snapshot = createLocalSnapshot({
      levelId: session.levelId,
      configVersion: session.configVersion,
      revision: session.game.moves,
      state: session.game,
      history: session.history,
      selected: session.selected,
      updatedAt: Date.now(),
    });
    this.storage.setItem(sessionKey(session.levelId), JSON.stringify(snapshot));
  }

  clearSession(levelId: string): void {
    if (getLevelConfig(levelId)) this.storage.removeItem(sessionKey(levelId));
  }

  migrateLegacyLevel12(): PlayerProgress {
    if (this.storage.getItem(MIGRATION_MARKER_KEY) === 'done') return this.loadProgress();

    const existing = decodePlayerProgress(this.storage.getItem(PROGRESS_KEY));
    if (existing) {
      this.storage.setItem(MIGRATION_MARKER_KEY, 'done');
      return existing;
    }

    const level12 = getLevelConfig('level-012');
    if (!level12) throw new Error('Published level 12 is unavailable');
    const legacy = decodeLegacyLevel12(this.storage.getItem(LEGACY_LEVEL_12_KEY), level12);
    if (!legacy) {
      const fallback = createDefaultProgress();
      this.saveProgress(fallback);
      this.storage.setItem(MIGRATION_MARKER_KEY, 'done');
      return fallback;
    }

    this.storage.setItem(sessionKey(level12.id), JSON.stringify(legacy));
    const migrated: PlayerProgress = {
      ...createDefaultProgress(),
      revision: 1,
      currentLevel: level12.id,
      highestUnlockedLevel: level12.id,
    };
    this.saveProgress(migrated);
    this.storage.setItem(MIGRATION_MARKER_KEY, 'done');
    return migrated;
  }

  loadSoundEnabled(): boolean {
    return this.storage.getItem(SOUND_KEY) !== 'false';
  }

  saveSoundEnabled(enabled: boolean): void {
    this.storage.setItem(SOUND_KEY, String(enabled));
  }

  loadStamina(now: number): StaminaState {
    return decodeStamina(this.storage.getItem(STAMINA_KEY), now);
  }

  saveStamina(state: StaminaState): void {
    this.storage.setItem(STAMINA_KEY, encodeStamina(state));
  }
}
