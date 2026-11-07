import { powersOf } from './commanders';
import { mergeUnits } from './merge';
import { shuffle } from './rng';
import type { StatMod } from './stats';
import type { GameState, Player, Unit } from './types';
import { JOHNNIE_FACTIONS, JOHNNIE_ROLES, johnnieId, UNIT_BY_ID } from './units';

// Johnson's Johnnie's Den: a pick of Johnnies, all with different factions and different roles. The one
// picked is the player's for the game: it rolls in their shop like a 3-gold hero, free (see shop.ts).

// Opens the Den the first time the power works for the player (Johnson picked, or his card on another
// commander). Run on every sync.
export function syncJohnnie(state: GameState, p: Player): void {
  const power = powersOf(p).johnnie;
  if (!power || p.johnnie) return;
  const factions = shuffle(state, [...JOHNNIE_FACTIONS]);
  const roles = shuffle(state, [...JOHNNIE_ROLES]);
  const n = Math.min(power.offer, factions.length, roles.length);
  p.johnnie = { offer: Array.from({ length: n }, (_, i) => johnnieId(factions[i], roles[i])), defId: null };
}

// Takes one Johnnie from the Den onto the bench, free (with the bench full, it waits like a gift until
// there's room). Returns why it can't, or null.
export function pickJohnnie(p: Player, defId: string, state: GameState): string | null {
  if (!p.johnnie?.offer.includes(defId)) return "That Johnnie isn't on offer";
  p.johnnie = { offer: [], defId };
  const free = p.bench.indexOf(null);
  if (free < 0) (p.gifts ??= []).push(defId);
  else {
    p.bench[free] = { uid: state.nextUid++, defId, star: 1 };
    mergeUnits(p, defId);
  }
  return null;
}

// Johnson's card: every Johnnie fights harder.
export function johnnieMods(p: Player, u: Unit): StatMod[] {
  const buff = powersOf(p).johnnieBuff;
  if (!buff || !UNIT_BY_ID[u.defId].johnnie) return [];
  return [
    { stat: 'atk', pct: buff.hybridAtk },
    { stat: 'ap', pct: buff.hybridAtk },
    { stat: 'hp', pct: buff.hp },
  ];
}
