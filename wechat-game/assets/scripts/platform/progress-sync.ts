import {
  decodePlayerProgress,
  mergePlayerProgress,
  type PlayerProgress,
} from '../core/level-progress.ts';

export interface LevelResult {
  readonly levelId: string;
  readonly moves: number;
  readonly durationMs: number;
  readonly undoCount: number;
  readonly rewardedBottleUsed: boolean;
}

export interface ProgressSyncPort {
  sync(progress: PlayerProgress): Promise<unknown>;
  submitLevelResult(result: LevelResult): Promise<void>;
}

export interface ProgressSyncResult {
  readonly status: 'offline' | 'synced' | 'invalid' | 'failed';
  readonly progress: PlayerProgress;
}
export function applyProgressSyncResult(
  current: PlayerProgress,
  result: ProgressSyncResult,
): PlayerProgress {
  return result.status === 'synced'
    ? mergePlayerProgress(current, result.progress)
    : current;
}

export class ProgressSyncCoordinator {
  private readonly port: ProgressSyncPort;
  private inFlight: Promise<ProgressSyncResult> | null = null;

  constructor(port: ProgressSyncPort) {
    this.port = port;
  }

  sync(local: PlayerProgress, online: boolean): Promise<ProgressSyncResult> {
    if (!online) return Promise.resolve({ status: 'offline', progress: local });
    if (this.inFlight) return this.inFlight;

    const operation = this.runSync(local);
    this.inFlight = operation.finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async runSync(local: PlayerProgress): Promise<ProgressSyncResult> {
    try {
      const value = await this.port.sync(local);
      const remote = decodePlayerProgress(JSON.stringify(value));
      if (!remote) return { status: 'invalid', progress: local };
      return {
        status: 'synced',
        progress: mergePlayerProgress(local, remote),
      };
    } catch {
      return { status: 'failed', progress: local };
    }
  }

  async submitLevelResult(result: LevelResult, online: boolean): Promise<'offline' | 'submitted' | 'failed'> {
    if (!online) return 'offline';
    try {
      await this.port.submitLevelResult(result);
      return 'submitted';
    } catch {
      return 'failed';
    }
  }
}

