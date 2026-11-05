import { GOLD_PER_XP, REROLL_COST, SHOP_SIZE } from './config';
import { equipBlock, syncItems } from './inventory';
import { cardItem, isItemCard, ITEMS } from './items';
import { orbOptions } from './orb';
import { absorb, copiesOf, findCopies, mergeUnits, slotsOf } from './merge';
import { addXp, boardCount, isAlive, levelUpCost } from './player';
import { refreshShop } from './shop';
import { TRAITS } from './traits';
import type { GameState, Loc, Player, Unit } from './types';
import { UNIT_BY_ID } from './units';

// Everything a player can do goes through here, bots included. Later the server
// runs this same function on actions received from clients, so validate everything.
export type Action =
  | { type: 'reroll' }
  | { type: 'levelUp' }
  | { type: 'toggleLock' }
  | { type: 'buy'; slot: number }
  | { type: 'sell'; from: Loc }
  | { type: 'move'; from: Loc; to: Loc }
  | { type: 'equip'; item: number; unit: number } // uids
  | { type: 'unequip'; item: number }
  | { type: 'useOrb'; unit: number; trait: string }; // unit uid

export type Result = { ok: true } | { ok: false; error: string };

const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

function slotsAt(p: Player, loc: Loc): (Unit | null)[] | null {
  if (loc.area !== 'bench' && loc.area !== 'board') return null;
  const slots = slotsOf(p, loc.area);
  if (!Number.isInteger(loc.index) || loc.index < 0 || loc.index >= slots.length) return null;
  return slots;
}

// A full bench is fine if this copy completes a merge.
export function canClaim(p: Player, defId: string): boolean {
  return p.bench.includes(null) || findCopies(p, defId, 1).length >= 2;
}

// Moves a shop unit onto the bench (no payment) and merges. Check canClaim first.
export function claimShopSlot(state: GameState, p: Player, slot: number): void {
  const defId = p.shop[slot]!;
  p.shop[slot] = null;
  const free = p.bench.indexOf(null);
  if (free >= 0) {
    p.bench[free] = { uid: state.nextUid++, defId, star: 1 };
  } else {
    // Absorbed straight into the pair it completes.
    const [keep, other] = findCopies(p, defId, 1);
    const keeper = slotsOf(p, keep.area)[keep.index]!;
    keeper.star = 2;
    absorb(p, keeper, other);
  }
  mergeUnits(p, defId);
}

export function applyAction(state: GameState, playerId: string, action: Action): Result {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return fail('Unknown player');
  if (!isAlive(p)) return fail('You are eliminated');
  const res = perform(state, p, action);
  if (res.ok) syncItems(state, p);
  return res;
}

function perform(state: GameState, p: Player, action: Action): Result {
  switch (action.type) {
    case 'reroll': {
      if (p.gold < REROLL_COST) return fail('Not enough gold');
      p.gold -= REROLL_COST;
      refreshShop(state, p);
      return OK;
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
      const { slot } = action;
      if (!Number.isInteger(slot) || slot < 0 || slot >= SHOP_SIZE) return fail('Bad shop slot');
      const defId = p.shop[slot];
      if (!defId) return fail('Nothing to buy there');
      if (isItemCard(defId)) return upgradeItem(p, slot);
      const cost = UNIT_BY_ID[defId].tier;
      if (p.gold < cost) return fail('Not enough gold');
      if (!canClaim(p, defId)) return fail('Bench is full');
      p.gold -= cost;
      claimShopSlot(state, p, slot);
      return OK;
    }

    case 'sell': {
      const slots = slotsAt(p, action.from);
      if (!slots) return fail('Bad location');
      const unit = slots[action.from.index];
      if (!unit) return fail('No unit there');
      const copies = copiesOf(unit);
      slots[action.from.index] = null;
      state.pool[unit.defId] += copies;
      p.gold += UNIT_BY_ID[unit.defId].tier * copies;
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
      src[from.index] = other;
      dst[to.index] = unit;
      if (boardCount(p) > p.level) {
        dst[to.index] = other;
        src[from.index] = unit;
        return fail(`Board is full (${p.level} units at level ${p.level})`);
      }
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
      if (!orbOptions(p.orbs[0], unit.defId).includes(action.trait)) return fail('That trait is not on offer');
      p.orbs.shift();
      p.orb = { defId: unit.defId, trait: action.trait };
      return OK;
    }

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

// Upgrade cards are free: they raise the matching owned item one tier, up to the shop's cap.
function upgradeItem(p: Player, slot: number): Result {
  const itemId = cardItem(p.shop[slot]!);
  const item = p.items.find((i) => i.id === itemId);
  if (!item) return fail(`You don't own ${ITEMS[itemId].name}`);
  const cap = TRAITS[ITEMS[itemId].trait].items?.maxShopTier ?? ITEMS[itemId].maxTier;
  if (item.tier >= cap) return fail(`${ITEMS[itemId].name} is already tier ${cap}`);
  item.tier++;
  p.shop[slot] = null;
  return OK;
}
