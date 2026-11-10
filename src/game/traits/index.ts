import { nextInt } from '../rng';
import type { Opener } from '../effects';
import { applyMods, baseStats, type StatMod, type Stats } from '../stats';
import type { Orb, Player, Star, Unit, UnitDef } from '../types';
import { UNIT_BY_ID, UNITS } from '../units';
import { astral } from './astral';
import { cultOfFire } from './cultOfFire';
import { dauntless } from './dauntless';
import { deadeye } from './deadeye';
import { defender } from './defender';
import { baseItemOf, isEnhanced, ITEMS } from '../items';
import { dragonAltar } from './dragonAltar';
import { fighter } from './fighter';
import { gustiwana } from './gustiwana';
import { hunter } from './hunter';
import { mage } from './mage';
import { mistbender } from './mistbender';
import { mooneater } from './mooneater';
import { spectre } from './spectre';
import { necromancer } from './necromancer';
import { phasewarper } from './phasewarper';
import { scavenger } from './scavenger';
import { skybringer } from './skybringer';
import { stargazer } from './stargazer';
import { weaponMaster } from './weaponMaster';
import { storyweaver } from './storyweaver';
import type { FightTally, Pulse, RoundStart, TraitDef, Trigger } from './types';

export type { StackReward, FightTally, Pulse, RoundStart, TraitDef, Trigger, UnitContext } from './types';
export { ASTRAL } from './astral';
export { CULT_OF_FIRE } from './cultOfFire';
export { DAUNTLESS } from './dauntless';
export { DEADEYE } from './deadeye';
export { DEFENDER } from './defender';
export { DRAGON_ALTAR } from './dragonAltar';
export { FIGHTER } from './fighter';
export { GUSTIWANA } from './gustiwana';
export { HUNTER } from './hunter';
export { MAGE } from './mage';
export { MISTBENDER } from './mistbender';
export { MOONEATER } from './mooneater';
export { SPECTRE } from './spectre';
export { NECROMANCER } from './necromancer';
export { PHASEWARPER } from './phasewarper';
export { SCAVENGER } from './scavenger';
export { SKYBRINGER } from './skybringer';
export { STARGAZER } from './stargazer';
export { STORYWEAVER } from './storyweaver';
export { WEAPON_MASTER } from './weaponMaster';

// Every trait in the game. A new trait is a new module plus one entry here.
export const TRAITS: Record<string, TraitDef> = Object.fromEntries([stargazer, hunter, dragonAltar, skybringer, deadeye, phasewarper, storyweaver, scavenger, gustiwana, mooneater, cultOfFire, mage, astral, defender, weaponMaster, fighter, dauntless, necromancer, mistbender, spectre].map((t) => [t.id, t]));

// The factions and roles a random orb reward can be (Box round, Prime Selection, Legacy of Valor, Mist Shop random
// orbs and the prizes built on them, Zhu Yong's treasure): only those that reach a 6 breakpoint, so never a small
// trait like Phasewarper, Scavenger, Storyweaver, Mooneater or Mistbender. `kind`: just factions, or just roles.
export const orbTraits = (kind?: 'faction' | 'role'): string[] =>
  Object.values(TRAITS)
    .filter((t) => (kind ? t.kind === kind : t.kind === 'faction' || t.kind === 'role') && t.breakpoints.includes(6))
    .map((t) => t.id);

// Trait id -> active level (1 = first breakpoint). Inactive traits are absent.
export type TraitLevels = Record<string, number>;

const hasTrait = (u: Unit, traitId: string) => UNIT_BY_ID[u.defId].traits.includes(traitId);

// Each distinct unit counts once, so duplicates don't stack a trait. An orb adds +1 to its trait
// while its unit type is fielded.
// The Magic Orb and any Mist orbs each add +1 to their trait while their unit type is fielded.
export function traitCounts(board: (Unit | null)[], orb: Orb | null = null, more: Orb[] = []): Record<string, number> {
  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  for (const u of board) {
    if (!u || seen.has(u.defId)) continue;
    seen.add(u.defId);
    for (const t of UNIT_BY_ID[u.defId].traits) counts[t] = (counts[t] ?? 0) + 1;
  }
  for (const o of orb ? [orb, ...more] : more) if (seen.has(o.defId)) counts[o.trait] = (counts[o.trait] ?? 0) + 1;
  return counts;
}

// Number of breakpoints reached; 0 = inactive.
export function traitLevel(traitId: string, count: number): number {
  return TRAITS[traitId].breakpoints.filter((b) => count >= b).length;
}

export function activeTraits(board: (Unit | null)[], orb: Orb | null = null, more: Orb[] = []): TraitLevels {
  const levels: TraitLevels = {};
  for (const [id, n] of Object.entries(traitCounts(board, orb, more))) {
    const lvl = traitLevel(id, n);
    if (lvl > 0) levels[id] = lvl;
  }
  return levels;
}

// Where a unit stands going into a fight. Everything optional; a benched unit has none of it.
export interface Field {
  levels: TraitLevels;
  cell: number;
  chosen: Record<string, string>; // trait id -> unit def id it picked for the game (GameState.chosen)
  stacks: Record<string, number>; // the owner's counters
  items: { id: string; tier: number; count?: number }[]; // the unit's active items and their working tiers (count: its counter)
  honorary: string[]; // traits it gets member bonuses for without being (or counting as) a member
  extra: StatMod[]; // flat player-wide bonuses (e.g. Mist Shop Blades), on top of traits and items
  leads: string[]; // traits it's the leader of (see traitLeaders)
  scale: number; // hp/atk multiplier, for the balance tool
}

// One entry per item type held (an item and its enhanced version are one type; the enhanced one, else the highest tier).
function uniqueItems(items: { id: string; tier: number }[]): { id: string; tier: number }[] {
  const best = new Map<string, { id: string; tier: number }>();
  for (const it of items) {
    const key = baseItemOf(it.id);
    const had = best.get(key);
    if (!had || (isEnhanced(it.id) && !isEnhanced(had.id)) || (isEnhanced(it.id) === isEnhanced(had.id) && it.tier > had.tier)) best.set(key, it);
  }
  return [...best.values()];
}

// Everything the active traits do to one unit.
export function unitMods(def: UnitDef, field: Partial<Field> = {}): StatMod[] {
  const { levels = {}, cell = -1, chosen = {}, stacks = {}, items = [], honorary = [], leads = [], extra = [] } = field;
  return [
    ...Object.entries(levels).flatMap(([id, level]) =>
      TRAITS[id].mods({
        level,
        member: def.traits.includes(id) || honorary.includes(id),
        cell,
        chosen: chosen[id] === def.id,
        stacks: stacks[id] ?? 0,
        leader: leads.includes(id),
      }),
    ),
    ...items.flatMap((it) => ITEMS[it.id].mods(it.tier)),
    // An item's counter (Supreme Blade's executions).
    ...items.flatMap((it) => ITEMS[it.id].counted?.(it.count ?? 0) ?? []),
    // Unique attributes count once per item type (an item and its enhanced version are one type: the enhanced counts).
    ...uniqueItems(items).flatMap(({ id, tier }) => ITEMS[id].unique?.(tier) ?? []),
    // Named passives (Swift, Longevity...) count once, whichever items carry them.
    ...[...new Map(items.flatMap((it) => (ITEMS[it.id].passives ?? []).map((ps) => [ps.id, ps] as const))).values()].flatMap((ps) => ps.mods),
    ...extra,
  ];
}

// A unit's fighting stats with every active trait applied, exactly as combat uses them.
export function unitStats(def: UnitDef, star: Star, field: Partial<Field> = {}): Stats {
  const bonus = Object.entries(field.levels ?? {}).reduce(
    (n, [id, level]) => n + (def.traits.includes(id) ? (TRAITS[id].starBonus?.(level, def) ?? 0) : 0),
    0,
  );
  return applyMods(baseStats(def, Math.min(4, star + bonus) as Star | 4, field.scale), unitMods(def, field));
}

// Trait id -> uids of the units leading it: for every active trait with a leader, the fielded
// members carrying the most items (as many as `leader.count` allows); ties go to the higher star,
// then higher tier, then board order.
export function traitLeaders(board: (Unit | null)[], levels: TraitLevels, itemCount: (uid: number) => number): Record<string, number[]> {
  const leaders: Record<string, number[]> = {};
  for (const [id, level] of Object.entries(levels)) {
    const leader = TRAITS[id].leader;
    if (!leader) continue;
    const rank = (u: Unit) => [itemCount(u.uid), u.star, UNIT_BY_ID[u.defId].tier];
    const members = board.filter((u): u is Unit => !!u && hasTrait(u, id));
    // Stable sort: equal ranks keep board order.
    members.sort((x, y) => {
      const [a, b] = [rank(x), rank(y)];
      const k = a.findIndex((n, i) => n !== b[i]);
      return k < 0 ? 0 : b[k] - a[k];
    });
    const top = members.slice(0, leader.count?.(level) ?? 1).map((u) => u.uid);
    if (top.length) leaders[id] = top;
  }
  return leaders;
}

// Rolled once at game start: each `chosen` trait picks one eligible unit for everyone, all game.
export function rollChosen(rng: { rng: number }): Record<string, string> {
  const picks: Record<string, string> = {};
  for (const t of Object.values(TRAITS)) {
    if (!t.chosen) continue;
    const pool = UNITS.filter((u) => u.traits.includes(t.id) && t.chosen!.tiers.includes(u.tier));
    if (pool.length > 0) picks[t.id] = pool[nextInt(rng, pool.length)].id;
  }
  return picks;
}

// The trait (if any) whose chosen unit this is, given which traits are active.
export function chosenBy(levels: TraitLevels, chosen: Record<string, string>, defId: string): string | null {
  return Object.keys(levels).find((id) => chosen[id] === defId) ?? null;
}

// After a fight: every active counting trait gains its per-fight amount, up to its max.
export function gainStacks(p: Player, levels: TraitLevels, tally: (traitId: string) => FightTally): void {
  for (const [id, level] of Object.entries(levels)) {
    const rule = TRAITS[id].stacks?.perFight;
    if (rule) addStacks(p, id, rule(level, tally(id)));
  }
}

// At round start: every active counting trait gains its per-round amount, from the units deployed now.
export function roundStacks(p: Player): void {
  const deployed = p.board.filter((u) => u && !UNIT_BY_ID[u.defId].piece).length;
  for (const [id, level] of Object.entries(playerTraits(p))) addStacks(p, id, TRAITS[id].stacks?.perRound?.(level, deployed) ?? 0);
}

function addStacks(p: Player, id: string, n: number): void {
  const rule = TRAITS[id].stacks;
  if (rule && n > 0) p.stacks[id] = Math.min(rule.max, (p.stacks[id] ?? 0) + n);
}

// Board cell -> id of the trait that marks it as a special tile.
export function traitTiles(levels: TraitLevels): Map<number, string> {
  const tiles = new Map<number, string>();
  for (const [id, level] of Object.entries(levels)) {
    for (const cell of TRAITS[id].tiles?.(level) ?? []) tiles.set(cell, id);
  }
  return tiles;
}

// Every pulse the active traits fire, tagged with the trait that fires it.
export function traitPulses(levels: TraitLevels): { trait: string; pulse: Pulse }[] {
  return Object.entries(levels).flatMap(([id, level]) => (TRAITS[id].pulses?.(level) ?? []).map((pulse) => ({ trait: id, pulse })));
}

// The triggers a unit carries into a fight: only its synergies' (`traits`: its own, plus any orb's on it).
export function unitTriggers(levels: TraitLevels, traits: Iterable<string>): { trait: string; trigger: Trigger }[] {
  const mine = new Set(traits);
  return Object.entries(levels)
    .filter(([id]) => mine.has(id))
    .flatMap(([id, level]) => (TRAITS[id].triggers?.(level) ?? []).map((trigger) => ({ trait: id, trigger })));
}

// A player's active traits: their board plus their orb.
export const playerTraits = (p: Pick<Player, 'board' | 'orb' | 'mistOrbs' | 'twilight'>) => activeTraits(p.board, p.orb, fieldedMistOrbs(p));
// A player's trait counts: board, Magic Orb and Mist orbs.
export const playerTraitCounts = (p: Pick<Player, 'board' | 'orb' | 'mistOrbs' | 'twilight'>) => traitCounts(p.board, p.orb, fieldedMistOrbs(p));
// Mist orbs on fielded units, as orbs on their unit type. Each counts once, even on two copies of a type.
// Lunox's Twilight Blessing counts the same way, while the very unit it's on is fielded.
export function fieldedMistOrbs(p: Pick<Player, 'board' | 'mistOrbs' | 'twilight'>): Orb[] {
  const orbs = (p.mistOrbs ?? []).flatMap((o) => {
    const holder = p.board.find((u) => u && u.uid === o.holder);
    return holder ? [{ defId: holder.defId, trait: o.trait }] : [];
  });
  const tw = p.twilight;
  const blessed = tw?.trait && tw.holder !== null ? p.board.find((u) => u && u.uid === tw.holder) : null;
  return blessed ? [...orbs, { defId: blessed.defId, trait: tw!.trait! }] : orbs;
}

// Round-start economy of every active trait for this player.
export function roundStartEffects(p: Pick<Player, 'board' | 'orb'>): { trait: string; effect: RoundStart }[] {
  return Object.entries(playerTraits(p)).flatMap(([id, level]) => {
    const effect = TRAITS[id].roundStart?.(level);
    return effect ? [{ trait: id, effect }] : [];
  });
}

// Battle-start effects a unit brings from its active synergies (`traits`: its own, plus any orb's on it).
export function unitOpeners(levels: TraitLevels, traits: Iterable<string>): { source: string; opener: Opener }[] {
  const mine = new Set(traits);
  return Object.entries(levels).flatMap(([id, level]) => {
    const opener = mine.has(id) ? TRAITS[id].opener?.(level) : undefined;
    return opener ? [{ source: id, opener }] : [];
  });
}

// Board swaps [from, to] that seat each tile trait's members on its tiles first,
// then fill any tiles still empty with other units. Pure: the board isn't touched.
export function tileSeating(board: (Unit | null)[], orb: Orb | null = null, more: Orb[] = []): [number, number][] {
  const b = board.slice();
  const swaps: [number, number][] = [];
  for (const [id, level] of Object.entries(activeTraits(board, orb, more))) {
    const tiles = TRAITS[id].tiles?.(level) ?? [];
    for (const membersOnly of [true, false]) {
      for (const to of tiles) {
        const here = b[to];
        // Commander pieces stay where their owner put them.
        if (here && (hasTrait(here, id) || !membersOnly || UNIT_BY_ID[here.defId].piece)) continue;
        const from = b.findIndex((u, i) => u && !UNIT_BY_ID[u.defId].piece && !tiles.includes(i) && (!membersOnly || hasTrait(u, id)));
        if (from < 0) break;
        [b[from], b[to]] = [b[to], b[from]];
        swaps.push([from, to]);
      }
    }
  }
  return swaps;
}
