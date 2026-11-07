// Trait balance harness: `bun run balance` (RUNS=1000 for more precision).
//
// Each scenario fights a board against an identical copy with traits switched off,
// so the win rate isolates the trait itself. Sides alternate to cancel any home/away
// bias. "worth" is the flat hp+atk boost the trait-less copy needs to break even.
import '../src/game/testUnits'; // neutral fillers (footman, knight, ...) for the boards below
import { simulateCombat, type CombatResult, type SimOptions } from '../src/game/combat';
import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS, TICKS_PER_SECOND } from '../src/game/config';
import { formation } from '../src/game/formation';
import { activeTraits, tileSeating, TRAITS } from '../src/game/traits';
import type { Player, Star, Unit } from '../src/game/types';

const RUNS = Number(process.env.RUNS ?? 400);
// ONLY=Defender runs just the scenarios whose name contains it.
const ONLY = process.env.ONLY;
const STAR = Number(process.env.STAR ?? 1) as Star;
// The game rolls this once per game; balance pins it so runs are comparable.
const CHOSEN = { storyweaver: process.env.PROTAGONIST ?? 'altus' };

type ScenarioItem = { id: string; tier: number; on: string }; // on = unit def id that holds it

export const SCENARIOS: { name: string; units: string[]; stacks?: Record<string, number>; items?: ScenarioItem[] }[] = [
  { name: 'baseline', units: ['footman', 'knight', 'paladin', 'archer', 'imp', 'titan'] },
  { name: 'Hunter 2', units: ['siyunyin', 'natalie', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Hunter 4', units: ['siyunyin', 'natalie', 'saber', 'katarina', 'archer', 'imp'] },
  { name: 'Hunter 6', units: ['siyunyin', 'natalie', 'saber', 'katarina', 'gufron', 'fanny', 'archer', 'imp'] },
  { name: 'Stargazer 2', units: ['eudora', 'luoyi', 'footman', 'knight', 'paladin', 'archer'] },
  { name: 'Stargazer 4', units: ['eudora', 'luoyi', 'mathilda', 'katarina', 'footman', 'knight'] },
  { name: 'Dragon Altar 2', units: ['siyunyin', 'luoyi', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Dragon Altar 4', units: ['siyunyin', 'luoyi', 'wan', 'suyu', 'archer', 'imp'] },
  { name: 'Dragon Altar 6', units: ['siyunyin', 'luoyi', 'wan', 'suyu', 'yang', 'balia', 'footman', 'knight'] },
  { name: 'Skybringer 2', units: ['eudora', 'balman', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Skybringer 4', units: ['eudora', 'balman', 'clint', 'gufron', 'archer', 'imp'] },
  { name: 'Skybringer 6', units: ['eudora', 'balman', 'clint', 'gufron', 'zhizong', 'balang', 'footman', 'knight'] },
  { name: 'Deadeye 2', units: ['mia', 'ginger', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Deadeye 4', units: ['mia', 'ginger', 'wan', 'kari', 'footman', 'knight'] },
  { name: 'Deadeye 6', units: ['mia', 'ginger', 'wan', 'kari', 'irina', 'melina', 'footman', 'knight'] },
  // Both roles side by side; no unit carries both, so this takes 8 units.
  { name: 'HU4 + DE4', units: ['natalie', 'katarina', 'gufron', 'fanny', 'ginger', 'wan', 'kari', 'melina'] },
  { name: 'Phasewarper 2', units: ['harley', 'kanina', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Phasewarper 3', units: ['harley', 'kanina', 'clint', 'footman', 'knight', 'archer'] },
  { name: 'Storyweaver 2 @0', units: ['belle', 'altus', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Storyweaver 2 @15', units: ['belle', 'altus', 'footman', 'knight', 'archer', 'imp'], stacks: { storyweaver: 15 } },
  { name: 'Storyweaver 2 @30', units: ['belle', 'altus', 'footman', 'knight', 'archer', 'imp'], stacks: { storyweaver: 30 } },
  { name: 'Storyweaver 4 @0', units: ['belle', 'mathilda', 'altus', 'vex', 'footman', 'knight'] },
  { name: 'Storyweaver 4 @15', units: ['belle', 'mathilda', 'altus', 'vex', 'footman', 'knight'], stacks: { storyweaver: 15 } },
  { name: 'Storyweaver 4 @30', units: ['belle', 'mathilda', 'altus', 'vex', 'footman', 'knight'], stacks: { storyweaver: 30 } },
  {
    name: 'Gustiwana 2 T1',
    units: ['dyroth', 'angela', 'footman', 'knight', 'archer', 'imp'],
    items: [{ id: 'keris', tier: 1, on: 'angela' }],
  },
  {
    name: 'Gustiwana 4 T2',
    units: ['dyroth', 'angela', 'frank', 'kari', 'archer', 'imp'],
    items: [
      { id: 'keris', tier: 2, on: 'angela' },
      { id: 'blangkon', tier: 2, on: 'dyroth' },
    ],
  },
  {
    name: 'Gustiwana 6 T3',
    units: ['dyroth', 'angela', 'frank', 'kari', 'lunox', 'lance', 'footman', 'knight'],
    items: [
      { id: 'keris', tier: 3, on: 'lunox' },
      { id: 'blangkon', tier: 3, on: 'dyroth' },
      { id: 'jimat', tier: 3, on: 'lunox' },
    ],
  },
  { name: 'Mooneater 2', units: ['hilos', 'kanina', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Mooneater 3', units: ['hilos', 'kanina', 'melina', 'footman', 'knight', 'archer'] },
  // The Offering goes on Titan: strong and traitless, so only Cult of Fire is measured.
  {
    name: 'Cult of Fire 2',
    units: ['cici', 'zhuxin', 'titan', 'footman', 'knight', 'archer'],
    items: [{ id: 'offering', tier: 1, on: 'titan' }],
  },
  {
    name: 'Cult of Fire 4',
    units: ['cici', 'zhuxin', 'mia', 'edith', 'titan', 'archer'],
    items: [{ id: 'offering', tier: 1, on: 'titan' }],
  },
  {
    name: 'Cult of Fire 6',
    units: ['cici', 'zhuxin', 'mia', 'edith', 'lola', 'fanny', 'titan', 'knight'],
    items: [{ id: 'offering', tier: 1, on: 'titan' }],
  },
  { name: 'Mage 2', units: ['val', 'zhuxin', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Mage 4', units: ['val', 'zhuxin', 'kanina', 'gourd', 'footman', 'knight'] },
  { name: 'Mage 6', units: ['val', 'zhuxin', 'kanina', 'gourd', 'vex', 'odette', 'footman', 'knight'] },
  { name: 'Astral 2', units: ['minos', 'martin', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Astral 4', units: ['minos', 'martin', 'katarina', 'hilman', 'footman', 'knight'] },
  { name: 'Astral 6', units: ['minos', 'martin', 'katarina', 'hilman', 'irina', 'odette', 'footman', 'knight'] },
  // Damage dealers on the rest of the board, so the armor/mr has hits to soak and something to protect.
  { name: 'Defender 2', units: ['minos', 'hilos', 'ginger', 'archer', 'imp', 'natalie'] },
  { name: 'Defender 4', units: ['minos', 'hilos', 'edith', 'tig', 'archer', 'imp'] },
  { name: 'Defender 6', units: ['minos', 'hilos', 'edith', 'tig', 'altus', 'balia', 'archer', 'imp'] },
  { name: 'Weapon Master 2', units: ['cici', 'martin', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Weapon Master 4', units: ['cici', 'martin', 'frank', 'suyu', 'footman', 'knight'] },
  { name: 'Weapon Master 6', units: ['cici', 'martin', 'frank', 'suyu', 'zhizong', 'thamar', 'footman', 'knight'] },
  { name: 'Fighter 2', units: ['dyroth', 'belle', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Fighter 4', units: ['dyroth', 'belle', 'aldo', 'pacquiao', 'footman', 'knight'] },
  { name: 'Fighter 6', units: ['dyroth', 'belle', 'aldo', 'pacquiao', 'yang', 'balang', 'footman', 'knight'] },
  { name: 'Dauntless 2', units: ['uranus', 'balman', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Dauntless 4', units: ['uranus', 'balman', 'hilman', 'frank', 'footman', 'knight'] },
  { name: 'Dauntless 6', units: ['uranus', 'balman', 'hilman', 'frank', 'lola', 'alice', 'footman', 'knight'] },
  { name: 'Necromancer 2 @0', units: ['val', 'natalie', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Necromancer 4 @350', units: ['val', 'natalie', 'harley', 'tig', 'footman', 'knight'], stacks: { necromancer: 350 } },
  { name: 'Necromancer 6 @999', units: ['val', 'natalie', 'harley', 'tig', 'sora', 'thamar', 'footman', 'knight'], stacks: { necromancer: 999 } },
  { name: 'Spectre 2', units: ['phove', 'ginger', 'footman', 'knight', 'archer', 'imp'] },
  { name: 'Spectre 4', units: ['phove', 'ginger', 'saber', 'pacquiao', 'footman', 'knight'] },
  { name: 'Spectre 6', units: ['phove', 'ginger', 'saber', 'pacquiao', 'gourd', 'alice', 'footman', 'knight'] },
  { name: 'Stargazer 6', units: ['eudora', 'luoyi', 'mathilda', 'katarina', 'lunox', 'nana', 'footman', 'knight'] },
];

// Default formation (melee front, ranged back), then trait tiles taken like bots do.
export function makePlayer(id: string, defIds: string[], stacks: Record<string, number> = {}, items: ScenarioItem[] = []): Player {
  const board: (Unit | null)[] = Array(BOARD_COLS * BOARD_ROWS).fill(null);
  formation(defIds).forEach((cell, i) => (board[cell] = { uid: i + 1, defId: defIds[i], star: STAR }));
  const owned = items.map((it, i) => ({ uid: 100 + i, id: it.id, tier: it.tier, holder: defIds.indexOf(it.on) + 1 }));
  for (const [from, to] of tileSeating(board)) [board[from], board[to]] = [board[to], board[from]];
  return { id, name: id, isBot: true, hp: 100, gold: 0, level: 9, xp: 0, bench: Array(BENCH_SIZE).fill(null), board, shop: [], shopLocked: false, place: null, stacks, items: owned, orbs: [], orb: null, commander: null };
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
    if (ONLY && !s.name.includes(ONLY)) continue;
    const p = makePlayer('trait', s.units, s.stacks, s.items);
    const levels = activeTraits(p.board);
    const active = Object.entries(levels).map(([id, lvl]) => `${TRAITS[id].name} ${TRAITS[id].breakpoints[lvl - 1]}`).join(', ') || '-';

    let ticks = 0;
    let casts = 0;
    let castUnits = 0;
    run(p, 1, RUNS, (r, side) => {
      ticks += r.ticks;
      // Placeholder casts and real skills alike, by the units that started the fight (summons, which
      // arrive mid-fight and aren't in r.fighters, aren't counted: this is casts per fielded unit).
      casts += r.events.filter((e) => (e.type === 'cast' || e.type === 'skill') && r.fighters[e.id]?.side === side).length;
      castUnits += r.fighters.filter((f) => f.side === side).length;
    });
    const w = Object.keys(levels).length ? worth(p) : 0;
    console.log(
      `${s.name.padEnd(18)} ${active.padEnd(18)} ${pct(w)} ${(ticks / RUNS / TICKS_PER_SECOND).toFixed(1).padStart(6)} ${(casts / castUnits).toFixed(2).padStart(11)}`,
    );
  }
}

if (import.meta.main) main();
