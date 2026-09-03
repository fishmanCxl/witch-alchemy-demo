import type { RewardedAdPort, RewardedAdResult } from './rewarded-bottle.ts';

export type RewardedStaminaStatus = RewardedAdResult | 'offline' | 'busy';

export class RewardedStaminaCoordinator {
  private running = false;
  private readonly ad: RewardedAdPort;

  constructor(ad: RewardedAdPort) {
    this.ad = ad;
  }

  async run(online: boolean): Promise<RewardedStaminaStatus> {
    if (!online) return 'offline';
    if (this.running) return 'busy';
    this.running = true;
    try {
      return await this.ad.show();
    } catch {
      return 'failed';
    } finally {
      this.running = false;
    }
  }
}
