# WeChat Mini Game Backend Architecture

**Status:** Approved on 2026-08-16

## Decision

Use a two-layer delivery architecture:

1. Keep the existing React/Vite Product Design mobile prototype for visual, interaction, timing, and responsive validation.
2. Build the production WeChat Mini Game in Cocos Creator 3.x with TypeScript, reusing the pure water-sort engine, presentation timing contracts, level JSON, and generated raster assets.

Use WeChat Cloud Development / Tencent CloudBase for the phase-one backend. Do not connect the React prototype to a live backend and do not place production environment IDs or credentials in the prototype.

## Phase-One Backend Scope

- cloud save and revision-based progress synchronization;
- remotely versioned level configuration;
- idempotent rewarded-empty-bottle claims;
- basic level-completion telemetry;
- WeChat identity derived inside cloud functions from the invocation context.

Global ranking, payments, inventory economy, social relationship data, live operations CMS, and cross-platform account linking are outside phase one.

## Runtime Boundaries

### Client-owned

- water-sort input and animation;
- witch state playback and potion particles;
- active puzzle state and local offline snapshot;
- deterministic bottle presentation seed;
- optimistic local progress display.

### Server-owned

- player identity and cloud progress revision;
- rewarded-bottle claim idempotency;
- remote level/config version;
- completion submissions and abuse signals;
- authoritative daily or event limits if introduced later.

## Cloud Functions

- `bootstrap`: return player profile, cloud progress, config version, and server time.
- `getGameConfig`: return enabled level/config payloads compatible with the client version.
- `syncProgress`: merge local progress against the current server revision.
- `claimRewardedBottle`: grant one rewarded empty bottle for the eligible level and return `granted` or `alreadyGranted`.
- `submitLevelResult`: record completion, moves, duration, undo count, and rewarded-bottle usage.

## Collections

- `users`: identity metadata and login timestamps.
- `player_progress`: current level, completed levels, best moves, config version, and revision.
- `reward_claims`: player, level, reward type, idempotency key, status, and timestamps.
- `level_configs`: published version, minimum client version, enabled state, and level payload.
- `level_results`: completion telemetry and abuse-review fields.

## Reward Claim Contract

1. The client shows the rewarded video.
2. Only a completed close result may request a claim.
3. The client sends `levelId` and a unique claim id, never OPENID.
4. The cloud function derives OPENID from the trusted invocation context.
5. A server-side transaction checks eligibility, writes the claim, and updates progress.
6. Retried requests return the existing result and never activate another bottle.

The client callback is not independent proof of ad completion. Phase one mitigates modified-client abuse through one-claim-per-level rules, idempotency, rate limits, and anomaly logging.

## Offline and Conflict Policy

- Ordinary play remains available offline.
- Local progress is synchronized on launch, completion, foreground return, and network recovery.
- Progress updates carry a revision. Server merge preserves completed levels and the better best-move value.
- Rewarded bottles require a successful server claim and are unavailable offline.

## Security

- Public level configuration is read-only.
- Player progress and reward collections reject direct client writes; mutations go through cloud functions.
- Cloud functions validate input schema, client/config version, rate limits, and idempotency.
- Development and production use separate CloudBase environments.
- No environment IDs, secrets, or admin credentials are committed to the React prototype.

## Current Prototype Constraint

Continue the existing seven-task chibi prototype implementation plan unchanged. Backend code, CloudBase deployment, Cocos project scaffolding, and real advertising SDK integration require separate implementation plans after the prototype passes design QA.
