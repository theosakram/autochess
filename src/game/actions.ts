import { MAX_LEVEL, REROLL_COST, SHOP_SIZE, XP_COST, XP_PER_BUY } from './config';
import { copiesOf, findCopies, mergeUnits, slotsOf } from './merge';
import { addXp, boardCount, isAlive } from './player';
import { refreshShop } from './shop';
import type { GameState, Loc, Player, Unit } from './types';
import { UNIT_BY_ID } from './units';

// Everything a player can do goes through here, bots included. Later the server
// runs this same function on actions received from clients, so validate everything.
export type Action =
  | { type: 'reroll' }
  | { type: 'buyXp' }
  | { type: 'buy'; slot: number }
  | { type: 'sell'; from: Loc }
  | { type: 'move'; from: Loc; to: Loc };

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
    slotsOf(p, keep.area)[keep.index]!.star = 2;
    slotsOf(p, other.area)[other.index] = null;
  }
  mergeUnits(p, defId);
}

export function applyAction(state: GameState, playerId: string, action: Action): Result {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return fail('Unknown player');
  if (!isAlive(p)) return fail('You are eliminated');

  switch (action.type) {
    case 'reroll': {
      if (p.gold < REROLL_COST) return fail('Not enough gold');
      p.gold -= REROLL_COST;
      refreshShop(state, p);
      return OK;
    }

    case 'buyXp': {
      if (p.level >= MAX_LEVEL) return fail('Already max level');
      if (p.gold < XP_COST) return fail('Not enough gold');
      p.gold -= XP_COST;
      addXp(p, XP_PER_BUY);
      return OK;
    }

    case 'buy': {
      const { slot } = action;
      if (!Number.isInteger(slot) || slot < 0 || slot >= SHOP_SIZE) return fail('Bad shop slot');
      const defId = p.shop[slot];
      if (!defId) return fail('Nothing to buy there');
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

    default:
      return fail('Unknown action');
  }
}
