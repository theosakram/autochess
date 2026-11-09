import { canClaimToBoard, gainUnit } from './actions';
import { powersOf } from './commanders';
import type { GameState, Player } from './types';
import { UNIT_BY_ID } from './units';

// Pacquiao's boxing gloves: inventory items (Player.gloves, by id), each used once on one of your heroes of the
// right cost. It gives 2 1★ copies of that hero, made up rather than taken from the shop pool: there even when the
// pool has none left, and selling them hands nothing back.
export interface GloveDef {
  id: string;
  name: string;
  icon: string;
  cost: number; // the hero's cost: exactly this, or up to it (`orLower`)
  orLower?: true;
}

export const GLOVE_COPIES = 2;

export const GLOVES: Record<string, GloveDef> = {
  glove3: { id: 'glove3', name: 'Tier-3 Boxing Glove', icon: '🥊', cost: 3 },
  glove4: { id: 'glove4', name: 'Tier-4 Boxing Glove', icon: '🥊', cost: 4 },
  glove5: { id: 'glove5', name: 'Tier-5 Boxing Glove', icon: '🥊', cost: 5 },
  glory: { id: 'glory', name: 'Glory Glove', icon: '🏆', cost: 3, orLower: true },
};

// Its look: the hero-cost colour it's for (tier-3 blue, tier-4 purple, tier-5 gold), the Glory Glove its own.
export const gloveClass = (g: GloveDef) => `glove ${g.orLower ? 'glove-glory' : `tier-${g.cost}`}`;

export const gloveText = (g: GloveDef) =>
  `Use it on one of your ${g.orLower ? `${g.cost}-cost or cheaper` : `${g.cost}-cost`} heroes: gain ${GLOVE_COPIES} 1★ copies of it, ` +
  "whatever the shop has left. Selling them doesn't put them back in the shop.";

const fits = (g: GloveDef, tier: number) => (g.orLower ? tier <= g.cost : tier === g.cost);

// Can glove `id` go on unit `uid`?
export function gloveBlock(p: Player, id: string, uid: number): string | null {
  const g = GLOVES[id];
  if (!g || !(p.gloves ?? []).includes(id)) return 'You have no such glove';
  const unit = [...p.board, ...p.bench].find((u) => u?.uid === uid);
  if (!unit) return 'Pick one of your heroes';
  const def = UNIT_BY_ID[unit.defId];
  if (def.piece || def.shop === false) return `The ${def.name} can't be boxed`;
  if (!fits(g, def.tier)) return `The ${g.name} only works on ${g.orLower ? `${g.cost}-cost or cheaper` : `${g.cost}-cost`} heroes`;
  if (!canClaimToBoard(p, unit.defId)) return 'No room for the copies';
  return null;
}

// Uses glove `id` on unit `uid`: its copies, made up (never from the pool). Returns an error, or null.
export function useGlove(state: GameState, p: Player, id: string, uid: number): string | null {
  const err = gloveBlock(p, id, uid);
  if (err) return err;
  const defId = [...p.board, ...p.bench].find((u) => u?.uid === uid)!.defId;
  p.gloves!.splice(p.gloves!.indexOf(id), 1);
  if (!p.gloves!.length) p.gloves = undefined;
  for (let k = 0; k < GLOVE_COPIES; k++) if (canClaimToBoard(p, defId)) gainUnit(state, p, defId, true, false, true);
  return null;
}

// Round start: the gloves Pacquiao's power hands out by now and hasn't yet (a card picked late still gets the
// earlier ones).
export function giveGloves(state: GameState, p: Player): void {
  for (const { round, glove } of powersOf(p).gloveRounds ?? []) {
    if (state.round < round || (p.glovesGiven ?? []).includes(round)) continue;
    (p.glovesGiven ??= []).push(round);
    (p.gloves ??= []).push(glove);
  }
}
