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
}

export interface Unit {
  uid: number;
  defId: string;
  star: Star;
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
  place: number | null; // finishing position, set once eliminated (or on winning)
  stacks: Record<string, number>; // trait id -> counter kept across fights (e.g. Storyweaver stories)
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
