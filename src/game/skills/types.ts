import type { Point, Side } from '../grid';
import type { DamageType, StatKey, Stats } from '../stats';

// The parts of a fighter a skill may read or change.
export interface SkillFighter extends Point {
  id: number;
  side: Side;
  star: number;
  hp: number;
  maxHp: number;
  dealt: number; // damage it has dealt so far this fight
  stats: Stats;
  skill: Record<string, number>; // the skill's own memory for this fight (e.g. casts so far)
}

// What combat lets a skill do. Everything goes through here so events, deaths, triggers
// and lifesteal stay consistent with the rest of combat.
export interface SkillApi {
  enemiesOf(f: SkillFighter): SkillFighter[]; // living
  nearestEnemy(f: SkillFighter): SkillFighter | null;
  occupant(p: Point): SkillFighter | null; // living fighter on a cell, if any
  // Both return whether the hit killed. A skill hit can't crit and heals by spell lifesteal;
  // a basic hit (an enhanced basic attack) can crit, gets basic attack damage, applies shred and heals by lifesteal.
  hit(source: SkillFighter, target: SkillFighter, raw: number, type: DamageType, effect: string): boolean;
  basicHit(source: SkillFighter, target: SkillFighter, raw: number, type: DamageType, effect: string): boolean;
  safestCell(f: SkillFighter): Point; // free cell farthest from every living enemy
  dashTo(f: SkillFighter, to: Point): void;
  guard(f: SkillFighter, seconds: number, reduction: number): void; // takes less damage for a while
  // Absorbs the next `amount` damage (after armor/mr) for `seconds`. Replaces any shield it had.
  shield(f: SkillFighter, amount: number, seconds: number): void;
  // Runs `fn` every `seconds`, `times` times, first one `seconds` from now. Stops if `f` dies;
  // keeps going while it's stunned.
  repeat(f: SkillFighter, seconds: number, times: number, fn: () => void): void;
  // Lowers a target's armor and/or magic resist for a while. Recasting the same effect on it
  // refreshes the debuff instead of stacking it; different effects stack.
  // Adds flat stats to a unit for `seconds` (Infinity = the rest of the fight). Re-applying the same
  // effect to the same unit refreshes it instead of stacking.
  buff(target: SkillFighter, mods: { stat: StatKey; add: number }[], seconds: number, effect: string, by: SkillFighter): void;
  // Whether `f` currently has a buff from `effect`.
  hasBuff(f: SkillFighter, effect: string): boolean;
  // Cosmetic: shows `count` marks from `effect` on `target` (0 clears them).
  showMarks(target: SkillFighter, count: number, effect: string): void;
  // Living allies of `f` (itself included).
  alliesOf(f: SkillFighter): SkillFighter[];
  // While busy, a unit neither attacks nor walks (it can still be hit, and its skill effects keep going).
  busy(f: SkillFighter, on: boolean): void;
  // Sets cells on fire for `seconds`: every 0.5s, each enemy of `source` standing in one takes
  // half of `perSecond` as a skill hit of `type`. Re-burning a cell refreshes it.
  burn(source: SkillFighter, cells: Point[], perSecond: number, type: DamageType, seconds: number, effect: string): void;
  // Purely cosmetic: tells the UI to draw `count` orbs circling `f` for `seconds`.
  showOrbit(f: SkillFighter, count: number, seconds: number, effect: string): void;
  // What its basic attacks hit with: attack as physical, or magic attack as magic for magic attackers.
  attackPower(f: SkillFighter): { amount: number; type: DamageType };
  debuff(target: SkillFighter, amount: { armor?: number; mr?: number }, seconds: number, effect: string): void;
}

// A unit's active skill: replaces the placeholder cast when its mana is full.
export interface SkillDef {
  id: string;
  name: string;
  // One description for every star; each {key} is filled from values(), one value per star.
  desc: string;
  values(): Record<string, string[]>;
  cast(api: SkillApi, caster: SkillFighter, target: SkillFighter): void;
  // A passive: runs once when the fight starts (positions are the starting ones).
  atStart?(api: SkillApi, caster: SkillFighter): void;
  // A passive: runs after each of the unit's own basic attacks that leaves the target alive.
  onBasicHit?(api: SkillApi, caster: SkillFighter, target: SkillFighter): void;
}
