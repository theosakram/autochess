import { canClaim, gainUnit } from './actions';
import type { GameState, Player } from './types';
import { UNIT_BY_ID } from './units';

// The Mirror Device: an inventory item (Player.mirrors counts them) from the Mist Shop, Amon's Mirror Bar and
// card, or Kaela's dice. Kept until used, any time: it copies one of the player's units (a new 1-star copy,
// from the pool).
export const MIRROR = {
  name: 'Mirror Device',
  icon: '👥',
  desc: 'Use it any time to copy one of your units: a new 1-star copy of it, from the pool.',
};

// Why unit `uid` can't be copied, or null.
export function mirrorBlock(state: GameState, p: Player, uid: number): string | null {
  if (!p.mirrors) return 'You have no Mirror Device';
  const unit = [...p.board, ...p.bench].find((u) => u?.uid === uid);
  if (!unit) return 'Pick one of your units to copy';
  const def = UNIT_BY_ID[unit.defId];
  if (def.shop === false) return `The ${def.name} can't be copied`;
  if (!state.pool[unit.defId]) return `No ${def.name} left to copy`;
  if (!canClaim(p, unit.defId)) return 'Bench is full';
  return null;
}

// Uses one Mirror Device on unit `uid`. Returns an error, or null.
export function useMirror(state: GameState, p: Player, uid: number): string | null {
  const err = mirrorBlock(state, p, uid);
  if (err) return err;
  const defId = [...p.board, ...p.bench].find((u) => u?.uid === uid)!.defId;
  state.pool[defId]--;
  p.mirrors!--;
  gainUnit(state, p, defId);
  return null;
}
