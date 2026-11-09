import { draw } from './altar';
import { powersOf } from './commanders';
import { baseItemOf, ESSENCE_CORE, ITEMS } from './items';
import { mergeUnits } from './merge';
import { baseStats, type StatMod } from './stats';
import type { Trigger } from './traits/types';
import type { GameState, Player, Unit } from './types';
import { UNIT_BY_ID } from './units';

// Luo Yi's Essence Altar. A hero put on it leaves the board and bench (it doesn't count toward traits) and,
// with the items it held, turns into the Essence Core: an item another hero holds (one slot). The holder gets
// a share of the altar hero's HP, attack, magic attack, armor and magic resist, the same share of its items'
// stats, and an Enhancement Effect for each of its roles. The hero can be taken back out (core and all), or
// swapped for another (the core stays where it is, with the new hero's essence).

// Enhancement Effects, by role (factions have none). Tune with `bun run balance`.
export const ESSENCE_ROLES: Record<string, { text: string; mods?: StatMod[]; trigger?: Trigger; freeHero?: number }> = {
  fighter: { text: '+25% basic attack damage', mods: [{ stat: 'basicAmp', add: 0.25 }] },
  dauntless: { text: 'a shield of 25% of max HP when combat starts', mods: [{ stat: 'startShield', add: 0.25 }] },
  defender: { text: '+20 armor and magic resist', mods: [{ stat: 'armor', add: 20 }, { stat: 'mr', add: 20 }] },
  weaponmaster: {
    text: '+20% attack and 5% lifesteal on all damage',
    mods: [{ stat: 'atk', pct: 0.2 }, { stat: 'lifesteal', add: 0.05 }, { stat: 'spellLifesteal', add: 0.05 }],
  },
  deadeye: { text: '+20% crit chance', mods: [{ stat: 'critChance', add: 0.2 }] },
  mage: { text: '+25% magic attack', mods: [{ stat: 'ap', pct: 0.25 }] },
  stargazer: { text: '+6 mana per second', mods: [{ stat: 'manaRegen', add: 6 }] },
  hunter: { text: 'basic attacks reduce the target\'s armor and magic resist by 20', mods: [{ stat: 'armorShred', add: 20 }] },
  phasewarper: {
    text: 'the first time it drops below 50% HP, it warps to the safest tile, heals 30% of its max HP and deals +20% damage for the rest of combat',
    trigger: { below: 0.5, teleport: true, healPct: 0.3, mods: [{ stat: 'damageAmp', add: 0.2 }] },
  },
  scavenger: { text: 'every two rounds, the cheapest hero in your shop is yours for free', freeHero: 2 },
};

const all = (p: Player) => [...p.board, ...p.bench];
export const essenceCore = (p: Player) => p.items.find((i) => baseItemOf(i.id) === ESSENCE_CORE) ?? null; // enhanced too
// The hero holding the core, if it's fielded (only then does the core work).
export const coreHolder = (p: Player): Unit | null => {
  const core = essenceCore(p);
  return core?.holder == null ? null : (p.board.find((u) => u?.uid === core.holder) ?? null);
};
// The altar hero's roles that have an effect.
export const essenceRoles = (p: Player): string[] => (p.essence?.hero ? UNIT_BY_ID[p.essence.hero.defId].traits.filter((t) => ESSENCE_ROLES[t]) : []);

// Why this unit can't go on the altar, or null.
export function essenceBlock(p: Player, uid: number): string | null {
  if (!powersOf(p).essence) return 'You have no Essence Altar';
  const unit = all(p).find((u) => u?.uid === uid);
  if (!unit) return 'No such unit';
  if (UNIT_BY_ID[unit.defId].piece) return `The ${UNIT_BY_ID[unit.defId].name} can't go on the altar`;
  return null;
}

// Puts unit `uid` on the altar. A hero already there comes back to the slot the new one left.
export function essenceIn(state: GameState, p: Player, uid: number): string | null {
  const blocked = essenceBlock(p, uid);
  if (blocked) return blocked;
  const slots = p.board.some((u) => u?.uid === uid) ? p.board : p.bench;
  const at = slots.findIndex((u) => u?.uid === uid);
  const unit = slots[at]!;
  let core = essenceCore(p);
  // The core can't hold itself: off this hero first.
  if (core?.holder === uid) core.holder = null;
  const old = p.essence?.hero ? { hero: p.essence.hero, items: p.essence.items } : null;
  const items = p.items.filter((i) => i.holder === uid);
  p.items = p.items.filter((i) => i.holder !== uid);
  slots[at] = null;
  if (old) {
    // The old hero takes the new one's place, its items back with it.
    slots[at] = old.hero;
    p.items.push(...old.items);
  }
  p.essence = { hero: unit, items };
  if (!core) {
    core = { uid: state.nextUid++, id: ESSENCE_CORE, tier: 1, holder: null };
    p.items.push(core);
  }
  // Back among the others, it combines with copies picked up meanwhile.
  if (old) mergeUnits(p, old.hero.defId);
  return null;
}

// Takes the altar hero back to the bench, with its items; the core goes.
export function essenceOut(p: Player): string | null {
  const hero = p.essence?.hero;
  if (!hero) return 'The altar is empty';
  const free = p.bench.indexOf(null);
  if (free < 0) return 'Your bench is full';
  p.bench[free] = hero;
  p.items = p.items.filter((i) => baseItemOf(i.id) !== ESSENCE_CORE);
  p.items.push(...p.essence!.items);
  p.essence = { hero: null, items: [] };
  // Copies picked up while it was on the altar combine with it now.
  mergeUnits(p, hero.defId);
  return null;
}

// What the core gives its holder: the altar hero's share of stats and items, then its role effects.
export function essenceMods(p: Player): StatMod[] {
  const hero = p.essence?.hero;
  const rule = powersOf(p).essence;
  if (!hero || !rule) return [];
  const share = rule.share;
  const s = baseStats(UNIT_BY_ID[hero.defId], hero.star);
  const mods: StatMod[] = (['hp', 'atk', 'ap', 'armor', 'mr'] as const).map((stat) => ({ stat, add: s[stat] * share }));
  for (const it of p.essence!.items) {
    const def = ITEMS[it.id];
    for (const m of [...def.mods(it.tier), ...(def.unique?.(it.tier) ?? []), ...(def.passives ?? []).flatMap((ps) => ps.mods)]) {
      mods.push({ stat: m.stat, ...(m.add !== undefined ? { add: m.add * share } : {}), ...(m.pct !== undefined ? { pct: m.pct * share } : {}) });
    }
  }
  for (const role of essenceRoles(p)) mods.push(...(ESSENCE_ROLES[role].mods ?? []));
  return mods;
}

// Combat triggers the core hands its holder (Phasewarper's warp).
export const essenceTriggers = (p: Player, uid: number): { trait: string; trigger: Trigger }[] =>
  coreHolder(p)?.uid === uid ? essenceRoles(p).flatMap((role) => (ESSENCE_ROLES[role].trigger ? [{ trait: role, trigger: ESSENCE_ROLES[role].trigger! }] : [])) : [];

// Round start: a Scavenger essence takes the cheapest shop hero every two rounds (while the core is held).
export function essenceRound(state: GameState, p: Player, loot: (rule: 'cheapest') => string | null): void {
  if (!coreHolder(p)) return;
  for (const role of essenceRoles(p)) {
    const every = ESSENCE_ROLES[role].freeHero;
    if (every && state.round % every === 0) loot('cheapest');
  }
}

// Luo Yi's card: a random hero of its tier when picked, then that same hero every round until the total.
export function payEcho(state: GameState, p: Player): void {
  const rule = powersOf(p).echo;
  if (!rule) return;
  if (!p.echo) {
    const id = draw(state, rule.tier as 3, null);
    if (!id) return;
    p.echo = { defId: id, given: 1 };
    (p.gifts ??= []).push(id);
    return;
  }
  if (p.echo.given >= rule.total || (state.pool[p.echo.defId] ?? 0) <= 0) return;
  state.pool[p.echo.defId]--;
  p.echo.given++;
  (p.gifts ??= []).push(p.echo.defId);
}

// Knocked out: the altar hero (and its copies) go back to the pool.
export function releaseEssence(state: GameState, p: Player, copies: (u: Unit) => number): void {
  const hero = p.essence?.hero;
  if (hero && hero.defId in state.pool) state.pool[hero.defId] += copies(hero);
  if (p.essence) p.essence = { hero: null, items: [] };
}
