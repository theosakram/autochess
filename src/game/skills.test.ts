import { describe, expect, test } from 'bun:test';
import { simulateCombat } from './combat';
import { createGame } from './game';
import { dist, type Point } from './grid';
import { JIMAT } from './items';
import { ahead3x3, aheadStrip, beyond, SPECTRAL_CATACLYSM, STALKERS_MARK, FATE_THREAD, CRATER_FALL, BLADE_DESCENT, WANDERERS_VOLLEY, STORM_FISTS, PHANTOM_STEP, PRAJURITS_OATH, WYRM_FRENZY, ALTAR_SPARK, ASH_STORM, ASHEN_WALL, CRYPT_SEAL, DRAGONS_DOMINION, UNDYING_FURY, SKY_REAP, DRAKE_REND, KINDLE_TWICE, DREAD_DESCENT, PYRE_BLAST, PUPPET_SNARE, THUNDER_WHIRL, COMET_LUNGE, COMMANDERS_MARK, ZODIAC_SLAM, STARWARD, ETHER_BEAM, GRAVE_WHISPER, dashLine, GALE_SHOT, SHADE_BOLTS, STORM_FLURRY, TALES_END, within, MYTH_MADE_FLESH, INKED_STRIKE, UNFOLDING_TALE, MIST_BOOMERANG, MIST_WARD, MISTY_JAB, pathTo, TIDAL_SURGE, GUARDIANS_STRIKE, SHOVEL_SLAM, TARI_PENYEMBUH, SAPPING_TOUCH, SPIRIT_ARCHERS, POLAR_BARRAGE, DRAGON_LANCE, FALLING_STAR, GLOOM_VOLLEY, PYRE_FRENZY, RAMPAGE, volleyShot, STORM_PURSUIT, orbCells, SOUL_ORBIT, MOURNFUL_SHOT, PHANTOM_EXECUTION, POWER_OF_CHAOS, RENDING_BITE, SKILLS, STARFALL_AEGIS, type SkillApi, type SkillFighter } from './skills';
import { DAUNTLESS, unitStats } from './traits';
import type { GameState, Player, Star } from './types';
import { UNIT_BY_ID } from './units';

// A stand-in for combat that records what a skill does.
function fakeBattle(enemyCells: Point[]) {
  const caster: SkillFighter = { id: 0, side: 0, star: 1, hp: 1000, maxHp: 1000, dealt: 0, chosen: null, x: 3, y: 5, stats: unitStats(UNIT_BY_ID.batarakala, 1), skill: {} };
  const enemies: SkillFighter[] = enemyCells.map((p, i) => ({ id: i + 1, side: 1, star: 1, hp: 1e9, maxHp: 1e9, dealt: 0, chosen: null, ...p, stats: caster.stats, skill: {} }));
  const all = [caster, ...enemies];
  const log = {
    hits: [] as { target: number; raw: number; effect: string; basic: boolean }[],
    dashes: [] as Point[],
    guards: [] as number[],
    shields: [] as { amount: number; seconds: number }[],
    shieldEnds: [] as ((() => void) | null)[],
    shieldTargets: [] as number[],
    repeats: [] as { seconds: number; times: number; fn: () => void }[],
    debuffs: [] as { target: number; amount: { armor?: number; mr?: number }; seconds: number; effect: string }[],
    busy: [] as boolean[],
    buffs: [] as { target: number; mods: { stat: string; add: number }[]; seconds: number; effect: string }[],
    unbuffs: [] as string[],
    summons: [] as SkillFighter[],
    heals: [] as { target: number; amount: number }[],
    stuns: [] as { target: number; seconds: number }[],
    taunts: [] as { target: number; by: number; seconds: number }[],
    links: [] as { by: number; targets: number[]; share: number }[],
    dropped: [] as number[],
    rolls: [] as number[],
    mana: [] as { target: number; amount: number }[],
    counters: [] as { by: number; target: number }[],
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
    hit: (s, target, raw, _type, effect) => ((s.dealt += raw), record(target, raw, effect, false)),
    basicHit: (_s, target, raw, _type, effect) => record(target, raw, effect, true),
    safestCell: () => ({ x: 6, y: 5 }),
    dashTo: (f, to) => {
      f.x = to.x;
      f.y = to.y;
      log.dashes.push(to);
    },
    guard: (_f, seconds) => log.guards.push(seconds),
    shield: (f, amount, seconds, _effect, onEnd) => {
      log.shields.push({ amount, seconds });
      log.shieldTargets.push(f.id);
      log.shieldEnds.push(onEnd ?? null);
    },
    repeat: (_f, seconds, times, fn) => log.repeats.push({ seconds, times, fn }),
    debuff: (target, amount, seconds, effect) => log.debuffs.push({ target: target.id, amount, seconds, effect }),
    attackPower: (f) => ({ amount: f.stats.atk, type: 'physical' }),
    showOrbit: () => {},
    showProjectile: () => {},
    random: (n) => (log.rolls.push(n), 0),
    giveMana: (f, amount) => log.mana.push({ target: f.id, amount }),
    counterAttack: (f, target) => log.counters.push({ by: f.id, target: target.id }),
    busy: (_f, on) => log.busy.push(on),
    buff: (target, mods, seconds, effect) => log.buffs.push({ target: target.id, mods, seconds, effect }),
    alliesOf: (f) => all.filter((e) => e.side === f.side && e.hp > 0),
    minionsOf: () => log.summons.filter((m) => m.hp > 0),
    summon: (owner, _defId, { hpShare, mirror, atk, at }) => {
      const m: SkillFighter = { id: 100 + log.summons.length, side: owner.side, star: owner.star, hp: owner.maxHp * hpShare, maxHp: owner.maxHp * hpShare, dealt: 0, chosen: null, x: at?.x ?? 0, y: at?.y ?? 0, stats: owner.stats, skill: { ...(mirror !== undefined && { mirror }), ...(atk !== undefined && { atk }) } };
      log.summons.push(m);
      return m;
    },
    hasBuff: (_f, effect) => log.buffs.some((b) => b.effect === effect && !log.unbuffs.includes(effect)),
    unbuff: (_f, effect) => log.unbuffs.push(effect),
    showMarks: () => {},
    stun: (target, seconds) => log.stuns.push({ target: target.id, seconds }),
    taunt: (target, by, seconds) => log.taunts.push({ target: target.id, by: by.id, seconds }),
    dropAggro: (f) => log.dropped.push(f.id),
    link: (by, targets, share) => log.links.push({ by: by.id, targets: targets.map((x) => x.id), share }),
    heal: (target, amount) => (log.heals.push({ target: target.id, amount }), amount),
    burn: (_s, cells, perSecond, _type, seconds) => log.burns.push({ cells: cells.map((c) => `${c.x},${c.y}`), perSecond, seconds }),
  };
  const cast = (skill = 'phantomexecution') => SKILLS[skill].cast(api, caster, enemies[0]);
  const onHit = (skill: string, target = enemies[0]) => SKILLS[skill].onBasicHit!(api, caster, target);
  const atStart = (skill: string) => SKILLS[skill].atStart!(api, caster);
  const attacked = (skill: string, by = enemies[0]) => SKILLS[skill].onAttacked!(api, caster, by);
  // `allies`: push extra units of the caster's side (alliesOf reads them).
  return { caster, enemies, log, fragile, cast, onHit, atStart, attacked, allies: all };
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

describe('Polar Barrage', () => {
  test('hits the 3x1 row around its target, then charges its next 3 attacks', () => {
    // Target at (3,1); enemies beside it at (2,1) and (4,1); one behind at (3,0) is out of the row.
    const b = fakeBattle([{ x: 3, y: 1 }, { x: 2, y: 1 }, { x: 4, y: 1 }, { x: 3, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.polaris, 1);
    b.cast('polarbarrage');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * POLAR_BARRAGE.area[0] && !h.basic)).toBe(true);
    expect(b.log.buffs).toEqual([{ target: 0, mods: [{ stat: 'basicAmp', add: POLAR_BARRAGE.bonus[0] }], seconds: Infinity, effect: 'polarcharged' }]);
    b.onHit('polarbarrage');
    b.onHit('polarbarrage');
    expect(b.log.unbuffs).toEqual([]);
    b.onHit('polarbarrage');
    expect(b.log.unbuffs).toEqual(['polarcharged']);
    b.onHit('polarbarrage');
    expect(b.log.unbuffs).toEqual(['polarcharged']);
  });

  test('in combat: exactly 3 charged attacks after each cast, hitting harder', () => {
    const state = createGame(10, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[17] = { uid: 1, defId: 'polaris', star: 2 };
    a.board[3] = { uid: 2, defId: 'knight', star: 3 };
    b.board[3] = { uid: 3, defId: 'titan', star: 3 };
    const r = simulateCombat({ rng: 3 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'polaris')!.id;
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me);
    if (!cast) throw new Error('no cast');
    const attacks = r.events.filter((e) => e.type === 'attack' && e.id === me && !e.crit);
    const before = attacks.filter((e) => e.t < cast.t).pop();
    const after = attacks.filter((e) => e.t > cast.t);
    if (before?.type !== 'attack') throw new Error('no attack before');
    const dmg = after.map((e) => (e.type === 'attack' ? e.damage : 0));
    // The titan's armor doesn't change in between (no shred here), so charged hits are simply bigger.
    expect(dmg.slice(0, 3).every((d) => d > before.damage)).toBe(true);
    expect(dmg[3]).toBe(before.damage);
  });
});

describe('Spirit Archers', () => {
  test('summons up to 1/2/3 archers by star, topping up fallen ones, and buffs itself', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 1 }]);
      b.caster.star = star;
      b.cast('spiritarchers');
      expect(b.log.summons).toHaveLength(star);
      expect(b.log.summons.every((m) => m.skill.mirror === SPIRIT_ARCHERS.mirror[star - 1])).toBe(true);
      b.log.summons[0].hp = 0; // one falls
      b.cast('spiritarchers');
      expect(b.log.summons.filter((m) => m.hp > 0)).toHaveLength(star);
      expect(b.log.buffs[0].mods).toEqual([
        { stat: 'attackSpeed', add: SPIRIT_ARCHERS.attackSpeed[star - 1] },
        { stat: 'damageAmp', add: SPIRIT_ARCHERS.damageAmp[star - 1] },
      ]);
    }
  });

  test('in combat: archers repeat each of its attacks on the same target, crits included, and vanish with it', () => {
    const state = createGame(11, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[17] = { uid: 1, defId: 'arjuna', star: 3 };
    a.board[3] = { uid: 2, defId: 'knight', star: 3 };
    // Deadeye crit chance via a second Deadeye, so crits show up.
    a.board[16] = { uid: 3, defId: 'gloomshot', star: 1 };
    b.board[3] = { uid: 4, defId: 'titan', star: 3 };
    b.board[4] = { uid: 5, defId: 'paladin', star: 3 };
    const r = simulateCombat({ rng: 5 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'arjuna')!.id;
    const summons = r.events.filter((e) => e.type === 'summon');
    expect(summons).toHaveLength(3);
    const archers = new Set(summons.map((e) => (e.type === 'summon' ? e.fighter.id : -1)));
    expect(summons.every((e) => e.type === 'summon' && e.owner === me && !r.fighters.some((f) => f.id === e.fighter.id))).toBe(true);
    // Every archer shot follows one of Arjuna's, same tick, same target, same crit.
    const attacks = r.events.filter((e) => e.type === 'attack');
    for (const s of attacks) {
      if (s.type !== 'attack' || !archers.has(s.id)) continue;
      const lead = attacks.find((x) => x.type === 'attack' && x.id === me && x.t === s.t && x.target === s.target);
      expect(lead).toBeDefined();
      expect(lead?.type === 'attack' && !!lead.crit).toBe(!!s.crit);
    }
    expect(attacks.some((s) => s.type === 'attack' && archers.has(s.id))).toBe(true);
    // Archers never act on their own: no moves, no casts.
    expect(r.events.some((e) => (e.type === 'move' || e.type === 'skill' || e.type === 'cast') && archers.has(e.id))).toBe(false);
    // If Arjuna died, so did every archer, at the same moment.
    const death = r.events.find((e) => e.type === 'death' && e.id === me);
    if (death) for (const id of archers) expect(r.events.some((e) => e.type === 'death' && e.id === id && e.t <= death.t)).toBe(true);
    // The archers don't get Arjuna's damage bonus: a same-tick archer shot on the same target is exactly
    // mirror x Arjuna's hit with the bonus taken back out (armor is the same for both).
    const amp = (t: number) => (r.events.some((e) => e.type === 'buff' && e.effect === 'spiritarchers' && e.until !== undefined && e.t <= t && t < e.until) ? SPIRIT_ARCHERS.damageAmp[2] : 0);
    for (const s of attacks) {
      if (s.type !== 'attack' || !archers.has(s.id) || s.again) continue;
      const lead = attacks.find((x) => x.type === 'attack' && x.id === me && x.t === s.t && x.target === s.target && !x.again);
      if (lead?.type !== 'attack') continue;
      expect(Math.abs(s.damage - (lead.damage / (1 + amp(s.t))) * SPIRIT_ARCHERS.mirror[2])).toBeLessThanOrEqual(2);
    }
    // Summons don't add to the loser's damage.
    expect(r.survivors.every((f) => !archers.has(f.id))).toBe(true);
  });
});

describe('Sapping Touch', () => {
  test('an empowered attack, then -attack and -magic attack on the target for 4s', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.wisp, star);
      b.enemies[0].stats = unitStats(UNIT_BY_ID.titan, 1);
      b.cast('sappingtouch');
      const i = star - 1;
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * (1 + SAPPING_TOUCH.bonus[i]), effect: 'sappingtouch', basic: true }]);
      const titan = b.enemies[0].stats;
      expect(b.log.buffs).toEqual([
        {
          target: 1,
          mods: [
            { stat: 'atk', add: -Math.round(titan.atk * SAPPING_TOUCH.weaken[i]) },
            { stat: 'ap', add: -Math.round(titan.ap * SAPPING_TOUCH.weaken[i]) },
          ],
          seconds: SAPPING_TOUCH.seconds,
          effect: 'sappingtouchweaken',
        },
      ]);
    }
  });

  test('in combat: the sapped target hits softer while it lasts', () => {
    const state = createGame(12, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'wisp', star: 3 };
    b.board[3] = { uid: 2, defId: 'knight', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const knight = r.fighters.find((f) => f.defId === 'knight')!.id;
    const sap = r.events.find((e) => e.type === 'buff' && e.effect === 'sappingtouchweaken');
    if (sap?.type !== 'buff' || sap.until === undefined) throw new Error('no sap');
    const until = sap.until;
    const hits = r.events.filter((e) => e.type === 'attack' && e.id === knight && !e.crit);
    const before = hits.filter((e) => e.t < sap.t).pop();
    const during = hits.find((e) => e.t > sap.t && e.t < until);
    if (before?.type !== 'attack' || during?.type !== 'attack') throw new Error('no hits to compare');
    expect(during.damage).toBeLessThan(before.damage);
  });
});

describe('Tari Penyembuh', () => {
  test('heals the ally with the lowest HP %, for a share of attack', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.penari, 2);
    b.caster.star = 2;
    // Allies: the caster (full), a big unit at 600/1500 (40%) and a small one at 300/500 (60%).
    const big: SkillFighter = { ...b.caster, id: 50, hp: 600, maxHp: 1500, x: 2, y: 5 };
    const small: SkillFighter = { ...b.caster, id: 51, hp: 300, maxHp: 500, x: 4, y: 5 };
    b.allies.push(big, small);
    b.cast('taripenyembuh');
    expect(b.log.heals).toEqual([{ target: 50, amount: b.caster.stats.atk * TARI_PENYEMBUH.atk[1] }]);
  });

  test('nobody hurt: no heal', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.cast('taripenyembuh');
    expect(b.log.heals).toEqual([]);
  });
});

describe('Shovel Slam', () => {
  test('3 slams (one on cast, two more 0.4s apart) into the 3x1 row; each hit stuns 0.5s', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.graverobber, 1);
    b.cast('shovelslam');
    expect(b.log.busy).toEqual([true]);
    expect(b.log.repeats[0]).toMatchObject({ seconds: SHOVEL_SLAM.every, times: SHOVEL_SLAM.slams - 1 });
    b.log.repeats[0].fn();
    b.log.repeats[0].fn();
    expect(b.log.busy).toEqual([true, false]);
    // The row is (2..4, 4): enemies 1 and 2 each slammed 3 times; the one at (3,3) never.
    const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
    expect([by(1), by(2), by(3)]).toEqual([3, 3, 0]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * SHOVEL_SLAM.atk[0] && h.effect === 'shovelslam')).toBe(true);
    expect(b.log.stuns).toHaveLength(6);
    expect(b.log.stuns.every((s) => s.seconds === SHOVEL_SLAM.stun)).toBe(true);
  });

  test('in combat: slammed enemies are stunned and do nothing until it wears off', () => {
    const state = createGame(13, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'graverobber', star: 2 };
    b.board[3] = { uid: 2, defId: 'knight', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const stuns = r.events.filter((e) => e.type === 'stun');
    expect(stuns.length).toBeGreaterThanOrEqual(1);
    for (const s of stuns) {
      if (s.type !== 'stun') continue;
      expect(r.events.some((e) => (e.type === 'attack' || e.type === 'move') && e.id === s.id && e.t > s.t && e.t < s.until)).toBe(false);
    }
  });
});

describe("Guardian's Strike", () => {
  test('an empowered attack, then a flat shield on itself', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.dwarapala, star);
      b.cast('guardiansstrike');
      const i = star - 1;
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * (1 + GUARDIANS_STRIKE.bonus[i]), effect: 'guardiansstrike', basic: true }]);
      expect(b.log.shields).toEqual([{ amount: GUARDIANS_STRIKE.shield[i], seconds: GUARDIANS_STRIKE.seconds }]);
    }
  });

  test('the shield comes even when the hit kills', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.fragile.add(1);
    b.cast('guardiansstrike');
    expect(b.log.shields).toHaveLength(1);
  });
});

describe('Tidal Surge', () => {
  test('the path: 8-way steps to the target, target included', () => {
    expect(pathTo({ x: 3, y: 5 }, { x: 3, y: 1 })).toEqual([{ x: 3, y: 4 }, { x: 3, y: 3 }, { x: 3, y: 2 }, { x: 3, y: 1 }]);
    expect(pathTo({ x: 3, y: 5 }, { x: 5, y: 1 })).toEqual([{ x: 4, y: 4 }, { x: 5, y: 3 }, { x: 5, y: 2 }, { x: 5, y: 1 }]);
  });

  test('surges beside the target and back home, hitting everyone on the path both ways', () => {
    // From (3,5) to the target at (3,1); an enemy in the way at (3,3), one off the path at (0,0).
    const b = fakeBattle([{ x: 3, y: 1 }, { x: 3, y: 3 }, { x: 0, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.rarajonggrang, 1);
    b.cast('tidalsurge');
    expect(b.log.dashes).toHaveLength(1);
    expect(b.log.busy).toEqual([true]);
    b.log.repeats[0].fn(); // the way back, a beat later
    expect(b.log.busy).toEqual([true, false]);
    expect(b.log.dashes).toHaveLength(2);
    expect(dist(b.log.dashes[0], { x: 3, y: 1 })).toBe(1);
    expect(b.log.dashes[1]).toEqual({ x: 3, y: 5 });
    const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
    expect([by(1), by(2), by(3)]).toEqual([2, 2, 0]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * TIDAL_SURGE.ap[0] && h.effect === 'tidalsurge' && !h.basic)).toBe(true);
  });
});

describe('Mist Ward', () => {
  test('a small shield; when it ends, everyone around takes its size as magic damage', () => {
    // Around the caster at (3,5): (3,4) and (2,4) are next to it, (3,2) isn't.
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 2 }]);
    b.caster.star = 2;
    b.cast('mistward');
    expect(b.log.shields).toEqual([{ amount: MIST_WARD.shield[1], seconds: MIST_WARD.seconds }]);
    expect(b.log.hits).toEqual([]);
    b.log.shieldEnds[0]!();
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.hits.every((h) => h.raw === MIST_WARD.shield[1] && h.effect === 'mistblast' && !h.basic)).toBe(true);
  });

  test('in combat: the shield bursts when broken or run out, and it casts often', () => {
    const state = createGame(14, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'hazeguard', star: 1 };
    b.board[3] = { uid: 2, defId: 'knight', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'hazeguard')!.id;
    const casts = r.events.filter((e) => e.type === 'skill' && e.id === me);
    const blasts = r.events.filter((e) => e.type === 'effect' && e.effect === 'mistblast');
    expect(casts.length).toBeGreaterThan(2);
    expect(blasts.length).toBeGreaterThan(0);
    // Each blast comes at most once per shield.
    expect(blasts.length).toBeLessThanOrEqual(casts.length);
  });
});

describe('Misty Jab', () => {
  test('a small empowered attack, then a heal of its max hp', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.fogfist, star);
      b.cast('mistyjab');
      const i = star - 1;
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * (1 + MISTY_JAB.bonus[i]), effect: 'mistyjab', basic: true }]);
      expect(b.log.heals).toEqual([{ target: 0, amount: b.caster.maxHp * MISTY_JAB.heal[i] }]);
    }
  });
});

describe('shield layers', () => {
  test('a skill shield stacks on a Dauntless start shield instead of replacing it, and bursts on its own', () => {
    const state = createGame(14, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    // Two Dauntless: the Hazeguard starts with a big shield, then casts small Mist Wards on top.
    a.board[3] = { uid: 1, defId: 'hazeguard', star: 1 };
    a.board[17] = { uid: 2, defId: 'thunderhawk', star: 1 };
    b.board[3] = { uid: 3, defId: 'knight', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'hazeguard')!.id;
    const start = r.events.find((e) => e.type === 'shield' && e.id === me && e.t === 0);
    if (start?.type !== 'shield') throw new Error('no start shield');
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me)!;
    const after = r.events.filter((e) => e.type === 'shield' && e.id === me && e.t === cast.t).pop();
    if (after?.type !== 'shield') throw new Error('no ward');
    // The ward adds to what's left of the start shield.
    const left = r.events.filter((e) => e.type === 'shield' && e.id === me && e.t < cast.t).pop();
    expect(after.amount).toBe((left?.type === 'shield' ? left.amount : 0) + MIST_WARD.shield[0]);
    expect(r.events.some((e) => e.type === 'effect' && e.effect === 'mistblast')).toBe(true);
  });
});

describe('Mist Boomerang', () => {
  test('beyond: carries on the line past the target, stopping at the edge', () => {
    expect(beyond({ x: 3, y: 5 }, { x: 5, y: 3 }, 2)).toEqual({ x: 6, y: 1 });
    expect(beyond({ x: 3, y: 5 }, { x: 3, y: 1 }, 2)).toEqual({ x: 3, y: 0 });
  });

  test('flies through its target and 2 tiles beyond, hitting everyone on the way, then again on the way back', () => {
    // From (3,5) at the target (3,3): out to (3,1). (3,4) is before it, (3,2) and (3,1) behind it; (3,0) is past the end.
    const b = fakeBattle([{ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 3, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.mistoracle, 1);
    b.cast('mistboomerang');
    const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
    expect([by(1), by(2), by(3), by(4), by(5)]).toEqual([1, 1, 1, 1, 0]);
    expect(b.log.repeats[0]).toMatchObject({ seconds: MIST_BOOMERANG.back, times: 1 });
    b.log.repeats[0].fn();
    expect([by(1), by(2), by(3), by(4), by(5)]).toEqual([2, 2, 2, 2, 0]);
    expect(b.log.dashes).toEqual([]);
    expect(b.log.busy).toEqual([]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * MIST_BOOMERANG.ap[0] && h.effect === 'mistboomerang')).toBe(true);
  });
});

describe('Inked Strike', () => {
  test('an empowered attack, then heals a share of its max hp', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.inkling, star);
      b.cast('inkedstrike');
      const i = star - 1;
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * (1 + INKED_STRIKE.bonus[i]), effect: 'inkedstrike', basic: true }]);
      expect(b.log.heals).toEqual([{ target: 0, amount: b.caster.maxHp * INKED_STRIKE.heal[i] }]);
    }
  });
});

describe('Unfolding Tale', () => {
  test('hastes itself and 2 random allies, then 3 bolts at different enemies when there are enough', () => {
    const b = fakeBattle([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.chronicler, 1);
    for (const [id, x] of [[60, 1], [61, 2], [62, 4]] as const) b.allies.push({ ...b.caster, id, x, y: 5 });
    b.cast('unfoldingtale');
    const hasted = b.log.buffs.filter((x) => x.effect === 'unfoldingtale').map((x) => x.target);
    expect(hasted).toHaveLength(3);
    expect(hasted[0]).toBe(0);
    expect(new Set(hasted).size).toBe(3);
    expect(b.log.buffs[0].mods).toEqual([{ stat: 'attackSpeed', add: UNFOLDING_TALE.attackSpeed[0] }]);
    const targets = b.log.hits.map((h) => h.target);
    expect(targets).toHaveLength(UNFOLDING_TALE.bolts);
    expect(new Set(targets).size).toBe(3);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * UNFOLDING_TALE.ap[0] && h.effect === 'unfoldingtale')).toBe(true);
  });

  test('fewer than 3 enemies: they take more than one bolt; no allies: just itself', () => {
    const b = fakeBattle([{ x: 0, y: 0 }, { x: 2, y: 0 }]);
    b.cast('unfoldingtale');
    expect(b.log.buffs.map((x) => x.target)).toEqual([0]);
    const targets = b.log.hits.map((h) => h.target).sort();
    expect(targets).toHaveLength(3);
    expect(new Set(targets)).toEqual(new Set([1, 2]));
  });
});

describe('Myth Made Flesh', () => {
  test('drops the beast where the enemies are thickest, hitting the 3x3, and the beast fights on its own', () => {
    // A cluster of three around (5,1), one loner at (0,4).
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }, { x: 0, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.mythweaver, 1);
    b.cast('mythmadeflesh');
    const [beast] = b.log.summons;
    const spot = { x: beast.x, y: beast.y };
    expect(Math.max(...[1, 2, 3].map((id) => dist(spot, b.enemies[id - 1])))).toBeLessThanOrEqual(1);
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * MYTH_MADE_FLESH.landing[0])).toBe(true);
    expect(beast.skill.atk).toBe(b.caster.stats.ap * MYTH_MADE_FLESH.atk[0]);
    expect(beast.skill.mirror).toBeUndefined(); // a fighter, not a mirror
    expect(b.log.burns).toEqual([]);
  });

  test('as the protagonist: the landing burns, and the beast hits much harder', () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.mythweaver, 1);
    b.caster.chosen = 'storyweaver';
    b.cast('mythmadeflesh');
    expect(b.log.burns).toHaveLength(1);
    expect(b.log.burns[0].cells).toHaveLength(9);
    expect(b.log.summons[0].skill.atk).toBeCloseTo(b.caster.stats.ap * MYTH_MADE_FLESH.atk[0] * MYTH_MADE_FLESH.protagonistAtk);
  });

  test('in combat: the beast lands, moves and attacks on its own, and outlives Mythweaver', () => {
    const state = createGame(16, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[17] = { uid: 1, defId: 'mythweaver', star: 2 };
    a.board[3] = { uid: 2, defId: 'knight', star: 2 };
    b.board[2] = { uid: 3, defId: 'paladin', star: 2 };
    b.board[3] = { uid: 4, defId: 'paladin', star: 2 };
    b.board[4] = { uid: 5, defId: 'paladin', star: 2 };
    const r = simulateCombat({ rng: 2 }, a, b);
    const summon = r.events.find((e) => e.type === 'summon');
    if (summon?.type !== 'summon') throw new Error('no beast');
    const beast = summon.fighter.id;
    expect(summon.fighter.defId).toBe('mythbeast');
    expect(r.events.some((e) => e.type === 'attack' && e.id === beast)).toBe(true);
    // It fills its mana and mauls (an empowered basic attack).
    expect(r.events.some((e) => e.type === 'skill' && e.id === beast && e.skill === 'beastmaul')).toBe(true);
    const myth = r.fighters.find((f) => f.defId === 'mythweaver')!.id;
    const dies = r.events.find((e) => e.type === 'death' && e.id === myth);
    if (dies) expect(r.events.some((e) => e.type === 'death' && e.id === beast && e.t === dies.t)).toBe(false);
  });
});

describe("Tale's End", () => {
  test('hits every enemy within 1 tile for attack plus max hp, carry-sized', () => {
    // Around (3,5): (3,4) and (2,4) are within 1; (3,3) is 2 away.
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.taleshield, 2);
    b.caster.star = 2;
    b.caster.maxHp = b.caster.stats.hp;
    b.cast('talesend');
    const raw = b.caster.stats.atk * TALES_END.atk[1] + b.caster.maxHp * TALES_END.hp[1];
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.hits.every((h) => h.raw === raw && h.effect === 'talesend')).toBe(true);
    expect(raw).toBeGreaterThan(700); // hits like a truck at 2 stars
    expect(b.log.stuns).toEqual([]);
    expect(b.log.shields).toEqual([]);
  });

  test('as the protagonist: 2 tiles, stuns, and a shield', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 3 }, { x: 0, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.taleshield, 1);
    b.caster.chosen = 'storyweaver';
    b.cast('talesend');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.stuns.every((s) => s.seconds === TALES_END.stun)).toBe(true);
    expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * TALES_END.shield, seconds: TALES_END.shieldSeconds }]);
    expect(within({ x: 3, y: 5 }, 2)).toHaveLength(14); // the board's bottom edge cuts it
  });
});

describe('Shade Bolts and Storm Flurry', () => {
  test('Shade Bolts: 3 equal bolts 0.7s apart; it keeps fighting meanwhile', () => {
    const b = fakeBattle([{ x: 3, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.shadewalker, 1);
    b.cast('shadebolts');
    expect(b.log.hits).toHaveLength(1);
    expect(b.log.repeats[0]).toMatchObject({ seconds: SHADE_BOLTS.every, times: SHADE_BOLTS.hits - 1 });
    b.log.repeats[0].fn();
    b.log.repeats[0].fn();
    expect(b.log.hits).toHaveLength(3);
    expect(b.log.hits.every((h) => h.target === 1 && h.raw === b.caster.stats.atk * SHADE_BOLTS.atk[0] && !h.basic)).toBe(true);
    expect(b.log.busy).toEqual([]);
  });

  test('Storm Flurry: 5 quick magic hits on one target, never crits, busy while it lasts', () => {
    const b = fakeBattle([{ x: 3, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.stormherald, 2);
    b.caster.star = 2;
    b.cast('stormflurry');
    expect(b.log.busy).toEqual([true]);
    for (let i = 0; i < STORM_FLURRY.hits - 1; i++) b.log.repeats[0].fn();
    expect(b.log.busy).toEqual([true, false]);
    expect(b.log.hits).toHaveLength(STORM_FLURRY.hits);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * STORM_FLURRY.ap[1] && !h.basic)).toBe(true);
  });

  test('in combat: the flurry never crits even with crit chance', () => {
    const state = createGame(17, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    // Deadeye 2 for crit chance on basic attacks.
    a.board[17] = { uid: 1, defId: 'stormherald', star: 2 };
    a.board[16] = { uid: 2, defId: 'gloomshot', star: 1 };
    a.board[15] = { uid: 3, defId: 'pyreguard', star: 1 };
    a.board[3] = { uid: 4, defId: 'knight', star: 3 };
    b.board[3] = { uid: 5, defId: 'paladin', star: 3 };
    const r = simulateCombat({ rng: 3 }, a, b);
    const flurry = r.events.filter((e) => e.type === 'effect' && e.effect === 'stormflurry');
    expect(flurry.length).toBeGreaterThanOrEqual(STORM_FLURRY.hits);
    expect(flurry.some((e) => e.type === 'effect' && e.crit)).toBe(false);
  });
});

describe('Gale Shot and Altar Spark', () => {
  test('Gale Shot: one physical hit, then Weak (more damage taken) on the target', () => {
    const b = fakeBattle([{ x: 3, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.galekin, 1);
    b.cast('galeshot');
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * GALE_SHOT.atk[0], effect: 'galeshot', basic: false }]);
    expect(b.log.buffs).toEqual([{ target: 1, mods: [{ stat: 'damageTaken', add: GALE_SHOT.weak[0] }], seconds: GALE_SHOT.seconds, effect: 'weak' }]);
  });

  test('Weak: every source deals more to the target while it lasts', () => {
    const state = createGame(18, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'galekin', star: 3 };
    a.board[17] = { uid: 2, defId: 'archer', star: 1 };
    b.board[3] = { uid: 3, defId: 'paladin', star: 3 };
    const r = simulateCombat({ rng: 2 }, a, b);
    const archer = r.fighters.find((f) => f.defId === 'archer')!.id;
    const weak = r.events.find((e) => e.type === 'buff' && e.effect === 'weak');
    if (weak?.type !== 'buff' || weak.until === undefined) throw new Error('no Weak');
    const until = weak.until;
    const hits = r.events.filter((e) => e.type === 'attack' && e.id === archer && !e.crit);
    const before = hits.filter((e) => e.t < weak.t).pop();
    const during = hits.find((e) => e.t > weak.t && e.t < until);
    if (before?.type !== 'attack' || during?.type !== 'attack') throw new Error('no archer hits to compare');
    expect(during.damage).toBe(Math.round((before.damage / 1) * (1 + GALE_SHOT.weak[2])));
  });

  test('Altar Spark: a small magic hit on the 3x1 row', () => {
    const b = fakeBattle([{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.altarkeeper, 1);
    b.cast('altarspark');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * ALTAR_SPARK.ap[0])).toBe(true);
    expect([UNIT_BY_ID.galekin.mana, UNIT_BY_ID.altarkeeper.mana]).toEqual([40, 40]);
  });
});

describe('Mage skills', () => {
  test('Grave Whisper passive: mana to itself and allies directly beside it, not diagonals or farther', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.caster.star = 2;
    // Caster at (3,5): (2,5) and (3,4) are beside it; (4,4) is diagonal; (0,5) is far.
    b.allies.push({ ...b.caster, id: 70, x: 2, y: 5 }, { ...b.caster, id: 71, x: 3, y: 4 }, { ...b.caster, id: 72, x: 4, y: 4 }, { ...b.caster, id: 73, x: 0, y: 5 });
    b.atStart('gravewhisper');
    expect(b.log.mana.map((m) => m.target).sort((x, y) => x - y)).toEqual([0, 70, 71]);
    expect(b.log.mana.every((m) => m.amount === GRAVE_WHISPER.mana[1])).toBe(true);
  });

  test('Grave Whisper active: a magic 3x1 row', () => {
    const b = fakeBattle([{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.boneadept, 1);
    b.cast('gravewhisper');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * GRAVE_WHISPER.ap[0])).toBe(true);
  });

  test('Ash Storm: a 3x3 fire around its target for 2s, 0.5s ticks', () => {
    const b = fakeBattle([{ x: 3, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.ashbinder, 1);
    b.cast('ashstorm');
    expect(b.log.burns).toHaveLength(1);
    expect(b.log.burns[0].cells).toHaveLength(9);
    expect(b.log.burns[0].seconds).toBe(ASH_STORM.seconds);
    // Each 0.5s tick deals half the per-second amount: the skill's per-tick number.
    expect(b.log.burns[0].perSecond / 2).toBeCloseTo(b.caster.stats.ap * ASH_STORM.ap[0]);
  });

  test('Ether Beam: 12 ticks along the line through its target, hitting everyone on it each tick', () => {
    // From (3,5) up through (3,2): (3,3) and (3,0) are on the line too; (2,2) isn't.
    const b = fakeBattle([{ x: 3, y: 2 }, { x: 3, y: 0 }, { x: 2, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.ethersage, 1);
    b.cast('etherbeam');
    expect(b.log.busy).toEqual([true]);
    for (let i = 0; i < ETHER_BEAM.ticks - 1; i++) b.log.repeats[0].fn();
    expect(b.log.busy).toEqual([true, false]);
    const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
    expect([by(1), by(2), by(3)]).toEqual([12, 12, 0]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * ETHER_BEAM.ap[0])).toBe(true);
  });
});

describe('Starward', () => {
  test('passive: whole-fight shields on the allies directly left and right, scaled to their own max hp', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.caster.star = 2;
    // Caster at (3,5): (2,5) and (4,5) flank it; (3,4) is in front, not beside.
    b.allies.push({ ...b.caster, id: 70, x: 2, y: 5, maxHp: 800 }, { ...b.caster, id: 71, x: 4, y: 5, maxHp: 1200 }, { ...b.caster, id: 72, x: 3, y: 4 });
    b.atStart('starward');
    expect(b.log.shieldTargets.sort()).toEqual([70, 71]);
    expect(b.log.shields.map((s) => s.amount).sort((x, y) => x - y)).toEqual([800 * STARWARD.shield[1], 1200 * STARWARD.shield[1]]);
    expect(b.log.shields.every((s) => s.seconds >= 45)).toBe(true);
  });

  test('active: heals the 2 lowest-HP allies (itself included) by their own max hp', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.caster.hp = 900; // 90%
    b.allies.push({ ...b.caster, id: 70, hp: 200, maxHp: 1000 }, { ...b.caster, id: 71, hp: 500, maxHp: 1000 }, { ...b.caster, id: 72, hp: 950, maxHp: 1000 });
    b.cast('starward');
    expect(b.log.heals).toEqual([
      { target: 70, amount: 1000 * STARWARD.heal[0] },
      { target: 71, amount: 1000 * STARWARD.heal[0] },
    ]);
  });

  test('in combat: the flank shields stack with a Dauntless start shield', () => {
    const state = createGame(19, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    // Hazeguard + Thunderhawk = Dauntless 2: Hazeguard starts shielded; the Squire beside it adds more.
    a.board[3] = { uid: 1, defId: 'stardustsquire', star: 1 };
    a.board[4] = { uid: 2, defId: 'hazeguard', star: 1 };
    a.board[17] = { uid: 3, defId: 'thunderhawk', star: 1 };
    b.board[3] = { uid: 4, defId: 'knight', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const haze = r.fighters.find((f) => f.defId === 'hazeguard')!;
    const shields = r.events.filter((e) => e.type === 'shield' && e.id === haze.id && e.t === 0);
    const last = shields[shields.length - 1];
    expect(last?.type === 'shield' && last.amount).toBe(Math.round(haze.maxHp * DAUNTLESS.shield[0]) + Math.round(haze.maxHp * STARWARD.shield[0]));
  });
});

describe('Comet Lunge and Zodiac Slam', () => {
  test('Comet Lunge: empowered hit with lifesteal on just that hit, then a max-hp shield', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.cometlancer, 1);
    b.cast('cometlunge');
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * (1 + COMET_LUNGE.bonus[0]), effect: 'cometlunge', basic: true }]);
    // Lifesteal lent for the hit, then taken back.
    expect(b.log.buffs.map((x) => [x.effect, x.mods])).toEqual([['cometlungeleech', [{ stat: 'lifesteal', add: COMET_LUNGE.lifesteal[0] }]]]);
    expect(b.log.unbuffs).toEqual(['cometlungeleech']);
    expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * COMET_LUNGE.shield[0], seconds: COMET_LUNGE.seconds }]);
  });

  test('Zodiac Slam: the 3x1 row, then a shield from the damage it dealt', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.zodiacblade, 1);
    b.cast('zodiacslam');
    const raw = b.caster.stats.atk * ZODIAC_SLAM.atk[0];
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.shields).toEqual([{ amount: raw * 2 * ZODIAC_SLAM.shield[0], seconds: ZODIAC_SLAM.seconds }]);
  });

  test('in combat: the lunge heals off its own damage; the slam shields off what it dealt', () => {
    const state = createGame(20, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'cometlancer', star: 2 };
    a.board[4] = { uid: 2, defId: 'zodiacblade', star: 2 };
    b.board[3] = { uid: 3, defId: 'paladin', star: 2 };
    b.board[4] = { uid: 4, defId: 'paladin', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const lancer = r.fighters.find((f) => f.defId === 'cometlancer')!.id;
    const lunge = r.events.find((e) => e.type === 'effect' && e.effect === 'cometlunge');
    if (lunge?.type !== 'effect') throw new Error('no lunge');
    const after = r.events.slice(r.events.indexOf(lunge) + 1, r.events.indexOf(lunge) + 3);
    const heal = after.find((e) => e.type === 'heal' && e.id === lancer);
    if (heal?.type === 'heal') expect(heal.amount).toBeLessThanOrEqual(Math.round(lunge.damage * COMET_LUNGE.lifesteal[1]));
    const blade = r.fighters.find((f) => f.defId === 'zodiacblade')!.id;
    const slams = r.events.filter((e) => e.type === 'effect' && e.effect === 'zodiacslam');
    expect(slams.length).toBeGreaterThan(0);
    const first = slams[0];
    const sameCast = slams.filter((e) => e.t === first.t);
    const dealt = sameCast.reduce((n, e) => n + (e.type === 'effect' ? e.damage : 0), 0);
    const shield = r.events.find((e) => e.type === 'shield' && e.id === blade && e.t === first.t);
    expect(shield?.type === 'shield' && shield.amount).toBeGreaterThanOrEqual(Math.round(dealt * ZODIAC_SLAM.shield[1]));
  });
});

describe('Thunder Whirl and Puppet Snare', () => {
  test('Thunder Whirl: 6 pulses over 1.5s around itself', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.thunderhawk, 1);
    b.cast('thunderwhirl');
    expect(b.log.repeats[0]).toMatchObject({ seconds: THUNDER_WHIRL.every, times: 5 });
    for (let i = 0; i < 5; i++) b.log.repeats[0].fn();
    const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
    expect([by(1), by(2), by(3)]).toEqual([6, 6, 0]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * THUNDER_WHIRL.atk[0])).toBe(true);
  });

  test('Puppet Snare: drags the farthest enemy beside it, then hits everyone around it', () => {
    // From (3,5): the farthest is (0,0); one already beside it at (3,4).
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 5, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.dalang, 1);
    b.cast('puppetsnare');
    expect(b.log.dashes).toHaveLength(1);
    expect(dist(b.log.dashes[0], { x: 3, y: 5 })).toBe(1);
    expect(dist(b.enemies[1], b.caster)).toBe(1); // it was pulled in
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * PUPPET_SNARE.atk[0])).toBe(true);
  });
});

describe('Pyre Blast and Dread Descent', () => {
  test('the 3x3 ahead: toward the enemy, starting right in front, never behind', () => {
    const cells = ahead3x3({ x: 3, y: 5, side: 0 }).map((p) => `${p.x},${p.y}`);
    expect(cells).toHaveLength(9);
    expect(cells).toContain('3,4');
    expect(cells).toContain('2,2');
    expect(cells).not.toContain('3,5');
    expect(ahead3x3({ x: 3, y: 0, side: 1 }).every((p) => p.y >= 1 && p.y <= 3)).toBe(true);
  });

  test('Pyre Blast: hits and stuns the 3x3 ahead, then shields itself', () => {
    // Caster at (3,5), side 0 (facing up): (3,4) and (2,2) are ahead; (3,1) is too far; (4,5) is beside.
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 2 }, { x: 3, y: 1 }, { x: 4, y: 5 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.pyromancer, 1);
    b.cast('pyreblast');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2]);
    expect(b.log.stuns.every((s) => s.seconds === PYRE_BLAST.stun)).toBe(true);
    expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * PYRE_BLAST.shield[0], seconds: PYRE_BLAST.seconds }]);
  });

  test('Dread Descent: leaps into the densest spot, hits and stuns everyone around it', () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }, { x: 0, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.wraithlord, 1);
    b.cast('dreaddescent');
    expect(b.log.dashes).toHaveLength(1);
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * DREAD_DESCENT.atk[0])).toBe(true);
  });
});

describe('Weapon Master skills', () => {
  test('Kindle Twice: two basic hits, with lifesteal lent for just those', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.kindler, 1);
    b.cast('kindletwice');
    expect(b.log.hits).toEqual([0, 1].map(() => ({ target: 1, raw: b.caster.stats.atk * KINDLE_TWICE.power[0], effect: 'kindletwice', basic: true })));
    expect(b.log.buffs.map((x) => [x.effect, x.mods])).toEqual([['kindleleech', [{ stat: 'lifesteal', add: KINDLE_TWICE.lifesteal[0] }]]]);
    expect(b.log.unbuffs).toEqual(['kindleleech']);
  });

  test('Drake Rend: two slashes then a bigger finisher on the 3x1 row; spell lifesteal only on the finisher', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 4, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.drakerider, 1);
    b.cast('drakerend');
    expect(b.log.busy).toEqual([true]);
    expect(b.log.buffs).toEqual([]);
    b.log.repeats[0].fn();
    b.log.repeats[0].fn();
    expect(b.log.busy).toEqual([true, false]);
    const raws = b.log.hits.map((h) => h.raw);
    const atk = b.caster.stats.atk;
    expect(raws).toEqual([atk * DRAKE_REND.slash[0], atk * DRAKE_REND.slash[0], atk * DRAKE_REND.slash[0], atk * DRAKE_REND.slash[0], atk * DRAKE_REND.finisher[0], atk * DRAKE_REND.finisher[0]]);
    expect(b.log.buffs.map((x) => [x.effect, x.mods])).toEqual([['drakeleech', [{ stat: 'spellLifesteal', add: DRAKE_REND.lifesteal[0] }]]]);
    expect(b.log.unbuffs).toEqual(['drakeleech']);
  });

  test('Skyreaver is a frontliner now', () => {
    expect(UNIT_BY_ID.skyreaver.range).toBe(1);
  });

  test('in combat: the finisher heals Drake Rider for its damage', () => {
    const state = createGame(21, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'drakerider', star: 2 };
    b.board[3] = { uid: 2, defId: 'paladin', star: 2 };
    b.board[4] = { uid: 3, defId: 'knight', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'drakerider')!.id;
    const fin = r.events.findIndex((e) => e.type === 'effect' && e.effect === 'drakerendfinisher');
    if (fin < 0) throw new Error('no finisher');
    expect(r.events.slice(fin, fin + 4).some((e) => e.type === 'heal' && e.id === me)).toBe(true);
  });
});

describe('Sky Reap', () => {
  test('passive: hit, hit, hit-hit (an extra basic hit on every third attack)', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.skyreaver, 1);
    const extras = () => b.log.hits.filter((h) => h.effect === 'skyreap').length;
    const seen: number[] = [];
    for (let n = 0; n < 6; n++) {
      b.onHit('skyreap');
      seen.push(extras());
    }
    expect(seen).toEqual([0, 0, 1, 1, 1, 2]);
    expect(b.log.hits.every((h) => h.basic && h.raw === b.caster.stats.atk)).toBe(true);
  });

  test('active: attack speed and lifesteal for 5s, and the cycle shortens to hit, hit-hit', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.skyreaver, 2);
    b.caster.star = 2;
    b.cast('skyreap');
    expect(b.log.buffs).toEqual([
      {
        target: 0,
        mods: [
          { stat: 'attackSpeed', add: SKY_REAP.attackSpeed[1] },
          { stat: 'lifesteal', add: SKY_REAP.lifesteal[1] },
        ],
        seconds: SKY_REAP.seconds,
        effect: 'skyreap',
      },
    ]);
    const seen: number[] = [];
    for (let n = 0; n < 4; n++) {
      b.onHit('skyreap');
      seen.push(b.log.hits.length);
    }
    expect(seen).toEqual([0, 1, 1, 2]);
  });

  test('in combat: double strikes land on the same tick as the attack they follow', () => {
    const state = createGame(22, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'skyreaver', star: 2 };
    b.board[3] = { uid: 2, defId: 'paladin', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'skyreaver')!.id;
    const extra = r.events.filter((e) => e.type === 'effect' && e.effect === 'skyreap');
    expect(extra.length).toBeGreaterThan(0);
    for (const e of extra) expect(r.events.some((x) => x.type === 'attack' && x.id === me && x.t === e.t)).toBe(true);
  });
});

describe('Undying Fury', () => {
  test('leaps into the densest spot, then a max-hp aura around it for 4s, with attack speed and lifesteal on everything', () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }, { x: 0, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.revenant, 1);
    b.cast('undyingfury');
    expect(b.log.dashes).toHaveLength(1);
    expect(b.log.buffs[0].mods).toEqual([
      { stat: 'attackSpeed', add: UNDYING_FURY.attackSpeed[0] },
      { stat: 'lifesteal', add: UNDYING_FURY.lifesteal[0] },
      { stat: 'spellLifesteal', add: UNDYING_FURY.lifesteal[0] },
    ]);
    expect(b.log.buffs[0].seconds).toBe(UNDYING_FURY.seconds);
    expect(b.log.repeats[0]).toMatchObject({ seconds: UNDYING_FURY.every, times: 7 });
    for (let n = 0; n < 7; n++) b.log.repeats[0].fn();
    const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
    expect([by(1), by(2), by(3), by(4)]).toEqual([8, 8, 8, 0]);
    expect(b.log.hits.every((h) => h.raw === b.caster.maxHp * UNDYING_FURY.hp[0] && h.effect === 'undyingfuryaura')).toBe(true);
  });

  test('in combat: the aura heals it (spell lifesteal from its own ticks)', () => {
    const state = createGame(23, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'revenant', star: 2 };
    b.board[3] = { uid: 2, defId: 'titan', star: 3 };
    b.board[4] = { uid: 3, defId: 'paladin', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'revenant')!.id;
    const tick = r.events.findIndex((e) => e.type === 'effect' && e.effect === 'undyingfuryaura');
    if (tick < 0) throw new Error('no aura');
    expect(r.events.slice(tick, tick + 6).some((e) => e.type === 'heal' && e.id === me)).toBe(true);
  });
});

describe('Defender skills', () => {
  test('Ashen Wall: a 3-wide strip to the far edge, small damage and a stun', () => {
    expect(aheadStrip({ x: 3, y: 5, side: 0 })).toHaveLength(15); // 3 wide x 5 rows ahead
    // (3,0) is at the far end, (2,3) in the strip, (0,1) outside it, (3,5) is the caster's own row.
    const b = fakeBattle([{ x: 3, y: 0 }, { x: 2, y: 3 }, { x: 0, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.ashwarden, 1);
    b.cast('ashenwall');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2]);
    expect(b.log.stuns.every((s) => s.seconds === ASHEN_WALL.stun)).toBe(true);
  });

  test('Crypt Seal: stuns everyone around it, then shields', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.cryptwarden, 1);
    b.cast('cryptseal');
    expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2]);
    expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * CRYPT_SEAL.shield[0], seconds: CRYPT_SEAL.seconds }]);
  });

  test("Dragon's Dominion: wing shields from the Dragon's max hp; lands, hits by max hp, taunts and shields", () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }]);
    b.caster.maxHp = 2000;
    b.allies.push({ ...b.caster, id: 70, x: 2, y: 5, maxHp: 500 }, { ...b.caster, id: 71, x: 4, y: 5, maxHp: 500 });
    b.atStart('dragonsdominion');
    expect(b.log.shields.map((s) => s.amount)).toEqual([2000 * DRAGONS_DOMINION.wingShield[0], 2000 * DRAGONS_DOMINION.wingShield[0]]);
    b.cast('dragonsdominion');
    expect(b.log.dashes).toHaveLength(1);
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.hits.every((h) => h.raw === 2000 * DRAGONS_DOMINION.hp[0])).toBe(true);
    expect(b.log.taunts.map((x) => [x.target, x.by, x.seconds]).sort()).toEqual([1, 2, 3].map((id) => [id, 0, DRAGONS_DOMINION.taunt]));
    expect(b.log.shields.at(-1)).toEqual({ amount: 2000 * DRAGONS_DOMINION.shield[0], seconds: DRAGONS_DOMINION.seconds });
  });

  test('in combat: a taunted unit attacks only the taunter until the taunt ends', () => {
    const state = createGame(24, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'ancientdragon', star: 2 };
    a.board[4] = { uid: 2, defId: 'knight', star: 2 };
    a.board[2] = { uid: 3, defId: 'knight', star: 2 };
    b.board[2] = { uid: 4, defId: 'paladin', star: 2 };
    b.board[3] = { uid: 5, defId: 'paladin', star: 2 };
    b.board[4] = { uid: 6, defId: 'paladin', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const dragon = r.fighters.find((f) => f.defId === 'ancientdragon')!.id;
    const taunts = r.events.filter((e) => e.type === 'taunt');
    expect(taunts.length).toBeGreaterThan(0);
    for (const tt of taunts) {
      if (tt.type !== 'taunt') continue;
      expect(tt.by).toBe(dragon);
      const during = r.events.filter((e) => e.type === 'attack' && e.id === tt.id && e.t > tt.t && e.t < tt.until);
      expect(during.every((e) => e.type === 'attack' && e.target === dragon)).toBe(true);
    }
  });
});

describe('Fighter skills', () => {
  test("Prajurit's Oath: hybrid lifesteal for the allies directly left and right; active is an empowered attack", () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.prajurit, 1);
    b.allies.push({ ...b.caster, id: 70, x: 2, y: 5 }, { ...b.caster, id: 71, x: 4, y: 5 }, { ...b.caster, id: 72, x: 3, y: 4 });
    b.atStart('prajuritsoath');
    expect(b.log.buffs.map((x) => x.target).sort()).toEqual([70, 71]);
    expect(b.log.buffs[0].mods).toEqual([
      { stat: 'lifesteal', add: PRAJURITS_OATH.lifesteal[0] },
      { stat: 'spellLifesteal', add: PRAJURITS_OATH.lifesteal[0] },
    ]);
    expect(b.log.buffs[0].seconds).toBe(Infinity);
    b.cast('prajuritsoath');
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * (1 + PRAJURITS_OATH.bonus[0]), effect: 'prajuritsoath', basic: true }]);
  });

  test('Phantom Step: dashes beside its target, strikes, stuns it and shields itself', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.phantomblade, 2);
    b.caster.star = 2;
    b.cast('phantomstep');
    expect(b.log.dashes).toHaveLength(1);
    expect(dist(b.log.dashes[0], { x: 3, y: 1 })).toBe(1);
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * PHANTOM_STEP.atk[1], effect: 'phantomstep', basic: false }]);
    expect(b.log.stuns).toEqual([{ target: 1, seconds: PHANTOM_STEP.stun[1] }]);
    expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * PHANTOM_STEP.shield[1], seconds: PHANTOM_STEP.seconds }]);
  });

  test('Wyrm Frenzy: a huge empowered attack, then attack speed and lifesteal', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.wyrmfang, 1);
    b.cast('wyrmfrenzy');
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * (1 + WYRM_FRENZY.bonus[0]), effect: 'wyrmfrenzy', basic: true }]);
    expect(b.log.buffs).toEqual([
      {
        target: 0,
        mods: [
          { stat: 'attackSpeed', add: WYRM_FRENZY.attackSpeed[0] },
          { stat: 'lifesteal', add: WYRM_FRENZY.lifesteal[0] },
        ],
        seconds: WYRM_FRENZY.seconds,
        effect: 'wyrmfrenzy',
      },
    ]);
  });

  test('Thunder Lord is a frontliner now', () => {
    expect(UNIT_BY_ID.thunderlord.range).toBe(1);
  });
});

describe('Storm Fists', () => {
  test('passive: a chance to counter-attack whoever hits it (rolled from the fight randomness)', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.attacked('stormfists'); // the fake roll is always 0: under any chance
    expect(b.log.counters).toEqual([{ by: 0, target: 1 }]);
    expect(b.log.rolls).toEqual([1000]);
  });

  test('active: 12 channeled punches into the 3-wide strip ahead, every enemy in it each time; busy meanwhile', () => {
    // Caster at (3,5) facing up: (3,4) and (2,0) are in the strip; (6,2) isn't.
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 0 }, { x: 6, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.thunderlord, 1);
    b.cast('stormfists');
    expect(b.log.busy).toEqual([true]);
    for (let n = 0; n < STORM_FISTS.punches - 1; n++) b.log.repeats[0].fn();
    expect(b.log.busy).toEqual([true, false]);
    const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
    expect([by(1), by(2), by(3)]).toEqual([STORM_FISTS.punches, STORM_FISTS.punches, 0]);
    expect(b.log.hits.every((h) => h.basic && h.raw === b.caster.stats.atk * STORM_FISTS.power[0])).toBe(true);
  });

  test('in combat: it counters ranged attackers too, from across the board', () => {
    const state = createGame(26, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'thunderlord', star: 3 };
    b.board[17] = { uid: 2, defId: 'archer', star: 3 }; // back row, range 4
    b.board[3] = { uid: 3, defId: 'knight', star: 3 };
    const r = simulateCombat({ rng: 2 }, a, b);
    const lord = r.fighters.find((f) => f.defId === 'thunderlord')!.id;
    const archer = r.fighters.find((f) => f.defId === 'archer')!.id;
    const shots = r.events.filter((e) => e.type === 'attack' && e.id === archer && e.target === lord);
    const counters = r.events.filter((e) => e.type === 'attack' && e.id === lord && e.target === archer && shots.some((s) => s.t === e.t));
    expect(shots.length).toBeGreaterThan(0);
    expect(counters.length).toBeGreaterThan(0);
  });

  test('in combat: counters are real basic attacks on the attacker, and never chain', () => {
    const state = createGame(25, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    // Thunder Lord vs another Thunder Lord: each one's counters must not set off the other's.
    a.board[3] = { uid: 1, defId: 'thunderlord', star: 3 };
    b.board[3] = { uid: 2, defId: 'thunderlord', star: 3 };
    const r = simulateCombat({ rng: 4 }, a, b);
    const [x, y] = r.fighters.map((f) => f.id);
    // Same-tick attacks back and forth: a counter shows as a second attack event on the same tick.
    const attacks = r.events.filter((e) => e.type === 'attack');
    const byTick = new Map<number, number[]>();
    for (const e of attacks) if (e.type === 'attack') byTick.set(e.t, [...(byTick.get(e.t) ?? []), e.id]);
    const counterTicks = [...byTick.values()].filter((ids) => ids.includes(x) && ids.includes(y));
    expect(counterTicks.length).toBeGreaterThan(0);
    // No runaway chain: never more than a handful of attacks on one tick.
    expect(Math.max(...[...byTick.values()].map((ids) => ids.length))).toBeLessThanOrEqual(6);
  });
});

describe("Wanderer's Volley", () => {
  test('a 3-wide projectile to the far end of the board, hitting everyone in its path', () => {
    // From (3,5) facing up: (3,4), (2,1), (4,0) are in the path; (0,2) and (6,0) aren't.
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 1 }, { x: 4, y: 0 }, { x: 0, y: 2 }, { x: 6, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.wanderingeye, 1);
    b.cast('wanderersvolley');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * WANDERERS_VOLLEY.atk[0] && !h.basic)).toBe(true);
  });
});

describe('Blade Descent', () => {
  test('leaps into the densest spot, stuns everyone around, charges the next attack and shields', () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }, { x: 0, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.wanderingblade, 1);
    b.cast('bladedescent');
    expect(b.log.dashes).toHaveLength(1);
    expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.stuns.every((s) => s.seconds === BLADE_DESCENT.stun[0])).toBe(true);
    expect(b.log.hits).toEqual([]);
    expect(b.log.buffs).toEqual([{ target: 0, mods: [{ stat: 'basicAmp', add: BLADE_DESCENT.bonus[0] }], seconds: Infinity, effect: 'bladecharged' }]);
    expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * BLADE_DESCENT.shield[0], seconds: BLADE_DESCENT.seconds }]);
    // The charge is spent on the next basic attack.
    b.onHit('bladedescent');
    expect(b.log.unbuffs).toEqual(['bladecharged']);
  });

  test('in combat: only the one attack after the cast hits harder', () => {
    const state = createGame(27, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'wanderingblade', star: 1 };
    b.board[3] = { uid: 2, defId: 'titan', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'wanderingblade')!.id;
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me);
    if (!cast) throw new Error('no cast');
    const hits = r.events.filter((e) => e.type === 'attack' && e.id === me && !e.crit && !e.again);
    const before = hits.filter((e) => e.t < cast.t).pop();
    const [first, second] = hits.filter((e) => e.t > cast.t);
    if (before?.type !== 'attack' || first?.type !== 'attack' || second?.type !== 'attack') throw new Error('not enough attacks');
    expect(first.damage).toBeGreaterThan(before.damage * 2);
    expect(second.damage).toBe(before.damage);
  });
});

describe('Crater Fall', () => {
  test('lands in the densest spot: tick, tick, tick, boom on that fixed area', () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }, { x: 0, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.wanderingbastion, 1);
    b.cast('craterfall');
    expect(b.log.dashes).toHaveLength(1);
    expect(b.log.repeats[0]).toMatchObject({ seconds: CRATER_FALL.every, times: CRATER_FALL.ticks });
    for (let n = 0; n < CRATER_FALL.ticks; n++) b.log.repeats[0].fn();
    const atk = b.caster.stats.atk;
    const onFirst = b.log.hits.filter((h) => h.target === 1).map((h) => [h.effect, h.raw]);
    expect(onFirst).toEqual([
      ['craterfall', atk * CRATER_FALL.tick[0]],
      ['craterfall', atk * CRATER_FALL.tick[0]],
      ['craterfall', atk * CRATER_FALL.tick[0]],
      ['craterboom', atk * CRATER_FALL.boom[0]],
    ]);
    expect(b.log.hits.some((h) => h.target === 4)).toBe(false);
  });
});

describe('Fate Thread', () => {
  test('passive: links 2 / 3 / all enemies by star', () => {
    for (const [star, expected] of [[1, 2], [2, 3], [3, 5]] as const) {
      const b = fakeBattle([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }]);
      b.caster.star = star;
      b.atStart('fatethread');
      expect(b.log.links).toHaveLength(1);
      expect(new Set(b.log.links[0].targets).size).toBe(expected);
      expect(b.log.links[0].share).toBe(FATE_THREAD.share[star - 1]);
    }
  });

  test('active: a single magic nuke', () => {
    const b = fakeBattle([{ x: 3, y: 1 }, { x: 4, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.wanderingseer, 1);
    b.cast('fatethread');
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.ap * FATE_THREAD.ap[0], effect: 'fatethread', basic: false }]);
  });

  test('in combat: damage to one linked enemy spills onto the others, and never chains', () => {
    const state = createGame(28, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[17] = { uid: 1, defId: 'wanderingseer', star: 3 };
    a.board[3] = { uid: 2, defId: 'knight', star: 3 };
    b.board[2] = { uid: 3, defId: 'paladin', star: 2 };
    b.board[3] = { uid: 4, defId: 'paladin', star: 2 };
    b.board[4] = { uid: 5, defId: 'paladin', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const link = r.events.find((e) => e.type === 'link');
    if (link?.type !== 'link') throw new Error('no link');
    expect(link.ids).toHaveLength(3); // 3 stars: every enemy
    const knight = r.fighters.find((f) => f.defId === 'knight')!.id;
    const hit = r.events.findIndex((e) => e.type === 'attack' && e.id === knight && link.ids.includes(e.target));
    const first = r.events[hit];
    if (first?.type !== 'attack') throw new Error('no hit on a linked enemy');
    const spill = r.events.slice(hit + 1, hit + 4).filter((e) => e.type === 'effect' && e.effect === 'fatelink');
    expect(spill).toHaveLength(2);
    for (const e of spill) if (e.type === 'effect') expect(Math.abs(e.damage - first.damage * FATE_THREAD.share[2])).toBeLessThanOrEqual(1);
  });
});

describe("Stalker's Mark", () => {
  test('active: vanishes to the safest tile (attackers drop it), then strikes its prey a beat later', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.wanderinghunter, 1);
    b.cast('stalkersmark');
    expect(b.log.dashes[0]).toEqual({ x: 6, y: 5 }); // the fake safest cell
    expect(b.log.dropped).toEqual([0]);
    expect(b.log.busy).toEqual([true]);
    expect(b.log.hits).toEqual([]);
    b.log.repeats[0].fn();
    expect(dist(b.log.dashes[1], { x: 3, y: 4 })).toBe(1);
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * STALKERS_MARK.atk[0], effect: 'stalkersmark', basic: false }]);
    expect(b.log.busy).toEqual([true, false]);
  });

  test('in combat: an adjacent enemy left under the threshold is executed, through shields', () => {
    const state = createGame(29, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: false },
    ]);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'wanderinghunter', star: 3 };
    b.board[3] = { uid: 2, defId: 'knight', star: 2 };
    b.board[4] = { uid: 3, defId: 'knight', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'wanderinghunter')!.id;
    const executions = r.events.filter((e) => e.type === 'effect' && e.effect === 'execute');
    expect(executions.length).toBeGreaterThan(0);
    for (const e of executions) {
      if (e.type !== 'effect') continue;
      expect(e.by).toBe(me);
      const victim = r.fighters.find((f) => f.id === e.target)!;
      expect(e.damage).toBeLessThan(victim.maxHp * STALKERS_MARK.execute[2]);
      expect(r.events.some((x) => x.type === 'death' && x.id === e.target && x.t === e.t)).toBe(true);
    }
  });
});

describe('Spectral Cataclysm', () => {
  test('leaps into the densest spot: impact on the tiles around, then a bigger blast out to 3 tiles', () => {
    // A cluster around (5,1); (2,3) is within 3 of it, (0,5) isn't.
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }, { x: 2, y: 3 }, { x: 0, y: 5 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.eidolon, 1);
    b.cast('spectralcataclysm');
    expect(b.log.dashes).toHaveLength(1);
    const land = b.log.dashes[0];
    const atk = b.caster.stats.atk;
    const impact = b.log.hits.filter((h) => h.effect === 'spectralimpact');
    expect(impact.length).toBeGreaterThan(0);
    for (const h of impact) {
      expect(dist(land, b.enemies[h.target - 1])).toBe(1);
      expect(h.raw).toBe(atk * SPECTRAL_CATACLYSM.impact[0]);
    }
    expect(b.log.repeats[0]).toMatchObject({ seconds: SPECTRAL_CATACLYSM.delay, times: 1 });
    b.log.repeats[0].fn();
    const blast = b.log.hits.filter((h) => h.effect === 'spectralcataclysm');
    const reached = [1, 2, 3, 4, 5].filter((id) => dist(land, b.enemies[id - 1]) <= SPECTRAL_CATACLYSM.radius);
    expect(blast.map((h) => h.target).sort()).toEqual(reached);
    expect(reached).not.toContain(5);
    expect(blast.every((h) => h.raw === atk * SPECTRAL_CATACLYSM.blast[0])).toBe(true);
  });
});
