import { nextInt } from '../rng';
import { applyMods, baseStats, type StatMod, type Stats } from '../stats';
import type { Player, Star, Unit, UnitDef } from '../types';
import { UNIT_BY_ID, UNITS } from '../units';
import { deadeye } from './deadeye';
import { dragonAltar } from './dragonAltar';
import { phasewarper } from './phasewarper';
import { scavenger } from './scavenger';
import { skybringer } from './skybringer';
import { stargazer } from './stargazer';
import { storyweaver } from './storyweaver';
import type { Pulse, RoundStart, TraitDef, Trigger } from './types';
import { undead } from './undead';

export type { Pulse, RoundStart, TraitDef, Trigger, UnitContext } from './types';
export { DEADEYE } from './deadeye';
export { DRAGON_ALTAR } from './dragonAltar';
export { PHASEWARPER } from './phasewarper';
export { SCAVENGER } from './scavenger';
export { SKYBRINGER } from './skybringer';
export { STARGAZER } from './stargazer';
export { STORYWEAVER } from './storyweaver';
export { UNDEAD } from './undead';

// Every trait in the game. A new trait is a new module plus one entry here.
export const TRAITS: Record<string, TraitDef> = Object.fromEntries([stargazer, undead, dragonAltar, skybringer, deadeye, phasewarper, storyweaver, scavenger].map((t) => [t.id, t]));

// Trait id -> active level (1 = first breakpoint). Inactive traits are absent.
export type TraitLevels = Record<string, number>;

const hasTrait = (u: Unit, traitId: string) => UNIT_BY_ID[u.defId].traits.includes(traitId);

// Each distinct unit counts once, so duplicates don't stack a trait.
export function traitCounts(board: (Unit | null)[]): Record<string, number> {
  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  for (const u of board) {
    if (!u || seen.has(u.defId)) continue;
    seen.add(u.defId);
    for (const t of UNIT_BY_ID[u.defId].traits) counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}

// Number of breakpoints reached; 0 = inactive.
export function traitLevel(traitId: string, count: number): number {
  return TRAITS[traitId].breakpoints.filter((b) => count >= b).length;
}

export function activeTraits(board: (Unit | null)[]): TraitLevels {
  const levels: TraitLevels = {};
  for (const [id, n] of Object.entries(traitCounts(board))) {
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
  scale: number; // hp/atk multiplier, for the balance tool
}

// Everything the active traits do to one unit.
export function unitMods(def: UnitDef, field: Partial<Field> = {}): StatMod[] {
  const { levels = {}, cell = -1, chosen = {}, stacks = {} } = field;
  return Object.entries(levels).flatMap(([id, level]) =>
    TRAITS[id].mods({ level, member: def.traits.includes(id), cell, chosen: chosen[id] === def.id, stacks: stacks[id] ?? 0 }),
  );
}

// A unit's fighting stats with every active trait applied, exactly as combat uses them.
export function unitStats(def: UnitDef, star: Star, field: Partial<Field> = {}): Stats {
  return applyMods(baseStats(def, star, field.scale), unitMods(def, field));
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

// After a fight: every active stacking trait gains one per enemy that died, within its caps.
export function gainStacks(p: Player, levels: TraitLevels, kills: number): void {
  for (const id of Object.keys(levels)) {
    const rule = TRAITS[id].stacks;
    if (rule) p.stacks[id] = Math.min(rule.max, (p.stacks[id] ?? 0) + Math.min(rule.perFight, kills));
  }
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

// The triggers a unit carries into a fight: its own traits' only.
export function unitTriggers(levels: TraitLevels, def: UnitDef): { trait: string; trigger: Trigger }[] {
  return Object.entries(levels)
    .filter(([id]) => def.traits.includes(id))
    .flatMap(([id, level]) => (TRAITS[id].triggers?.(level) ?? []).map((trigger) => ({ trait: id, trigger })));
}

// Round-start economy of every active trait on this board.
export function roundStartEffects(board: (Unit | null)[]): { trait: string; effect: RoundStart }[] {
  return Object.entries(activeTraits(board)).flatMap(([id, level]) => {
    const effect = TRAITS[id].roundStart?.(level);
    return effect ? [{ trait: id, effect }] : [];
  });
}

// Board swaps [from, to] that seat each tile trait's members on its tiles first,
// then fill any tiles still empty with other units. Pure: the board isn't touched.
export function tileSeating(board: (Unit | null)[]): [number, number][] {
  const b = board.slice();
  const swaps: [number, number][] = [];
  for (const [id, level] of Object.entries(activeTraits(board))) {
    const tiles = TRAITS[id].tiles?.(level) ?? [];
    for (const membersOnly of [true, false]) {
      for (const to of tiles) {
        const here = b[to];
        if (here && (hasTrait(here, id) || !membersOnly)) continue;
        const from = b.findIndex((u, i) => u && !tiles.includes(i) && (!membersOnly || hasTrait(u, id)));
        if (from < 0) break;
        [b[from], b[to]] = [b[to], b[from]];
        swaps.push([from, to]);
      }
    }
  }
  return swaps;
}
