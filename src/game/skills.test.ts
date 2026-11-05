import { describe, expect, test } from 'bun:test';
import { simulateCombat } from './combat';
import { createGame } from './game';
import { dist, type Point } from './grid';
import { JIMAT } from './items';
import { COMMANDERS_MARK, dashLine, DRAGON_LANCE, FALLING_STAR, GLOOM_VOLLEY, PYRE_FRENZY, RAMPAGE, volleyShot, STORM_PURSUIT, orbCells, SOUL_ORBIT, MOURNFUL_SHOT, PHANTOM_EXECUTION, POWER_OF_CHAOS, RENDING_BITE, SKILLS, STARFALL_AEGIS, type SkillApi, type SkillFighter } from './skills';
import { unitStats } from './traits';
import type { GameState, Player, Star } from './types';
import { UNIT_BY_ID } from './units';

// A stand-in for combat that records what a skill does.
function fakeBattle(enemyCells: Point[]) {
  const caster: SkillFighter = { id: 0, side: 0, star: 1, hp: 1000, maxHp: 1000, dealt: 0, x: 3, y: 5, stats: unitStats(UNIT_BY_ID.batarakala, 1), skill: {} };
  const enemies: SkillFighter[] = enemyCells.map((p, i) => ({ id: i + 1, side: 1, star: 1, hp: 1e9, maxHp: 1e9, dealt: 0, ...p, stats: caster.stats, skill: {} }));
  const all = [caster, ...enemies];
  const log = {
    hits: [] as { target: number; raw: number; effect: string; basic: boolean }[],
    dashes: [] as Point[],
    guards: [] as number[],
    shields: [] as { amount: number; seconds: number }[],
    repeats: [] as { seconds: number; times: number; fn: () => void }[],
    debuffs: [] as { target: number; amount: { armor?: number; mr?: number }; seconds: number; effect: string }[],
    busy: [] as boolean[],
    buffs: [] as { target: number; mods: { stat: string; add: number }[]; seconds: number; effect: string }[],
    burns: [] as { cells: string[]; perSecond: number; seconds: number }[],
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
    shield: (_f, amount, seconds) => log.shields.push({ amount, seconds }),
    repeat: (_f, seconds, times, fn) => log.repeats.push({ seconds, times, fn }),
    debuff: (target, amount, seconds, effect) => log.debuffs.push({ target: target.id, amount, seconds, effect }),
    attackPower: (f) => ({ amount: f.stats.atk, type: 'physical' }),
    showOrbit: () => {},
    busy: (_f, on) => log.busy.push(on),
    buff: (target, mods, seconds, effect) => log.buffs.push({ target: target.id, mods, seconds, effect }),
    alliesOf: (f) => all.filter((e) => e.side === f.side && e.hp > 0),
    hasBuff: (_f, effect) => log.buffs.some((b) => b.effect === effect),
    showMarks: () => {},
    burn: (_s, cells, perSecond, _type, seconds) => log.burns.push({ cells: cells.map((c) => `${c.x},${c.y}`), perSecond, seconds }),
  };
  const cast = (skill = 'phantomexecution') => SKILLS[skill].cast(api, caster, enemies[0]);
  const onHit = (skill: string, target = enemies[0]) => SKILLS[skill].onBasicHit!(api, caster, target);
  return { caster, enemies, log, fragile, cast, onHit };
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
    const raw = b.caster.stats.ap * POWER_OF_CHAOS.ap[0];
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

describe('Starfall Aegis', () => {
  test('shields for a share of max hp and strikes every enemy every 0.5s, 10 times', () => {
    const b = fakeBattle([{ x: 1, y: 1 }, { x: 5, y: 0 }, { x: 3, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.empyrean, 1);
    b.cast('starfallaegis');
    expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * STARFALL_AEGIS.shield[0], seconds: 5 }]);
    expect(b.log.repeats.map(({ seconds, times }) => ({ seconds, times }))).toEqual([{ seconds: 0.5, times: 10 }]);
    expect(b.log.hits).toEqual([]); // nothing lands on cast
    b.log.repeats[0].fn();
    expect(b.log.hits).toEqual([1, 2, 3].map((target) => ({ target, raw: b.caster.stats.ap * STARFALL_AEGIS.ap[0], effect: 'starfall', basic: false })));
  });

  test('3 stars: 75% max hp shield, 400% magic attack', () => {
    expect(STARFALL_AEGIS.shield).toEqual([0.1, 0.2, 0.75]);
    expect(STARFALL_AEGIS.ap).toEqual([0.95, 1, 4]);
  });

  test('in combat: strikes land 5 ticks apart, 10 per cast, and the shield soaks damage first', () => {
    const state = createGame(3, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[17] = { uid: 1, defId: 'empyrean', star: 1 };
    a.board[3] = { uid: 4, defId: 'titan', star: 3 }; // keeps the enemies busy
    b.board[3] = { uid: 2, defId: 'titan', star: 2 };
    b.board[4] = { uid: 3, defId: 'paladin', star: 2 };
    const r = simulateCombat({ rng: 7 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'empyrean')!.id;
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me)!;
    const paladin = r.fighters.find((f) => f.defId === 'paladin')!.id;
    const strikes = r.events.filter((e) => e.type === 'effect' && e.effect === 'starfall' && e.target === paladin);
    const firstCast = strikes.filter((e) => e.t <= cast.t + 50);
    expect(firstCast.map((e) => e.t - cast.t)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    const shield = r.events.find((e) => e.type === 'shield' && e.id === me);
    expect(shield?.type === 'shield' && shield.amount).toBe(Math.round(UNIT_BY_ID.empyrean.hp * STARFALL_AEGIS.shield[0]));
    expect(shield?.type === 'shield' && shield.until).toBe(cast.t + 50);
  });
});

describe('shields', () => {
  test('damage eats the shield before hp', () => {
    const state = createGame(3, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[17] = { uid: 1, defId: 'empyrean', star: 3 };
    b.board[3] = { uid: 2, defId: 'titan', star: 2 };
    b.board[4] = { uid: 3, defId: 'paladin', star: 2 };
    const r = simulateCombat({ rng: 3 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'empyrean')!.id;
    const gained = r.events.find((e) => e.type === 'shield' && e.id === me);
    if (gained?.type !== 'shield') throw new Error('no shield');
    // Every hit taken while the shield holds drains it by the damage and leaves hp alone.
    let shield = gained.amount;
    const before = r.events.filter((e) => e.t <= gained.t && e.type === 'attack' && e.target === me).pop();
    let hp = before?.type === 'attack' ? before.hp : Math.round(UNIT_BY_ID.empyrean.hp * 3.24);
    let soaked = 0;
    for (const e of r.events) {
      if (e.t <= gained.t || e.t >= gained.until || e.type !== 'attack' || e.target !== me) continue;
      if (e.damage > shield) break;
      expect(e.hp).toBe(hp);
      shield -= e.damage;
      hp = e.hp;
      soaked++;
    }
    expect(soaked).toBeGreaterThan(0);
  });
});

describe('Rending Bite', () => {
  test('one enhanced basic attack on the target, then -armor/-mr for 4s, by star', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.drakeling, star);
      b.cast('rendingbite');
      const i = star - 1;
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * (1 + RENDING_BITE.bonus[i]), effect: 'rendingbite', basic: true }]);
      const d = RENDING_BITE.defense[i];
      expect(b.log.debuffs).toEqual([{ target: 1, amount: { armor: d, mr: d }, seconds: RENDING_BITE.seconds, effect: 'rendingbite' }]);
    }
  });

  test('a bite that kills leaves no debuff', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.fragile.add(1);
    b.cast('rendingbite');
    expect(b.log.debuffs).toEqual([]);
  });

  test('in combat: the torn target takes more from physical hits while it lasts, then it wears off', () => {
    const state = createGame(3, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'drakeling', star: 1 };
    b.board[3] = { uid: 2, defId: 'paladin', star: 1 };
    const r = simulateCombat({ rng: 2 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'drakeling')!.id;
    const debuff = r.events.find((e) => e.type === 'debuff');
    if (debuff?.type !== 'debuff') throw new Error('no bite landed');
    expect(debuff.by).toBe(me);
    expect(debuff.until - debuff.t).toBe(RENDING_BITE.seconds * 10);
    const hits = r.events.filter((e) => e.type === 'attack' && e.id === me && !e.crit);
    const before = hits.find((e) => e.t < debuff.t)!;
    const during = hits.find((e) => e.t > debuff.t && e.t < debuff.until);
    const after = hits.find((e) => e.t >= debuff.until && (r.events.filter((x) => x.type === 'debuff' && x.t <= e.t).pop() as { until: number }).until <= e.t);
    expect(during && during.type === 'attack' && before.type === 'attack' && during.damage).toBeGreaterThan(before.type === 'attack' ? before.damage : 0);
    if (after && after.type === 'attack' && before.type === 'attack') expect(after.damage).toBe(before.damage);
  });
});

describe('Mournful Shot', () => {
  test('one empowered attack by star, nothing else', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.banshee, star);
      b.cast('mournfulshot');
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * (1 + MOURNFUL_SHOT.bonus[star - 1]), effect: 'mournfulshot', basic: true }]);
      expect(b.log.debuffs).toEqual([]);
    }
  });

  test('cheap single-hit skills: Drakeling and Banshee cast every few attacks', () => {
    expect(UNIT_BY_ID.drakeling.mana).toBe(60);
    expect(UNIT_BY_ID.banshee.mana).toBe(50);
  });
});

describe('Falling Star', () => {
  test('dashes beside the lowest-hp enemy and strikes it with magic', () => {
    const b = fakeBattle([{ x: 3, y: 2 }, { x: 0, y: 0 }, { x: 6, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.nebulaseer, 1);
    b.enemies[0].hp = 900;
    b.enemies[1].hp = 300; // the weakest, far corner
    b.enemies[2].hp = 500;
    b.cast('fallingstar');
    expect(b.log.dashes).toHaveLength(1);
    expect(dist(b.log.dashes[0], { x: 0, y: 0 })).toBe(1);
    expect(b.log.hits).toEqual([{ target: 2, raw: b.caster.stats.ap * FALLING_STAR.ap[0], effect: 'fallingstar', basic: false }]);
  });

  test('ties go to the nearest; no dash when already beside it', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 0, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.nebulaseer, 2);
    b.caster.star = 2;
    b.enemies.forEach((e) => (e.hp = 400));
    b.cast('fallingstar');
    expect(b.log.dashes).toEqual([]);
    expect(b.log.hits[0]).toMatchObject({ target: 1, raw: b.caster.stats.ap * FALLING_STAR.ap[1] });
  });
});

describe('Soul Orbit', () => {
  test('5 orbs spread round the ring, each step one cell further, never on the caster', () => {
    const c = { x: 3, y: 3 };
    const at = (step: number) => orbCells(c, step).map((p) => `${p.x},${p.y}`);
    expect(at(0)).toHaveLength(SOUL_ORBIT.orbs);
    expect(new Set(at(0)).size).toBe(SOUL_ORBIT.orbs);
    expect(at(0)).not.toContain('3,3');
    expect(at(1)).not.toEqual(at(0));
    expect(at(8)).toEqual(at(0)); // a full lap
    // At an edge, orbs off the board just miss.
    expect(orbCells({ x: 0, y: 0 }, 0).every((p) => p.x >= 0 && p.y >= 0)).toBe(true);
  });

  test('orbits for 4s in 0.5s steps; each step hits enemies under an orb', () => {
    const b = fakeBattle([{ x: 2, y: 4 }, { x: 4, y: 5 }, { x: 0, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.soulreaper, 1);
    b.cast('soulorbit');
    expect(b.log.repeats.map(({ seconds, times }) => ({ seconds, times }))).toEqual([{ seconds: SOUL_ORBIT.step, times: SOUL_ORBIT.seconds / SOUL_ORBIT.step }]);
    for (let i = 0; i < 8; i++) b.log.repeats[0].fn();
    const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
    // Each adjacent enemy sits under an orb 5 of the 8 steps; the far one never.
    expect(by(1)).toBe(5);
    expect(by(2)).toBe(5);
    expect(by(3)).toBe(0);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * SOUL_ORBIT.ap[0] && h.effect === 'soulorbit')).toBe(true);
  });
});

describe('Storm Pursuit', () => {
  test('dashes beside the enemy that has dealt the most damage, and strikes it physically', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 6, y: 0 }, { x: 0, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.tempestknight, 1);
    b.enemies[0].dealt = 300; // the tank in its face
    b.enemies[1].dealt = 2400; // the carry, far corner
    b.enemies[2].dealt = 900;
    b.cast('stormpursuit');
    expect(b.log.dashes).toHaveLength(1);
    expect(dist(b.log.dashes[0], { x: 6, y: 0 })).toBe(1);
    expect(b.log.hits).toEqual([{ target: 2, raw: b.caster.stats.atk * STORM_PURSUIT.atk[0], effect: 'stormpursuit', basic: false }]);
  });

  test('before anyone has dealt damage, it goes for the nearest', () => {
    const b = fakeBattle([{ x: 0, y: 0 }, { x: 3, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.tempestknight, 1);
    b.cast('stormpursuit');
    expect(b.log.hits[0].target).toBe(2);
  });

  test('in combat, damage dealt is tracked per unit, so it finds the real carry', () => {
    const state = createGame(5, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'tempestknight', star: 2 };
    a.board[4] = { uid: 2, defId: 'knight', star: 2 };
    b.board[3] = { uid: 3, defId: 'knight', star: 3 }; // a wall that deals little
    b.board[18] = { uid: 4, defId: 'gloomshot', star: 3 }; // the carry, in the back
    const r = simulateCombat({ rng: 4 }, a, b);
    const knight = r.fighters.find((f) => f.defId === 'tempestknight')!.id;
    const carry = r.fighters.find((f) => f.defId === 'gloomshot')!.id;
    const cast = r.events.find((e) => e.type === 'skill' && e.id === knight);
    if (!cast) throw new Error('no cast');
    const strike = r.events.find((e) => e.type === 'effect' && e.effect === 'stormpursuit');
    expect(strike?.type === 'effect' && strike.target).toBe(carry);
  });
});

describe('Rampage', () => {
  test('5 slow dashes at the farthest enemy, crashing into each enemy once per dash, burning every cell crossed', () => {
    const b = fakeBattle([{ x: 3, y: 0 }, { x: 3, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.abomination, 1);
    b.cast('rampage');
    expect(b.log.busy).toEqual([true]);
    expect(b.log.repeats[0].seconds).toBe(RAMPAGE.stepSeconds);
    for (let i = 0; i < b.log.repeats[0].times && b.log.busy.length < 2; i++) b.log.repeats[0].fn();
    expect(b.log.busy).toEqual([true, false]);
    const crashes = b.log.hits.filter((h) => h.effect === 'rampage');
    expect(crashes.every((h) => h.raw === b.caster.stats.atk * RAMPAGE.atk[0] && !h.basic)).toBe(true);
    // The first charge runs up the column from (3,5): through (3,2) and (3,0), both hit once.
    expect(crashes.slice(0, 2).map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.burns.length).toBeGreaterThan(5);
    expect(b.log.burns.every((x) => x.perSecond === b.caster.stats.atk * RAMPAGE.burn[0] && x.seconds === RAMPAGE.burnSeconds)).toBe(true);
    expect(b.log.burns.slice(0, 5).map((x) => x.cells[0])).toEqual(['3,4', '3,3', '3,2', '3,1', '3,0']);
  });

  test('in combat: it stops attacking while it rampages, can still be hit, and fire hurts enemies standing in it', () => {
    const state = createGame(6, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'abomination', star: 2 };
    b.board[3] = { uid: 2, defId: 'paladin', star: 3 };
    b.board[10] = { uid: 3, defId: 'archer', star: 3 };
    b.board[17] = { uid: 4, defId: 'imp', star: 3 };
    const r = simulateCombat({ rng: 8 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'abomination')!.id;
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me);
    if (!cast) throw new Error('no rampage');
    const crashes = r.events.filter((e) => e.type === 'effect' && e.effect === 'rampage');
    const burns = r.events.filter((e) => e.type === 'effect' && e.effect === 'rampageburn');
    expect(crashes.length).toBeGreaterThan(0);
    expect(burns.length).toBeGreaterThan(0);
    expect(r.events.some((e) => e.type === 'ground')).toBe(true);
    // Busy: no basic attacks from it until its last dash step is over.
    const lastStep = Math.max(...r.events.filter((e) => (e.type === 'dash' && e.id === me) || (e.type === 'effect' && e.effect === 'rampage')).map((e) => e.t));
    expect(r.events.some((e) => e.type === 'attack' && e.id === me && e.t > cast.t && e.t < lastStep)).toBe(false);
    // Still targetable: it takes hits during the rampage.
    expect(r.events.some((e) => e.type === 'attack' && e.target === me && e.t > cast.t && e.t < lastStep)).toBe(true);
    // ...but gains no mana from them.
    const during = r.events.filter((e) => e.type === 'attack' && e.target === me && e.t > cast.t && e.t < lastStep);
    expect(during.every((e) => e.type === 'attack' && e.targetMana === 0)).toBe(true);
  });
});

describe('Gloom Volley', () => {
  test('5 shots at the target, each stronger than the last, as basic attacks', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 1 }, { x: 5, y: 1 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.gloomshot, star);
      b.cast('gloomvolley');
      expect(b.log.busy).toEqual([true]);
      expect(b.log.repeats[0]).toMatchObject({ seconds: GLOOM_VOLLEY.every, times: GLOOM_VOLLEY.shots });
      for (let i = 0; i < GLOOM_VOLLEY.shots; i++) b.log.repeats[0].fn();
      expect(b.log.busy).toEqual([true, false]);
      const raws = b.log.hits.map((h) => h.raw);
      expect(b.log.hits.every((h) => h.target === 1 && h.basic && h.effect === 'gloomvolley')).toBe(true);
      expect(raws).toEqual([0, 1, 2, 3, 4].map((n) => b.caster.stats.atk * volleyShot(star, n)));
      for (let i = 1; i < raws.length; i++) expect(raws[i]).toBeGreaterThan(raws[i - 1]);
    }
  });

  test('4x the first shot: 400% / 450% / 900% of attack in all', () => {
    const total = (s: number) => [0, 1, 2, 3, 4].reduce((n, k) => n + volleyShot(s, k), 0);
    expect([1, 2, 3].map((s) => +total(s).toFixed(3))).toEqual([4, 4.5, 9]);
  });

  test('when the target falls, the rest go to the nearest enemy', () => {
    const b = fakeBattle([{ x: 3, y: 1 }, { x: 3, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.gloomshot, 1);
    b.fragile.add(1);
    b.cast('gloomvolley');
    for (let i = 0; i < GLOOM_VOLLEY.shots; i++) b.log.repeats[0].fn();
    expect(b.log.hits.map((h) => h.target)).toEqual([1, 2, 2, 2, 2]);
  });
});

describe('Pyre Frenzy', () => {
  test('active: more attack speed for itself, for 5s', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.star = 2;
    b.cast('pyrefrenzy');
    expect(b.log.buffs).toEqual([{ target: 0, mods: [{ stat: 'attackSpeed', add: PYRE_FRENZY.frenzy[1] }], seconds: PYRE_FRENZY.seconds, effect: 'pyrefrenzy' }]);
  });

  test('in combat: the passive hastes itself and allies directly beside it (not diagonal), for the whole fight', () => {
    const state = createGame(7, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    // Board: row 0 is the front. Pyre Guard at column 3 of row 1 (cell 10).
    a.board[10] = { uid: 1, defId: 'pyreguard', star: 1 };
    a.board[9] = { uid: 2, defId: 'footman', star: 1 }; // left
    a.board[11] = { uid: 3, defId: 'knight', star: 1 }; // right
    a.board[3] = { uid: 4, defId: 'archer', star: 1 }; // in front
    a.board[17] = { uid: 5, defId: 'imp', star: 1 }; // behind
    a.board[2] = { uid: 6, defId: 'paladin', star: 1 }; // diagonal: no
    b.board[3] = { uid: 7, defId: 'titan', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const hasted = r.events.filter((e) => e.type === 'buff' && e.t === 0 && e.effect === 'pyreaura').map((e) => (e.type === 'buff' ? r.fighters[e.id].defId : ''));
    expect(hasted.sort()).toEqual(['archer', 'footman', 'imp', 'knight', 'pyreguard']);
    expect(r.events.filter((e) => e.type === 'buff' && e.effect === 'pyreaura').every((e) => e.type === 'buff' && e.until === undefined)).toBe(true);
  });

  test('in combat: it attacks faster while the frenzy lasts', () => {
    const state = createGame(7, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'pyreguard', star: 3 };
    b.board[3] = { uid: 2, defId: 'titan', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'pyreguard')!.id;
    const frenzy = r.events.find((e) => e.type === 'buff' && e.effect === 'pyrefrenzy');
    if (frenzy?.type !== 'buff' || frenzy.until === undefined) throw new Error('no frenzy');
    const until = frenzy.until;
    const gaps = (from: number, to: number) => {
      const ts = r.events.filter((e) => e.type === 'attack' && e.id === me && e.t >= from && e.t < to).map((e) => e.t);
      return ts.slice(1).map((t, i) => t - ts[i]);
    };
    // Before the first frenzy vs inside it (up to just before the next cast, which uses up an attack).
    const before = gaps(1, frenzy.t);
    const nextCast = r.events.find((e) => e.type === 'skill' && e.id === me && e.t > frenzy.t)?.t ?? until;
    const during = gaps(frenzy.t + 1, Math.min(until, nextCast));
    expect(Math.max(...during)).toBeLessThan(Math.min(...before));
  });
});

describe('timed buffs', () => {
  test('come off when they run out', () => {
    // A test-only unit: hastes itself for 1s at the start of the fight, and never casts.
    SKILLS.testhaste = {
      id: 'testhaste',
      name: 'Test Haste',
      desc: '',
      values: () => ({}),
      cast() {},
      atStart(api, caster) {
        api.buff(caster, [{ stat: 'attackSpeed', add: 1 }], 1, 'testhaste', caster);
      },
    };
    UNIT_BY_ID.testhaster = { ...UNIT_BY_ID.footman, id: 'testhaster', mana: 99_999, skill: 'testhaste' };
    const state = createGame(7, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'testhaster', star: 3 };
    b.board[3] = { uid: 2, defId: 'paladin', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const buff = r.events.find((e) => e.type === 'buff' && e.effect === 'testhaste');
    if (buff?.type !== 'buff' || buff.until === undefined) throw new Error('no buff');
    const until = buff.until;
    const ts = r.events.filter((e) => e.type === 'attack' && e.id === 0).map((e) => e.t);
    // The attack landing on the expiry tick was timed while hasted.
    const during = ts.filter((t) => t <= until);
    const after = ts.filter((t) => t > until);
    expect(during.length).toBeGreaterThan(1);
    expect(after.length).toBeGreaterThan(1);
    expect(during[1] - during[0]).toBeLessThan(after[1] - after[0]);
    delete SKILLS.testhaste;
    delete UNIT_BY_ID.testhaster;
  });
});

describe('Dragon Lance', () => {
  test('one physical skill hit on its target, by star', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 2 }, { x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.wyrmcaller, star);
      b.cast('dragonlance'); // fakeBattle casts at enemies[0]
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * DRAGON_LANCE.atk[star - 1], effect: 'dragonlance', basic: false }]);
      expect(b.log.dashes).toEqual([]);
    }
  });

  test('a target that just died: the nearest enemy instead', () => {
    const b = fakeBattle([{ x: 0, y: 0 }, { x: 3, y: 4 }]);
    b.enemies[0].hp = 0;
    b.cast('dragonlance');
    expect(b.log.hits.map((h) => h.target)).toEqual([2]);
  });
});

describe("Commander's Mark", () => {
  test('passive: the 5th basic attack on a target sets its marks off; marks are per target', () => {
    const b = fakeBattle([{ x: 3, y: 1 }, { x: 5, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.senopati, 1);
    for (let i = 0; i < 4; i++) b.onHit('commandersmark');
    b.onHit('commandersmark', b.enemies[1]); // a different target: its own count
    expect(b.log.hits).toEqual([]);
    b.onHit('commandersmark');
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * COMMANDERS_MARK.burst[0], effect: 'markburst', basic: false }]);
    // The count starts over.
    for (let i = 0; i < 4; i++) b.onHit('commandersmark');
    expect(b.log.hits).toHaveLength(1);
  });

  test('active: attack speed for 5s, and marks burst at 4 while it lasts', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.senopati, 2);
    b.caster.star = 2;
    b.cast('commandersmark');
    expect(b.log.buffs).toEqual([{ target: 0, mods: [{ stat: 'attackSpeed', add: COMMANDERS_MARK.attackSpeed[1] }], seconds: COMMANDERS_MARK.seconds, effect: 'commandersmark' }]);
    for (let i = 0; i < 4; i++) b.onHit('commandersmark');
    expect(b.log.hits.map((h) => h.raw)).toEqual([b.caster.stats.atk * COMMANDERS_MARK.burst[1]]);
  });

  test('in combat: bursts land on the 5th hit against one target', () => {
    const state = createGame(9, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[17] = { uid: 1, defId: 'senopati', star: 1 };
    a.board[3] = { uid: 2, defId: 'knight', star: 3 };
    b.board[3] = { uid: 3, defId: 'paladin', star: 3 };
    const r = simulateCombat({ rng: 2 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'senopati')!.id;
    const firstBurst = r.events.find((e) => e.type === 'effect' && e.effect === 'markburst');
    if (!firstBurst) throw new Error('no burst');
    const hitsBefore = r.events.filter((e) => e.type === 'attack' && e.id === me && e.t <= firstBurst.t);
    expect(hitsBefore).toHaveLength(COMMANDERS_MARK.marks);
  });
});
