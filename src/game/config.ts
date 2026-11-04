export const BENCH_SIZE = 8;
export const BOARD_COLS = 8;
export const BOARD_ROWS = 4;
export const SHOP_SIZE = 5;

export const REROLL_COST = 2;
export const XP_COST = 4;
export const XP_PER_BUY = 4;
export const PASSIVE_XP = 2;
export const MAX_LEVEL = 9;

export const BASE_INCOME = 5;
export const MAX_INTEREST = 5;
export const START_HP = 100;

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
