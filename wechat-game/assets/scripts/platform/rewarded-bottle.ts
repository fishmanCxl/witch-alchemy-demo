export type RewardedAdResult = 'completed' | 'cancelled' | 'failed';
export type RewardClaimResult = 'granted' | 'alreadyGranted' | 'rejected';
export type RewardFlowStatus = RewardedAdResult | RewardClaimResult | 'offline' | 'busy';

export interface RewardedAdPort {
  show(): Promise<RewardedAdResult>;
}

export interface RewardClaimPort {
  claim(levelId: string, claimId: string): Promise<RewardClaimResult>;
}

export interface RewardFlowResult {
  readonly status: RewardFlowStatus;
  readonly activateBottle: boolean;
}

export class RewardedBottleCoordinator {
  private running = false;
  private readonly ad: RewardedAdPort;
  private readonly claims: RewardClaimPort;

  constructor(ad: RewardedAdPort, claims: RewardClaimPort) {
    this.ad = ad;
    this.claims = claims;
  }

  async run(levelId: string, claimId: string, online: boolean): Promise<RewardFlowResult> {
    if (!online) return { status: 'offline', activateBottle: false };
    if (this.running) return { status: 'busy', activateBottle: false };
    this.running = true;

    try {
      const adResult = await this.ad.show();
      if (adResult !== 'completed') return { status: adResult, activateBottle: false };

      const claimResult = await this.claims.claim(levelId, claimId);
      return {
        status: claimResult,
        activateBottle: claimResult === 'granted' || claimResult === 'alreadyGranted',
      };
    } catch {
      return { status: 'failed', activateBottle: false };
    } finally {
      this.running = false;
    }
  }
}
