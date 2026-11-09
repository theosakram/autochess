import { grantBlood } from './blood';
import { essenceRound, payEcho, releaseEssence } from './essence';
import { runBot } from './bot';
import { enemyDeaths, killsBy, memberSkills, simulateCombat, type CombatResult } from './combat';
import {
  BASE_DAMAGE,
  BENCH_SIZE,
  BOARD_COLS,
  BOARD_ROWS,
  BASIC_ITEM_OFFER,
  BASIC_ITEM_ROUND,
  COMMANDER_CARD_ROUND,
  EQUIPMENT_DROPS,
  WIN_GOLD,
  isEquipmentRound,
  isMonsterRound,
  FREE_UNITS,
  PASSIVE_XP,
  POOL_SIZE,
  SHOP_SIZE,
  START_HP,
  START_LEVEL,
  POWER_CARD_ROUNDS,
  POWER_TIERS,
} from './config';
import { copiesOf, mergeUnits } from './merge';
import { openChest, stageItems, takeOfferedItem } from './inventory';
import { cardRolls } from './luckyDice';
import { addXp, recordFight, roundIncome, isAlive } from './player';
import { nextInt, shuffle } from './rng';
import { drawUnit, refreshShop, returnShop, rollFreeHero } from './shop';
import { applyAction, claimShopSlot, canClaim } from './actions';
import { checkRally, payHeirs } from './cyclops';
import { syncPlayer } from './sync';
import { grantOrbs } from './orb';
import { offerPowerCards, pickFactionOrb, pickPowerCard, roundHealOf } from './powerCards';
import { hurtPlayer, offerCards, payCard, powersOf } from './commanders';
import type { Side } from './grid';
import { BASIC_ITEMS, isItemCard, ITEMS } from './items';
import { MONSTER_ID, monsterSide } from './monsters';
import { gainStacks, roundStacks, roundStartEffects, rollChosen, type RoundStart } from './traits';
import { UNIT_BY_ID } from './units';
import type { BotLevel, GameState, Player, PowerTier } from './types';
import { UNITS } from './units';

export interface PlayerSeed {
  id: string;
  name: string;
  isBot: boolean;
  botLevel?: BotLevel;
  commander?: string; // picked for them before the first round (the commander balance harness)
}

export interface Fight {
  home: string;
  away: string;
  // Odd player count: away is a copy of another player's board and takes no damage.
  ghost: boolean;
  result: CombatResult;
  damage: number; // dealt to the loser
  monster?: true; // a monster round: away is MONSTER_ID
  loot?: number; // monster loot picks the home player got from it (they open next round)
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
  state.powerTiers = rollPowerTiers(seed);
  for (const p of state.players) giveStarterUnits(state, p);
  seeds.forEach((s, i) => s.commander && applyAction(state, state.players[i].id, { type: 'pickCommander', commander: s.commander }));
  startRound(state);
  return state;
}

// The match's power card tiers, one independent even roll per POWER_CARD_ROUNDS round. Off its own rng
// stream so the rest of the game rolls exactly as before.
export function rollPowerTiers(seed: number): PowerTier[] {
  const rng = { rng: (seed ^ 0x5eed7135) | 0 };
  return POWER_CARD_ROUNDS.map(() => POWER_TIERS[nextInt(rng, POWER_TIERS.length)]);
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
    // The end of the round just played pays out (on round 1: stage I's basic reward, the starting gold).
    p.gold += roundIncome(p, Math.max(1, state.round - 1)).total;
    // Healing Fountain: the commander heals, up to full.
    p.hp = Math.min(START_HP, p.hp + roundHealOf(p));
    // That paid one round of each Payday owed.
    if (p.payday) p.payday = p.payday.map((d) => ({ ...d, rounds: d.rounds - 1 })).filter((d) => d.rounds > 0);
    // A locked shop keeps what's left in it for this round, then unlocks.
    if (p.shopLocked) p.shopLocked = false;
    else {
      refreshShop(state, p);
      if (state.round > 1) rollFreeHero(state, p); // Guiness: after fights only
    }
  }
  // The commander card round: everyone gets an offer to pick from.
  if (state.round === COMMANDER_CARD_ROUND) for (const p of alive) if (!p.commanderCard) p.cardOffer = offerCards(state, p);
  // Power card rounds: an offer at the tier this match rolled.
  for (const p of alive) offerPowerCards(state, p);
  // The basic item round: a few random basic items, pick one.
  if (state.round === BASIC_ITEM_ROUND) for (const p of alive) {
    p.itemOffer = shuffle(state, [...BASIC_ITEMS]).slice(0, BASIC_ITEM_OFFER);
    p.offerFrom = 'basic';
  }
  // Alice: a Blood Pact on its rounds.
  for (const p of alive) grantBlood(state, p);
  // Kaela's card: its Lucky Dice rolls due this round.
  for (const p of alive) cardRolls(state, p);
  // Equipment Chests earned last fight (one at a time; the rest open as each is picked).
  for (const p of alive) openChest(state, p);
  // Units deployed at the start of the round feed counting traits (before bots rearrange).
  for (const p of alive) roundStacks(p);
  const bonuses = alive.flatMap((p) =>
    roundStartEffects(p).map(({ trait, effect }) => ({ playerId: p.id, trait, ...payOut(state, p, effect) })),
  );
  for (const p of alive) stageItems(state, p);
  // Luo Yi: her card's copies, and a Scavenger essence's free hero.
  for (const p of alive) {
    if (p.echo) payEcho(state, p);
    essenceRound(state, p, (rule) => loot(state, p, rule));
  }
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
      p.cardOffer = p.cardRerolled = undefined;
      payCard(state, p, p.commanderCard);
      openChest(state, p);
      cardRolls(state, p);
    }
    if (p.powerOffer) pickPowerCard(state, p, p.powerOffer.cards[0]);
    if (p.factionOrbOffer) pickFactionOrb(state, p, p.factionOrbOffer[0]);
    // Likewise unpicked items: the first on offer, chest after chest.
    while (p.itemOffer?.length) takeOfferedItem(state, p, p.itemOffer[0]);
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
    const result = simulateCombat(state, home, away, { chosen: state.chosen, round: state.round });
    const damage = result.winner === null ? 0 : BASE_DAMAGE + result.survivors.reduce((n, f) => n + f.star, 0);
    if (result.winner === 1) hurtPlayer(home, damage);
    else if (result.winner === 0 && !ghost) hurtPlayer(away, damage);
    recordFight(home, result.winner === 0, WIN_GOLD);
    if (!ghost) recordFight(away, result.winner === 1, WIN_GOLD);
    // A ghost is a copy, so its owner gains nothing from the fight.
    const tally = (side: 0 | 1) => (traitId: string) => ({ kills: enemyDeaths(result, side), memberSkills: memberSkills(result, side, traitId) });
    gainStacks(home, result.traits[0], tally(0));
    if (!ghost) gainStacks(away, result.traits[1], tally(1));
    afterFight(home, result, 0);
    if (!ghost) afterFight(away, result, 1);
    fights.push({ home: home.id, away: away.id, ghost, result, damage });
  }

  eliminate(state, alive.length);
  return fights;
}

// What a player gets from a fight of their own: commander gold for the result, and Equipment Chests.
function afterFight(p: Player, result: CombatResult, side: Side): void {
  const gold = powersOf(p).roundGold;
  if (gold && result.winner !== null) p.gold += result.winner === side ? gold.win : gold.loss;
  payBounty(p, result, side);
  earnChests(p, result, side);
}

// Ruby's card: gold for every Cloak and Scythe whose holder is still standing at the end, up to a limit a game.
export function payBounty(p: Player, result: CombatResult, side: Side): void {
  const rule = powersOf(p).survivorGold;
  if (!rule) return;
  const dead = new Set(result.events.flatMap((e) => (e.type === 'death' ? [e.id] : [])));
  const standing = result.fighters
    .filter((f) => f.side === side && !dead.has(f.id))
    .reduce((n, f) => n + f.items.filter((i) => rule.items.includes(i.id)).length, 0);
  const paid = p.survivorGold ?? 0;
  const gold = Math.min(rule.gold * standing, rule.max - paid);
  if (gold <= 0) return;
  p.gold += gold;
  p.survivorGold = paid + gold;
}

// Adds the kills of this side's chest item holder, and turns them into chests up to the item's limit.
export function earnChests(p: Player, result: CombatResult, side: Side): void {
  const holders = result.fighters.filter((f) => f.side === side && f.items.some((i) => ITEMS[i.id].chests));
  if (holders.length === 0) return;
  const rule = ITEMS[holders[0].items.find((i) => ITEMS[i.id].chests)!.id].chests!;
  const chests = (p.chests ??= { kills: 0, earned: 0, waiting: 0 });
  chests.kills += killsBy(result, holders.map((f) => f.id));
  while (chests.kills >= rule.kills && chests.earned < rule.max) {
    chests.kills -= rule.kills;
    chests.earned++;
    chests.waiting++;
  }
}

// Everyone fights the round's monsters. Win or lose, each player gets loot picks (equipment rounds); losing still
// costs hp, as in any fight.
function monsterRound(state: GameState): Fight[] {
  const alive = state.players.filter(isAlive);
  const fights = alive.map((p): Fight => {
    const { player: monsters, statMult } = monsterSide(state.round);
    const result = simulateCombat(state, p, monsters, { chosen: state.chosen, statMult: [1, statMult], round: state.round });
    const damage = result.winner === null ? 0 : BASE_DAMAGE + result.survivors.reduce((n, f) => n + f.star, 0);
    if (result.winner === 1) hurtPlayer(p, damage);
    gainStacks(p, result.traits[0], (traitId: string) => ({ kills: enemyDeaths(result, 0), memberSkills: memberSkills(result, 0, traitId) }));
    afterFight(p, result, 0);
    const loot = isEquipmentRound(state.round) ? EQUIPMENT_DROPS : 0;
    p.loot = (p.loot ?? 0) + loot;
    return { home: p.id, away: MONSTER_ID, ghost: false, result, damage, monster: true, loot };
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
  });
  // Cyclops: gold from each knockout (their heroes still on them), then they're released to the pool.
  for (const p of out) payHeirs(state, p);
  for (const p of out) releaseUnits(state, p);
  const left = state.players.filter(isAlive);
  // Cyclops: the low-hp rally, for anyone still in.
  for (const p of left) checkRally(state, p);
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
  releaseEssence(state, p, copiesOf);
  returnShop(state, p);
}
