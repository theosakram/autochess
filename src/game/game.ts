import { runBot } from './bot';
import { enemyDeaths, simulateCombat, type CombatResult } from './combat';
import {
  BASE_DAMAGE,
  BASE_INCOME,
  BENCH_SIZE,
  BOARD_COLS,
  BOARD_ROWS,
  FREE_UNITS,
  PASSIVE_XP,
  POOL_SIZE,
  SHOP_SIZE,
  START_HP,
  START_LEVEL,
} from './config';
import { copiesOf, mergeUnits } from './merge';
import { addXp, interest, isAlive } from './player';
import { nextInt, shuffle } from './rng';
import { drawUnit, refreshShop, returnShop } from './shop';
import { claimShopSlot, canClaim } from './actions';
import { syncItems } from './inventory';
import { grantOrbs } from './orb';
import { isItemCard } from './items';
import { gainStacks, roundStartEffects, rollChosen, type RoundStart } from './traits';
import { UNIT_BY_ID } from './units';
import type { GameState, Player } from './types';
import { UNITS } from './units';

export interface PlayerSeed {
  id: string;
  name: string;
  isBot: boolean;
}

export interface Fight {
  home: string;
  away: string;
  // Odd player count: away is a copy of another player's board and takes no damage.
  ghost: boolean;
  result: CombatResult;
  damage: number; // dealt to the loser
}

export function createGame(seed: number, seeds: PlayerSeed[]): GameState {
  const pool: Record<string, number> = {};
  for (const u of UNITS) pool[u.id] = POOL_SIZE[u.tier - 1];

  const state: GameState = {
    round: 0,
    rng: seed | 0,
    nextUid: 1,
    pool,
    chosen: {},
    players: seeds.map((s) => ({
      ...s,
      hp: START_HP,
      gold: 0,
      level: START_LEVEL,
      xp: 0,
      bench: Array(BENCH_SIZE).fill(null),
      board: Array(BOARD_COLS * BOARD_ROWS).fill(null),
      shop: Array(SHOP_SIZE).fill(null),
      shopLocked: false,
      place: null,
      stacks: {},
      items: [],
      orbs: [],
      orb: null,
    })),
  };
  state.chosen = rollChosen(state);
  for (const p of state.players) giveStarterUnits(state, p);
  startRound(state);
  return state;
}

// Free units on the bench, taken from the shared pool like a purchase. The player fields them.
function giveStarterUnits(state: GameState, p: Player): void {
  const defIds = Array.from({ length: FREE_UNITS }, () => drawUnit(state, p.level)).filter((d) => d !== null);
  defIds.forEach((defId, i) => (p.bench[i] = { uid: state.nextUid++, defId, star: 1 }));
  for (const defId of new Set(defIds)) mergeUnits(p, defId);
}

export function isGameOver(state: GameState): boolean {
  return state.players.filter(isAlive).length <= 1;
}

// What a trait handed a player at round start, for the UI to announce.
export interface RoundBonus {
  playerId: string;
  trait: string;
  gold: number;
  looted: string | null; // unit def id taken from the shop
}

// Preparation phase start. Returns the round-start trait bonuses that were paid out.
export function startRound(state: GameState): RoundBonus[] {
  state.round++;
  grantOrbs(state);
  const alive = state.players.filter(isAlive);
  for (const p of alive) {
    if (state.round > 1) addXp(p, PASSIVE_XP);
    p.gold += BASE_INCOME + interest(p.gold);
    // A locked shop keeps what's left in it for this round, then unlocks.
    if (p.shopLocked) p.shopLocked = false;
    else refreshShop(state, p);
  }
  const bonuses = alive.flatMap((p) =>
    roundStartEffects(p).map(({ trait, effect }) => ({ playerId: p.id, trait, ...payOut(state, p, effect) })),
  );
  for (const p of alive) syncItems(state, p);
  for (const p of alive) {
    if (p.isBot) runBot(state, p);
  }
  return bonuses;
}

function payOut(state: GameState, p: Player, effect: RoundStart): { gold: number; looted: string | null } {
  const gold = effect.gold ?? 0;
  p.gold += gold;
  return { gold, looted: effect.loot ? loot(state, p, effect.loot) : null };
}

// Takes one shop unit for free: the cheapest (ties random) or any at random. Skipped if it can't fit.
function loot(state: GameState, p: Player, rule: 'cheapest' | 'random'): string | null {
  let slots = p.shop.flatMap((id, slot) => (id && !isItemCard(id) ? [slot] : []));
  if (rule === 'cheapest') {
    const min = Math.min(...slots.map((s) => UNIT_BY_ID[p.shop[s]!].tier));
    slots = slots.filter((s) => UNIT_BY_ID[p.shop[s]!].tier === min);
  }
  if (slots.length === 0) return null;
  const slot = slots[nextInt(state, slots.length)];
  const defId = p.shop[slot]!;
  if (!canClaim(p, defId)) return null;
  claimShopSlot(state, p, slot);
  return defId;
}

// Pair everyone up, fight, apply damage, knock out anyone at 0 hp.
export function resolveCombat(state: GameState): Fight[] {
  const alive = shuffle(state, state.players.filter(isAlive));
  const fights: Fight[] = [];

  for (let i = 0; i < alive.length; i += 2) {
    const home = alive[i];
    let away = alive[i + 1];
    const ghost = !away;
    if (ghost) {
      if (alive.length < 2) break;
      // home is the last entry, so this picks anyone else.
      away = alive[nextInt(state, alive.length - 1)];
    }
    const result = simulateCombat(state, home, away, { chosen: state.chosen });
    const damage = result.winner === null ? 0 : BASE_DAMAGE + result.survivors.reduce((n, f) => n + f.star, 0);
    if (result.winner === 1) home.hp -= damage;
    else if (result.winner === 0 && !ghost) away.hp -= damage;
    // A ghost is a copy, so its owner gains nothing from the fight.
    gainStacks(home, result.traits[0], enemyDeaths(result, 0));
    if (!ghost) gainStacks(away, result.traits[1], enemyDeaths(result, 1));
    fights.push({ home: home.id, away: away.id, ghost, result, damage });
  }

  eliminate(state, alive.length);
  return fights;
}

function eliminate(state: GameState, aliveBefore: number): void {
  // Same-round knockouts are ranked by how far below zero they fell.
  const out = state.players.filter((p) => p.place === null && p.hp <= 0).sort((a, b) => b.hp - a.hp);
  out.forEach((p, k) => {
    p.place = aliveBefore - out.length + 1 + k;
    p.hp = 0;
    releaseUnits(state, p);
  });
  const left = state.players.filter(isAlive);
  if (left.length === 1) left[0].place = 1;
}

function releaseUnits(state: GameState, p: Player): void {
  for (const slots of [p.bench, p.board]) {
    slots.forEach((u, i) => {
      if (!u) return;
      state.pool[u.defId] += copiesOf(u);
      slots[i] = null;
    });
  }
  returnShop(state, p);
}
