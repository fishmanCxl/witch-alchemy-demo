import type { RewardClaimPort, RewardClaimResult, RewardedAdPort, RewardedAdResult } from './rewarded-bottle.ts';
import type { PlayerProgress } from '../core/level-progress.ts';
import type { LevelResult, ProgressSyncPort } from './progress-sync.ts';

interface CloseResult { readonly isEnded?: boolean }
interface RewardedVideoAdLike {
  load(): Promise<unknown>;
  show(): Promise<unknown>;
  onClose(callback: (result?: CloseResult) => void): void;
  offClose(callback: (result?: CloseResult) => void): void;
  onError?(callback: () => void): void;
  offError?(callback: () => void): void;
}

interface WeChatApiLike {
  createRewardedVideoAd(options: { adUnitId: string }): RewardedVideoAdLike;
  getAccountInfoSync?(): { miniProgram?: { envVersion?: string } };
  getNetworkType?(options: { success: (result: { networkType: string }) => void }): void;
  onNetworkStatusChange?(callback: (result: { isConnected: boolean }) => void): void;
  offNetworkStatusChange?(callback: (result: { isConnected: boolean }) => void): void;
  onShow?(callback: () => void): void;
  offShow?(callback: () => void): void;
  onHide?(callback: () => void): void;
  offHide?(callback: () => void): void;
  cloud?: {
    init(options?: { traceUser?: boolean }): void;
    callFunction(options: { name: string; data: Record<string, unknown> }): Promise<{ result?: unknown }>;
  };
}

function runtimeWx(): WeChatApiLike | null {
  return (globalThis as typeof globalThis & { wx?: WeChatApiLike }).wx ?? null;
}

export interface QaActions {
  unlockAll(): void;
  reset(): void;
}

type QaGlobal = typeof globalThis & { WitchAlchemyQA?: QaActions };

export class WeChatRewardedAd implements RewardedAdPort {
  private readonly ad: RewardedVideoAdLike;

  constructor(api: WeChatApiLike, adUnitId: string) {
    this.ad = api.createRewardedVideoAd({ adUnitId });
  }

  async show(): Promise<RewardedAdResult> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: RewardedAdResult): void => {
        if (settled) return;
        settled = true;
        this.ad.offClose(onClose);
        this.ad.offError?.(onError);
        resolve(result);
      };
      const onClose = (result?: CloseResult): void => finish(result?.isEnded === true ? 'completed' : 'cancelled');
      const onError = (): void => finish('failed');
      this.ad.onClose(onClose);
      this.ad.onError?.(onError);
      this.ad.show().catch(() => this.ad.load().then(() => this.ad.show())).catch(onError);
    });
  }
}

export class UnavailableRewardedAd implements RewardedAdPort {
  async show(): Promise<RewardedAdResult> { return 'failed'; }
}

export class FakeRewardedAd implements RewardedAdPort {
  private readonly result: RewardedAdResult;
  constructor(result: RewardedAdResult = 'completed') { this.result = result; }
  async show(): Promise<RewardedAdResult> { return this.result; }
}

export class WeChatRewardClaimClient implements RewardClaimPort {
  private readonly api: WeChatApiLike;
  constructor(api: WeChatApiLike) {
    this.api = api;
    this.api.cloud?.init({ traceUser: true });
  }

  async claim(levelId: string, claimId: string): Promise<RewardClaimResult> {
    if (!this.api.cloud) return 'rejected';
    const response = await this.api.cloud.callFunction({
      name: 'claimRewardedBottle',
      data: { levelId, claimId },
    });
    const status = (response.result as { status?: unknown } | undefined)?.status;
    return status === 'granted' || status === 'alreadyGranted' ? status : 'rejected';
  }
}

export class FakeRewardClaimClient implements RewardClaimPort {
  async claim(): Promise<RewardClaimResult> { return 'granted'; }
}

export class WeChatProgressClient implements ProgressSyncPort {
  private readonly api: WeChatApiLike;

  constructor(api: WeChatApiLike) {
    this.api = api;
    this.api.cloud?.init({ traceUser: true });
  }

  async sync(progress: PlayerProgress): Promise<unknown> {
    if (!this.api.cloud) return null;
    const response = await this.api.cloud.callFunction({
      name: 'syncProgress',
      data: { ...progress },
    });
    const result = response.result as { ok?: unknown; progress?: unknown } | undefined;
    if (result?.ok !== true) throw new Error('progress sync rejected');
    return result.progress ?? null;
  }

  async submitLevelResult(result: LevelResult): Promise<void> {
    if (!this.api.cloud) return;
    const response = await this.api.cloud.callFunction({
      name: 'submitLevelResult',
      data: { ...result },
    });
    if ((response.result as { ok?: unknown } | undefined)?.ok !== true) {
      throw new Error('level result rejected');
    }
  }
}

export class UnavailableProgressClient implements ProgressSyncPort {
  async sync(): Promise<unknown> { return null; }
  async submitLevelResult(): Promise<void> {}
}

export class PlatformRuntime {
  private online = true;
  private readonly api = runtimeWx();
  private readonly networkListener = (result: { isConnected: boolean }): void => { this.online = result.isConnected; };
  private showListener: (() => void) | null = null;
  private hideListener: (() => void) | null = null;
  private qaActions: QaActions | null = null;

  constructor() {
    this.api?.getNetworkType?.({ success: ({ networkType }) => { this.online = networkType !== 'none'; } });
    this.api?.onNetworkStatusChange?.(this.networkListener);
  }

  isWeChat(): boolean { return this.api !== null; }
  isOnline(): boolean { return this.online; }

  createRewardedPorts(adUnitId: string): { ad: RewardedAdPort; claims: RewardClaimPort } {
    if (!this.api) return { ad: new FakeRewardedAd(), claims: new FakeRewardClaimClient() };
    return {
      ad: adUnitId ? new WeChatRewardedAd(this.api, adUnitId) : new UnavailableRewardedAd(),
      claims: new WeChatRewardClaimClient(this.api),
    };
  }

  createProgressSyncPort(): ProgressSyncPort {
    return this.api?.cloud ? new WeChatProgressClient(this.api) : new UnavailableProgressClient();
  }

  registerQaActions(actions: QaActions): void {
    const envVersion = this.api?.getAccountInfoSync?.().miniProgram?.envVersion;
    if (envVersion !== 'develop' && envVersion !== 'trial') return;
    (globalThis as QaGlobal).WitchAlchemyQA = actions;
    this.qaActions = actions;
  }

  bindLifecycle(onShow: () => void, onHide: () => void): void {
    this.showListener = onShow;
    this.hideListener = onHide;
    this.api?.onShow?.(onShow);
    this.api?.onHide?.(onHide);
  }

  dispose(): void {
    this.api?.offNetworkStatusChange?.(this.networkListener);
    if (this.showListener) this.api?.offShow?.(this.showListener);
    if (this.hideListener) this.api?.offHide?.(this.hideListener);
    const host = globalThis as QaGlobal;
    if (this.qaActions && host.WitchAlchemyQA === this.qaActions) delete host.WitchAlchemyQA;
    this.qaActions = null;
  }
}
