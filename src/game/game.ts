import { runBot } from './bot';
import {
  BASE_INCOME,
  BENCH_SIZE,
  BOARD_COLS,
  BOARD_ROWS,
  MAX_INTEREST,
  PASSIVE_XP,
  POOL_SIZE,
  SHOP_SIZE,
  START_HP,
} from './config';
import { addXp } from './player';
import { refreshShop } from './shop';
import type { GameState } from './types';
import { UNITS } from './units';

export interface PlayerSeed {
  id: string;
  name: string;
  isBot: boolean;
}

export function createGame(seed: number, seeds: PlayerSeed[]): GameState {
  const pool: Record<string, number> = {};
  for (const u of UNITS) pool[u.id] = POOL_SIZE[u.tier - 1];

  const state: GameState = {
    round: 0,
    rng: seed | 0,
    nextUid: 1,
    pool,
    players: seeds.map((s) => ({
      ...s,
      hp: START_HP,
      gold: 0,
      level: 1,
      xp: 0,
      bench: Array(BENCH_SIZE).fill(null),
      board: Array(BOARD_COLS * BOARD_ROWS).fill(null),
      shop: Array(SHOP_SIZE).fill(null),
    })),
  };
  startRound(state);
  return state;
}

// Preparation phase start. Combat will slot in before this once it exists.
export function startRound(state: GameState): void {
  state.round++;
  for (const p of state.players) {
    if (state.round > 1) addXp(p, PASSIVE_XP);
    p.gold += BASE_INCOME + Math.min(MAX_INTEREST, Math.floor(p.gold / 10));
    refreshShop(state, p);
  }
  for (const p of state.players) {
    if (p.isBot) runBot(state, p);
  }
}
