import { SHOP_ODDS } from './config';
import { nextFloat, nextInt } from './rng';
import type { GameState, Player } from './types';
import { UNITS } from './units';

function pickTier(state: GameState, level: number): number {
  const odds = SHOP_ODDS[level - 1];
  let r = nextFloat(state) * 100;
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i];
    if (r < 0) return i + 1;
  }
  return 1;
}

// Weighted by remaining copies, so contested units get rarer for everyone.
function drawFromTier(state: GameState, tier: number): string | null {
  const defs = UNITS.filter((u) => u.tier === tier);
  const total = defs.reduce((n, d) => n + state.pool[d.id], 0);
  if (total === 0) return null;
  let r = nextInt(state, total);
  for (const d of defs) {
    r -= state.pool[d.id];
    if (r < 0) {
      state.pool[d.id]--;
      return d.id;
    }
  }
  return null;
}

export function drawUnit(state: GameState, level: number): string | null {
  // A drained tier falls back to cheaper ones rather than leaving the slot empty.
  for (let t = pickTier(state, level); t >= 1; t--) {
    const id = drawFromTier(state, t);
    if (id) return id;
  }
  return null;
}

export function returnShop(state: GameState, p: Player): void {
  for (let i = 0; i < p.shop.length; i++) {
    const id = p.shop[i];
    if (id) state.pool[id]++;
    p.shop[i] = null;
  }
}

export function refreshShop(state: GameState, p: Player): void {
  returnShop(state, p);
  for (let i = 0; i < p.shop.length; i++) p.shop[i] = drawUnit(state, p.level);
}
