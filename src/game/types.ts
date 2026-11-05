export type Tier = 1 | 2 | 3 | 4 | 5;
export type Star = 1 | 2 | 3;

export interface UnitDef {
  id: string;
  name: string;
  tier: Tier; // also the gold cost
  traits: string[]; // trait ids, see traits.ts
  // 1★ combat stats; higher stars scale hp and atk by STAR_MULT.
  hp: number;
  atk: number;
  armor: number; // reduces physical damage
  mr: number; // magic resist, reduces magic damage
  mana: number; // max mana; casts when full
  range: number; // in cells, Chebyshev distance
  attackTicks: number; // ticks between attacks
  skill?: string; // skill id (see skills/); without one the unit uses the placeholder cast
  attackType?: 'physical' | 'magic'; // damage type of basic attacks; physical if unset
}

export interface Unit {
  uid: number;
  defId: string;
  star: Star;
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
  stacks: Record<string, number>; // trait id -> counter kept across fights (e.g. Storyweaver stories)
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
