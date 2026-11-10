import { canClaimToBoard, gainUnit } from './actions';
import { powersOf } from './commanders';
import { bloodRoom, findCopies, mergeSize, pooledOf, slotsOf } from './merge';
import { nextInt } from './rng';
import { drawFromTier } from './shop';
import type { GameState, Player, Unit } from './types';
import { UNIT_BY_ID, UNITS } from './units';

// Moscow (see commanders/moscow.ts): the Shadow Altar's ritual and its charge, and his card's hero each round.

// The altar's named heroes, rolled once (when the power first shows up): a random shop hero of each cost.
export function syncRitual(state: GameState, p: Player): void {
  const ritual = powersOf(p).ritual;
  if (!ritual || p.ritual) return;
  const want = ritual.costs.flatMap((cost) => {
    const defs = UNITS.filter((u) => u.tier === cost && u.shop !== false && !u.locked && !u.piece);
    return defs.length ? [defs[nextInt(state, defs.length)].id] : [];
  });
  p.ritual = { want, offered: [], charges: 0 };
}

// The player's unit `uid` and where it sits, or null.
function find(p: Player, uid: number): { slots: (Unit | null)[]; index: number; unit: Unit } | null {
  for (const area of ['board', 'bench'] as const) {
    const slots = slotsOf(p, area);
    const index = slots.findIndex((u) => u?.uid === uid);
    if (index >= 0) return { slots, index, unit: slots[index]! };
  }
  return null;
}

// The named heroes still to offer.
export const ritualLeft = (p: Player): string[] => (p.ritual ? p.ritual.want.filter((id) => !p.ritual!.offered.includes(id)) : []);

// Why this unit can't be offered now, or null.
export function ritualOfferBlock(p: Player, unit: { defId: string }): string | null {
  if (!powersOf(p).ritual || !p.ritual) return 'You have no Shadow Altar';
  if (!ritualLeft(p).length) return 'The ritual is over';
  if (!ritualLeft(p).includes(unit.defId)) return `The altar doesn't ask for the ${UNIT_BY_ID[unit.defId].name}`;
  return null;
}

// Offers unit `uid`: gone (copies back to the pool, items to the inventory by the next sync). The last one ends
// the ritual with a charge.
export function ritualOffer(state: GameState, p: Player, uid: number): string | null {
  const at = find(p, uid);
  if (!at) return 'No such unit';
  const block = ritualOfferBlock(p, at.unit);
  if (block) return block;
  at.slots[at.index] = null;
  if (at.unit.defId in state.pool) state.pool[at.unit.defId] += pooledOf(at.unit);
  p.ritual!.offered.push(at.unit.defId);
  if (!ritualLeft(p).length) p.ritual!.charges++;
  return null;
}

// Empty slots the charge's copies of `defId` need: a copy completing a set merges into it (no slot), otherwise it
// takes one. Alice's Blood Pact hero takes every copy in.
function slotsNeeded(p: Player, defId: string, copies: number): number {
  if (bloodRoom(p, defId)) return 0;
  const size = mergeSize(defId);
  let have = findCopies(p, defId, 1).length;
  let need = 0;
  for (let k = 0; k < copies; k++) {
    if (have >= size - 1) have -= size - 1; // completes a set: the new 2★ keeps one of their slots
    else {
      need++;
      have++;
    }
  }
  return need;
}

const freeSlots = (p: Player) => p.bench.filter((u) => !u).length + p.board.filter((u) => !u).length;

// Why the charge can't go on this unit now, or null.
export function ritualCopyBlock(p: Player, unit: { defId: string }): string | null {
  const ritual = powersOf(p).ritual;
  if (!ritual || !p.ritual?.charges) return 'No Shadow charge';
  const def = UNIT_BY_ID[unit.defId];
  if (def.piece || def.turret) return `The ${def.name} can't be copied`;
  if (slotsNeeded(p, unit.defId, ritual.copies) > freeSlots(p)) return 'No room for the copies';
  return null;
}

// Spends the charge on unit `uid`: copies of it from nothing (outside the pool), merging as they land.
export function useRitualCopy(state: GameState, p: Player, uid: number): string | null {
  const at = find(p, uid);
  if (!at) return 'No such unit';
  const block = ritualCopyBlock(p, at.unit);
  if (block) return block;
  p.ritual!.charges--;
  const { defId } = at.unit;
  for (let k = 0; k < powersOf(p).ritual!.copies; k++) if (canClaimToBoard(p, defId)) gainUnit(state, p, defId, true, false, true);
  p.ritual!.last = defId;
  return null;
}

// Moscow's card: a random hero of the next cost on the pick and at each round start after, one cost up each time,
// from the pool (waiting for bench room like gifts).
export function payLadder(state: GameState, p: Player): void {
  const ladder = powersOf(p).ladder;
  if (!ladder) return;
  const at = (p.ladder ??= { given: 0, round: 0 });
  if (at.given >= ladder.tiers.length || at.round === state.round) return;
  const id = drawFromTier(state, ladder.tiers[at.given], p);
  if (id) (p.gifts ??= []).push(id);
  at.last = id ?? undefined;
  at.given++;
  at.round = state.round;
}
