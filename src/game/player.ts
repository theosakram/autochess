import { baseReward, GOLD_PER_XP, INTEREST_PER_10, LOSE_STREAK_BONUS, MAX_INTEREST, MAX_LEVEL, stageOf, WIN_STREAK_BONUS, XP_TO_LEVEL } from './config';
import { heroCapBonusOf, interestCapOf, levelRefreshesOf, xpCutOf } from './powerCards';
import { markedUid, powersOf } from './commanders';
import type { Player } from './types';
import { UNIT_BY_ID } from './units';

export function isAlive(p: Player): boolean {
  return p.hp > 0;
}

// Whether a fielded unit takes no slot: a free-slot unit (the Plane Wanderer), or Fanny's cabled hero.
const takesNoSlot = (p: Player, u: { uid: number; defId: string }) => !!UNIT_BY_ID[u.defId].freeSlot || u.uid === markedUid(p, 'cable');

// Units counting toward the board limit.
export function boardCount(p: Player): number {
  return p.board.filter((u) => u && !takesNoSlot(p, u)).length;
}

// Fielded units that take no slot.
// Commander pieces (the Divine Beast) aren't units, so they're not counted here either.
export const freeSlotCount = (p: Player) => p.board.filter((u) => u && takesNoSlot(p, u) && !UNIT_BY_ID[u.defId].piece).length;

// How many heroes the player may field: their level, plus Party's Opening, Box round and Fanny's card capacity.
export const heroCapOf = (p: Player) => p.level + heroCapBonusOf(p) + (p.boxCap ?? 0) + (powersOf(p).heroCap ?? 0);

// The highest level the player can reach (Territory Agreement caps it).
export const levelCapOf = (p: Player) => Math.min(MAX_LEVEL, p.levelCap ?? MAX_LEVEL);

export function xpToNext(p: Player): number | null {
  if (p.level >= levelCapOf(p)) return null;
  const cut = xpCutOf(p); // Full Throttle
  return cut ? Math.max(1, Math.round(XP_TO_LEVEL[p.level - 1] * (1 - cut))) : XP_TO_LEVEL[p.level - 1];
}

// Gold to buy the rest of the current level, or null at max level.
export function levelUpCost(p: Player): number | null {
  const need = xpToNext(p);
  return need === null ? null : (need - p.xp) * GOLD_PER_XP;
}

// Interest on gold banked, up to `cap` (MAX_INTEREST; Vault Upgrade raises it, see interestCapOf).
export function interest(gold: number, cap = MAX_INTEREST): number {
  return Math.min(cap, Math.floor(gold / 10) * INTEREST_PER_10);
}

// The streak bonus for a streak (+n wins / -n losses in a row).
export function streakBonus(streak: number): number {
  const table = streak > 0 ? WIN_STREAK_BONUS : LOSE_STREAK_BONUS;
  return table[Math.min(Math.abs(streak), table.length - 1)];
}

// Interest this player earns on `gold` banked (none for Lance).
export const interestOf = (p: Player, gold: number): number => (powersOf(p).noInterest ? 0 : interest(gold, interestCapOf(p)));

// Commander gold at the end of round `round`: Lance's stage bonus, and his card's gold from its level on.
export function commanderGold(p: Player, round: number): number {
  const pw = powersOf(p);
  const stage = pw.stageGold ? pw.stageGold[Math.min(stageOf(round), pw.stageGold.length) - 1] : 0;
  const level = pw.levelGold && p.level >= pw.levelGold.level ? pw.levelGold.gold : 0;
  return stage + level;
}

// What the end of round `round` pays: basic reward (by its stage), interest on gold banked, streak bonus,
// commander gold (`commander: false` leaves it out: the starting gold isn't a round's end).
export function roundIncome(p: Player, round: number, commander = true): { base: number; interest: number; streak: number; payday: number; bonus: number; total: number } {
  const parts = { base: baseReward(round), interest: interestOf(p, p.gold), streak: streakBonus(p.streak ?? 0), payday: paydayGold(p), bonus: commander ? commanderGold(p, round) : 0 };
  return { ...parts, total: parts.base + parts.interest + parts.streak + parts.payday + parts.bonus };
}

// Lance: the round is over, so all gold goes into xp, up to the level cap (what's left at the cap stays).
export function burnGold(p: Player): void {
  if (!powersOf(p).burnGold) return;
  for (let cost = levelUpCost(p); cost !== null && p.gold > 0; cost = levelUpCost(p)) {
    const xp = Math.floor(Math.min(p.gold, cost) / GOLD_PER_XP);
    if (xp <= 0) break;
    p.gold -= xp * GOLD_PER_XP;
    addXp(p, xp);
  }
}

// Payday: what the next end of round pays from the cards still owing.
export const paydayGold = (p: Player) => (p.payday ?? []).reduce((n, d) => n + d.gold, 0);

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
    levelRewards(p);
    // Golden Era: free shop refreshes with each level.
    const free = levelRefreshesOf(p);
    if (free) p.freeRerolls = (p.freeRerolls ?? 0) + free;
    need = xpToNext(p);
  }
  if (need === null) p.xp = 0;
}

// What reaching a new level pays: Val's Scout charge (at its levels), and his card's free buy and gold.
function levelRewards(p: Player): void {
  const pw = powersOf(p);
  if (pw.scout?.levels.includes(p.level)) p.scoutCharges = (p.scoutCharges ?? 0) + 1;
  if (pw.levelReward) {
    p.gold += pw.levelReward.gold;
    p.freeBuy = (p.freeBuy ?? 0) + pw.levelReward.free;
  }
}
