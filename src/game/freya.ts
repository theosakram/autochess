import { powersOf } from './commanders';
import { openChest } from './inventory';
import { MIST_WARES } from './mistShop';
import { nextInt } from './rng';
import type { StatMod } from './stats';
import { playerTraits, type TraitLevels } from './traits';
import type { GameState, Player, UnitDef } from './types';
import { UNITS } from './units';

// Freya's blessing (see commanders/freya.ts): one role works harder, and its 2/4/6 each give a reward
// the player claims when they like, once a game each.

const freyaOf = (p: Player) => (p.freya ??= { trait: null, claimed: [] });

// Blesses `trait` (any time, as often as the player likes). Returns why it can't, or null.
export function setEnhance(p: Player, trait: string): string | null {
  const power = powersOf(p).enhance;
  if (!power) return 'You have no blessing to give';
  if (!power.traits[trait]) return "That role can't be blessed";
  freyaOf(p).trait = trait;
  return null;
}

// The blessing's extra mods for one fielded unit, given the active trait levels.
export function enhanceMods(p: Player, def: UnitDef, honorary: string[], levels: TraitLevels): StatMod[] {
  const power = powersOf(p).enhance;
  const trait = p.freya?.trait;
  const level = trait ? levels[trait] : undefined;
  if (!power || !trait || !level) return [];
  const t = power.traits[trait];
  if (t.members && !def.traits.includes(trait) && !honorary.includes(trait)) return [];
  return t.mods.map((m) => (m.pct ? { stat: m.stat, pct: m.pct[level - 1] } : { stat: m.stat, add: m.add![level - 1] }));
}

// The reward levels (1 = the trait's 2, ...) the player may claim now: reached by the blessed trait, not claimed yet.
export function claimable(p: Player): number[] {
  const power = powersOf(p).enhance;
  const trait = p.freya?.trait;
  if (!power || !trait) return [];
  const level = playerTraits(p)[trait] ?? 0;
  return [1, 2, 3].filter((l) => l <= level && l <= power.rewardGold.length && !p.freya!.claimed.includes(l));
}

// Two random heroes of `trait` whose costs add up to `worth` (e.g. 5: 1+4 or 2+3), from the pool.
// Null if no pair is left in the pool.
function rollPair(state: GameState, trait: string, worth: number): [string, string] | null {
  const open = (tier: number) => UNITS.filter((u) => u.tier === tier && u.shop !== false && !u.locked && u.traits.includes(trait) && (state.pool[u.id] ?? 0) > 0);
  const pairs: [number, number][] = [];
  for (let a = 1; a <= worth - a; a++) {
    const b = worth - a;
    const left = open(a);
    const right = open(b);
    const copies = (list: UnitDef[]) => list.reduce((n, u) => n + state.pool[u.id], 0);
    if (left.length && right.length && (a !== b || copies(left) >= 2)) pairs.push([a, b]);
  }
  if (!pairs.length) return null;
  const [a, b] = pairs[nextInt(state, pairs.length)];
  const draw = (tier: number) => {
    const list = open(tier);
    const id = list[nextInt(state, list.length)].id;
    state.pool[id]--;
    return id;
  };
  return [draw(a), draw(b)];
}

// Claims reward level `level`: its two heroes (waiting for bench room like any gift), and the card's extra.
// With no pair left in the pool, its worth comes as gold instead.
export function claimEnhance(state: GameState, p: Player, level: number): string | null {
  if (!claimable(p).includes(level)) return 'No reward to claim there';
  const pw = powersOf(p);
  const worth = pw.enhance!.rewardGold[level - 1];
  freyaOf(p).claimed.push(level);
  const pair = rollPair(state, p.freya!.trait!, worth);
  if (pair) (p.gifts ??= []).push(...pair);
  else p.gold += worth;
  if (pw.enhanceExtra) {
    if (level === 1) p.gold += pw.enhanceExtra.gold;
    else if (level === 2) {
      (p.chests ??= { kills: 0, earned: 0, waiting: 0 }).waiting++;
      openChest(state, p);
    } else MIST_WARES[nextInt(state, 2) ? 'randomroleorb' : 'randomfactionorb'].apply(state, p, undefined);
  }
  return null;
}
