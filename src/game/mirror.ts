import { canClaim, gainUnit } from './actions';
import type { GameState, Player } from './types';

// The Mirror Device: an inventory item (Player.mirrors counts them) from the Mist Shop, Amon's Mirror Bar and
// card, or Kaela's dice. Kept until used, any time: it copies any of the player's units (a new 1-star copy),
// shop or not. The copy comes from the pool while it has one, otherwise from outside it (a shortfall, never
// returned to the pool).
export const MIRROR = {
  name: 'Mirror Device',
  icon: '👥',
  desc: "Use it any time to copy any one of your units: a new 1-star copy of it, even a hero the shop doesn't sell or has run out of.",
};

// Why unit `uid` can't be copied, or null.
export function mirrorBlock(_state: GameState, p: Player, uid: number): string | null {
  if (!p.mirrors) return 'You have no Mirror Device';
  const unit = [...p.board, ...p.bench].find((u) => u?.uid === uid);
  if (!unit) return 'Pick one of your units to copy';
  if (!canClaim(p, unit.defId)) return 'Bench is full';
  return null;
}

// Uses one Mirror Device on unit `uid`. Returns an error, or null.
export function useMirror(state: GameState, p: Player, uid: number): string | null {
  const err = mirrorBlock(state, p, uid);
  if (err) return err;
  const defId = [...p.board, ...p.bench].find((u) => u?.uid === uid)!.defId;
  const pooled = (state.pool[defId] ?? 0) > 0;
  if (pooled) state.pool[defId]--;
  p.mirrors!--;
  gainUnit(state, p, defId, false, false, !pooled);
  return null;
}
