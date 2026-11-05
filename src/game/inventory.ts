import { MAX_ITEMS_PER_UNIT } from './config';
import { ITEMS } from './items';
import { nextInt } from './rng';
import { applyMods, type StatKey, type Stats } from './stats';
import { playerTraits, TRAITS, unitStats, type TraitLevels } from './traits';
import type { GameState, Item, Player, Unit } from './types';
import { UNIT_BY_ID } from './units';

export const heldBy = (p: Player, unitUid: number) => p.items.filter((i) => i.holder === unitUid);

export const hasRoom = (p: Player, unitUid: number) => heldBy(p, unitUid).length < MAX_ITEMS_PER_UNIT;

// Why `unit` can't take `item`, or null if it can.
export function equipBlock(p: Player, item: Item, unit: Unit): string | null {
  const def = ITEMS[item.id];
  if (def.forbidden && UNIT_BY_ID[unit.defId].traits.includes(def.forbidden)) {
    return `${TRAITS[def.forbidden].name} units can't hold the ${def.name}`;
  }
  if (item.holder !== unit.uid && !hasRoom(p, unit.uid)) return `A unit holds at most ${MAX_ITEMS_PER_UNIT} items`;
  return null;
}

// The tier an item works at given the holder's side's traits, or 0 if its trait is inactive.
export function effectiveTier(item: Item, levels: TraitLevels): number {
  const def = ITEMS[item.id];
  const level = levels[def.trait] ?? 0;
  if (!level) return 0;
  if (def.tierFromTrait) return Math.min(level, def.maxTier);
  const top = TRAITS[def.trait].items?.topLevel;
  return top !== undefined && level >= top ? def.maxTier : item.tier;
}

// What a unit's items do in a fight: id and working tier of each active one.
export function activeItems(items: Item[], levels: TraitLevels): { id: string; tier: number }[] {
  return items.flatMap((it) => {
    const tier = effectiveTier(it, levels);
    return tier ? [{ id: it.id, tier }] : [];
  });
}

// Run after anything that changes a player's units: items whose holder is gone go back to
// the inventory, and traits hand out any items the board has earned (random order, no repeats).
export function syncItems(state: GameState, p: Player): void {
  const units = new Set([...p.board, ...p.bench].flatMap((u) => (u ? [u.uid] : [])));
  for (const it of p.items) if (it.holder !== null && !units.has(it.holder)) it.holder = null;

  for (const [id, level] of Object.entries(playerTraits(p))) {
    const rule = TRAITS[id].items;
    if (!rule) continue;
    let missing = rule.grants[level - 1] - p.items.filter((it) => rule.pool.includes(it.id)).length;
    while (missing-- > 0) {
      const left = rule.pool.filter((itemId) => !p.items.some((it) => it.id === itemId));
      if (left.length === 0) break;
      p.items.push({ uid: state.nextUid++, id: left[nextInt(state, left.length)], tier: 1, holder: null });
    }
  }
}

// Traits whose member bonuses these (active) items grant their holder.
export function honoraryTraits(items: { id: string }[]): string[] {
  return items.flatMap((it) => {
    const grant = ITEMS[it.id].grantsMembership;
    return grant ? [grant.trait] : [];
  });
}

// Fight stats of every fielded unit, keyed by uid: traits and items first, then item auras,
// which read their holder's finished stats. Combat and the unit card both use this.
// What an item aura is handing out right now.
export interface AuraGrant {
  to: string; // trait whose units receive it
  stat: StatKey;
  amount: number; // added to each receiver
  share: number;
  base: number; // the holder's stat it's a share of
  receivers: number;
}

// Fight stats of every fielded unit, keyed by uid: traits and items first, then item auras,
// which read their holder's finished stats. Also returns each aura's grant, keyed by item uid,
// so the UI shows exactly the numbers combat uses.
function resolveField(p: Player, levels: TraitLevels, chosen: Record<string, string>, scale: number) {
  const stats = new Map<number, Stats>();
  const auras = new Map<number, AuraGrant>();
  p.board.forEach((u, cell) => {
    if (!u) return;
    const items = activeItems(heldBy(p, u.uid), levels);
    const honorary = honoraryTraits(items);
    stats.set(u.uid, unitStats(UNIT_BY_ID[u.defId], u.star, { levels, cell, scale, chosen, stacks: p.stacks, items, honorary }));
  });
  for (const holder of p.board) {
    if (!holder) continue;
    for (const it of heldBy(p, holder.uid)) {
      const tier = effectiveTier(it, levels);
      const aura = tier ? ITEMS[it.id].aura?.(tier) : undefined;
      if (!aura) continue;
      const base = stats.get(holder.uid)![aura.fromStat];
      const amount = Math.round(base * aura.share);
      const receivers = p.board.filter((u) => u && u.uid !== holder.uid && UNIT_BY_ID[u.defId].traits.includes(aura.to)) as Unit[];
      for (const u of receivers) stats.set(u.uid, applyMods(stats.get(u.uid)!, [{ stat: aura.stat, add: amount }]));
      auras.set(it.uid, { to: aura.to, stat: aura.stat, amount, share: aura.share, base, receivers: receivers.length });
    }
  }
  return { stats, auras };
}

export const fieldStats = (p: Player, levels: TraitLevels, chosen: Record<string, string> = {}, scale = 1) =>
  resolveField(p, levels, chosen, scale).stats;

export const auraGrants = (p: Player, levels: TraitLevels, chosen: Record<string, string> = {}) =>
  resolveField(p, levels, chosen, 1).auras;
