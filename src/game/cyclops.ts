import { powersOf } from './commanders';
import { SHOP_ODDS } from './config';
import { copiesOf } from './merge';
import { nextInt } from './rng';
import { playerTraitCounts } from './traits';
import type { GameState, Player } from './types';
import { UNIT_BY_ID, UNITS, unitPrice } from './units';

// Cyclops (see commanders/cyclops.ts): a rally at low hp, and gold from every other player knocked out.

// The first time the player is at the rally's hp or below: heroes of their biggest trait (most fielded
// heroes; ties at random), from the pool at costs their shop can roll now, waiting for bench room like
// gifts; and Equipment Chests (opened at the next round start). Run after every fight.
export function checkRally(state: GameState, p: Player): void {
  const rally = powersOf(p).rally;
  if (!rally || p.rallied || p.hp <= 0 || p.hp > rally.hp) return;
  const counts = playerTraitCounts(p);
  const top = Math.max(0, ...Object.values(counts));
  const best = Object.keys(counts).filter((t) => counts[t] === top);
  const trait = top > 0 ? best[nextInt(state, best.length)] : null;
  const odds = SHOP_ODDS[p.level - 1];
  const heroes: string[] = [];
  for (let k = 0; trait && k < rally.heroes; k++) {
    const open = UNITS.filter((u) => u.shop !== false && !u.locked && u.traits.includes(trait) && (odds[u.tier - 1] ?? 0) > 0 && (state.pool[u.id] ?? 0) > 0);
    if (!open.length) break;
    const id = open[nextInt(state, open.length)].id;
    state.pool[id]--;
    heroes.push(id);
  }
  (p.gifts ??= []).push(...heroes);
  (p.chests ??= { kills: 0, earned: 0, waiting: 0 }).waiting += rally.chests;
  p.rallied = { trait, heroes };
}

// What a player's heroes are worth: every copy (board and bench) at its price.
export function heroValue(p: Player): number {
  return [...p.board, ...p.bench].reduce((n, u) => (u && !UNIT_BY_ID[u.defId].piece ? n + unitPrice(u.defId) * copiesOf(u) : n), 0);
}

// `out` was just knocked out (its heroes still on it): every player still in with Cyclops's shares gets
// that much of their hero value as gold.
export function payHeirs(state: GameState, out: Player): void {
  const value = heroValue(out);
  for (const p of state.players) {
    if (p === out || p.place !== null || p.hp <= 0) continue;
    const pw = powersOf(p);
    const gold = Math.round(value * ((pw.heirShare ?? 0) + (pw.heirShareCard ?? 0)));
    if (gold <= 0) continue;
    p.gold += gold;
    p.heirGold = (p.heirGold ?? 0) + gold;
  }
}
