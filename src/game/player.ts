import { baseReward, GOLD_PER_XP, INTEREST_PER_10, LOSE_STREAK_BONUS, MAX_INTEREST, MAX_LEVEL, WIN_STREAK_BONUS, XP_TO_LEVEL } from './config';
import type { Player } from './types';
import { UNIT_BY_ID } from './units';

export function isAlive(p: Player): boolean {
  return p.hp > 0;
}

// Units counting toward the board limit (some, like the Plane Wanderer, take no slot).
export function boardCount(p: Player): number {
  return p.board.filter((u) => u && !UNIT_BY_ID[u.defId].freeSlot).length;
}

// Fielded units that take no slot.
// Commander pieces (the Divine Beast) aren't units, so they're not counted here either.
export const freeSlotCount = (p: Player) => p.board.filter((u) => u && UNIT_BY_ID[u.defId].freeSlot && !UNIT_BY_ID[u.defId].piece).length;

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

// The streak bonus for a streak (+n wins / -n losses in a row).
export function streakBonus(streak: number): number {
  const table = streak > 0 ? WIN_STREAK_BONUS : LOSE_STREAK_BONUS;
  return table[Math.min(Math.abs(streak), table.length - 1)];
}

// What the end of round `round` pays: basic reward (by its stage), interest on gold banked, streak bonus.
export function roundIncome(p: Player, round: number): { base: number; interest: number; streak: number; total: number } {
  const parts = { base: baseReward(round), interest: interest(p.gold), streak: streakBonus(p.streak ?? 0) };
  return { ...parts, total: parts.base + parts.interest + parts.streak };
}

// A fight against a player: the streak moves, and a win pays WIN_GOLD on the spot. A draw counts as a loss.
export function recordFight(p: Player, won: boolean, winGold: number): void {
  const streak = p.streak ?? 0;
  p.streak = won ? Math.max(0, streak) + 1 : Math.min(0, streak) - 1;
  if (won) p.gold += winGold;
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
