import { runBot } from './bot';
import { enemyDeaths, memberSkills, simulateCombat, type CombatResult } from './combat';
import {
  BASE_DAMAGE,
  BASE_INCOME,
  BENCH_SIZE,
  BOARD_COLS,
  BOARD_ROWS,
  BASIC_ITEM_OFFER,
  BASIC_ITEM_ROUND,
  COMMANDER_CARD_ROUND,
  EQUIPMENT_DROPS,
  isMonsterRound,
  FREE_UNITS,
  PASSIVE_XP,
  POOL_SIZE,
  SHOP_SIZE,
  START_HP,
  START_LEVEL,
} from './config';
import { copiesOf, mergeUnits } from './merge';
import { stageItems, takeBasicItem } from './inventory';
import { addXp, interest, isAlive } from './player';
import { nextInt, shuffle } from './rng';
import { drawUnit, refreshShop, returnShop } from './shop';
import { claimShopSlot, canClaim } from './actions';
import { syncPlayer } from './sync';
import { grantOrbs } from './orb';
import { offerCards, pickGold } from './commanders';
import { BASIC_ITEMS, EQUIPMENT, isItemCard, ITEMS } from './items';
import { MONSTER_ID, monsterSide } from './monsters';
import { gainStacks, roundStacks, roundStartEffects, rollChosen, type RoundStart } from './traits';
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
  monster?: true; // a monster round: away is MONSTER_ID
  drops?: string[]; // equipment item ids the home player got from it
}

export function createGame(seed: number, seeds: PlayerSeed[]): GameState {
  const pool: Record<string, number> = {};
  for (const u of UNITS) if (u.shop !== false) pool[u.id] = POOL_SIZE[u.tier];

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
      commander: null,
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
  // The commander card round: everyone gets an offer to pick from.
  if (state.round === COMMANDER_CARD_ROUND) for (const p of alive) if (!p.commanderCard) p.cardOffer = offerCards(state, p);
  // The basic item round: a few random basic items, pick one.
  if (state.round === BASIC_ITEM_ROUND) for (const p of alive) p.itemOffer = shuffle(state, [...BASIC_ITEMS]).slice(0, BASIC_ITEM_OFFER);
  // Units deployed at the start of the round feed counting traits (before bots rearrange).
  for (const p of alive) roundStacks(p);
  const bonuses = alive.flatMap((p) =>
    roundStartEffects(p).map(({ trait, effect }) => ({ playerId: p.id, trait, ...payOut(state, p, effect) })),
  );
  for (const p of alive) stageItems(state, p);
  for (const p of alive) syncPlayer(state, p);
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
  // A commander card left unpicked defaults to the first on offer (the player's own commander's).
  for (const p of state.players.filter(isAlive)) {
    if (p.cardOffer?.length) {
      p.commanderCard = p.cardOffer[0];
      p.cardOffer = undefined;
      p.gold += pickGold(p, p.commanderCard);
    }
    // Likewise an unpicked basic item: the first on offer.
    if (p.itemOffer?.length) takeBasicItem(state, p, p.itemOffer[0]);
    syncPlayer(state, p);
  }
  if (isMonsterRound(state.round)) return monsterRound(state);
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
    const tally = (side: 0 | 1) => (traitId: string) => ({ kills: enemyDeaths(result, side), memberSkills: memberSkills(result, side, traitId) });
    gainStacks(home, result.traits[0], tally(0));
    if (!ghost) gainStacks(away, result.traits[1], tally(1));
    fights.push({ home: home.id, away: away.id, ghost, result, damage });
  }

  eliminate(state, alive.length);
  return fights;
}

// Everyone fights the round's monsters. Win or lose, each player gets random equipment; losing still
// costs hp, as in any fight.
function monsterRound(state: GameState): Fight[] {
  const alive = state.players.filter(isAlive);
  const fights = alive.map((p): Fight => {
    const { player: monsters, statMult } = monsterSide(state.round);
    const result = simulateCombat(state, p, monsters, { chosen: state.chosen, statMult: [1, statMult] });
    const damage = result.winner === null ? 0 : BASE_DAMAGE + result.survivors.reduce((n, f) => n + f.star, 0);
    if (result.winner === 1) p.hp -= damage;
    gainStacks(p, result.traits[0], (traitId: string) => ({ kills: enemyDeaths(result, 0), memberSkills: memberSkills(result, 0, traitId) }));
    const drops = Array.from({ length: EQUIPMENT_DROPS }, () => EQUIPMENT[nextInt(state, EQUIPMENT.length)]).filter((id) => id in ITEMS);
    for (const id of drops) p.items.push({ uid: state.nextUid++, id, tier: 1, holder: null });
    return { home: p.id, away: MONSTER_ID, ghost: false, result, damage, monster: true, drops };
  });
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
      if (u.defId in state.pool) state.pool[u.defId] += copiesOf(u);
      slots[i] = null;
    });
  }
  for (const id of p.gifts ?? []) state.pool[id]++;
  p.gifts = [];
  returnShop(state, p);
}
