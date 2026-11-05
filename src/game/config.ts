export const BENCH_SIZE = 8;
export const BOARD_COLS = 7;
export const BOARD_ROWS = 3;
export const SHOP_SIZE = 5;

export const REROLL_COST = 2;
export const XP_COST = 4;
export const XP_PER_BUY = 4;
export const PASSIVE_XP = 2;
export const MAX_LEVEL = 9;

export const BASE_INCOME = 5;
export const MAX_INTEREST = 5;
export const START_HP = 100;
export const START_LEVEL = 3;
// Units every player gets before round 1, drawn from the pool at START_LEVEL shop odds.
export const FREE_UNITS = 3;

export const TICKS_PER_SECOND = 10;
export const MAX_COMBAT_TICKS = 45 * TICKS_PER_SECOND;
export const MOVE_TICKS = 4; // ticks to cross one cell
// hp/atk multiplier, indexed by star - 1.
export const STAR_MULT = [1, 1.8, 3.24];
export const MANA_PER_ATTACK = 10;
export const MANA_PER_HIT_TAKEN = 5;
// Placeholder spell until units get real abilities: CAST_MULT x atk, ignores armor.
export const CAST_MULT = 3;
// Basic attacks that crit deal this many times their damage (before trait bonuses).
export const BASE_CRIT_DAMAGE = 1.5;
// Loser takes BASE_DAMAGE plus the stars of every enemy unit still standing.
export const BASE_DAMAGE = 2;

// Copies of each unit in the shared pool, indexed by tier - 1.
export const POOL_SIZE = [29, 22, 18, 12, 10];

// XP needed to go from level n to n + 1, indexed by n - 1.
export const XP_TO_LEVEL = [2, 2, 6, 10, 20, 36, 48, 72];

// Shop odds (%) per tier, indexed by level - 1.
export const SHOP_ODDS = [
  [100, 0, 0, 0, 0],
  [100, 0, 0, 0, 0],
  [75, 25, 0, 0, 0],
  [55, 30, 15, 0, 0],
  [45, 33, 20, 2, 0],
  [30, 40, 25, 5, 0],
  [19, 35, 35, 10, 1],
  [18, 25, 36, 18, 3],
  [10, 20, 25, 35, 10],
];
