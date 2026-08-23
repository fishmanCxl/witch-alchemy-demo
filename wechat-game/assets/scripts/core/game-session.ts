import { createDemoState } from './demo-level.ts';
import { addRewardBottle, pour, vanishBottle } from './water-sort.ts';
import type { GameState } from './types.ts';

export type WitchMood = 'idle' | 'prepare' | 'raise' | 'cast' | 'celebrate' | 'return' | 'oops';
export type GameCue =
  | 'bottle-select'
  | 'bottle-deselect'
  | 'pour-valid'
  | 'pour-invalid'
  | 'potion-complete'
  | 'potion-vanish'
  | 'undo'
  | 'restart'
  | 'reward-empty-bottle';

export interface GameSession {
  readonly game: GameState;
  readonly history: readonly GameState[];
  readonly selected: number | null;
  readonly pendingCompletion: readonly number[];
  readonly witchMood: WitchMood;
  readonly message: string;
}

export interface SessionResult {
  readonly session: GameSession;
  readonly cue: GameCue | null;
  readonly invalid: readonly number[];
  readonly pouring: readonly number[];
}

const NO_EFFECTS = { invalid: [], pouring: [] } as const;

export function createGameSession(game: GameState = createDemoState()): GameSession {
  return {
    game,
    history: [],
    selected: null,
    pendingCompletion: [],
    witchMood: 'idle',
    message: '选择一瓶，再选择目标瓶',
  };
}

export function pressBottle(session: GameSession, index: number): SessionResult {
  if (session.pendingCompletion.length > 0) {
    return { session, cue: null, ...NO_EFFECTS };
  }

  const bottle = session.game.bottles[index];
  if (!bottle || bottle.status !== 'active') {
    return { session, cue: null, ...NO_EFFECTS };
  }

  if (session.selected === null) {
    if (bottle.layers.length === 0) {
      return {
        session: { ...session, witchMood: 'oops', message: '空瓶不能作为起点' },
        cue: 'pour-invalid',
        invalid: [index],
        pouring: [],
      };
    }

    return {
      session: {
        ...session,
        selected: index,
        witchMood: 'prepare',
        message: '法杖已锁定，再点目标瓶',
      },
      cue: 'bottle-select',
      ...NO_EFFECTS,
    };
  }

  if (session.selected === index) {
    return {
      session: { ...session, selected: null, witchMood: 'return', message: '已取消选择' },
      cue: 'bottle-deselect',
      ...NO_EFFECTS,
    };
  }

  const result = pour(session.game, session.selected, index);
  if (result.moved === 0) {
    return {
      session: { ...session, witchMood: 'oops', message: '只能倒入空瓶或同色药液' },
      cue: 'pour-invalid',
      invalid: [session.selected, index],
      pouring: [],
    };
  }

  const completed = result.completed.length > 0;
  return {
    session: {
      game: result.state,
      history: [...session.history, session.game],
      selected: null,
      pendingCompletion: result.completed,
      witchMood: completed ? 'celebrate' : 'cast',
      message: completed ? '魔药合成成功！' : `倒入 ${result.moved} 层药液`,
    },
    cue: completed ? 'potion-complete' : 'pour-valid',
    invalid: [],
    pouring: [session.selected, index],
  };
}

export function completePendingBottles(session: GameSession): GameSession {
  if (session.pendingCompletion.length === 0) return session;
  return {
    ...session,
    game: session.pendingCompletion.reduce(vanishBottle, session.game),
    pendingCompletion: [],
    witchMood: 'return',
  };
}

export function undoSession(session: GameSession): SessionResult {
  const previous = session.history.at(-1);
  if (!previous || session.pendingCompletion.length > 0) {
    return { session, cue: null, ...NO_EFFECTS };
  }

  return {
    session: {
      ...session,
      game: previous,
      history: session.history.slice(0, -1),
      selected: null,
      witchMood: 'cast',
      message: '已撤销上一步',
    },
    cue: 'undo',
    ...NO_EFFECTS,
  };
}

export function restartSession(_session: GameSession): SessionResult {
  return {
    session: { ...createGameSession(), witchMood: 'cast', message: '关卡已重新开始' },
    cue: 'restart',
    ...NO_EFFECTS,
  };
}

export function grantRewardBottle(session: GameSession): SessionResult {
  if (session.pendingCompletion.length > 0) {
    return { session, cue: null, ...NO_EFFECTS };
  }

  const game = addRewardBottle(session.game);
  if (game === session.game) return { session, cue: null, ...NO_EFFECTS };

  return {
    session: {
      ...session,
      game,
      history: [...session.history, session.game],
      selected: null,
      witchMood: 'celebrate',
      message: '广告奖励完成，空瓶已加入',
    },
    cue: 'reward-empty-bottle',
    ...NO_EFFECTS,
  };
}

export function settleWitch(session: GameSession): GameSession {
  if (session.witchMood === 'prepare') return { ...session, witchMood: 'raise' };
  if (session.witchMood !== 'idle') return { ...session, witchMood: 'return' };
  return session;
}

export function finishWitchReturn(session: GameSession): GameSession {
  return session.witchMood === 'return' ? { ...session, witchMood: 'idle' } : session;
}
