import { powersOf } from './commanders';
import { BLOOD_STEPS, bloodMerge } from './merge';
import type { StatMod } from './stats';
import { STAR_MULT } from './config';
import type { GameState, Player, Unit } from './types';
import { UNIT_BY_ID } from './units';

// Alice's Blood Pact: a use on rounds I-1, II-1 and III-1 (unused ones wait). Used on a hero type you own, it
// blesses that type for the rest of the game: its copies no longer merge three at a time but pile into one
// hero (Unit.copies), up to the last of BLOOD_STEPS; it also hands over one more copy, which goes straight in.
// Between full stars every copy raises its stats; past 3 stars each copy is a flat boost (see bloodMods).

// Hands out this round's use, once per use round, while the power works for the player.
export function grantBlood(state: GameState, p: Player): void {
  const pact = powersOf(p).bloodPact;
  if (!pact || !pact.rounds.includes(state.round)) return;
  const blood = (p.blood ??= { blessed: [], uses: 0, rounds: [] });
  if (blood.rounds.includes(state.round)) return;
  blood.rounds.push(state.round);
  blood.uses++;
}

export const isBlessed = (p: Player, defId: string) => !!p.blood?.blessed.includes(defId);

// Why this unit can't take the Blood Pact, or null.
export function bloodBlock(p: Player, uid: number): string | null {
  if (!powersOf(p).bloodPact || !p.blood?.uses) return 'No Blood Pact to use';
  const unit = [...p.board, ...p.bench].find((u) => u?.uid === uid);
  if (!unit) return 'No such unit';
  const def = UNIT_BY_ID[unit.defId];
  if (def.piece || def.shop === false) return `The ${def.name} can't take the Blood Pact`;
  if (isBlessed(p, def.id)) return `The ${def.name} already has the Blood Pact`;
  return null;
}

// Uses a Blood Pact on unit `uid`'s type: blessed, its copies gather into one, plus a free copy from the pool.
export function bloodBless(state: GameState, p: Player, uid: number): string | null {
  const blocked = bloodBlock(p, uid);
  if (blocked) return blocked;
  const unit = [...p.board, ...p.bench].find((u) => u?.uid === uid)!;
  p.blood!.uses--;
  p.blood!.blessed.push(unit.defId);
  // The free copy: from the pool when there's one left.
  const extra = (state.pool[unit.defId] ?? 0) > 0 ? 1 : 0;
  if (extra) state.pool[unit.defId]--;
  bloodMerge(p, unit.defId, extra);
  return null;
}

// A blessed hero's star display: full red stars, and how far toward the next (0..1).
export function bloodStars(copies: number): { full: number; frac: number } {
  let i = 0;
  while (i + 1 < BLOOD_STEPS.length && copies >= BLOOD_STEPS[i + 1]) i++;
  const next = BLOOD_STEPS[i + 1];
  return { full: i + 1, frac: next === undefined ? 0 : (copies - BLOOD_STEPS[i]) / (next - BLOOD_STEPS[i]) };
}

// Stat mods for a blessed hero's copies: toward the next star's stats between full stars; past 3 stars,
// +perCopy hybrid attack and max hp each. Plus the card's hybrid attack on every blessed hero.
export function bloodMods(p: Player, u: Unit): StatMod[] {
  if (u.copies === undefined || !isBlessed(p, u.defId)) return [];
  const pact = powersOf(p).bloodPact;
  const mods: StatMod[] = [];
  const { full, frac } = bloodStars(u.copies);
  let grow = 0;
  if (full < 3 && frac > 0) grow = (STAR_MULT[full] / STAR_MULT[full - 1] - 1) * frac;
  if (full >= 3) grow = (pact?.perCopy ?? 0) * (u.copies - BLOOD_STEPS[2]);
  let atk = grow;
  if (grow) mods.push({ stat: 'hp', pct: grow });
  atk += powersOf(p).bloodAtk ?? 0;
  if (atk) mods.push({ stat: 'atk', pct: atk }, { stat: 'ap', pct: atk });
  return mods;
}
