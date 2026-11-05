import { describe, expect, test } from 'bun:test';
import { simulateCombat } from './combat';
import { createGame } from './game';
import { dist, type Point } from './grid';
import { JIMAT } from './items';
import { dashLine, PHANTOM_EXECUTION, POWER_OF_CHAOS, SKILLS, type SkillApi, type SkillFighter } from './skills';
import { unitStats } from './traits';
import type { GameState, Player, Star } from './types';
import { UNIT_BY_ID } from './units';

// A stand-in for combat that records what a skill does.
function fakeBattle(enemyCells: Point[]) {
  const caster: SkillFighter = { id: 0, side: 0, star: 1, hp: 1000, x: 3, y: 5, stats: unitStats(UNIT_BY_ID.batarakala, 1), skill: {} };
  const enemies: SkillFighter[] = enemyCells.map((p, i) => ({ id: i + 1, side: 1, star: 1, hp: 1e9, ...p, stats: caster.stats, skill: {} }));
  const all = [caster, ...enemies];
  const log = {
    hits: [] as { target: number; raw: number; effect: string; basic: boolean }[],
    dashes: [] as Point[],
    guards: [] as number[],
  };
  // Enemies whose next hit kills them (to test kill-chains).
  const fragile = new Set<number>();
  const record = (target: SkillFighter, raw: number, effect: string, basic: boolean) => {
    log.hits.push({ target: target.id, raw, effect, basic });
    if (!fragile.has(target.id)) return false;
    target.hp = 0;
    return true;
  };
  const api: SkillApi = {
    enemiesOf: () => enemies.filter((e) => e.hp > 0),
    nearestEnemy: (f) => {
      const alive = enemies.filter((e) => e.hp > 0);
      return alive.length ? alive.reduce((a, b) => (dist(f, b) < dist(f, a) ? b : a)) : null;
    },
    occupant: (p) => all.find((f) => f.hp > 0 && f.x === p.x && f.y === p.y) ?? null,
    hit: (_s, target, raw, _type, effect) => record(target, raw, effect, false),
    basicHit: (_s, target, raw, _type, effect) => record(target, raw, effect, true),
    safestCell: () => ({ x: 6, y: 5 }),
    dashTo: (f, to) => {
      f.x = to.x;
      f.y = to.y;
      log.dashes.push(to);
    },
    guard: (_f, seconds) => log.guards.push(seconds),
  };
  const cast = (skill = 'phantomexecution') => SKILLS[skill].cast(api, caster, enemies[0]);
  return { caster, enemies, log, fragile, cast };
}

describe('Phantom Execution', () => {
  test('dashes 1, then 2, then 3 per cast, and never more', () => {
    const b = fakeBattle([{ x: 3, y: 3 }]);
    const perCast = [1, 2, 3, 3].map(() => {
      const before = b.log.dashes.length;
      b.cast();
      return b.log.dashes.length - before;
    });
    expect(perCast).toEqual([1, 2, 3, 3]);
    expect(b.log.guards).toEqual([1, 2, 3, 3].map((n) => n * PHANTOM_EXECUTION.dashSeconds));
  });

  test('hits every enemy on the line for its star share of attack; Phantoms only after 3 dashes', () => {
    // Two enemies straight ahead in the caster's column.
    const b = fakeBattle([{ x: 3, y: 3 }, { x: 3, y: 2 }]);
    const raw = b.caster.stats.atk * PHANTOM_EXECUTION.atk[0];
    b.cast(); // dash 1
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.hits.every((h) => h.raw === raw && h.effect === 'phantomexecution')).toBe(true);
    b.cast(); // dashes 2-3
    expect(b.log.hits.some((h) => h.effect === 'phantom')).toBe(false);
    b.cast(); // dashes 4-6: every one leaves a Phantom
    expect(b.log.hits.filter((h) => h.effect === 'phantom').length).toBeGreaterThan(0);
  });

  test('the dash line runs straight through the target to the edge or 4 cells', () => {
    expect(dashLine({ x: 3, y: 5 }, { x: 3, y: 3 }, 4)).toEqual([
      { x: 3, y: 4 },
      { x: 3, y: 3 },
      { x: 3, y: 2 },
      { x: 3, y: 1 },
    ]);
    expect(dashLine({ x: 1, y: 1 }, { x: 0, y: 0 }, 4)).toEqual([{ x: 0, y: 0 }]);
  });
});

function newGame(): GameState {
  return createGame(7, [
    { id: 'a', name: 'A', isBot: false },
    { id: 'b', name: 'B', isBot: false },
  ]);
}

let uid = 70_000;
function field(p: Player, units: [string, Star, number][]): number[] {
  p.board.fill(null);
  p.bench.fill(null);
  return units.map(([defId, star, cell]) => {
    p.board[cell] = { uid: ++uid, defId, star };
    return uid;
  });
}

describe('Power of Chaos', () => {
  test('dashes to safety, then 3 enhanced basic attacks at the nearest enemy', () => {
    const b = fakeBattle([{ x: 3, y: 3 }, { x: 0, y: 0 }]);
    b.cast('powerofchaos');
    expect(b.log.dashes).toEqual([{ x: 6, y: 5 }]);
    expect(b.log.hits).toHaveLength(POWER_OF_CHAOS.assaults);
    const raw = b.caster.stats.atk * POWER_OF_CHAOS.atk[0];
    expect(b.log.hits.every((h) => h.basic && h.raw === raw && h.effect === 'chaosassault')).toBe(true);
  });

  test('each kill grants one more Chaos Assault', () => {
    const b = fakeBattle([{ x: 6, y: 3 }, { x: 5, y: 3 }, { x: 0, y: 0 }]);
    b.fragile.add(1);
    b.fragile.add(2);
    b.cast('powerofchaos');
    // 3 assaults + 2 bonus for the 2 kills; the last 3 all land on the survivor.
    expect(b.log.hits.map((h) => h.target)).toEqual([1, 2, 3, 3, 3]);
  });
});

describe('skills in a real fight', () => {
  test('Batara Kala casts Phantom Execution: a skill event, then dashes and hits credited to him', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['batarakala', 3, 3]]);
    field(b, [['abomination', 2, 2], ['titan', 2, 3], ['paladin', 2, 4]]);
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'batarakala')!;
    const skill = r.events.findIndex((e) => e.type === 'skill' && e.id === me.id);
    expect(skill).toBeGreaterThanOrEqual(0);
    const after = r.events.slice(skill + 1).filter((e) => e.t === r.events[skill].t);
    expect(after.some((e) => e.type === 'dash' && e.id === me.id)).toBe(true);
    expect(after.some((e) => e.type === 'effect' && e.by === me.id && e.effect === 'phantomexecution')).toBe(true);
    // No placeholder cast for a unit that has a real skill.
    expect(r.events.some((e) => e.type === 'cast' && e.id === me.id)).toBe(false);
  });

  test('Resi casts Power of Chaos: Chaos Assaults credited to her, as magic damage', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['resi', 3, 17]]);
    field(b, [['abomination', 2, 2], ['titan', 2, 3], ['paladin', 2, 4]]);
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'resi')!;
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me.id);
    expect(cast?.type === 'skill' && cast.skill).toBe('powerofchaos');
    const assaults = r.events.filter((e) => e.type === 'effect' && e.by === me.id && e.effect === 'chaosassault' && e.t === cast!.t);
    expect(assaults.length).toBeGreaterThanOrEqual(POWER_OF_CHAOS.assaults);
  });

  test("Jimat's spell lifesteal heals off Keris' Mortal Strike", () => {
    const state = newGame();
    const [a, b] = state.players;
    const [holder] = field(a, [['prajurit', 3, 3], ['penari', 1, 20]]);
    field(b, [['titan', 2, 3], ['paladin', 2, 6]]);
    a.items = [
      { uid: 1, id: 'keris', tier: 3, holder },
      { uid: 2, id: 'jimat', tier: 1, holder },
    ];
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'prajurit')!.id;
    const strikes = r.events.filter((e) => e.type === 'effect' && e.by === me && e.effect === 'keris');
    expect(strikes.length).toBeGreaterThan(0);
    // Every Mortal Strike hit that lands while he's hurt is followed by a heal of up to 20% of it.
    let healedFromStrike = 0;
    for (const s of strikes) {
      const i = r.events.indexOf(s);
      const heal = r.events.slice(i + 1, i + 3).find((e) => e.type === 'heal' && e.id === me);
      if (heal?.type === 'heal' && s.type === 'effect') {
        expect(heal.amount).toBeLessThanOrEqual(Math.round(s.damage * JIMAT.spellLifesteal));
        healedFromStrike++;
      }
    }
    expect(healedFromStrike).toBeGreaterThan(0);
  });
});
