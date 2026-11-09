import { powersOf, type AltarPower } from './commanders';
import { roundLabel } from './config';
import { pooledOf, slotsOf } from './merge';
import { addXp } from './player';
import { nextInt } from './rng';
import { TRAITS } from './traits';
import type { GameState, Player, Tier, UnitDef } from './types';
import { UNIT_BY_ID, UNITS } from './units';

// Dyroth's altars: offer a hero, get 1-star heroes of the next cost up (see AltarPower). Gifts are taken from
// the pool and land on the bench as room allows (Player.gifts).

export type AltarKey = 'altar' | 'secondAltar';
export const ALTAR_KEYS: AltarKey[] = ['altar', 'secondAltar'];

// Every cost a shop hero comes in, cheapest first (1, 2, 3, 4, 5, 7).
const TIERS = [...new Set(UNITS.filter((u) => u.shop !== false).map((u) => u.tier))].sort((x, y) => x - y);
// The next cost up from `tier`, or null at the top.
export const nextTier = (tier: Tier): Tier | null => TIERS.find((t) => t > tier) ?? null;

export const altarOf = (p: Player, key: AltarKey): AltarPower | null => powersOf(p)[key] ?? null;

// An altar's uses: one from its first round, then one more every `every` rounds, banked (they stack) until
// spent. Worked out from the round, so nothing ticks: `uses` ready now, and the round the next one comes.
export function altarStatus(p: Player, key: AltarKey, round: number): { uses: number; next: number } {
  const altar = altarOf(p, key);
  if (!altar) return { uses: 0, next: Infinity };
  const due = p.altars?.[key] ?? altar.first;
  const banked = p.altarUses?.[key] ?? 0;
  if (round < due) return { uses: banked, next: due };
  const earned = 1 + Math.floor((round - due) / altar.every);
  return { uses: banked + earned, next: due + earned * altar.every };
}

// Why this unit def can't go on an altar, or null.
export function offerBlock(def: UnitDef): string | null {
  if (def.piece || def.shop === false) return `The ${def.name} can't be offered`;
  if (nextTier(def.tier) === null) return `Nothing costs more than the ${def.name}`;
  return null;
}

// A random hero of this cost from the pool (weighted by copies left, like the shop), with `trait` if given;
// any of that cost if none with the trait is left. Taken out of the pool. Null if the pool has none at all.
export function draw(state: GameState, tier: Tier, trait: string | null): string | null {
  const open = (u: UnitDef) => u.tier === tier && u.shop !== false && !u.locked && (state.pool[u.id] ?? 0) > 0;
  let defs = UNITS.filter((u) => open(u) && (trait === null || u.traits.includes(trait)));
  if (!defs.length) defs = UNITS.filter(open);
  const total = defs.reduce((n, d) => n + state.pool[d.id], 0);
  if (!total) return null;
  let r = nextInt(state, total);
  const def = defs.find((d) => (r -= state.pool[d.id]) < 0)!;
  state.pool[def.id]--;
  return def.id;
}

// One of the unit's traits of this kind, at random; null if it has none.
function pickTrait(state: GameState, def: UnitDef, kind: 'faction' | 'role'): string | null {
  const ids = def.traits.filter((id) => TRAITS[id].kind === kind);
  return ids.length ? ids[nextInt(state, ids.length)] : null;
}

// Offers the unit `uid` on altar `key`, spending one of its uses. Returns an error, or null (gifts queued).
export function offer(state: GameState, p: Player, key: AltarKey, uid: number): string | null {
  const altar = altarOf(p, key);
  if (!altar) return 'You have no such altar';
  const status = altarStatus(p, key, state.round);
  if (status.uses === 0) return `The ${altar.name} is ready on round ${roundLabel(status.next)}`;
  let found: { slots: ReturnType<typeof slotsOf>; index: number } | null = null;
  for (const area of ['board', 'bench'] as const) {
    const slots = slotsOf(p, area);
    const index = slots.findIndex((u) => u?.uid === uid);
    if (index >= 0) found = { slots, index };
  }
  if (!found) return 'No such unit';
  const unit = found.slots[found.index]!;
  const def = UNIT_BY_ID[unit.defId];
  const blocked = offerBlock(def);
  if (blocked) return blocked;
  const tier = nextTier(def.tier)!;

  found.slots[found.index] = null;
  if (unit.defId in state.pool) state.pool[unit.defId] += pooledOf(unit);
  const wanted = altar.gifts === 'traits' ? [pickTrait(state, def, 'faction'), pickTrait(state, def, 'role')] : [null];
  const gifts = wanted.map((trait) => draw(state, tier, trait)).filter((id) => id !== null);
  (p.gifts ??= []).push(...gifts);
  // Spend one use; the countdown to the next keeps going as it was.
  (p.altars ??= {})[key] = status.next;
  (p.altarUses ??= {})[key] = status.uses - 1;
  p.altarLast = { key, offered: unit.defId, gifts };
  addXp(p, altar.xp);
  return null;
}
