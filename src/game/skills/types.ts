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
  chosen: string | null; // id of the trait whose chosen unit (e.g. Storyweaver protagonist) this is, if active
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
  // `show`: how many seconds the move animates (default: a quick dash), or false to not animate it (a showLeap draws it).
  // `effect`: whose dash it is, for its look on the board (cosmetic only).
  dashTo(f: SkillFighter, to: Point, show?: number | false, effect?: string): void;
  guard(f: SkillFighter, seconds: number, reduction: number): void; // takes less damage for a while
  // Absorbs the next `amount` damage (after armor/mr) for `seconds`. Replaces any shield it had.
  // Adds a shield layer from `effect` on top of any others: damage eats the newest layer first. A new
  // layer from the same effect replaces the old one. `onEnd`, if given, runs once when this layer ends:
  // broken, run out, or replaced (not if the unit is dead by then).
  shield(f: SkillFighter, amount: number, seconds: number, effect: string, onEnd?: () => void): void;
  // Runs `fn` every `seconds`, `times` times, first one `seconds` from now. Stops if `f` dies;
  // keeps going while it's stunned.
  repeat(f: SkillFighter, seconds: number, times: number, fn: () => void): void;
  // Lowers a target's armor and/or magic resist for a while. Recasting the same effect on it
  // refreshes the debuff instead of stacking it; different effects stack.
  // Adds flat stats to a unit for `seconds` (Infinity = the rest of the fight). Re-applying the same
  // effect to the same unit refreshes it instead of stacking.
  buff(target: SkillFighter, mods: { stat: StatKey; add: number }[], seconds: number, effect: string, by: SkillFighter): void;
  // Takes a buff off early (e.g. one that lasts a number of attacks rather than seconds).
  unbuff(f: SkillFighter, effect: string): void;
  // Whether `f` currently has a buff from `effect`.
  hasBuff(f: SkillFighter, effect: string): boolean;
  // Cosmetic: shows `count` marks from `effect` on `target` (0 clears them).
  showMarks(target: SkillFighter, count: number, effect: string): void;
  // Puts a summon of `defId` on the side of `owner`, with `hpShare` of the owner's max hp, on a free cell
  // beside `opts.at` (default: beside the owner), or null if there's no room. Two kinds:
  //  - a mirror (`mirror` set): never acts on its own, repeats `mirror` x each of the owner's basic
  //    attacks on the same target (crits included), and vanishes when the owner dies;
  //  - a fighter (no `mirror`): moves and attacks on its own with `atk` (as attack and magic attack),
  //    and stays when the owner dies.
  summon(owner: SkillFighter, defId: string, opts: { hpShare: number; mirror?: number; atk?: number; at?: Point }): SkillFighter | null;
  // Takes one of its summons off the board (gone, not killed: nothing counts it as a death by a hit).
  dismiss(minion: SkillFighter): void;
  // `f`'s living summons.
  minionsOf(f: SkillFighter): SkillFighter[];
  // Taunts `target` for `seconds`: it must go after `by` (while `by` lives).
  taunt(target: SkillFighter, by: SkillFighter, seconds: number): void;
  // Links `targets`: while `by` lives, damage any of them takes is shared with the others
  // (`share` of it, as pure damage credited to `by`). Shared damage isn't shared again.
  link(by: SkillFighter, targets: SkillFighter[], share: number): void;
  // Every enemy currently going after `f` drops it and picks a new target.
  dropAggro(f: SkillFighter): void;
  // Stuns `target` for `seconds` (a longer stun it already has wins).
  stun(target: SkillFighter, seconds: number, by: SkillFighter): void;
  // Restores up to `amount` hp (never past max), credited to `by` (else the target). Returns how much it actually healed.
  heal(target: SkillFighter, amount: number, by?: SkillFighter): number;
  // `f` makes a full basic attack on `target` right now, at any range: it can crit, roll Fighter's
  // hit-again, lifesteal and gain mana like any attack. Counters can't trigger counters.
  counterAttack(f: SkillFighter, target: SkillFighter): void;
  // `f` makes a full basic attack on `target` right now, at any range, dealing `mult` x its usual damage:
  // crits, hit-again, lifesteal, mana and every item on-hit effect work as for any attack.
  attack(f: SkillFighter, target: SkillFighter, mult: number): void;
  // Rooted: it never walks. No basic: it never basic-attacks, and casts (at any range) once its mana is full.
  stance(f: SkillFighter, s: { rooted?: boolean; noBasic?: boolean }): void;
  // No stuns, taunts or enemy displacement for the next `seconds` (never shortens immunity it has).
  ccImmune(f: SkillFighter, seconds: number): void;
  // Alive, not stunned and not frozen.
  canAct(f: SkillFighter): boolean;
  // Gives `f` mana (up to its max).
  giveMana(f: SkillFighter, amount: number): void;
  // A random integer in [0, n), from the fight's seeded randomness (fights still replay exactly).
  random(n: number): number;
  // Living allies of `f` (itself included).
  alliesOf(f: SkillFighter): SkillFighter[];
  // While busy, a unit neither attacks nor walks (it can still be hit, and its skill effects keep going).
  busy(f: SkillFighter, on: boolean): void;
  // Sets cells on fire for `seconds`: every 0.5s, each enemy of `source` standing in one takes
  // half of `perSecond` as a skill hit of `type`. Re-burning a cell refreshes it.
  burn(source: SkillFighter, cells: Point[], perSecond: number, type: DamageType, seconds: number, effect: string): void;
  // Purely cosmetic: tells the UI to draw `count` orbs circling `f` for `seconds`.
  showOrbit(f: SkillFighter, count: number, seconds: number, effect: string): void;
  // Purely cosmetic: `f` leaps in an arc to `to` over `seconds` (it doesn't move; dashTo does that).
  showLeap(f: SkillFighter, to: Point, seconds: number): void;
  // Purely cosmetic: a projectile flying from one cell to another over `seconds`.
  showProjectile(from: Point, to: Point, seconds: number, effect: string): void;
  // What its basic attacks hit with: attack as physical, or magic attack as magic for magic attackers.
  attackPower(f: SkillFighter): { amount: number; type: DamageType };
  debuff(target: SkillFighter, amount: { armor?: number; mr?: number }, seconds: number, effect: string): void;
  // Puts `by`'s armor/mr shred (Hunter) on `target` now, as a basic attack would: a skill hit right after
  // already benefits. Skill hits don't shred on their own.
  shred(target: SkillFighter, by: SkillFighter): void;
}

// A unit's active skill: replaces the placeholder cast when its mana is full.
export interface SkillDef {
  id: string;
  name: string;
  // One description for every star; each {key} is filled from values(), one value per star.
  desc: string;
  values(): Record<string, string[]>; // a value the same at every star may be given once
  // Which {key}s are damage, and of what type ('attack': its basic attack's type; 'adaptive': physical or magic,
  // whichever of its attack and magic attack is higher).
  damage?: Record<string, DamageType | 'attack'>;
  cast(api: SkillApi, caster: SkillFighter, target: SkillFighter): void;
  // A passive: runs once when the fight starts (positions are the starting ones).
  atStart?(api: SkillApi, caster: SkillFighter): void;
  // Runs `atStart` after every other skill's: for passives that move the unit (a leap), so buffs that
  // depend on where it stands (an ally beside it, its row) still reach it first.
  atStartLate?: true;
  // A passive execute: an enemy on the tiles around it that is damaged and left below this share of
  // its max hp (per star) dies on the spot, through shields.
  executeBelow?: number[];
  // A passive: runs when an enemy's basic attack hits this unit (and it survives). Not for counters.
  onAttacked?(api: SkillApi, caster: SkillFighter, attacker: SkillFighter): void;
  // A passive: runs after each of the unit's own basic attacks (the target may have died to it).
  onBasicHit?(api: SkillApi, caster: SkillFighter, target: SkillFighter): void;
  // A passive: runs once after each of the unit's whole basic attacks, Fighter's hit-again included
  // (counters too; not enhanced basic hits from skills).
  afterAttack?(api: SkillApi, caster: SkillFighter, target: SkillFighter): void;
  // A passive: each of its basic attacks is `shots` basic hits of `power` x a normal one (each sets off
  // on-hit and item effects; mana comes once per attack). Asked anew for every attack.
  volley?(caster: SkillFighter): { shots: number; power: number };
}
