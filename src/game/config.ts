export const BENCH_SIZE = 8;
export const BOARD_COLS = 7;
export const BOARD_ROWS = 3;
export const SHOP_SIZE = 5;

export const REROLL_COST = 2;
// Leveling up buys exactly the xp still missing for the next level, at this price per xp.
export const GOLD_PER_XP = 1;
export const PASSIVE_XP = 2;
export const MAX_LEVEL = 10;

// --- Economy ---
// At the end of every round: the basic reward, interest and the streak bonus (see player.roundIncome).
// Basic reward by stage (I, II, III, IV and later): it goes up with every new stage, then stays.
export const BASE_REWARD = [4, 5, 6, 7];
export const baseReward = (round: number) => BASE_REWARD[Math.min(stageOf(round), BASE_REWARD.length) - 1];
export const INTEREST_PER_10 = 2; // per 10 gold banked: 10+ gives 2, 20+ gives 4
export const MAX_INTEREST = 4;
// Paid right after winning a fight against a player, before the round's rewards (so it can push interest).
export const WIN_GOLD = 1;
// Streak bonuses by streak length (index = fights in a row; past the end, the last applies). Only fights
// against players count: monster rounds leave a streak as it is. A draw counts as a loss.
export const WIN_STREAK_BONUS = [0, 0, 1, 2, 2, 3];
export const LOSE_STREAK_BONUS = [0, 0, 1, 2, 2, 3];
export const START_HP = 100;
export const START_LEVEL = 3;
export const MAX_ITEMS_PER_UNIT = 3;
// --- Stages ---
// Rounds come in stages: stage I has STAGE_ONE_ROUNDS rounds (I-1 .. I-4), every later stage STAGE_ROUNDS
// (II-1 .. II-6, ...). The game state counts rounds straight through (1, 2, 3, ...); these convert.
export const STAGE_ONE_ROUNDS = 4;
export const STAGE_ROUNDS = 6;

export function stageRound(round: number): { stage: number; sub: number } {
  if (round <= STAGE_ONE_ROUNDS) return { stage: 1, sub: Math.max(1, round) };
  const k = round - STAGE_ONE_ROUNDS - 1;
  return { stage: 2 + Math.floor(k / STAGE_ROUNDS), sub: (k % STAGE_ROUNDS) + 1 };
}
// The round count of stage-round `stage`-`sub` (roundAt(3, 1) is III-1).
export const roundAt = (stage: number, sub: number) => (stage === 1 ? sub : STAGE_ONE_ROUNDS + (stage - 2) * STAGE_ROUNDS + sub);
export const stageOf = (round: number) => stageRound(round).stage;

const ROMAN: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n: number): string {
  let out = '';
  for (const [v, r] of ROMAN) for (; n >= v; n -= v) out += r;
  return out;
}
// "II-3"
export const roundLabel = (round: number) => {
  const { stage, sub } = stageRound(round);
  return `${roman(stage)}-${sub}`;
};

// Every stage from II on starts with a Magic Orb for every player (II-1, III-1, ...).
export const isOrbRound = (round: number) => {
  const { stage, sub } = stageRound(round);
  return stage >= 2 && sub === 1;
};

// The round every player picks a commander card (I-2), out of this many.
export const COMMANDER_CARD_ROUND = 2;
export const CARD_OFFER_SIZE = 4;

// The round every player picks a basic item (I-2: the creeps' drop), out of this many random ones.
export const BASIC_ITEM_ROUND = 2;
export const BASIC_ITEM_OFFER = 3;
// Equipment offered by an Equipment Chest (see ItemDef.chests): pick 1.
export const CHEST_OFFER = 3;

// Monster rounds: everyone fights monsters instead of each other; a loss still costs hp. See monsters.ts.
// I-1 is the creep round (its drop is the basic item pick on I-2). Round 3 of every stage from II on
// (II-3, III-3, ...) is an equipment round: win or lose, each player gets EQUIPMENT_DROPS loot picks, each a
// pick of 1 out of 3 equipment: one physical, one magic or hybrid, one armor (see inventory.lootOffer).
export const CREEP_ROUND = 1;
export const EQUIPMENT_ROUND_SUB = 3;
export const isEquipmentRound = (round: number) => {
  const { stage, sub } = stageRound(round);
  return stage >= 2 && sub === EQUIPMENT_ROUND_SUB;
};
export const isMonsterRound = (round: number) => round === CREEP_ROUND || isEquipmentRound(round);
export const EQUIPMENT_DROPS = 2;
// Units every player gets before round 1, drawn from the pool at START_LEVEL shop odds.
export const FREE_UNITS = 3;

export const TICKS_PER_SECOND = 10;
export const MAX_COMBAT_TICKS = 45 * TICKS_PER_SECOND;
export const MOVE_TICKS = 4; // ticks to cross one cell
// hp/atk multiplier, indexed by star - 1.
// A 4th entry for units a trait makes fight one star above 3.
export const STAR_MULT = [1, 1.8, 3.24, 5.832];
export const MANA_PER_ATTACK = 10;
export const MANA_PER_HIT_TAKEN = 5;
// Placeholder spell until units get real abilities: CAST_MULT x atk as magic damage.
export const CAST_MULT = 3;
// Basic attacks that crit deal this many times their damage (before trait bonuses).
export const BASE_CRIT_DAMAGE = 1.5;
// Loser takes BASE_DAMAGE plus the stars of every enemy unit still standing.
export const BASE_DAMAGE = 2;

// Copies of each unit in the shared pool, indexed by tier - 1.
export const POOL_SIZE: Record<number, number> = { 1: 29, 2: 22, 3: 18, 4: 12, 5: 10, 7: 6 }; // copies per unit, by tier

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
