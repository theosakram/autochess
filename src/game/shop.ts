import { POOL_SIZE } from './config';
import { baseItemOf, isItemCard, itemCard } from './items';
import { nextFloat, nextInt } from './rng';
import { playerTraits, TRAITS } from './traits';
import { powersOf } from './commanders';
import { shopOdds } from './powerCards';
import type { GameState, Player } from './types';
import { UNIT_BY_ID, UNITS } from './units';

// `p`, when given, brings its Customize Recruitment cards in.
function pickTier(state: GameState, level: number, p?: Player): number {
  const odds = shopOdds(level, p);
  let r = nextFloat(state) * 100;
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i];
    if (r < 0) return i + 1;
  }
  return 1;
}

// Weighted by remaining copies, so contested units get rarer for everyone. The player's own Johnnie
// (Johnson) rolls with its tier as if it had a full pool that never runs out (Johnson's card adds copies): it's theirs alone.
export function drawFromTier(state: GameState, tier: number, p?: Player): string | null {
  const defs = UNITS.filter((u) => (u.shopTier ?? u.tier) === tier && u.shop !== false && (!u.locked || !!p?.unlocked?.includes(u.id)));
  const johnnie = p?.johnnie?.defId && UNIT_BY_ID[p.johnnie.defId].tier === tier ? p.johnnie.defId : null;
  const own = johnnie ? POOL_SIZE[tier] + (powersOf(p!).johnniePool ?? 0) : 0;
  const total = defs.reduce((n, d) => n + state.pool[d.id], 0) + own;
  if (total === 0) return null;
  let r = nextInt(state, total);
  if (r < own) return johnnie;
  r -= own;
  for (const d of defs) {
    r -= state.pool[d.id];
    if (r < 0) {
      state.pool[d.id]--;
      return d.id;
    }
  }
  return null;
}

// `p`, when given, lets locked units it has unlocked show up, and its Customize Recruitment change the odds.
export function drawUnit(state: GameState, level: number, p?: Player): string | null {
  // A drained tier falls back to cheaper ones rather than leaving the slot empty.
  for (let t = pickTier(state, level, p); t >= 1; t--) {
    const id = drawFromTier(state, t, p);
    if (id) return id;
  }
  return null;
}

export function returnShop(state: GameState, p: Player): void {
  for (let i = 0; i < p.shop.length; i++) {
    const id = p.shop[i];
    if (id && !isItemCard(id) && id in state.pool) state.pool[id]++;
    p.shop[i] = null;
  }
}

export function refreshShop(state: GameState, p: Player): void {
  returnShop(state, p);
  p.freeSlot = null;
  for (let i = 0; i < p.shop.length; i++) p.shop[i] = upgradeCard(state, p) ?? drawUnit(state, p.level, p);
}

// What buying shop slot `slot` costs this player: 0 for the free hero (Guiness), else the unit's price.
export function shopPrice(p: Player, slot: number): number {
  const id = p.shop[slot];
  if (!id || isItemCard(id)) return 0;
  // Guiness's free slot; Opening Promotion's free first buy of the round.
  return p.freeSlot === slot || p.freeBuy ? 0 : UNIT_BY_ID[id].price ?? UNIT_BY_ID[id].tier;
}

// Guiness: after the free after-fight refresh, maybe make one hero in the shop free: always while his card's
// rounds last (one used up), else at his innate chance. Rolls only for players with the power.
export function rollFreeHero(state: GameState, p: Player): void {
  const chance = powersOf(p).freeHeroChance ?? 0;
  const card = (p.freeHeroes ?? 0) > 0;
  if (!card && !chance) return;
  const slots = p.shop.flatMap((id, i) => (id && !isItemCard(id) ? [i] : []));
  if (!slots.length) return;
  if (card) p.freeHeroes!--;
  else if (nextFloat(state) >= chance) return;
  p.freeSlot = slots[nextInt(state, slots.length)];
}

// While a trait with items is active, a slot may offer a free upgrade for one of its owned items.
// Only rolls when there's something to upgrade, so other games replay exactly as before.
function upgradeCard(state: GameState, p: Player): string | null {
  for (const id of Object.keys(playerTraits(p))) {
    const rule = TRAITS[id].items;
    if (!rule) continue;
    const upgradable = p.items.filter((it) => rule.pool.includes(baseItemOf(it.id)) && it.tier < rule.maxShopTier);
    // The card names the base item (an enhanced one is upgraded through it).
    if (upgradable.length > 0 && nextFloat(state) < rule.shopChance) return itemCard(baseItemOf(upgradable[nextInt(state, upgradable.length)].id));
  }
  return null;
}
