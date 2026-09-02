export const STAMINA_MAX = 10;
export const STAMINA_RECOVERY_MS = 30 * 60 * 1000;
export const STAMINA_AD_REWARD = 5;

export interface StaminaState {
  readonly schemaVersion: 1;
  readonly value: number;
  readonly updatedAt: number;
}

const frozen = (value: number, updatedAt: number): StaminaState =>
  Object.freeze({ schemaVersion: 1 as const, value, updatedAt });

export function createFullStamina(now: number): StaminaState {
  return frozen(STAMINA_MAX, now);
}

export function decodeStamina(serialized: string, now: number): StaminaState {
  try {
    const value = JSON.parse(serialized) as Record<string, unknown>;
    if (Array.isArray(value) || value.schemaVersion !== 1 ||
      typeof value.value !== 'number' || !Number.isInteger(value.value) ||
      value.value < 0 || value.value > STAMINA_MAX ||
      typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) {
      return createFullStamina(now);
    }
    return frozen(value.value, value.updatedAt);
  } catch {
    return createFullStamina(now);
  }
}

export function encodeStamina(state: StaminaState): string {
  return JSON.stringify(state);
}

export function reconcileStamina(state: StaminaState, now: number): StaminaState {
  if (state.value >= STAMINA_MAX || now <= state.updatedAt) return state;
  const recovered = Math.floor((now - state.updatedAt) / STAMINA_RECOVERY_MS);
  if (recovered < 1) return state;
  const value = Math.min(STAMINA_MAX, state.value + recovered);
  return frozen(value, value === STAMINA_MAX ? now : state.updatedAt + recovered * STAMINA_RECOVERY_MS);
}

export function spendStamina(state: StaminaState, now: number): StaminaState | null {
  const current = reconcileStamina(state, now);
  return current.value < 1 ? null : frozen(current.value - 1, now);
}

export function grantAdStamina(state: StaminaState, now: number): StaminaState {
  const value = Math.min(STAMINA_MAX, state.value + STAMINA_AD_REWARD);
  return value === STAMINA_MAX ? createFullStamina(now) : frozen(value, state.updatedAt);
}

export function nextRecoveryMs(state: StaminaState, now: number): number {
  const current = reconcileStamina(state, now);
  if (current.value >= STAMINA_MAX) return 0;
  return Math.max(0, STAMINA_RECOVERY_MS - (now - current.updatedAt));
}
