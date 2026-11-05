import type { Point, Side } from '../grid';
import type { DamageType, Stats } from '../stats';

// The parts of a fighter a skill may read or change.
export interface SkillFighter extends Point {
  id: number;
  side: Side;
  star: number;
  hp: number;
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
  // a basic hit (an enhanced basic attack) can crit, applies shred and heals by lifesteal.
  hit(source: SkillFighter, target: SkillFighter, raw: number, type: DamageType, effect: string): boolean;
  basicHit(source: SkillFighter, target: SkillFighter, raw: number, type: DamageType, effect: string): boolean;
  safestCell(f: SkillFighter): Point; // free cell farthest from every living enemy
  dashTo(f: SkillFighter, to: Point): void;
  guard(f: SkillFighter, seconds: number, reduction: number): void; // takes less damage for a while
}

// A unit's active skill: replaces the placeholder cast when its mana is full.
export interface SkillDef {
  id: string;
  name: string;
  // One description for every star; each {key} is filled from values(), one value per star.
  desc: string;
  values(): Record<string, string[]>;
  cast(api: SkillApi, caster: SkillFighter, target: SkillFighter): void;
}
