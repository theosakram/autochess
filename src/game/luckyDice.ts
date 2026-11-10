import { powersOf } from './commanders';
import { EQUIPMENT, ITEMS } from './items';
import { MIST_WARES } from './mistShop';
import { nextInt } from './rng';
import { TRAITS } from './traits';
import type { GameState, Player } from './types';

// Kaela's Lucky Dice: her Treasure Grove (roll for points, open for a prize) and her card's two free rolls.
// Every prize is worth a set amount of gold: one random thing that fits in it, topped up with gold.

interface Prize {
  id: string;
  value: number; // in gold
  // Hands it over; returns its name, or null if it can't be given (bench full, pool empty).
  give(state: GameState, p: Player): string | null;
}

// A Mist ware handed over for free; its name, or null if it couldn't be applied.
const ware = (id: string, label: (p: Player) => string) => (state: GameState, p: Player) =>
  MIST_WARES[id].apply(state, p, undefined) === null ? label(p) : null;
const lastOrb = (p: Player) => TRAITS[p.mistOrbs!.at(-1)!.trait].name;

// Values follow the Mist Shop's prices (8 Mist coins a gold); equipment isn't sold there, so it's set here.
const PRIZES: Prize[] = [
  { id: 'gold', value: 0, give: () => '' },
  { id: 'hero4', value: 4, give: ware('random4', () => 'a random 4-gold hero') },
  { id: 'hero5', value: 5, give: ware('random5', () => 'a random 5-gold hero') },
  { id: 'factionorb', value: 10, give: ware('randomfactionorb', (p) => `a ${lastOrb(p)} orb`) },
  { id: 'roleorb', value: 10, give: ware('randomroleorb', (p) => `a ${lastOrb(p)} orb`) },
  {
    id: 'mirror',
    value: 10,
    give: (_state, p) => {
      p.mirrors = (p.mirrors ?? 0) + 1;
      return 'a Mirror Device';
    },
  },
  {
    id: 'equipment',
    value: 12,
    give: (state, p) => {
      const id = EQUIPMENT[nextInt(state, EQUIPMENT.length)];
      p.items.push({ uid: state.nextUid++, id, tier: 1, holder: null });
      return `${ITEMS[id].icon} ${ITEMS[id].name}`;
    },
  },
];
export const PRIZE_VALUES: Record<string, number> = Object.fromEntries(PRIZES.map((z) => [z.id, z.value]));

// Pays a prize worth `value` gold (Kaela's dice, kept as her last prize).
export function payPrize(state: GameState, p: Player, value: number): string {
  const text = rollPrize(state, p, value);
  (p.luck ??= { rolled: [], last: null }).last = text;
  return text;
}

// A random prize worth `value` gold that fits (gold alone always does), then gold for the rest; `skip`: prize ids
// left out. A prize that can't be given falls back to gold. Returns what was given, e.g. "a Mirror Device + 3 gold".
export function rollPrize(state: GameState, p: Player, value: number, skip: string[] = []): string {
  const fits = PRIZES.filter((z) => z.value <= value && !skip.includes(z.id));
  const prize = fits[nextInt(state, fits.length)];
  const name = prize.value > 0 ? prize.give(state, p) : null;
  const gold = name === null ? value : value - prize.value;
  p.gold += gold;
  return [name, gold > 0 || !name ? `${gold} gold` : ''].filter(Boolean).join(' + ');
}

const troveOf = (p: Player) => (p.trove ??= { points: 0, rolls: 0, rolledRound: 0, opens: 0, lastRoll: null, bust: false });

// Rolls banked: one a round from I-1 (Kaela is picked on the first round), unused ones carry over.
export const rollsLeft = (state: GameState, p: Player) => Math.max(0, state.round - troveOf(p).rolls);

// Why this player can't roll the Trove's dice now, or null.
export function rollBlock(state: GameState, p: Player): string | null {
  const power = powersOf(p).trove;
  if (!power) return 'You have no Treasure Grove';
  const t = troveOf(p);
  if (t.opens >= power.opens) return 'The Trove is spent';
  if (rollsLeft(state, p) <= 0) return 'No rolls left; one more next round';
  return null;
}

export function rollTrove(state: GameState, p: Player): string | null {
  const block = rollBlock(state, p);
  if (block) return block;
  const power = powersOf(p).trove!;
  const t = troveOf(p);
  const roll = 1 + nextInt(state, power.die);
  t.rolls++;
  t.rolledRound = state.round;
  t.lastRoll = roll;
  t.bust = t.points + roll > power.max;
  t.points = t.bust ? 0 : t.points + roll;
  return null;
}

// Why this player can't open the Trove now, or null.
export function openBlock(p: Player): string | null {
  const power = powersOf(p).trove;
  if (!power) return 'You have no Treasure Grove';
  const t = troveOf(p);
  if (t.opens >= power.opens) return 'The Trove is spent';
  if (t.points <= 0) return 'No points to cash in';
  return null;
}

export function openTrove(state: GameState, p: Player): string | null {
  const block = openBlock(p);
  if (block) return block;
  const t = troveOf(p);
  payPrize(state, p, powersOf(p).trove!.value[t.points]);
  t.points = 0;
  t.opens++;
  return null;
}

// The card's Lucky Dice: every roll due by this round and not rolled yet (a late pick rolls the missed ones).
export function cardRolls(state: GameState, p: Player): void {
  const rolls = powersOf(p).luckyRolls;
  if (!rolls) return;
  const luck = (p.luck ??= { rolled: [], last: null });
  for (const r of rolls) {
    if (r.round > state.round || luck.rolled.includes(r.round)) continue;
    luck.rolled.push(r.round);
    payPrize(state, p, r.min + nextInt(state, r.max - r.min + 1));
  }
}

