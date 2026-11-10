import { powersOf } from './commanders';
import type { TierShopPower } from './commanders';
import { drawFromTier, drawUnit, returnShop } from './shop';
import type { GameState, Player } from './types';

// Harley (see commanders/harley.ts): Full House charges, earned on a schedule and banked; using one fills the shop
// with heroes of one cost and gives a free buy for the round.

const due = (s: TierShopPower, round: number) => round >= s.first && (round - s.first) % s.every === 0;

// The player's Full House powers: his own, then his card's.
const powers = (p: Player) => {
  const pw = powersOf(p);
  return [pw.tierShop, pw.tierShopCard].flatMap((s, i) => (s ? [{ s, card: i === 1 }] : []));
};

// At round start: a charge from each power due this round.
export function chargeFullHouses(state: GameState, p: Player): void {
  for (const { s } of powers(p)) if (due(s, state.round)) (p.fullHouse ??= {})[s.tier] = (p.fullHouse[s.tier] ?? 0) + 1;
}

// Each power with its next charge round from `round` on (for the UI).
export function nextFullHouses(p: Player, round: number): { tier: number; round: number; card: boolean }[] {
  return powers(p).map(({ s, card }) => ({
    tier: s.tier,
    round: round <= s.first ? s.first : s.first + Math.ceil((round - s.first) / s.every) * s.every,
    card,
  }));
}

// Why this player can't use a `tier` Full House now, or null.
export function fullHouseBlock(p: Player, tier: number): string | null {
  if (!powers(p).some(({ s }) => s.tier === tier)) return 'You have no Full House of that cost';
  if (!p.fullHouse?.[tier]) return 'No charge left';
  return null;
}

// Spends a charge: the shop is replaced by `tier`-cost heroes (a drained cost rolls as usual), and one free buy.
export function useFullHouse(state: GameState, p: Player, tier: number): string | null {
  const block = fullHouseBlock(p, tier);
  if (block) return block;
  p.fullHouse![tier]--;
  returnShop(state, p);
  p.freeSlot = null;
  for (let i = 0; i < p.shop.length; i++) p.shop[i] = drawFromTier(state, tier, p) ?? drawUnit(state, p.level, p);
  p.freeBuy = (p.freeBuy ?? 0) + (powers(p).find(({ s }) => s.tier === tier)!.s.free);
  return null;
}
