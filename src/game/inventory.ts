import { markedUid, powersOf, protectedUids } from './commanders';
import { CHEST_OFFER, MAX_ITEMS_PER_UNIT, stageOf } from './config';
import { EQUIPMENT, ITEMS } from './items';
import { nextInt, shuffle } from './rng';
import { applyMods, type StatKey, type StatMod, type Stats } from './stats';
import { playerTraits, traitLeaders, TRAITS, unitStats, type TraitLevels } from './traits';
import type { GameState, Item, Player, Unit } from './types';
import { UNIT_BY_ID } from './units';

export const heldBy = (p: Player, unitUid: number) => p.items.filter((i) => i.holder === unitUid);

// Item slots a unit's items take (most take 1; e.g. the Thief Tool takes them all). Also its item count.
export const slotsUsed = (p: Player, unitUid: number) => heldBy(p, unitUid).reduce((n, i) => n + (ITEMS[i.id].slots ?? 1), 0);

export const hasRoom = (p: Player, unitUid: number) => slotsUsed(p, unitUid) < MAX_ITEMS_PER_UNIT;

// Why `unit` can't take `item`, or null if it can.
export function equipBlock(p: Player, item: Item, unit: Unit): string | null {
  const def = ITEMS[item.id];
  if (UNIT_BY_ID[unit.defId].piece) return `The ${UNIT_BY_ID[unit.defId].name} can't hold items`;
  if (def.forbidden && UNIT_BY_ID[unit.defId].traits.includes(def.forbidden)) {
    return `${TRAITS[def.forbidden].name} units can't hold the ${def.name}`;
  }
  if (def.membersOnly && !UNIT_BY_ID[unit.defId].traits.includes(def.trait!)) {
    return `Only ${TRAITS[def.trait!].name} units can hold the ${def.name}`;
  }
  if (item.holder !== unit.uid && slotsUsed(p, unit.uid) + (def.slots ?? 1) > MAX_ITEMS_PER_UNIT) {
    return def.slots && def.slots > 1 ? `The ${def.name} takes all ${def.slots} item slots` : `A unit holds at most ${MAX_ITEMS_PER_UNIT} items`;
  }
  return null;
}

// The tier an item works at given the holder's side's traits, or 0 if its trait is inactive.
export function effectiveTier(item: Item, levels: TraitLevels): number {
  const def = ITEMS[item.id];
  if (!def.trait) return item.tier; // equipment always works
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

// Puts an offered item into the player's items (unequipped) and closes the offer; the next chest opens.
export function takeOfferedItem(state: GameState, p: Player, itemId: string): void {
  p.items.push({ uid: state.nextUid++, id: itemId, tier: 1, holder: null });
  p.itemOffer = undefined;
  openChest(state, p);
  stageItems(state, p);
}

// Opens a waiting Equipment Chest, unless an offer is already up: pick 1 of a few random equipment.
export function openChest(state: GameState, p: Player): void {
  if (p.itemOffer?.length || !p.chests?.waiting) return;
  p.chests.waiting--;
  p.itemOffer = shuffle(state, [...EQUIPMENT]).slice(0, CHEST_OFFER);
}

// Items whose tier is the game's stage (see ItemDef.tierByStage) catch up with it.
export function stageItems(state: GameState, p: Player): void {
  for (const it of p.items) {
    const def = ITEMS[it.id];
    if (def.tierByStage) it.tier = Math.min(def.maxTier, stageOf(state.round));
  }
}

// Traits whose member bonuses these (active) items grant their holder.
export function honoraryTraits(items: { id: string }[]): string[] {
  return items.flatMap((it) => {
    const grant = ITEMS[it.id].grantsMembership;
    return grant ? [grant.trait] : [];
  });
}

// Trait id -> uid of its leader on this board. Every carried item counts, working or not.
export const fieldLeaders = (p: Player, levels: TraitLevels) => traitLeaders(p.board, levels, (uid) => slotsUsed(p, uid));

// The traits a unit leads, by uid.
export function leadsOf(p: Player, levels: TraitLevels, uid: number): string[] {
  const leaders = fieldLeaders(p, levels);
  return Object.keys(leaders).filter((id) => leaders[id] === uid);
}

// What an item aura is handing out right now.
export interface AuraGrant {
  to: string; // trait whose units receive it
  stats: StatKey[];
  amount: number; // added to each of `stats` on each receiver
  share: number;
  base: number; // the holder's stat it's a share of
  from: StatKey; // which one that was
  receivers: number;
}

// Fight stats of every fielded unit, keyed by uid: traits and items first, then item auras,
// which read their holder's finished stats. Also returns each aura's grant, keyed by item uid,
// so the UI shows exactly the numbers combat uses.
function resolveField(p: Player, levels: TraitLevels, chosen: Record<string, string>, scale: number) {
  const stats = new Map<number, Stats>();
  const auras = new Map<number, AuraGrant>();
  const leaders = fieldLeaders(p, levels);
  const bonus = p.mistBonus;
  const extra: StatMod[] = bonus
    ? [
        { stat: 'atk', pct: bonus.atk },
        { stat: 'ap', pct: bonus.atk },
        { stat: 'armor', pct: bonus.def },
        { stat: 'mr', pct: bonus.def },
      ]
    : [];
  const blessed = protectedUids(p);
  const protect = powersOf(p).protect;
  p.board.forEach((u, cell) => {
    if (!u) return;
    const items = activeItems(heldBy(p, u.uid), levels);
    const own = UNIT_BY_ID[u.defId].honorary;
    const honorary = [...honoraryTraits(items), ...(own ? [own.trait] : [])];
    const leads = Object.keys(leaders).filter((id) => leaders[id] === u.uid);
    const mods: StatMod[] = [...extra];
    // Kagura's card: the dancing hero fights harder.
    const boost = u.uid === markedUid(p, 'boost') ? powersOf(p).boost : undefined;
    if (boost) {
      mods.push(
        { stat: 'atk', pct: boost.hybridAtk },
        { stat: 'ap', pct: boost.hybridAtk },
        { stat: 'lifesteal', add: boost.hybridLifesteal },
        { stat: 'spellLifesteal', add: boost.hybridLifesteal },
      );
    }
    // Angela: protected heroes hit harder with their skills.
    if (protect && blessed.has(u.uid)) mods.push({ stat: 'skillAmp', add: protect.skillAmp });
    stats.set(u.uid, unitStats(UNIT_BY_ID[u.defId], u.star, { levels, cell, scale, chosen, stacks: p.stacks, items, honorary, leads, extra: mods }));
  });
  for (const holder of p.board) {
    if (!holder) continue;
    for (const it of heldBy(p, holder.uid)) {
      const tier = effectiveTier(it, levels);
      const aura = tier ? ITEMS[it.id].aura?.(tier) : undefined;
      if (!aura) continue;
      const held = stats.get(holder.uid)!;
      const from = aura.from.reduce((best, k) => (held[k] > held[best] ? k : best));
      const base = held[from];
      const amount = Math.round(base * aura.share);
      const receivers = p.board.filter((u) => u && u.uid !== holder.uid && UNIT_BY_ID[u.defId].traits.includes(aura.to)) as Unit[];
      for (const u of receivers) stats.set(u.uid, applyMods(stats.get(u.uid)!, aura.stats.map((stat) => ({ stat, add: amount }))));
      auras.set(it.uid, { to: aura.to, stats: aura.stats, amount, share: aura.share, base, from, receivers: receivers.length });
    }
  }
  return { stats, auras };
}

export const fieldStats = (p: Player, levels: TraitLevels, chosen: Record<string, string> = {}, scale = 1) =>
  resolveField(p, levels, chosen, scale).stats;

export const auraGrants = (p: Player, levels: TraitLevels, chosen: Record<string, string> = {}) =>
  resolveField(p, levels, chosen, 1).auras;
