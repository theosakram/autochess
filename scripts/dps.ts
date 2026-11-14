// Training dummies: every hero's damage per second over the same window, against targets that never die.
//
//   bun run dps                          every shop hero, 1★
//   bun run dps zhizong suyu             just these
//   bun run dps 4                        every 4-gold hero
//   bun run dps 4 --star 2 --with weaponmaster:4 --armor 60 --runs 20 --no-hits
//   bun run dps val --set GRAVE_WHISPER.ap=2.4,2.4,3.3
//   bun run dps mathilda --with storyweaver:2 --stacks storyweaver=30
//
// The hero stands in its usual spot (melee front, ranged back) against stationary dummies with ~infinite hp
// that never cast. By default they "hit" it for 0 damage at a steady rate, so it gains the mana a frontliner
// would from taking hits (one hit a second, whatever the setup); --no-hits turns that off. Two setups: one dummy (single target) and a 3x2 block of
// six (crowd: what AoE is worth). Damage is the hero's own plus its summons', in the first 30s (overtime
// starts at 30s and would skew it). `--with trait:level` fills the board with that trait's other members
// (cheapest first) so the level is active; only the hero's damage counts. alive(s): how long it lasts alone
// against 5 unkillable attackers (3 physical, 2 magic, 70 damage a second each, x star), capped at 40s.
import '../src/game/testUnits';
import { simulateCombat, type CombatEvent } from '../src/game/combat';
import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS, OVERTIME_TICKS, STAR_MULT, TICKS_PER_SECOND } from '../src/game/config';
import { formation } from '../src/game/formation';
import { TRAITS } from '../src/game/traits';
import * as SKILLS from '../src/game/skills';
import * as TRAIT_CONSTS from '../src/game/traits';
import type { Player, Star, Unit, UnitDef } from '../src/game/types';
import { UNIT_BY_ID, UNITS } from '../src/game/units';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const STAR = Number(flag('star') ?? 1) as Star;
const RUNS = Number(flag('runs') ?? 10);
const ARMOR = Number(flag('armor') ?? 36);
const MR = Number(flag('mr') ?? ARMOR);
const WITH = flag('with');
const HITS = !args.includes('--no-hits');
// --stacks storyweaver=30: the player's trait stacks (stories, souls...) going into the fight.
const STACKS = Object.fromEntries((flag('stacks') ?? '').split(',').filter(Boolean).map((kv) => [kv.split('=')[0], Number(kv.split('=')[1])]));
// --set GRAVE_WHISPER.ap=2.4,2.4,3.3 (repeatable): try a skill's or trait's numbers without editing files.
const sets: string[] = [];
for (let v = flag('set'); v !== undefined; v = flag('set')) sets.push(v);
const picks = args.filter((a) => !a.startsWith('--'));

// Stationary, unkillable, harmless, never attacking. One of them (the hitter) "hits" for 0 from where it
// stands, so the hero's mana from hits is the same against one dummy as against six.
const DUMMY: UnitDef = {
  id: 'dummy', name: 'Dummy', tier: 1, traits: [], hp: 1e9, atk: 0, ap: 0, armor: ARMOR, mr: MR, mana: 1e9,
  range: 1, attackTicks: 1e9, rooted: true, shop: false,
};
UNIT_BY_ID.dummy = DUMMY;
UNIT_BY_ID.dummyhitter = { ...DUMMY, id: 'dummyhitter', range: 99, attackTicks: HITS ? 10 : 1e9 };
// The survival test's attackers: still unkillable and stationary, but they hit for real, 3 physical and 2
// magic, scaled with the hero's star like a same-star board would be.
const PUNCH = Math.round(70 * STAR_MULT[STAR - 1]);
UNIT_BY_ID.brute = { ...DUMMY, id: 'brute', atk: PUNCH, range: 99, attackTicks: 10 };
UNIT_BY_ID.hexer = { ...DUMMY, id: 'hexer', ap: PUNCH, range: 99, attackTicks: 10, attackType: 'magic' };

for (const set of sets) {
  const [path, value] = set.split('=');
  const [name, key] = path.split('.');
  const owner = ((SKILLS as Record<string, unknown>)[name] ?? (TRAIT_CONSTS as Record<string, unknown>)[name]) as Record<string, unknown> | undefined;
  if (!owner || !(key in owner)) throw new Error(`--set: no ${path}`);
  const nums = value.split(',').map(Number);
  // Arrays change in place: some skills hold on to the array itself (barrage.ts).
  if (Array.isArray(owner[key])) (owner[key] as number[]).splice(0, Infinity, ...nums);
  else owner[key] = nums[0];
}

const WINDOW = OVERTIME_TICKS;
const SINGLE = [3]; // front row, middle
const CROWD = [2, 3, 4, BOARD_COLS + 2, BOARD_COLS + 3, BOARD_COLS + 4]; // 3 wide, 2 deep
const SINGLE_DEFS = ['dummyhitter'];
const CROWD_DEFS = ['dummyhitter', 'dummy', 'dummy', 'dummy', 'dummy', 'dummy'];
const ATTACKERS = ['brute', 'brute', 'brute', 'hexer', 'hexer'];

const player = (id: string, board: (Unit | null)[]): Player => ({
  id, name: id, isBot: true, hp: 100, gold: 0, level: 9, xp: 0, bench: Array(BENCH_SIZE).fill(null), board,
  shop: [], shopLocked: false, place: null, stacks: { ...STACKS }, items: [], orbs: [], orb: null, commander: null,
});

// The hero plus enough of a trait's other members to switch that level on.
function team(hero: string): string[] {
  if (!WITH) return [hero];
  const [trait, lvl] = WITH.split(':');
  if (!TRAITS[trait]?.breakpoints.includes(Number(lvl))) throw new Error(`--with: ${trait} has no ${lvl}-unit level (${TRAITS[trait]?.breakpoints.join('/')})`);
  const need = Number(lvl); // units, as in "Weapon Master 4"
  const others = UNITS.filter((u) => u.id !== hero && u.shop !== false && u.traits.includes(trait)).sort((a, b) => a.tier - b.tier);
  const have = UNIT_BY_ID[hero].traits.includes(trait) ? 1 : 0;
  return [hero, ...others.slice(0, Math.max(0, need - have)).map((u) => u.id)];
}

function measure(hero: string, cells: number[], defs: string[]) {
  const ids = team(hero);
  const mine: (Unit | null)[] = Array(BOARD_COLS * BOARD_ROWS).fill(null);
  formation(ids).forEach((cell, i) => (mine[cell] = { uid: i + 1, defId: ids[i], star: STAR }));
  const theirs: (Unit | null)[] = Array(BOARD_COLS * BOARD_ROWS).fill(null);
  cells.forEach((cell, i) => (theirs[cell] = { uid: 100 + i, defId: defs[i], star: 1 }));
  let dmg = 0;
  let casts = 0;
  let alive = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = simulateCombat({ rng: (i + 1) * 2654435761 }, player('a', mine), player('b', theirs));
    const me = r.fighters.findIndex((f) => f.side === 0 && f.defId === hero);
    const credit = new Set([me]); // the hero and whatever it summons
    let died = r.ticks;
    for (const e of r.events as (CombatEvent & { id?: number; by?: number; damage?: number })[]) {
      if (e.t >= WINDOW) break;
      if (e.type === 'summon' && credit.has(e.owner)) credit.add(e.fighter.id);
      if (e.type === 'skill' && e.id === me) casts++;
      const who = e.type === 'effect' ? e.by : e.type === 'attack' || e.type === 'cast' ? e.id : undefined;
      if (who !== undefined && credit.has(who) && e.damage) dmg += e.damage;
      if (e.type !== 'heal' && 'target' in e && e.target === me && 'hp' in e && e.hp === 0 && died === r.ticks) died = e.t;
    }
    alive += died;
  }
  return { dps: dmg / RUNS / (WINDOW / TICKS_PER_SECOND), casts: casts / RUNS, alive: alive / RUNS / TICKS_PER_SECOND };
}

const heroes = UNITS.filter((u) => u.shop !== false || picks.includes(u.id)).filter(
  (u) => !picks.length || picks.includes(u.id) || picks.includes(String(u.tier)),
);
console.log(
  `${STAR}★, ${WINDOW / TICKS_PER_SECOND}s, ${RUNS} runs, dummies ${ARMOR} armor / ${MR} mr, ${HITS ? 'hitting (mana from hits)' : 'not hitting'}${WITH ? `, with ${WITH}` : ''}\n`,
);
console.log('hero          cost range   single    crowd(6)  casts   alive(s)');
for (const u of heroes.sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id))) {
  const one = measure(u.id, SINGLE, SINGLE_DEFS);
  const six = measure(u.id, CROWD, CROWD_DEFS);
  const hit = measure(u.id, CROWD.slice(0, ATTACKERS.length), ATTACKERS);
  console.log(`${u.id.padEnd(13)} ${String(u.tier).padStart(3)}g ${String(u.range).padStart(5)} ${one.dps.toFixed(0).padStart(8)} ${six.dps.toFixed(0).padStart(9)} ${one.casts.toFixed(1).padStart(6)} ${hit.alive.toFixed(1).padStart(9)}`);
}
