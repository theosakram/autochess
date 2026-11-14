import { powersOf } from './commanders';
import { nextFloat } from './rng';
import { drawFromTier, drawUnit, returnShop } from './shop';
import type { GameState, Player, UnitDef } from './types';
import { UNIT_BY_ID } from './units';

// Val (see commanders/val.ts): Scout charges, one on reaching each of his levels, banked. Using one on a hero of
// the player's fills the shop with heroes sharing at least one trait with it, and gives free buys for the round.

const ownUnit = (p: Player, uid: number) => [...p.board, ...p.bench].find((u) => u?.uid === uid) ?? null;

// Why this player can't Scout from the hero `uid` now, or null.
export function scoutBlock(p: Player, uid: number): string | null {
  if (!powersOf(p).scout) return "You don't have Val's Scout";
  if (!p.scoutCharges) return 'No Scout charge left';
  const unit = ownUnit(p, uid);
  if (!unit) return 'No such unit';
  if (UNIT_BY_ID[unit.defId].piece || !UNIT_BY_ID[unit.defId].traits.length) return "That one has no traits to scout by";
  return null;
}

// One slot's hero: a cost rolled from the Scout odds (not the level's) first, then dearer, then cheaper ones
// sharing a trait; a plain draw if the pool has none of them left.
function drawShared(state: GameState, p: Player, odds: number[], shares: (d: UnitDef) => boolean): string | null {
  let first = odds.length;
  let r = nextFloat(state) * odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i];
    if (r < 0) {
      first = i + 1;
      break;
    }
  }
  const order = [first, ...Array.from({ length: 5 - first }, (_, i) => first + 1 + i), ...Array.from({ length: first - 1 }, (_, i) => first - 1 - i)];
  for (const t of order) {
    const id = drawFromTier(state, t, p, shares);
    if (id) return id;
  }
  return drawUnit(state, p.level, p);
}

// Spends a charge on the hero `uid`: a fresh shop of heroes sharing a trait with it, and the free buys.
export function useScout(state: GameState, p: Player, uid: number): string | null {
  const block = scoutBlock(p, uid);
  if (block) return block;
  const traits = new Set(UNIT_BY_ID[ownUnit(p, uid)!.defId].traits);
  const shares = (d: UnitDef) => d.traits.some((t) => traits.has(t));
  p.scoutCharges!--;
  returnShop(state, p);
  p.freeSlot = null;
  const odds = powersOf(p).scout!.odds;
  for (let i = 0; i < p.shop.length; i++) p.shop[i] = drawShared(state, p, odds, shares);
  p.freeBuy = (p.freeBuy ?? 0) + powersOf(p).scout!.free;
  return null;
}
