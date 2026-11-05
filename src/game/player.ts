import { GOLD_PER_XP, INTEREST_PER_10, MAX_INTEREST, MAX_LEVEL, XP_TO_LEVEL } from './config';
import type { Player } from './types';

export function isAlive(p: Player): boolean {
  return p.hp > 0;
}

export function boardCount(p: Player): number {
  return p.board.filter(Boolean).length;
}

export function xpToNext(p: Player): number | null {
  return p.level >= MAX_LEVEL ? null : XP_TO_LEVEL[p.level - 1];
}

// Gold to buy the rest of the current level, or null at max level.
export function levelUpCost(p: Player): number | null {
  const need = xpToNext(p);
  return need === null ? null : (need - p.xp) * GOLD_PER_XP;
}

export function interest(gold: number): number {
  return Math.min(MAX_INTEREST, Math.floor(gold / 10) * INTEREST_PER_10);
}

export function addXp(p: Player, amount: number): void {
  p.xp += amount;
  let need = xpToNext(p);
  while (need !== null && p.xp >= need) {
    p.xp -= need;
    p.level++;
    need = xpToNext(p);
  }
  if (need === null) p.xp = 0;
}
