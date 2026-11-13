import { bloodBless, grantBlood } from './blood';
import { essenceIn, essenceOut } from './essence';
import { pickJohnnie } from './johnnie';
import { claimEnhance, setEnhance } from './freya';
import { bless } from './twilight';
import { GOLD_PER_XP, REROLL_COST, SHOP_SIZE } from './config';
import { COMMANDERS, MARKS, markedUid, payCard, payCommander, pieceBlock, powersOf, rerollCard, type MarkKind } from './commanders';
import { equipBlock, openChest, takeOfferedItem } from './inventory';
import { buyMistWare, equipMistOrb, unequipMistOrb } from './mistShop';
import { cardRolls, openTrove, rollTrove } from './luckyDice';
import { useFullHouse } from './tierShop';
import { payLadder, ritualOffer, useRitualCopy } from './ritual';
import { useMirror } from './mirror';
import { DEATH_ORACLE, refreshXp, pickFactionOrb, pickPowerCard, rerollPowerCard, rollFreeRefresh } from './powerCards';
import { useDuplicator } from './duplicator';
import { useEnhancer } from './enhancer';
import { useGlove } from './gloves';
import { offer, type AltarKey } from './altar';
import { pickReward, syncPlayer } from './sync';
import { baseItemOf, cardItem, isItemCard, ITEMS } from './items';
import { orbOptions } from './orb';
import { absorb, bloodMerge, bloodRoom, copiesOf, pooledOf, findCopies, mergeSize, mergeUnits, nearMerge, promote, slotsOf } from './merge';
import { addXp, boardCount, heroCapOf, isAlive, levelUpCost } from './player';
import { drawUnit, refreshShop, shopPrice } from './shop';
import { pickBox } from './box';
import { TRAITS } from './traits';
import { nextInt } from './rng';
import type { GameState, Loc, Player, Unit } from './types';
import { UNIT_BY_ID, unitPrice } from './units';

// Everything a player can do goes through here, bots included. Later the server
// runs this same function on actions received from clients, so validate everything.
export type Action =
  | { type: 'reroll' }
  | { type: 'levelUp' }
  | { type: 'toggleLock' }
  | { type: 'fullHouse'; tier: number }
  | { type: 'ritualOffer'; unit: number } // Moscow: offer a hero (uid) the Shadow Altar asks for
  | { type: 'ritualCopy'; unit: number } // Moscow: spend the Shadow charge on a hero (uid)
  | { type: 'buy'; slot: number }
  | { type: 'sell'; from: Loc }
  | { type: 'move'; from: Loc; to: Loc }
  | { type: 'equip'; item: number; unit: number } // uids
  | { type: 'unequip'; item: number }
  | { type: 'useOrb'; unit: number; trait: string } // unit uid
  | { type: 'mistBuy'; slot: number; choice?: string } // choice: a unit uid (Mirror) or trait id (picked orbs)
  | { type: 'equipMistOrb'; orb: number; unit: number } // uids; from the inventory or another unit
  | { type: 'unequipMistOrb'; orb: number }
  | { type: 'pickCommander'; commander: string } // once, at the start of the game
  | { type: 'pickCard'; card: string } // one of the cards on offer (a commander id)
  | { type: 'rerollCard'; slot: number } // swap one offered card, once per slot
  | { type: 'pickPower'; card: string } // one of the power cards on offer
  | { type: 'rerollPower'; slot: number } // swap one offered power card, once per slot
  | { type: 'pickFactionOrb'; trait: string } // Prime Selection: one of the faction orbs on offer
  | { type: 'mark'; kind: MarkKind; unit: number } // unit uid: the hero a commander mark goes on (Kagura, Miya, Fanny)
  | { type: 'pickItem'; item: string } // one of the basic items on offer
  | { type: 'pickBox'; prize: number } // the Box round: a prize, on your turn
  | { type: 'rollDice' } // Kaela: roll the Trove's Lucky Dice (a roll a round, unused ones bank up)
  | { type: 'openTrove' } // Kaela: cash in the Trove's points
  | { type: 'useMirror'; unit: number } // unit uid: copy it with a Mirror Device from the inventory
  | { type: 'useDuplicator'; item: number } // item uid: copy it with an Equipment Duplicator from the inventory
  | { type: 'useGlove'; glove: string; unit: number } // Pacquiao: a boxing glove on one of your heroes
  | { type: 'useEnhancer'; item: number } // item uid: enhance it with one of Minos's Enhancement Charges
  | { type: 'offer'; altar: AltarKey; unit: number } // Dyroth: offer a hero (uid) on one of his altars
  | { type: 'bless'; unit: number } // Lunox: place the Twilight Blessing on a hero (uid)
  | { type: 'bloodPact'; unit: number } // Alice: use a Blood Pact on a hero (uid)
  | { type: 'essenceIn'; unit: number } // Luo Yi: put a hero (uid) on the Essence Altar (swapping out any there)
  | { type: 'essenceOut' } // Luo Yi: take the altar hero back to the bench
  | { type: 'pickJohnnie'; johnnie: string }
  | { type: 'pickReward'; trait: string; unit: string } // one of the reward units on offer (the Necromancer's Plane Wanderer)
  | { type: 'enhance'; trait: string } // Freya: bless a role (any time)
  | { type: 'claimEnhance'; level: number }; // Freya: claim the blessed role's reward at level 1-3 (its 2/4/6) // Johnson: one of the Johnnies on offer in the Den (a def id)

export type Result = { ok: true } | { ok: false; error: string };

const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });
const result = (error: string | null): Result => (error ? fail(error) : OK);

function slotsAt(p: Player, loc: Loc): (Unit | null)[] | null {
  if (loc.area !== 'bench' && loc.area !== 'board') return null;
  const slots = slotsOf(p, loc.area);
  if (!Number.isInteger(loc.index) || loc.index < 0 || loc.index >= slots.length) return null;
  return slots;
}

// A full bench is fine if this copy completes a merge.
export function canClaim(p: Player, defId: string): boolean {
  return p.bench.includes(null) || nearMerge(p, defId) || bloodRoom(p, defId) !== null;
}

// As canClaim, but an empty board cell will do too (gainUnit with `board`).
export function canClaimToBoard(p: Player, defId: string): boolean {
  return canClaim(p, defId) || p.board.some((u, i) => !u && !pieceBlock(p, defId, { area: 'board', index: i }));
}

// Pas de Deux, Reinforcement Plus: a 2★ copy of `defId` to the bench, else to an empty board cell (past the level limit if need
// be), else lost. `have`: copies already out of the pool for it (a bought one). It takes what copies the pool has left, and is made up past that; selling it gives back
// only what it took.
export function giveTwoStar(state: GameState, p: Player, defId: string, have = 0): void {
  giveStarred(state, p, defId, 2, have);
}

// A hero at `star` (its copies from the pool as it has them, made up past that; with `fromPool` false, all made up:
// the pool untouched, and selling it returns nothing) to the bench, else an empty board cell. `extra` goes on the
// new unit (e.g. a hero card's buff). False, and nothing taken, if no room.
export function giveStarred(state: GameState, p: Player, defId: string, star: 2 | 3, have = 0, extra: Partial<Unit> = {}, fromPool = true): boolean {
  const bench = p.bench.indexOf(null);
  const cell = bench < 0 ? p.board.indexOf(null) : -1;
  if (bench < 0 && cell < 0) return false;
  const want = mergeSize(defId) ** (star - 1);
  const took = fromPool ? Math.min(want - have, state.pool[defId] ?? 0) : 0;
  if (defId in state.pool) state.pool[defId] -= took;
  const unit: Unit = { uid: state.nextUid++, defId, star, ...(have + took < want ? { shortfall: want - have - took } : {}), ...extra };
  if (bench >= 0) p.bench[bench] = unit;
  else p.board[cell] = unit;
  mergeUnits(p, defId);
  return true;
}

// Sells the unit in `slots[index]`: its copies back to the pool, their price to the player.
export function sellAt(state: GameState, p: Player, slots: (Unit | null)[], index: number): void {
  const unit = slots[index]!;
  slots[index] = null;
  if (unit.defId in state.pool) state.pool[unit.defId] += pooledOf(unit);
  p.gold += unitPrice(unit.defId) * copiesOf(unit);
}

// Frees a bench slot by selling a random bench hero (never a piece or turret). Its index, or -1 if none could go.
export function makeBenchRoom(state: GameState, p: Player): number {
  const free = p.bench.indexOf(null);
  if (free >= 0) return free;
  const sellable = p.bench.flatMap((u, i) => (u && !UNIT_BY_ID[u.defId].piece && !UNIT_BY_ID[u.defId].turret ? [i] : []));
  if (!sellable.length) return -1;
  const i = sellable[nextInt(state, sellable.length)];
  sellAt(state, p, p.bench, i);
  return i;
}

// At the start of a fight, a board past the level limit loses its weakest units (lowest star, then cheapest;
// ties at random) one by one to the bench. A full bench first sells a random bench hero to make room; only with
// nothing there to sell does the board unit itself get sold.
export function trimBoard(state: GameState, p: Player): void {
  while (boardCount(p) > heroCapOf(p)) {
    const cabled = markedUid(p, 'cable'); // Fanny's: takes no slot, so moving it frees none
    const cells = p.board.flatMap((u, i) => (u && !UNIT_BY_ID[u.defId].freeSlot && !UNIT_BY_ID[u.defId].piece && u.uid !== cabled ? [i] : []));
    const weight = (i: number) => p.board[i]!.star * 100 + unitPrice(p.board[i]!.defId);
    const low = Math.min(...cells.map(weight));
    const weakest = cells.filter((i) => weight(i) === low);
    const cell = weakest[nextInt(state, weakest.length)];
    const free = makeBenchRoom(state, p);
    if (free >= 0) {
      p.bench[free] = p.board[cell];
      p.board[cell] = null;
    } else sellAt(state, p, p.board, cell);
  }
}

// Moves a shop unit onto the bench (no payment) and merges. Check canClaim first.
export function claimShopSlot(state: GameState, p: Player, slot: number, board = false): void {
  const defId = p.shop[slot]!;
  p.shop[slot] = null;
  if (p.freeSlot === slot) p.freeSlot = null;
  gainUnit(state, p, defId, board);
}

// An empty board cell a unit may stand on (any row), picked at random, or -1.
export function freeBoardCell(state: GameState, p: Player, defId: string): number {
  const cells = p.board.flatMap((u, i) => (!u && !pieceBlock(p, defId, { area: 'board', index: i }) ? [i] : []));
  return cells.length ? cells[nextInt(state, cells.length)] : -1;
}

// Puts a new 1★ copy on the bench (or straight into the pair it completes) and merges. With `board`, a full
// bench sends it to an empty board cell instead, even past the level limit (trimmed when the fight starts).
// The copy must already be out of the pool. Check canClaim (or canClaimToBoard) first.
// `outside`: a copy that never came from the pool (counted as shortfall, so selling it returns nothing).
export function gainUnit(state: GameState, p: Player, defId: string, board = false, merc = false, outside = false): void {
  // Alice's Blood Pact hero takes the copy straight in.
  const blood = bloodRoom(p, defId);
  if (blood) {
    if (outside) blood.shortfall = (blood.shortfall ?? 0) + 1;
    return bloodMerge(p, defId, 1);
  }
  const extra = { ...(merc && { merc: true }), ...(outside && { shortfall: 1 }) };
  const free = p.bench.indexOf(null);
  const cell = free < 0 && board && !nearMerge(p, defId) ? freeBoardCell(state, p, defId) : -1;
  if (free >= 0) {
    p.bench[free] = { uid: state.nextUid++, defId, star: 1, ...extra };
  } else if (cell >= 0) {
    p.board[cell] = { uid: state.nextUid++, defId, star: 1, ...extra };
  } else {
    // Absorbed straight into the set it completes.
    const [keep, ...others] = findCopies(p, defId, 1);
    const keeper = slotsOf(p, keep.area)[keep.index]!;
    if (merc) keeper.merc = true;
    if (outside) keeper.shortfall = (keeper.shortfall ?? 0) + 1;
    promote(p, keeper, 2);
    for (const loc of others.slice(0, mergeSize(defId) - 2)) absorb(p, keeper, loc);
  }
  mergeUnits(p, defId);
}

export function applyAction(state: GameState, playerId: string, action: Action): Result {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return fail('Unknown player');
  if (!isAlive(p)) return fail('You are eliminated');
  const res = perform(state, p, action);
  if (res.ok) syncPlayer(state, p);
  return res;
}

function perform(state: GameState, p: Player, action: Action): Result {
  switch (action.type) {
    case 'reroll': {
      if (p.freeRerolls) p.freeRerolls--;
      // Death Oracle: 1 hp instead of gold (never the last hp: then gold as usual).
      else if (p.bloodRefreshes && p.hp > DEATH_ORACLE.hp) {
        p.hp -= DEATH_ORACLE.hp;
        p.bloodRefreshes = p.bloodRefreshes - 1 || undefined;
      } else if (p.gold < REROLL_COST) return fail('Not enough gold');
      else p.gold -= REROLL_COST;
      refreshShop(state, p);
      rollFreeRefresh(state, p);
      refreshXp(state, p); // Experienced Shuffle
      return OK;
    }

    case 'ritualOffer':
      return result(ritualOffer(state, p, action.unit));

    case 'ritualCopy':
      return result(useRitualCopy(state, p, action.unit));

    case 'fullHouse': {
      const why = useFullHouse(state, p, action.tier);
      return why ? fail(why) : OK;
    }

    case 'toggleLock': {
      p.shopLocked = !p.shopLocked;
      return OK;
    }

    case 'levelUp': {
      const cost = levelUpCost(p);
      if (cost === null) return fail('Already max level');
      if (p.gold < cost) return fail(`Need ${cost} gold to level up`);
      p.gold -= cost;
      addXp(p, cost / GOLD_PER_XP);
      return OK;
    }

    case 'buy': {
      return buyAt(state, p, action.slot);
    }

    case 'sell': {
      const slots = slotsAt(p, action.from);
      if (!slots) return fail('Bad location');
      const unit = slots[action.from.index];
      if (!unit) return fail('No unit there');
      if (UNIT_BY_ID[unit.defId].piece || UNIT_BY_ID[unit.defId].turret) return fail(`The ${UNIT_BY_ID[unit.defId].name} can't be sold`);
      sellAt(state, p, slots, action.from.index);
      return OK;
    }

    case 'move': {
      const { from, to } = action;
      const src = slotsAt(p, from);
      const dst = slotsAt(p, to);
      if (!src || !dst) return fail('Bad location');
      const unit = src[from.index];
      if (!unit) return fail('No unit there');
      const other = dst[to.index];
      // Commander pieces only go where they may stand, even when swapped.
      const blocked = pieceBlock(p, unit.defId, to) ?? (other ? pieceBlock(p, other.defId, from) : null);
      if (blocked) return fail(blocked);
      // Past the level limit is fine: the board is trimmed when the fight starts (trimBoard).
      src[from.index] = other;
      dst[to.index] = unit;
      return OK;
    }

    case 'equip': {
      const item = p.items.find((i) => i.uid === action.item);
      if (!item) return fail('No such item');
      const unit = [...p.board, ...p.bench].find((u) => u?.uid === action.unit);
      if (!unit) return fail('No such unit');
      const blocked = equipBlock(p, item, unit);
      if (blocked) return fail(blocked);
      item.holder = action.unit;
      return OK;
    }

    case 'useOrb': {
      if (p.orbs.length === 0) return fail('No Magic Orb to use');
      const unit = [...p.board, ...p.bench].find((u) => u?.uid === action.unit);
      if (!unit) return fail('No such unit');
      if (UNIT_BY_ID[unit.defId].piece) return fail(`The ${UNIT_BY_ID[unit.defId].name} can't take an orb`);
      if (!orbOptions(p.orbs[0], unit.defId).includes(action.trait)) return fail('That trait is not on offer');
      // A unit type holding a Mist orb (on any of its copies) can't take the Magic Orb.
      const copies = new Set([...p.board, ...p.bench].flatMap((u) => (u && u.defId === unit.defId ? [u.uid] : [])));
      if (p.mistOrbs?.some((o) => o.holder !== null && copies.has(o.holder))) return fail('It already holds a faction or role orb');
      p.orbs.shift();
      p.orb = { defId: unit.defId, trait: action.trait };
      return OK;
    }

    case 'pickCommander': {
      if (p.commander) return fail('You already have a commander');
      if (!COMMANDERS[action.commander]) return fail('No such commander');
      p.commander = action.commander;
      payCommander(state, p);
      openChest(state, p); // Guiness's starting chest
      grantBlood(state, p); // Alice picked on I-1: that round's Blood Pact
      return OK;
    }

    case 'pickCard': {
      if (!p.cardOffer?.includes(action.card)) return fail('That card is not on offer');
      p.commanderCard = action.card;
      p.cardOffer = p.cardRerolled = undefined;
      payCard(state, p, action.card);
      openChest(state, p);
      cardRolls(state, p);
      payLadder(state, p); // Moscow's card: its first hero
      return OK;
    }

    case 'pickPower': {
      const why = pickPowerCard(state, p, action.card);
      return why ? fail(why) : OK;
    }

    case 'pickBox':
      return result(pickBox(state, p, action.prize));

    case 'pickFactionOrb': {
      const why = pickFactionOrb(state, p, action.trait);
      return why ? fail(why) : OK;
    }

    case 'rerollPower': {
      const why = rerollPowerCard(state, p, action.slot);
      return why ? fail(why) : OK;
    }

    case 'rerollCard': {
      const why = rerollCard(state, p, action.slot);
      return why ? fail(why) : OK;
    }

    case 'pickItem': {
      if (!p.itemOffer?.includes(action.item)) return fail('That item is not on offer');
      takeOfferedItem(state, p, action.item);
      return OK;
    }

    case 'mark': {
      const mark = MARKS[action.kind];
      if (!mark) return fail('No such mark');
      if (!mark.available(powersOf(p))) return fail(`You don't have the ${mark.name}`);
      const unit = [...p.board, ...p.bench].find((u) => u?.uid === action.unit);
      if (!unit) return fail('No such unit');
      if (UNIT_BY_ID[unit.defId].piece) return fail(`The ${UNIT_BY_ID[unit.defId].name} can't take the ${mark.name}`);
      (p.marks ??= {})[action.kind] = { uid: unit.uid, defId: unit.defId };
      return OK;
    }

    case 'rollDice':
      return result(rollTrove(state, p));

    case 'openTrove':
      return result(openTrove(state, p));

    case 'useMirror':
      return result(useMirror(state, p, action.unit));

    case 'useDuplicator':
      return result(useDuplicator(state, p, action.item));
    case 'useGlove':
      return result(useGlove(state, p, action.glove, action.unit));
    case 'useEnhancer':
      return result(useEnhancer(p, action.item));

    case 'offer':
      return result(offer(state, p, action.altar, action.unit));

    case 'bless':
      return result(bless(state, p, action.unit));

    case 'bloodPact':
      return result(bloodBless(state, p, action.unit));

    case 'essenceIn':
      return result(essenceIn(state, p, action.unit));

    case 'essenceOut':
      return result(essenceOut(p));

    case 'enhance':
      return result(setEnhance(p, action.trait));

    case 'claimEnhance':
      return result(claimEnhance(state, p, action.level));

    case 'pickJohnnie':
      return result(pickJohnnie(p, action.johnnie, state));
    case 'pickReward':
      return result(pickReward(p, action.trait, action.unit));

    case 'mistBuy':
      return buyMistWare(state, p, action.slot, action.choice);

    case 'equipMistOrb':
      return equipMistOrb(p, action.orb, action.unit);

    case 'unequipMistOrb':
      return unequipMistOrb(p, action.orb);

    case 'unequip': {
      const item = p.items.find((i) => i.uid === action.item);
      if (!item) return fail('No such item');
      item.holder = null;
      return OK;
    }

    default:
      return fail('Unknown action');
  }
}

// Upgrade cards are free: they raise the matching owned item one tier, up to the shop's cap. A hero takes
// the card's slot, so the shop doesn't come up a slot short.
// Buys shop slot `slot`: a hero (or an item card's upgrade, which doesn't count as buying for Aurora).
function buyAt(state: GameState, p: Player, slot: number): Result {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SHOP_SIZE) return fail('Bad shop slot');
  const defId = p.shop[slot];
  if (!defId) return fail('Nothing to buy there');
  if (isItemCard(defId)) return upgradeItem(state, p, slot);
  const cost = shopPrice(p, slot);
  if (p.gold < cost) return fail('Not enough gold');
  // A free buy (Opening Promotion, Harley) used up, unless Guiness had made the hero free anyway. Only once the
  // buy goes through: a failed one keeps it.
  const useFreeBuy = () => {
    if (p.freeBuy && p.freeSlot !== slot) p.freeBuy = p.freeBuy - 1 || undefined;
  };
  // Fast Promotion: it comes 2★ (bench, else the board).
  if (p.promoteNext) {
    if (!p.bench.includes(null) && !p.board.includes(null)) return fail('No room');
    useFreeBuy();
    p.gold -= cost;
    p.shop[slot] = null;
    if (p.freeSlot === slot) p.freeSlot = null;
    p.promoteNext = p.promoteNext - 1 || undefined;
    giveTwoStar(state, p, defId, 1);
    p.boughtRound = state.round;
    return OK;
  }
  // A full bench sends it to the board (trimmed when the fight starts).
  if (!canClaimToBoard(p, defId)) return fail('No room on the bench or board');
  useFreeBuy();
  p.gold -= cost;
  claimShopSlot(state, p, slot, true);
  p.boughtRound = state.round; // Aurora: a round with a hero bought (item cards don't count)
  return OK;
}

function upgradeItem(state: GameState, p: Player, slot: number): Result {
  const itemId = cardItem(p.shop[slot]!);
  const item = p.items.find((i) => baseItemOf(i.id) === itemId); // its enhanced version too
  if (!item) return fail(`You don't own ${ITEMS[itemId].name}`);
  const trait = ITEMS[itemId].trait;
  const cap = (trait && TRAITS[trait].items?.maxShopTier) || ITEMS[itemId].maxTier;
  if (item.tier >= cap) return fail(`${ITEMS[itemId].name} is already tier ${cap}`);
  item.tier++;
  p.shop[slot] = drawUnit(state, p.level, p);
  return OK;
}
