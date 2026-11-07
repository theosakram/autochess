import { isOrbRound } from './config';
import { isAlive } from './player';
import { nextInt } from './rng';
import { TRAITS } from './traits';
import type { GameState } from './types';
import { UNIT_BY_ID } from './units';

// Magic Orb: used on a unit type, it adds +1 to one trait for as long as that unit type is fielded.
// One active orb per player; using another replaces it.

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

// The traits an orb offers on a unit: each of its own plus one random other. The random one is
// fixed by the orb's seed and the unit, so reopening the choice can't reroll it.
export function orbOptions(seed: number, defId: string): string[] {
  const own = UNIT_BY_ID[defId].traits;
  const others = Object.keys(TRAITS)
    .filter((id) => !own.includes(id))
    .sort();
  if (others.length === 0) return [...own];
  return [...own, others[nextInt({ rng: seed ^ hash(defId) }, others.length)]];
}

// Fixed rounds hand every player still alive an unused orb. Returns who got one.
export function grantOrbs(state: GameState): string[] {
  if (!isOrbRound(state.round)) return [];
  const alive = state.players.filter(isAlive);
  for (const p of alive) p.orbs.push(nextInt(state, 2 ** 30));
  return alive.map((p) => p.id);
}
