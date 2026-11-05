export const BENCH_SIZE = 8;
export const BOARD_COLS = 7;
export const BOARD_ROWS = 3;
export const SHOP_SIZE = 5;

export const REROLL_COST = 2;
// Leveling up buys exactly the xp still missing for the next level, at this price per xp.
export const GOLD_PER_XP = 1;
export const PASSIVE_XP = 2;
export const MAX_LEVEL = 10;

export const BASE_INCOME = 5;
export const INTEREST_PER_10 = 2; // per 10 gold held at round start
export const MAX_INTEREST = 4;
export const START_HP = 100;
export const START_LEVEL = 3;
export const MAX_ITEMS_PER_UNIT = 3;
// Rounds that hand every player a Magic Orb.
export const ORB_ROUNDS = [10, 20, 30];
// Units every player gets before round 1, drawn from the pool at START_LEVEL shop odds.
export const FREE_UNITS = 3;

export const TICKS_PER_SECOND = 10;
export const MAX_COMBAT_TICKS = 45 * TICKS_PER_SECOND;
export const MOVE_TICKS = 4; // ticks to cross one cell
// hp/atk multiplier, indexed by star - 1.
export const STAR_MULT = [1, 1.8, 3.24];
export const MANA_PER_ATTACK = 10;
export const MANA_PER_HIT_TAKEN = 5;
// Placeholder spell until units get real abilities: CAST_MULT x atk as magic damage.
export const CAST_MULT = 3;
// Basic attacks that crit deal this many times their damage (before trait bonuses).
export const BASE_CRIT_DAMAGE = 1.5;
// Loser takes BASE_DAMAGE plus the stars of every enemy unit still standing.
export const BASE_DAMAGE = 2;

// Copies of each unit in the shared pool, indexed by tier - 1.
export const POOL_SIZE = [29, 22, 18, 12, 10];

// XP (= gold, at GOLD_PER_XP 1) needed to go from level n to n + 1, indexed by n - 1.
// Players start at level 3, so the first two entries only matter for tests.
export const XP_TO_LEVEL = [2, 2, 3, 8, 20, 32, 38, 54, 74];

// Shop odds (%) for 1- to 5-gold units, indexed by level - 1. Each row sums to 100.
// Players start at level 3, so the first two rows only matter for tests.
export const SHOP_ODDS = [
  [100, 0, 0, 0, 0],
  [100, 0, 0, 0, 0],
  [60, 30, 10, 0, 0],
  [50, 35, 15, 0, 0],
  [34, 35, 30, 1, 0],
  [25, 30, 40, 5, 0],
  [19, 28, 42, 10, 1],
  [16, 26, 35, 18, 5],
  [13, 22, 25, 26, 14],
  [6, 12, 22, 35, 25],
];
