import type { Opener } from '../effects';
import type { DamageType, StatMod } from '../stats';

// What a trait sees about one unit when its side has the trait active.
export interface UnitContext {
  level: number; // active level, 1 = first breakpoint
  member: boolean; // the unit itself has this trait
  cell: number; // board index the unit starts on
  chosen: boolean; // this unit is the trait's chosen one for the game (see TraitDef.chosen)
  stacks: number; // the owner's counter for this trait (see TraitDef.stacks)
  leader: boolean; // this unit is the trait's leader on its board (see TraitDef.leader)
}

// Timed damage from the trait itself (not from a unit), hitting every enemy.
// First strike lands `every` seconds into the fight.
export interface Pulse {
  every: number; // seconds
  times: number;
  pctMaxHp: number; // of each target's max hp
  damageType: DamageType;
}

// Economy at the start of a round, right after the free shop refresh.
export interface RoundStart {
  gold?: number;
  loot?: 'cheapest' | 'random'; // take one unit from the shop for free; ties on cheapest are random
}

// One-shot reaction of a member the first time its hp falls below `below` (and it survives).
export interface Trigger {
  below: number; // hp fraction
  teleport: boolean; // warp to the free tile farthest from every enemy
  healPct: number; // of max hp
  mods: StatMod[]; // for the rest of the fight
}

// What a side did in one fight, as counting traits see it.
export interface FightTally {
  kills: number; // enemies that died
  memberSkills: number; // skills (real or placeholder) cast by this trait's own units
}

// A trait is pure data plus hooks. The engine asks every active trait for each
// unit's StatMods; it never branches on a trait id.
// One milestone of a counting trait (e.g. the Necromancer grave), claimed once when the counter reaches
// `at`: its reward unit at a star, gold, random equipment, or Magic Orbs.
export type StackReward = { at: number } & ({ star: 1 | 2 | 3 } | { gold: number } | { equipment: number } | { orbs: number });

export interface TraitDef {
  id: string;
  name: string;
  icon: string; // shown in the synergy panel; emoji until there's art
  kind: 'faction' | 'role';
  breakpoints: number[];
  // One sentence for every level, e.g. 'Skybringers deal +{amp} damage'. Each {key}
  // is filled from values(), which gives that key's formatted value per breakpoint.
  desc: string;
  values(): Record<string, string[]>;
  mods(ctx: UnitContext): StatMod[];
  // Board cells this trait marks as special at a level (drawn by the UI, preferred by bots).
  tiles?(level: number): number[];
  pulses?(level: number): Pulse[];
  triggers?(level: number): Trigger[]; // members only
  opener?(level: number): Opener; // members only
  // At game start, one member of these tiers is picked at random as the chosen unit, for every player, all game.
  chosen?: { tiers: number[] };
  roundStart?(level: number): RoundStart | undefined;
  // A member reached a new star by merging, while the trait is active: hand out a free unit
  // (one of `gift`, at random, from the pool) and/or unlock a locked unit for this player's shop.
  onPromote?(level: number, def: import('../types').UnitDef, star: import('../types').Star): { gift?: string[]; unlock?: string } | null;
  // Members fight this many stars higher (stats only), on top of their real star.
  starBonus?(level: number, def: import('../types').UnitDef): number;
  // A shop panel beside the board, open while any member is fielded. Its wares are designed later.
  sideShop?: { title: string };
  // Exclusive items this trait hands out (see items/) and lets the shop upgrade.
  items?: {
    pool: string[];
    grants: number[]; // items owned per level
    shopChance: number; // per shop slot while active: an upgrade card instead of a unit
    maxShopTier: number;
    topLevel?: number; // from this level, every item works at its max tier
  };
  // While active, the fielded member carrying the most items leads the trait (ties: higher star,
  // then higher tier, then first on the board). Its mods see `leader: true`. `count` lets more
  // than one member lead at a given level (default 1).
  leader?: { title: string; icon: string; count?: (level: number) => number };
  // A counter the player keeps all game. It shows up the first time the trait is active and only
  // grows while it's active: after each fight, and at the start of each round.
  stacks?: {
    label: string; // what the counter is called, e.g. 'Stories'
    max: number;
    perFight?(level: number, fight: FightTally): number;
    perRound?(level: number, deployed: number): number; // deployed = units on the board at round start
    // Each reached in order, once per game: the player gets their reward unit at `star`, or their copy is raised to it.
    rewards?: StackReward[]; // in order of `at`; each is claimed once
    // The reward unit: one of these, rolled per player when the counter first appears, then fixed all game.
    rewardUnits?: string[];
    rewardChoices?: number; // how many of rewardUnits are offered to pick from (default 1: rolled, no pick)
    fullAt?: number; // at this level the counter jumps to its max at once
  };
}
