import { powersOf } from './commanders';
import { BLOOD_STEPS, bloodMerge } from './merge';
import { baseStats, type StatMod } from './stats';
import type { GameState, Player, Star, Unit } from './types';
import { UNIT_BY_ID } from './units';

// Alice's Blood Pact: a use on rounds I-1, II-1 and III-1 (unused ones wait). Used on a hero type you own, it
// blesses that type for the rest of the game: its copies no longer merge three at a time but pile into one
// hero (Unit.copies), up to the last of BLOOD_STEPS. Every copy raises its stats (see bloodMods).

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

// Uses a Blood Pact on unit `uid`'s type: blessed, its copies gather into one.
export function bloodBless(_state: GameState, p: Player, uid: number): string | null {
  const blocked = bloodBlock(p, uid);
  if (blocked) return blocked;
  const unit = [...p.board, ...p.bench].find((u) => u?.uid === uid)!;
  p.blood!.uses--;
  p.blood!.blessed.push(unit.defId);
  bloodMerge(p, unit.defId);
  return null;
}

// A blessed hero's star display: full red stars, and how far toward the next (0..1).
export function bloodStars(copies: number): { full: number; frac: number } {
  let i = 0;
  while (i + 1 < BLOOD_STEPS.length && copies >= BLOOD_STEPS[i + 1]) i++;
  const next = BLOOD_STEPS[i + 1];
  return { full: i + 1, frac: next === undefined ? 0 : (copies - BLOOD_STEPS[i]) / (next - BLOOD_STEPS[i]) };
}

// Stat mods for a blessed hero's copies, as a share of its current-star stats (the hero's own per-star values):
// - 1★: each copy moves perCopy[0] of the way to its 2★ stats.
// - 2★: each copy adds perCopy[1] of its 3★ stats.
// - 3★: those 2★ bonuses stay (every copy keeps counting), and each copy past 3★ adds perCopy[2] more.
// Plus the card's hybrid attack on every blessed hero.
export function bloodMods(p: Player, u: Unit): StatMod[] {
  if (u.copies === undefined || !isBlessed(p, u.defId)) return [];
  const per = powersOf(p).bloodPact?.perCopy ?? [0, 0, 0];
  const star = Math.min(bloodStars(u.copies).full, 3) as Star;
  const extra = u.copies - BLOOD_STEPS[star - 1];
  const grow = { hp: 0, atk: 0, ap: 0 };
  const def = UNIT_BY_ID[u.defId];
  const s1 = baseStats(def, 1);
  const s2 = baseStats(def, 2);
  const s3 = baseStats(def, 3);
  for (const k of ['hp', 'atk', 'ap'] as const) {
    if (star === 1) grow[k] = per[0] * extra * (s2[k] / s1[k] - 1);
    if (star === 2) grow[k] = (per[1] * extra * s3[k]) / s2[k];
    if (star === 3) grow[k] = per[1] * (BLOOD_STEPS[2] - BLOOD_STEPS[1]) + per[2] * extra;
  }
  const card = powersOf(p).bloodAtk ?? 0;
  grow.atk += card;
  grow.ap += card;
  const mods: StatMod[] = [];
  for (const k of ['hp', 'atk', 'ap'] as const) if (grow[k]) mods.push({ stat: k, pct: grow[k] });
  return mods;
}
