export type Tier = 1 | 2 | 3 | 4 | 5 | 7; // 7: the one 7-gold unit
export type Star = 1 | 2 | 3;

export interface UnitDef {
  id: string;
  name: string;
  tier: Tier; // also the gold cost
  traits: string[]; // trait ids, see traits.ts
  // 1★ combat stats; higher stars scale hp, atk and ap by STAR_MULT.
  hp: number;
  atk: number; // physical attack: physical basic attacks, "attack"-scaled effects
  ap: number; // magic attack: magic basic attacks and magic skill damage
  armor: number; // reduces physical damage
  mr: number; // magic resist, reduces magic damage
  mana: number; // max mana; casts when full
  range: number; // in cells, Chebyshev distance
  attackTicks: number; // ticks between attacks
  skill?: string; // skill id (see skills/); without one the unit uses the placeholder cast
  shop?: false; // false: never in the shop or the pool; only handed out (e.g. by a trait reward)
  locked?: true; // in a player's shop only once something unlocks it for them (Player.unlocked)
  shopTier?: Tier; // the shop odds column it's rolled under, if not its own tier
  freeSlot?: true; // doesn't count toward the board limit (level)
  summon?: true; // only exists inside a fight, summoned by a skill: never owned, shown or sold
  // Gets this trait's member bonuses without being a member or counting toward it (like an item bearer).
  honorary?: { trait: string; icon: string };
  attackType?: 'physical' | 'magic'; // damage type of basic attacks; physical if unset
}

export interface Unit {
  uid: number;
  defId: string;
  star: Star;
}

export interface MistOrb {
  uid: number;
  trait: string;
  holder: number | null; // unit uid
}

export interface Item {
  uid: number;
  id: string; // item def id, see items/
  tier: number;
  holder: number | null; // uid of the unit holding it, null = in the inventory
}

// An applied Magic Orb: every fielded unit of this type adds +1 to this trait.
export interface Orb {
  defId: string;
  trait: string;
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  hp: number;
  gold: number;
  level: number;
  xp: number;
  bench: (Unit | null)[];
  board: (Unit | null)[]; // row-major, BOARD_COLS * BOARD_ROWS, row 0 is the front line
  shop: (string | null)[]; // unit def ids, already taken out of the pool
  shopLocked: boolean; // skip the next free refresh, then unlock
  place: number | null; // finishing position, set once eliminated (or on winning)
  stacks: Record<string, number>; // trait id -> counter kept all game (e.g. Storyweaver stories)
  rewards?: Record<string, number>; // trait id -> how many of its stack rewards were handed out
  rewardUnit?: Record<string, string>; // trait id -> the reward unit rolled for this player (see stacks.rewardUnits)
  promotions?: { defId: string; star: Star }[]; // merges since the last sync, for traits that react to them
  gifts?: string[]; // free units already taken from the pool, waiting for bench room
  unlocked?: string[]; // locked unit ids this player's shop may now offer
  mistShop?: string[]; // the Mist Shop's 3 wares on offer (see mistShop.ts), once it has opened
  mistBonus?: { atk: number; def: number }; // bought Blades / Shields: % attack and magic attack, % armor and mr, for every fielded unit
  // Mist orbs (from the Mist Shop), held like items: +1 to `trait` while the holder is fielded. Back to
  // the inventory (holder null) when the holder leaves; movable any time. See mistShop.ts.
  mistOrbs?: MistOrb[];
  items: Item[];
  orbs: number[]; // unused Magic Orbs (each one's seed)
  orb: Orb | null; // the one in use
}

// Plain data only, so the whole state can be serialized and sent over the wire later.
export interface GameState {
  round: number;
  rng: number;
  nextUid: number;
  pool: Record<string, number>;
  players: Player[];
  chosen: Record<string, string>; // trait id -> unit def id it picked for the whole game, same for everyone
}

export type Area = 'bench' | 'board';

export interface Loc {
  area: Area;
  index: number;
}
