import { canClaim, gainUnit, type Result } from './actions';
import { nextFloat, nextInt } from './rng';
import { TRAITS } from './traits';
import type { GameState, Player } from './types';
import { UNIT_BY_ID } from './units';

// The Mist Shop (Mistbender): three wares bought with Mist coins. A bought ware's slot refills at random.

export type MistChoice = 'unit' | 'faction' | 'role';

export interface MistWare {
  id: string;
  name: string;
  icon: string;
  price: number;
  desc: string;
  weight: number; // chance to fill an emptied slot, relative to the others (0 = never)
  choose?: MistChoice; // what the buyer picks
  // Applies it; returns an error, or null. `choice` is a unit uid or a trait id when `choose` is set.
  apply(state: GameState, p: Player, choice: string | undefined): string | null;
}

const COIN_TRAIT = 'mistbender'; // whose counter the coins are

const blade = (tier: 1 | 2 | 3): MistWare => ({
  id: `blade${tier}`,
  name: `Blade ${'I'.repeat(tier)}`,
  icon: '🗡️',
  price: 8 * tier,
  desc: `+${tier}% attack and magic attack for every unit you field, for the rest of the game. Stacks.`,
  weight: [5, 3, 2][tier - 1],
  apply(_state, p) {
    p.mistBonus = { atk: (p.mistBonus?.atk ?? 0) + tier / 100, def: p.mistBonus?.def ?? 0 };
    return null;
  },
});
const shield = (tier: 1 | 2 | 3): MistWare => ({
  id: `shield${tier}`,
  name: `Shield ${'I'.repeat(tier)}`,
  icon: '🛡️',
  price: 8 * tier,
  desc: `+${tier}% armor and magic resist for every unit you field, for the rest of the game. Stacks.`,
  weight: [5, 3, 2][tier - 1],
  apply(_state, p) {
    p.mistBonus = { atk: p.mistBonus?.atk ?? 0, def: (p.mistBonus?.def ?? 0) + tier / 100 };
    return null;
  },
});
// A random shop unit of this cost, from the pool (weighted by copies left, like the shop).
const randomUnit = (tier: 4 | 5, price: number): MistWare => ({
  id: `random${tier}`,
  name: `Random ${tier}-gold`,
  icon: tier === 4 ? '🟪' : '🟧',
  price,
  desc: `A random ${tier}-gold unit, straight to your bench.`,
  weight: 1,
  apply(state, p) {
    const defs = Object.values(UNIT_BY_ID).filter((u) => u.tier === tier && u.shop !== false && !u.locked && (state.pool[u.id] ?? 0) > 0);
    const total = defs.reduce((n, d) => n + state.pool[d.id], 0);
    if (!total) return `No ${tier}-gold units left in the pool`;
    let r = nextInt(state, total);
    const def = defs.find((d) => (r -= state.pool[d.id]) < 0)!;
    if (!canClaim(p, def.id)) return 'Bench is full';
    state.pool[def.id]--;
    gainUnit(state, p, def.id);
    return null;
  },
});

const traitIds = (kind: 'faction' | 'role') => Object.values(TRAITS).filter((t) => t.kind === kind).map((t) => t.id);
const orb = (kind: 'faction' | 'role', pick: boolean): MistWare => ({
  id: `${pick ? 'pick' : 'random'}${kind}orb`,
  name: pick ? `${kind === 'faction' ? 'Faction' : 'Role'} Orb` : `Random ${kind === 'faction' ? 'Faction' : 'Role'} Orb`,
  icon: kind === 'faction' ? '🔵' : '🟣',
  price: pick ? 160 : 80,
  desc:
    `${pick ? 'Choose a' : 'A random'} ${kind}. Put the orb on one of your units, like an item: +1 to that ${kind} while it's fielded. ` +
    'Not on a unit whose type has the Magic Orb, and one per unit.',
  weight: pick ? 0.5 : 1,
  ...(pick && { choose: kind }),
  apply(state, p, choice) {
    const options = traitIds(kind);
    const trait = pick ? choice : options[nextInt(state, options.length)];
    if (!trait || !options.includes(trait)) return `Pick a ${kind}`;
    (p.mistOrbs ??= []).push({ uid: state.nextUid++, trait, holder: null });
    return null;
  },
});

export const MIST_WARES: Record<string, MistWare> = Object.fromEntries(
  [
    {
      id: 'mistoracle',
      name: 'Mist Oracle',
      icon: '🌫️',
      price: 60,
      desc: 'The 5-gold Mistbender, straight to your bench.',
      weight: 0, // only in the shop's first batch
      apply(state: GameState, p: Player) {
        if (!state.pool.mistoracle) return 'No Mist Oracle left in the pool';
        if (!canClaim(p, 'mistoracle')) return 'Bench is full';
        state.pool.mistoracle--;
        gainUnit(state, p, 'mistoracle');
        return null;
      },
    } satisfies MistWare,
    blade(1),
    blade(2),
    blade(3),
    shield(1),
    shield(2),
    shield(3),
    {
      id: 'mirror',
      name: 'Mirror Device',
      icon: '👥',
      price: 80,
      desc: 'Copy one of your units: a new 1-star copy of it, from the pool.',
      weight: 1,
      choose: 'unit',
      apply(state: GameState, p: Player, choice: string | undefined) {
        const unit = [...p.board, ...p.bench].find((u) => u && String(u.uid) === choice);
        if (!unit) return 'Pick one of your units to copy';
        if (!state.pool[unit.defId]) return `No ${UNIT_BY_ID[unit.defId].name} left to copy`;
        if (!canClaim(p, unit.defId)) return 'Bench is full';
        state.pool[unit.defId]--;
        gainUnit(state, p, unit.defId);
        return null;
      },
    } satisfies MistWare,
    randomUnit(4, 32),
    randomUnit(5, 40),
    orb('faction', false),
    orb('role', false),
    orb('faction', true),
    orb('role', true),
  ].map((w) => [w.id, w as MistWare]),
);

const CHEAP = ['blade1', 'blade2', 'blade3', 'shield1', 'shield2', 'shield3'];

// A random ware for an emptied slot, by weight.
function randomWare(state: GameState, pool = Object.values(MIST_WARES)): string {
  const total = pool.reduce((n, w) => n + w.weight, 0);
  let r = nextFloat(state) * total;
  for (const w of pool) {
    r -= w.weight;
    if (r < 0) return w.id;
  }
  return pool[pool.length - 1].id;
}

// Opens the shop the first time: Mist Oracle in the middle, a cheap ware either side.
export function openMistShop(state: GameState, p: Player): void {
  if (p.mistShop) return;
  const cheap = CHEAP.map((id) => MIST_WARES[id]);
  p.mistShop = [randomWare(state, cheap), 'mistoracle', randomWare(state, cheap)];
}

export const mistCoins = (p: Player) => p.stacks[COIN_TRAIT] ?? 0;

export function buyMistWare(state: GameState, p: Player, slot: number, choice?: string): Result {
  const id = p.mistShop?.[slot];
  if (!id) return { ok: false, error: 'Nothing there' };
  const ware = MIST_WARES[id];
  if (mistCoins(p) < ware.price) return { ok: false, error: `Needs ${ware.price} Mist coins` };
  const error = ware.apply(state, p, choice);
  if (error) return { ok: false, error };
  p.stacks[COIN_TRAIT] = mistCoins(p) - ware.price;
  p.mistShop![slot] = randomWare(state);
  return { ok: true };
}

// Why unit `uid` can't hold a Mist orb, or null if it can: not on the Magic Orb's unit type, one per unit.
export function orbBlock(p: Player, uid: number): string | null {
  const unit = [...p.board, ...p.bench].find((u) => u?.uid === uid);
  if (!unit) return 'No such unit';
  if (UNIT_BY_ID[unit.defId].piece) return `The ${UNIT_BY_ID[unit.defId].name} can't hold an orb`;
  if (p.orb?.defId === unit.defId) return 'It already has the Magic Orb';
  if (p.mistOrbs?.some((o) => o.holder === uid)) return 'It already holds a faction or role orb';
  return null;
}

// Puts Mist orb `orbUid` on unit `uid`, from the inventory or from another unit.
export function equipMistOrb(p: Player, orbUid: number, uid: number): Result {
  const orb = p.mistOrbs?.find((o) => o.uid === orbUid);
  if (!orb) return { ok: false, error: 'No such Mist orb' };
  if (orb.holder === uid) return { ok: true };
  const block = orbBlock(p, uid);
  if (block) return { ok: false, error: block };
  orb.holder = uid;
  return { ok: true };
}

export function unequipMistOrb(p: Player, orbUid: number): Result {
  const orb = p.mistOrbs?.find((o) => o.uid === orbUid);
  if (!orb) return { ok: false, error: 'No such Mist orb' };
  orb.holder = null;
  return { ok: true };
}

// Orbs whose holder left (sold, merged away, eliminated) go back to the inventory.
export function syncMistOrbs(p: Player): void {
  const units = new Set([...p.board, ...p.bench].flatMap((u) => (u ? [u.uid] : [])));
  for (const o of p.mistOrbs ?? []) if (o.holder !== null && !units.has(o.holder)) o.holder = null;
}
