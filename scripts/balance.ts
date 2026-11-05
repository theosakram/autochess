// Trait balance harness: `bun run balance` (RUNS=1000 for more precision).
//
// Each scenario fights a board against an identical copy with traits switched off,
// so the win rate isolates the trait itself. Sides alternate to cancel any home/away
// bias. "worth" is the flat hp+atk boost the trait-less copy needs to break even.
import { simulateCombat, type CombatResult, type SimOptions } from '../src/game/combat';
import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS, TICKS_PER_SECOND } from '../src/game/config';
import { formation } from '../src/game/formation';
import { activeTraits, tileSeating, TRAITS } from '../src/game/traits';
import type { Player, Star, Unit } from '../src/game/types';

const RUNS = Number(process.env.RUNS ?? 400);
const STAR = Number(process.env.STAR ?? 1) as Star;
// The game rolls this once per game; balance pins it so runs are comparable.
const CHOSEN = { storyweaver: process.env.PROTAGONIST ?? 'fablesword' };

type ScenarioItem = { id: string; tier: number; on: string }; // on = unit def id that holds it

export const SCENARIOS: { name: string; units: string[]; stacks?: Record<string, number>; items?: ScenarioItem[] }[] = [
  { name: 'baseline', units: ['footman', 'knight', 'paladin', 'archer', 'imp', 'titan'] },
  { name: 'Hunter 2', units: ['skeleton', 'ghoul', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Hunter 4', units: ['skeleton', 'ghoul', 'deathknight', 'wraith', 'archer', 'imp'] },
  { name: 'Hunter 6', units: ['skeleton', 'ghoul', 'banshee', 'deathknight', 'wraith', 'abomination', 'archer', 'imp'] },
  { name: 'Stargazer 2', units: ['acolyte', 'druid', 'footman', 'knight', 'paladin', 'archer'] },
  { name: 'Stargazer 4', units: ['acolyte', 'druid', 'shaman', 'wyrm', 'footman', 'knight'] },
  { name: 'Dragon Altar 2', units: ['drakeling', 'scalebearer', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Dragon Altar 4', units: ['drakeling', 'scalebearer', 'altarkeeper', 'wyrmcaller', 'archer', 'imp'] },
  { name: 'Dragon Altar 6', units: ['drakeling', 'scalebearer', 'altarkeeper', 'wyrmcaller', 'drakerider', 'ancientdragon', 'footman', 'knight'] },
  { name: 'Skybringer 2', units: ['galekin', 'thunderhawk', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Skybringer 4', units: ['galekin', 'thunderhawk', 'stormherald', 'tempestknight', 'archer', 'imp'] },
  { name: 'Skybringer 6', units: ['galekin', 'thunderhawk', 'stormherald', 'tempestknight', 'skyreaver', 'thunderlord', 'footman', 'knight'] },
  { name: 'Deadeye 2', units: ['slinger', 'hawkeye', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Deadeye 4', units: ['slinger', 'hawkeye', 'marksman', 'duelist', 'footman', 'knight'] },
  { name: 'Deadeye 6', units: ['slinger', 'hawkeye', 'marksman', 'duelist', 'bonesniper', 'deadshot', 'footman', 'knight'] },
  // Both roles side by side; no unit carries both, so this takes 8 units.
  { name: 'HU4 + DE4', units: ['skeleton', 'ghoul', 'deathknight', 'wraith', 'slinger', 'hawkeye', 'marksman', 'duelist'] },
  { name: 'Phasewarper 2', units: ['blinkblade', 'rarajonggrang', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Phasewarper 3', units: ['blinkblade', 'rarajonggrang', 'voidstalker', 'footman', 'knight', 'archer'] },
  { name: 'Storyweaver 2 @0', units: ['inkling', 'fablesword', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Storyweaver 2 @15', units: ['inkling', 'fablesword', 'footman', 'knight', 'archer', 'imp'], stacks: { storyweaver: 15 } },
  { name: 'Storyweaver 2 @30', units: ['inkling', 'fablesword', 'footman', 'knight', 'archer', 'imp'], stacks: { storyweaver: 30 } },
  { name: 'Storyweaver 4 @0', units: ['inkling', 'chronicler', 'fablesword', 'mythweaver', 'footman', 'knight'] },
  { name: 'Storyweaver 4 @15', units: ['inkling', 'chronicler', 'fablesword', 'mythweaver', 'footman', 'knight'], stacks: { storyweaver: 15 } },
  { name: 'Storyweaver 4 @30', units: ['inkling', 'chronicler', 'fablesword', 'mythweaver', 'footman', 'knight'], stacks: { storyweaver: 30 } },
  {
    name: 'Gustiwana 2 T1',
    units: ['prajurit', 'penari', 'footman', 'knight', 'archer', 'imp'],
    items: [{ id: 'keris', tier: 1, on: 'penari' }],
  },
  {
    name: 'Gustiwana 4 T2',
    units: ['prajurit', 'penari', 'dalang', 'senopati', 'archer', 'imp'],
    items: [
      { id: 'keris', tier: 2, on: 'penari' },
      { id: 'blangkon', tier: 2, on: 'prajurit' },
    ],
  },
  {
    name: 'Gustiwana 6 T3',
    units: ['prajurit', 'penari', 'dalang', 'senopati', 'resi', 'batarakala', 'footman', 'knight'],
    items: [
      { id: 'keris', tier: 3, on: 'resi' },
      { id: 'blangkon', tier: 3, on: 'prajurit' },
      { id: 'jimat', tier: 3, on: 'resi' },
    ],
  },
  { name: 'Mooneater 2', units: ['rembulan', 'rarajonggrang', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Mooneater 3', units: ['rembulan', 'rarajonggrang', 'deadshot', 'footman', 'knight', 'archer'] },
  // The Offering goes on Titan: strong and traitless, so only Cult of Fire is measured.
  {
    name: 'Cult of Fire 2',
    units: ['kindler', 'ashbinder', 'titan', 'footman', 'knight', 'archer'],
    items: [{ id: 'offering', tier: 1, on: 'titan' }],
  },
  {
    name: 'Cult of Fire 4',
    units: ['kindler', 'ashbinder', 'pyreguard', 'flamecaller', 'titan', 'archer'],
    items: [{ id: 'offering', tier: 1, on: 'titan' }],
  },
  {
    name: 'Cult of Fire 6',
    units: ['kindler', 'ashbinder', 'pyreguard', 'flamecaller', 'pyromancer', 'abomination', 'titan', 'knight'],
    items: [{ id: 'offering', tier: 1, on: 'titan' }],
  },
  { name: 'Stargazer 6', units: ['acolyte', 'druid', 'shaman', 'astromancer', 'wyrm', 'oracle', 'footman', 'knight'] },
];

// Default formation (melee front, ranged back), then trait tiles taken like bots do.
export function makePlayer(id: string, defIds: string[], stacks: Record<string, number> = {}, items: ScenarioItem[] = []): Player {
  const board: (Unit | null)[] = Array(BOARD_COLS * BOARD_ROWS).fill(null);
  formation(defIds).forEach((cell, i) => (board[cell] = { uid: i + 1, defId: defIds[i], star: STAR }));
  const owned = items.map((it, i) => ({ uid: 100 + i, id: it.id, tier: it.tier, holder: defIds.indexOf(it.on) + 1 }));
  for (const [from, to] of tileSeating(board)) [board[from], board[to]] = [board[to], board[from]];
  return { id, name: id, isBot: true, hp: 100, gold: 0, level: 9, xp: 0, bench: Array(BENCH_SIZE).fill(null), board, shop: [], shopLocked: false, place: null, stacks, items: owned, orbs: [], orb: null };
}

// Plays `p` (traits on, x1 stats) against its copy (traits off, x mult stats).
function run(p: Player, mult: number, runs: number, onResult?: (r: CombatResult, side: 0 | 1) => void): number {
  const copy = { ...p, id: 'copy' };
  let score = 0;
  for (let i = 0; i < runs; i++) {
    const side = (i % 2) as 0 | 1;
    const opts: SimOptions =
      side === 0
        ? { traits: [true, false], statMult: [1, mult], chosen: CHOSEN }
        : { traits: [false, true], statMult: [mult, 1], chosen: CHOSEN };
    const r = simulateCombat({ rng: (i + 1) * 2654435761 }, side === 0 ? p : copy, side === 0 ? copy : p, opts);
    score += r.winner === side ? 1 : r.winner === null ? 0.5 : 0;
    onResult?.(r, side);
  }
  return score / runs;
}

export function worth(p: Player): number {
  let lo = 1;
  let hi = 2;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (run(p, mid, RUNS / 2) > 0.5) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2 - 1;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`.padStart(7);

function main(): void {
  console.log(`runs=${RUNS} star=${STAR}  (target worth: ~10% at 2, ~25% at 4, ~45% at 6)\n`);
  console.log('scenario           active               worth   secs  casts/unit');
  for (const s of SCENARIOS) {
    const p = makePlayer('trait', s.units, s.stacks, s.items);
    const levels = activeTraits(p.board);
    const active = Object.entries(levels).map(([id, lvl]) => `${TRAITS[id].name} ${TRAITS[id].breakpoints[lvl - 1]}`).join(', ') || '-';

    let ticks = 0;
    let casts = 0;
    let castUnits = 0;
    run(p, 1, RUNS, (r, side) => {
      ticks += r.ticks;
      casts += r.events.filter((e) => e.type === 'cast' && r.fighters[e.id].side === side).length;
      castUnits += r.fighters.filter((f) => f.side === side).length;
    });
    const w = Object.keys(levels).length ? worth(p) : 0;
    console.log(
      `${s.name.padEnd(18)} ${active.padEnd(18)} ${pct(w)} ${(ticks / RUNS / TICKS_PER_SECOND).toFixed(1).padStart(6)} ${(casts / castUnits).toFixed(2).padStart(11)}`,
    );
  }
}

if (import.meta.main) main();
