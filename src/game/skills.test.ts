import { describe, expect, test } from 'bun:test';
import { simulateCombat } from './combat';
import { MAX_COMBAT_TICKS, TICKS_PER_SECOND } from './config';
import { createGame } from './game';
import { dist, GRID_H, GRID_W, type Point } from './grid';
import { JIMAT } from './items';
import { KERIS_SLASH, PARTY_CRASHER, ahead3x3, beyond, coneAhead, coneBehind, facingStrip, lineThrough, wideLine, SPECTRAL_CATACLYSM, STALKERS_MARK, FATE_THREAD, SOUTHERN_TIDE, SUMPAH_PALAPA, CRATER_FALL, BLADE_DESCENT, WANDERERS_VOLLEY, STORM_FISTS, PHANTOM_STEP, PRAJURITS_OATH, WYRM_FRENZY, ALTAR_SPARK, ASH_STORM, ASHEN_WALL, CRYPT_SEAL, DRAGONS_DOMINION, UNDYING_FURY, SKY_REAP, DRAKE_REND, KINDLE_TWICE, DREAD_DESCENT, PYRE_BLAST, PUPPET_SNARE, THUNDER_WHIRL, COMET_LUNGE, COMMANDERS_MARK, ZODIAC_SLAM, STARWARD, ETHER_BEAM, GRAVE_WHISPER, bestLine, GALE_SHOT, SHADE_BOLTS, STORM_FLURRY, TALES_END, within, MYTH_MADE_FLESH, INKED_STRIKE, UNFOLDING_TALE, MIST_BOOMERANG, MIST_WARD, MISTY_JAB, pathTo, TIDAL_SURGE, GUARDIANS_STRIKE, SHOVEL_SLAM, TARI_PENYEMBUH, SAPPING_TOUCH, SPIRIT_ARCHERS, POLAR_BARRAGE, DRAGON_LANCE, FALLING_STAR, GLOOM_VOLLEY, PYRE_FRENZY, RAMPAGE, STORM_PURSUIT, orbCells, SOUL_ORBIT, MOURNFUL_SHOT, PHANTOM_EXECUTION, POWER_OF_CHAOS, RENDING_BITE, SKILLS, STARFALL_AEGIS, type SkillApi, type SkillFighter } from './skills';
import { DAUNTLESS, TRAITS, unitStats } from './traits';
import type { GameState, Player, Star } from './types';
import { UNIT_BY_ID, UNITS } from './units';

// A stand-in for combat that records what a skill does.
function fakeBattle(enemyCells: Point[]) {
  const caster: SkillFighter = { id: 0, side: 0, star: 1, hp: 1000, maxHp: 1000, dealt: 0, chosen: null, x: 3, y: 5, stats: unitStats(UNIT_BY_ID.lance, 1), skill: {} };
  const enemies: SkillFighter[] = enemyCells.map((p, i) => ({ id: i + 1, side: 1, star: 1, hp: 1e9, maxHp: 1e9, dealt: 0, chosen: null, ...p, stats: caster.stats, skill: {} }));
  const all = [caster, ...enemies];
  const log = {
    hits: [] as { target: number; raw: number; effect: string; basic: boolean }[],
    hitTypes: [] as string[], // damage type of each hit, same order as `hits`
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
    attacks: [] as { by: number; target: number; mult: number }[],
    stances: [] as { rooted?: boolean; noBasic?: boolean }[],
    immune: [] as number[],
    stuns: [] as { target: number; seconds: number }[],
    taunts: [] as { target: number; by: number; seconds: number }[],
    links: [] as { by: number; targets: number[]; share: number }[],
    dropped: [] as number[],
    rolls: [] as number[],
    mana: [] as { target: number; amount: number }[],
    counters: [] as { by: number; target: number }[],
    burns: [] as { cells: string[]; perSecond: number; seconds: number }[],
    // Shreds and hits in the order they happened, e.g. 'shred:1', 'hit:1'.
    order: [] as string[],
  };
  // Enemies whose next hit kills them (to test kill-chains).
  const fragile = new Set<number>();
  const record = (target: SkillFighter, raw: number, effect: string, basic: boolean, type: string) => {
    log.hits.push({ target: target.id, raw, effect, basic });
    log.hitTypes.push(type);
    log.order.push(`hit:${target.id}`);
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
    hit: (s, target, raw, type, effect) => ((s.dealt += raw), record(target, raw, effect, false, type)),
    basicHit: (_s, target, raw, type, effect) => record(target, raw, effect, true, type),
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
    showLeap: () => {},
    shred: (target) => {
      log.order.push(`shred:${target.id}`);
    },
    random: (n) => (log.rolls.push(n), 0),
    giveMana: (f, amount) => log.mana.push({ target: f.id, amount }),
    counterAttack: (f, target) => log.counters.push({ by: f.id, target: target.id }),
    attack: (f, target, mult) => log.attacks.push({ by: f.id, target: target.id, mult }),
    stance: (_f, st) => log.stances.push(st),
    ccImmune: (_f, seconds) => log.immune.push(seconds),
    canAct: (f) => f.hp > 0,
    busy: (_f, on) => log.busy.push(on),
    buff: (target, mods, seconds, effect) => log.buffs.push({ target: target.id, mods, seconds, effect }),
    alliesOf: (f) => all.filter((e) => e.side === f.side && e.hp > 0),
    minionsOf: () => log.summons.filter((m) => m.hp > 0),
    dismiss: (m) => {
      m.hp = 0;
    },
    summon: (owner, _defId, { hpShare, mirror, atk, at }) => {
      const m: SkillFighter = { id: 100 + log.summons.length, side: owner.side, star: owner.star, hp: owner.maxHp * hpShare, maxHp: owner.maxHp * hpShare, dealt: 0, chosen: null, x: at?.x ?? 0, y: at ? at.y + (all.some((e) => e.hp > 0 && e.x === at.x && e.y === at.y) ? 1 : 0) : 0, stats: owner.stats, skill: { ...(mirror !== undefined && { mirror }), ...(atk !== undefined && { atk }) } };
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
  const afterAttack = (skill: string, target = enemies[0]) => SKILLS[skill].afterAttack!(api, caster, target);
  // `allies`: push extra units of the caster's side (alliesOf reads them).
  return { api, caster, enemies, log, fragile, cast, onHit, atStart, attacked, afterAttack, allies: all };
}

describe('Phantom Execution', () => {
  test('Lance has hand-set stats per star (mana too), melee', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.lance, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([4075, 7335, 50535]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([240, 365, 775]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([240, 365, 775]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([50, 50, 20]);
    expect([UNIT_BY_ID.lance.name, UNIT_BY_ID.lance.range]).toEqual(['Lance', 1]);
  });

  test('3★ only: starts the fight with full mana', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 3 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.lance, star);
      b.atStart('phantomexecution');
      expect(b.log.mana).toEqual(star === 3 ? [{ target: b.caster.id, amount: b.caster.stats.maxMana }] : []);
      expect(b.log.dashes).toEqual([]);
    }
  });

  // Casts once and plays out every queued dash.
  const castAll = (b: ReturnType<typeof fakeBattle>) => {
    const from = b.log.repeats.length;
    b.cast();
    for (const r of b.log.repeats.slice(from)) for (let i = 0; i < r.times; i++) r.fn();
  };

  test('3 dashes per cast: one at once, the rest a dash apart, busy until the last', () => {
    const b = fakeBattle([{ x: 3, y: 3 }]);
    b.cast();
    expect(b.log.dashes).toHaveLength(1);
    expect(b.log.busy).toEqual([true]);
    expect(b.log.repeats[0]).toMatchObject({ seconds: PHANTOM_EXECUTION.dashSeconds, times: 2 });
    b.log.repeats[0].fn();
    b.log.repeats[0].fn();
    expect(b.log.dashes).toHaveLength(3);
    expect(b.log.busy).toEqual([true, false]);
    expect(b.log.guards).toEqual([3 * PHANTOM_EXECUTION.dashSeconds]);
  });

  test('dashes along the line through the most enemies, not the nearest', () => {
    // Nearest is alone at (2,4); a pair lines up to the right at (5,5),(6,5).
    const b = fakeBattle([{ x: 2, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 5 }]);
    b.cast();
    expect(b.log.hits.slice(0, 2).map((h) => h.target).sort()).toEqual([2, 3]);
  });

  test('hits every enemy on the line for its star share of attack; Phantoms only after 3 dashes', () => {
    // Two enemies straight ahead in the caster's column.
    const b = fakeBattle([{ x: 3, y: 3 }, { x: 3, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.lance, 1);
    const raw = b.caster.stats.atk * PHANTOM_EXECUTION.atk[0];
    castAll(b); // dashes 1-3
    expect(b.log.hits.slice(0, 2).map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.hits.every((h) => h.raw === raw && h.effect === 'phantomexecution')).toBe(true);
    castAll(b); // dashes 4-6: every one leaves a Phantom
    expect(b.log.hits.filter((h) => h.effect === 'phantom').length).toBeGreaterThan(0);
  });

  test('bestLine aims at any angle, through the most enemies; ties go nearest (or farthest)', () => {
    // A lone enemy off every 8-way line from (3,5) still gets hit.
    const lone = fakeBattle([{ x: 4, y: 2 }]);
    expect(bestLine(lone.api, lone.caster, 4)).toContainEqual({ x: 4, y: 2 });
    // Two lone enemies, equal count: nearest by default, farthest with `far`.
    const two = fakeBattle([{ x: 3, y: 4 }, { x: 0, y: 5 }]);
    expect(bestLine(two.api, two.caster, 99)[0]).toEqual({ x: 3, y: 4 });
    expect(bestLine(two.api, two.caster, 99, true)[0]).toEqual({ x: 2, y: 5 });
    // Length caps the line.
    expect(bestLine(two.api, two.caster, 1)).toHaveLength(1);
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
  test('Lunox has hand-set stats per star, range 4, 20 mana, magic attacks', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.lunox, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3100, 5580, 13795]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([130, 185, 295]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([130, 185, 295]);
    expect([UNIT_BY_ID.lunox.name, UNIT_BY_ID.lunox.range, UNIT_BY_ID.lunox.mana, UNIT_BY_ID.lunox.attackType]).toEqual(['Lunox', 4, 20, 'magic']);
  });

  // Casting charges her; each later attack spends one as a Chaos Assault.
  const attack = (b: ReturnType<typeof fakeBattle>) => SKILLS.powerofchaos.enhancedAttack!(b.api, b.caster, b.caster);

  test('charges her next 3 attacks; the first dashes to safety, then each is one enhanced hit', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 3 }, { x: 0, y: 0 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.lunox, star);
      b.cast('powerofchaos');
      expect(b.log.hits).toEqual([]);
      for (let n = 0; n < POWER_OF_CHAOS.assaults; n++) expect(attack(b)).toBe(true);
      expect(attack(b)).toBe(false); // spent: back to normal attacks
      expect(b.log.dashes).toEqual([{ x: 6, y: 5 }]);
      expect(b.log.hits).toHaveLength(POWER_OF_CHAOS.assaults);
      const raw = b.caster.stats.ap * POWER_OF_CHAOS.ap[star - 1];
      expect(b.log.hits.every((h) => h.basic && h.raw === raw && h.effect === 'chaosassault')).toBe(true);
    }
  });

  test('each kill grants one more Chaos Assault', () => {
    const b = fakeBattle([{ x: 6, y: 3 }, { x: 5, y: 3 }, { x: 0, y: 0 }]);
    b.fragile.add(1);
    b.fragile.add(2);
    b.cast('powerofchaos');
    while (attack(b));
    // 3 assaults + 2 bonus for the 2 kills, nearest first from the safe cell (6,5); the last 3 all land on the survivor.
    expect(b.log.hits.map((h) => h.target)).toEqual([1, 2, 3, 3, 3]);
  });
});

describe('skills in a real fight', () => {
  test('Lance casts Phantom Execution: a skill event, then dashes and hits credited to him', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['lance', 3, 3]]);
    field(b, [['fanny', 2, 2], ['titan', 2, 3], ['paladin', 2, 4]]);
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'lance')!;
    const skill = r.events.findIndex((e) => e.type === 'skill' && e.id === me.id);
    expect(skill).toBeGreaterThanOrEqual(0);
    const after = r.events.slice(skill + 1).filter((e) => e.t === r.events[skill].t);
    expect(after.some((e) => e.type === 'dash' && e.id === me.id)).toBe(true);
    expect(after.some((e) => e.type === 'effect' && e.by === me.id && e.effect === 'phantomexecution')).toBe(true);
    // No placeholder cast for a unit that has a real skill.
    expect(r.events.some((e) => e.type === 'cast' && e.id === me.id)).toBe(false);
  });

  test('Lunox casts Power of Chaos: her next attacks are Chaos Assaults credited to her', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['lunox', 3, 17]]);
    field(b, [['fanny', 2, 2], ['titan', 2, 3], ['paladin', 2, 4]]);
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'lunox')!;
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me.id);
    expect(cast?.type === 'skill' && cast.skill).toBe('powerofchaos');
    // Her next attacks, not the cast itself: one Chaos Assault per attack, on separate ticks.
    const assaults = r.events.filter((e) => e.type === 'effect' && e.by === me.id && e.effect === 'chaosassault');
    expect(assaults.length).toBeGreaterThanOrEqual(POWER_OF_CHAOS.assaults);
    expect(assaults.every((e) => e.t > cast!.t)).toBe(true);
    expect(new Set(assaults.slice(0, POWER_OF_CHAOS.assaults).map((e) => e.t)).size).toBe(POWER_OF_CHAOS.assaults);
  });

  test("Jimat's spell lifesteal heals off Keris' Justice", () => {
    const state = newGame();
    const [a, b] = state.players;
    const [holder] = field(a, [['kari', 1, 3], ['angela', 1, 20]]);
    field(b, [['titan', 2, 3], ['paladin', 2, 6]]);
    a.items = [
      { uid: 1, id: 'keris', tier: 3, holder },
      { uid: 2, id: 'jimat', tier: 1, holder },
    ];
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'kari')!.id;
    const strikes = r.events.filter((e) => e.type === 'effect' && e.by === me && e.effect === 'keris');
    expect(strikes.length).toBeGreaterThan(0);
    // Every Justice hit that lands while he's hurt is followed by a heal of up to 20% of it.
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
  test('Odette has hand-set stats per star (mana too), range 4', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.odette, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3565, 6415, 44205]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([175, 265, 565]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([175, 265, 565]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([50, 50, 20]);
    expect([UNIT_BY_ID.odette.name, UNIT_BY_ID.odette.range]).toEqual(['Odette', 4]);
  });

  test('a flat shield, then channels: strikes every enemy every 0.5s, 10 times, busy until the last', () => {
    for (const star of [1, 3] as const) {
      const b = fakeBattle([{ x: 1, y: 1 }, { x: 5, y: 0 }, { x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.odette, star);
      b.cast('starfallaegis');
      expect(b.log.shields).toEqual([{ amount: STARFALL_AEGIS.shield[star - 1], seconds: 5 }]);
      expect(b.log.repeats.map(({ seconds, times }) => ({ seconds, times }))).toEqual([{ seconds: 0.5, times: 10 }]);
      expect(b.log.busy).toEqual([true]);
      expect(b.log.hits).toEqual([]); // nothing lands on cast
      b.log.repeats[0].fn();
      expect(b.log.hits).toEqual([1, 2, 3].map((target) => ({ target, raw: b.caster.stats.ap * STARFALL_AEGIS.ap[star - 1], effect: 'starfall', basic: false })));
      for (let n = 1; n < 10; n++) b.log.repeats[0].fn();
      expect(b.log.busy).toEqual([true, false]);
    }
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
    a.board[17] = { uid: 1, defId: 'odette', star: 1 };
    a.board[3] = { uid: 4, defId: 'titan', star: 3 }; // keeps the enemies busy
    b.board[3] = { uid: 2, defId: 'titan', star: 2 };
    b.board[4] = { uid: 3, defId: 'paladin', star: 2 };
    const r = simulateCombat({ rng: 7 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'odette')!.id;
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me)!;
    const paladin = r.fighters.find((f) => f.defId === 'paladin')!.id;
    const strikes = r.events.filter((e) => e.type === 'effect' && e.effect === 'starfall' && e.target === paladin);
    const firstCast = strikes.filter((e) => e.t <= cast.t + 50);
    expect(firstCast.map((e) => e.t - cast.t)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    const shield = r.events.find((e) => e.type === 'shield' && e.id === me);
    expect(shield?.type === 'shield' && shield.amount).toBe(STARFALL_AEGIS.shield[0]);
    // Channeling: no attacks of its own while the stars fall.
    expect(r.events.some((e) => e.type === 'attack' && e.id === me && e.t > cast.t && e.t < cast.t + 50)).toBe(false);
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
    a.board[17] = { uid: 1, defId: 'odette', star: 1 };
    b.board[3] = { uid: 2, defId: 'titan', star: 2 };
    b.board[4] = { uid: 3, defId: 'paladin', star: 2 };
    const r = simulateCombat({ rng: 3 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'odette')!.id;
    const gained = r.events.find((e) => e.type === 'shield' && e.id === me);
    if (gained?.type !== 'shield') throw new Error('no shield');
    // Every hit taken while the shield holds drains it by the damage and leaves hp alone.
    let shield = gained.amount;
    const before = r.events.filter((e) => e.t <= gained.t && e.type === 'attack' && e.target === me).pop();
    let hp = before?.type === 'attack' ? before.hp : Math.round(unitStats(UNIT_BY_ID.odette, 1).hp);
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
  test('Si Yun Yin has hand-set stats per star, melee, 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.siyunyin, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([1840, 3310, 5960]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([110, 165, 220]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([110, 165, 220]);
    expect([UNIT_BY_ID.siyunyin.name, UNIT_BY_ID.siyunyin.range, UNIT_BY_ID.siyunyin.mana]).toEqual(['Si Yun Yin', 1, 30]);
  });

  test('one enhanced basic attack on the target, then -armor/-mr for 10s, by star', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.siyunyin, star);
      b.cast('rendingbite');
      const i = star - 1;
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * RENDING_BITE.power[i], effect: 'rendingbite', basic: true }]);
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
    a.board[3] = { uid: 1, defId: 'siyunyin', star: 1 };
    b.board[3] = { uid: 2, defId: 'paladin', star: 1 };
    const r = simulateCombat({ rng: 2 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'siyunyin')!.id;
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
  test('Natalie has hand-set stats per star, melee, 20 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.natalie, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2025, 3645, 6550]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([120, 180, 240]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([120, 180, 240]);
    expect([UNIT_BY_ID.natalie.name, UNIT_BY_ID.natalie.range, UNIT_BY_ID.natalie.mana]).toEqual(['Natalie', 1, 20]);
  });

  test('every Hunter attacks about 0.75 times a second', () => {
    for (const u of UNITS.filter((d) => d.traits.includes('hunter'))) expect([u.id, u.attackTicks]).toEqual([u.id, 13]);
  });

  test('one enhanced attack for the whole share of attack, by star, nothing else', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.natalie, star);
      b.cast('mournfulshot');
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * MOURNFUL_SHOT.power[star - 1], effect: 'mournfulshot', basic: true }]);
      expect(b.log.debuffs).toEqual([]);
    }
  });
});

describe('Falling Star', () => {
  test('Katarina has hand-set stats per star, melee, 60 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.katarina, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2575, 4635, 8760]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([145, 200, 260]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([145, 200, 260]);
    expect([UNIT_BY_ID.katarina.name, UNIT_BY_ID.katarina.range, UNIT_BY_ID.katarina.mana]).toEqual(['Katarina', 1, 60]);
  });

  test('every Stargazer attacks about 0.75 times a second', () => {
    for (const u of UNITS.filter((d) => d.traits.includes('stargazer'))) expect([u.id, u.attackTicks]).toEqual([u.id, 13]);
  });

  test('dashes beside the farthest enemy and strikes it with magic', () => {
    for (const star of [1, 3] as const) {
      // From (3,5): (0,0) is the farthest.
      const b = fakeBattle([{ x: 3, y: 2 }, { x: 0, y: 0 }, { x: 6, y: 3 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.katarina, star);
      b.cast('fallingstar');
      expect(b.log.dashes).toHaveLength(1);
      expect(dist(b.log.dashes[0], { x: 0, y: 0 })).toBe(1);
      expect(b.log.hits).toEqual([{ target: 2, raw: b.caster.stats.ap * FALLING_STAR.ap[star - 1], effect: 'fallingstar', basic: false }]);
    }
  });

  test('no dash when the only enemy is already beside it', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.katarina, 2);
    b.caster.star = 2;
    b.cast('fallingstar');
    expect(b.log.dashes).toEqual([]);
    expect(b.log.hits[0]).toMatchObject({ target: 1, raw: b.caster.stats.ap * FALLING_STAR.ap[1] });
  });

  test('the strike hits every enemy within 1 tile of where she lands, not just her target', () => {
    // (0,0) is the farthest; (1,1) and (0,2) crowd around it; (5,0) is far from everything.
    const b = fakeBattle([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 6, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.katarina, 1);
    b.cast('fallingstar');
    const land = b.log.dashes[0];
    expect(dist(land, { x: 0, y: 0 })).toBe(1);
    const near = [1, 2, 3, 4].filter((id) => dist(land, b.enemies[id - 1]) <= 1);
    expect(near).toContain(1);
    expect(near.length).toBeGreaterThan(1);
    expect(b.log.hits.map((h) => h.target).sort()).toEqual(near);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * FALLING_STAR.ap[0] && h.effect === 'fallingstar')).toBe(true);
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

  test('Saber has hand-set stats per star, melee, 60 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.saber, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2575, 4635, 8760]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([155, 230, 310]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([155, 230, 310]);
    expect([UNIT_BY_ID.saber.name, UNIT_BY_ID.saber.range, UNIT_BY_ID.saber.mana]).toEqual(['Saber', 1, 60]);
  });

  test('orbits for 4s in 0.5s steps; each step hits enemies under an orb', () => {
    const b = fakeBattle([{ x: 2, y: 4 }, { x: 4, y: 5 }, { x: 0, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.saber, 1);
    b.cast('soulorbit');
    expect(b.log.repeats.map(({ seconds, times }) => ({ seconds, times }))).toEqual([{ seconds: SOUL_ORBIT.step, times: SOUL_ORBIT.seconds / SOUL_ORBIT.step }]);
    for (let i = 0; i < 8; i++) b.log.repeats[0].fn();
    const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
    // Each adjacent enemy sits under an orb 5 of the 8 steps; the far one never.
    expect(by(1)).toBe(5);
    expect(by(2)).toBe(5);
    expect(by(3)).toBe(0);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * SOUL_ORBIT.atk[0] && h.effect === 'soulorbit')).toBe(true);
  });
});

describe('Storm Pursuit', () => {
  test('Gufron has hand-set stats per star, melee, 40 mana, magic attacks', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.gufron, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3545, 6380, 15770]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([180, 275, 410]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([180, 275, 410]);
    expect([UNIT_BY_ID.gufron.name, UNIT_BY_ID.gufron.range, UNIT_BY_ID.gufron.mana]).toEqual(['Gufron', 1, 40]);
  });

  test('throw: knives fill a cone toward his target; jump: beside the top dealer; pull: the cone and the way back', () => {
    for (const star of [1, 3] as const) {
      // Caster (3,5), side 0, prey straight up at (3,4). In the cone: (3,4) row 1, (1,3) row 2, (0,2) row 3.
      // Out of it: (1,4) is beside the first row, (3,6) is behind him, (6,4) is off to the side.
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 1, y: 3 }, { x: 0, y: 2 }, { x: 1, y: 4 }, { x: 3, y: 6 }, { x: 6, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.gufron, star);
      b.cast('stormpursuit');
      const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
      expect([1, 2, 3, 4, 5, 6].map(by)).toEqual([1, 1, 1, 0, 0, 0]);
      expect(b.log.busy).toEqual([true]);
      expect(b.log.repeats.map((r) => r.seconds)).toEqual([STORM_PURSUIT.jump, STORM_PURSUIT.recall]);
      b.log.repeats[0].fn();
      // The nearest free cell beside the prey; he fights on from there.
      expect(b.log.dashes).toEqual([{ x: 2, y: 4 }]);
      expect(b.log.busy).toEqual([true, false]);
      b.log.repeats[1].fn();
      // The cone again (each once, however many knives pass).
      expect([1, 2, 3, 4, 5, 6].map(by)).toEqual([2, 2, 2, 0, 0, 0]);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * STORM_PURSUIT.ap[star - 1] && h.effect === 'stormpursuit' && !h.basic)).toBe(true);
    }
  });

  test('he throws at his target but leaps to the enemy that has dealt the most damage; the pull hits on its way to him', () => {
    // Target (3,4) right ahead; the top dealer (6,0) is far off; (5,2) stands between the knives and where he lands.
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 6, y: 0 }, { x: 4, y: 1 }]);
    b.enemies[1].dealt = 500;
    b.caster.stats = unitStats(UNIT_BY_ID.gufron, 1);
    b.cast('stormpursuit');
    expect(b.log.hits.map((h) => h.target)).toEqual([1]);
    b.log.repeats[0].fn();
    expect(b.log.dashes).toEqual([{ x: 5, y: 1 }]);
    b.log.repeats[1].fn();
    // The cone again (1), and (4,1) on the far-row knife (3,2)'s way to (5,1).
    expect(b.log.hits.slice(1).map((h) => h.target).sort()).toEqual([1, 3]);
  });

  test('only the first cast leaps; later ones throw and pull from where he stands', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 6, y: 0 }]);
    b.enemies[1].dealt = 500;
    b.caster.stats = unitStats(UNIT_BY_ID.gufron, 1);
    b.cast('stormpursuit');
    b.log.repeats.splice(0);
    b.cast('stormpursuit');
    expect(b.log.repeats.map((r) => r.seconds)).toEqual([STORM_PURSUIT.recall]);
    b.log.repeats[0].fn();
    expect(b.log.dashes).toEqual([]);
    expect(b.log.busy).toEqual([true]); // only the first cast's
  });

  test('the cone turns toward his target: one to the side gets a sideways cone', () => {
    // Target at (5,5), to his right: the cone opens rightward, so (6,3) (2 right, 2 up) is in it and (3,3) above him isn't.
    const b = fakeBattle([{ x: 5, y: 5 }, { x: 6, y: 3 }, { x: 3, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.gufron, 1);
    b.cast('stormpursuit');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
  });
});

describe('Rampage', () => {
  test('Fanny has hand-set stats per star (mana too), melee', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.fanny, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([4075, 7335, 50535]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([255, 385, 820]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([255, 385, 820]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([50, 50, 20]);
    expect([UNIT_BY_ID.fanny.name, UNIT_BY_ID.fanny.range]).toEqual(['Fanny', 1]);
  });

  test('5 dashes to the wall at the farthest enemy, hitting each enemy passed once per dash; 4 fireballs per dash; then a slash', () => {
    for (const star of [1, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 0 }, { x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.fanny, star);
      b.cast('rampage');
      expect(b.log.busy).toEqual([true]);
      expect(b.log.repeats[0].seconds).toBe(RAMPAGE.stepSeconds);
      for (let i = 0; i < b.log.repeats[0].times && b.log.busy.length < 2; i++) b.log.repeats[0].fn();
      expect(b.log.busy).toEqual([true, false]);
      const atk = b.caster.stats.atk;
      const of = (effect: string) => b.log.hits.filter((h) => h.effect === effect);
      // The first dash runs up the column from (3,5): through (3,2) and (3,0), both hit once.
      expect(of('rampage').slice(0, 2).map((h) => h.target).sort()).toEqual([1, 2]);
      expect(of('rampage').every((h) => h.raw === atk * RAMPAGE.atk[star - 1] && !h.basic)).toBe(true);
      expect(of('rampagefireball')).toHaveLength(RAMPAGE.dashes * RAMPAGE.fireballs);
      expect(of('rampagefireball').every((h) => h.raw === atk * RAMPAGE.fireball[star - 1])).toBe(true);
      expect(of('rampageslash')).toHaveLength(1);
      expect(of('rampageslash')[0].raw).toBe(atk * RAMPAGE.slash[star - 1]);
      expect(b.log.hits[b.log.hits.length - 1].effect).toBe('rampageslash');
      expect(b.log.burns).toEqual([]);
    }
  });

  test('in combat: it stops attacking while it dashes, can still be hit, and ends with a slash', () => {
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
    a.board[3] = { uid: 1, defId: 'fanny', star: 1 };
    b.board[3] = { uid: 2, defId: 'titan', star: 3 }; // sturdy enough to outlast the dashes and take the slash
    b.board[10] = { uid: 3, defId: 'archer', star: 3 };
    b.board[17] = { uid: 4, defId: 'imp', star: 3 };
    const r = simulateCombat({ rng: 8 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'fanny')!.id;
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me);
    if (!cast) throw new Error('no rampage');
    expect(r.events.some((e) => e.type === 'effect' && e.effect === 'rampagefireball')).toBe(true);
    expect(r.events.some((e) => e.type === 'effect' && e.effect === 'rampageslash')).toBe(true);
    // Each dash is drawn as one arcing leap, never cell-by-cell steps.
    const dashes = r.events.filter((e) => e.type === 'dash' && e.id === me && e.t >= cast.t);
    expect(dashes.some((e) => e.type === 'dash' && e.arc)).toBe(true);
    // Busy: no basic attacks from it until its last dash step is over.
    // (Only the first rampage: it can cast again later.)
    const next = r.events.find((e) => e.type === 'skill' && e.id === me && e.t > cast.t)?.t ?? Infinity;
    const lastStep = Math.max(...r.events.filter((e) => e.t < next && ((e.type === 'dash' && e.id === me) || (e.type === 'effect' && e.effect === 'rampage'))).map((e) => e.t));
    expect(r.events.some((e) => e.type === 'attack' && e.id === me && e.t > cast.t && e.t < lastStep)).toBe(false);
    // Still targetable: it takes hits during the rampage.
    expect(r.events.some((e) => e.type === 'attack' && e.target === me && e.t > cast.t && e.t < lastStep)).toBe(true);
    // ...but gains no mana from them.
    const during = r.events.filter((e) => e.type === 'attack' && e.target === me && e.t > cast.t && e.t < lastStep);
    expect(during.every((e) => e.type === 'attack' && e.targetMana === 0)).toBe(true);
  });
});

describe('Gloom Volley', () => {
  test('Ginger has hand-set stats per star, range 4, 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.ginger, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([1705, 2070, 5525]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([110, 165, 220]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([110, 165, 220]);
    expect([UNIT_BY_ID.ginger.name, UNIT_BY_ID.ginger.range, UNIT_BY_ID.ginger.mana]).toEqual(['Ginger', 4, 30]);
  });

  test('5 rapid shots at the target, each the same, as basic attacks', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 1 }, { x: 5, y: 1 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.ginger, star);
      b.cast('gloomvolley');
      expect(b.log.busy).toEqual([true]);
      expect(b.log.repeats[0]).toMatchObject({ seconds: GLOOM_VOLLEY.every, times: GLOOM_VOLLEY.shots });
      for (let i = 0; i < GLOOM_VOLLEY.shots; i++) b.log.repeats[0].fn();
      expect(b.log.busy).toEqual([true, false]);
      expect(b.log.hits.every((h) => h.target === 1 && h.basic && h.effect === 'gloomvolley')).toBe(true);
      expect(b.log.hits.map((h) => h.raw)).toEqual(Array(5).fill(b.caster.stats.atk * GLOOM_VOLLEY.shot[star - 1]));
    }
  });

  test('when the target falls, the rest go to the nearest enemy', () => {
    const b = fakeBattle([{ x: 3, y: 1 }, { x: 3, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.ginger, 1);
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

  test('Mia has hand-set stats per star, range 4, 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.mia, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([1705, 3070, 5520]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([110, 165, 220]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([110, 165, 220]);
    expect([UNIT_BY_ID.mia.name, UNIT_BY_ID.mia.range, UNIT_BY_ID.mia.mana]).toEqual(['Mia', 4, 30]);
  });

  test('in combat: the passive hastes itself and the allies directly left and right of it, for the whole fight', () => {
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
    // Board: row 0 is the front. Mia at column 3 of row 1 (cell 10).
    a.board[10] = { uid: 1, defId: 'mia', star: 1 };
    a.board[9] = { uid: 2, defId: 'footman', star: 1 }; // left
    a.board[11] = { uid: 3, defId: 'knight', star: 1 }; // right
    a.board[3] = { uid: 4, defId: 'archer', star: 1 }; // in front: no
    a.board[17] = { uid: 5, defId: 'imp', star: 1 }; // behind: no
    a.board[2] = { uid: 6, defId: 'paladin', star: 1 }; // diagonal: no
    b.board[3] = { uid: 7, defId: 'titan', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const hasted = r.events.filter((e) => e.type === 'buff' && e.t === 0 && e.effect === 'pyreaura').map((e) => (e.type === 'buff' ? r.fighters[e.id].defId : ''));
    expect(hasted.sort()).toEqual(['footman', 'knight', 'mia']);
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
    a.board[3] = { uid: 1, defId: 'mia', star: 3 };
    b.board[3] = { uid: 2, defId: 'titan', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'mia')!.id;
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
  test('Wan has hand-set stats per star, range 4, 20 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.wan, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2170, 3905, 7380]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([140, 210, 280]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([140, 210, 280]);
    expect([UNIT_BY_ID.wan.name, UNIT_BY_ID.wan.range, UNIT_BY_ID.wan.mana]).toEqual(['Wan', 4, 20]);
  });

  test('every ranged hero has range 4, except Melina (12), Cici and Alice (2)', () => {
    const special: Record<string, number> = { melina: 12, cici: 2, alice: 2 };
    // Heroes only: not summons, nor the Elder Drake (a boss).
    const heroes = UNITS.filter((d) => !d.summon && d.id !== 'elderdrake' && (d.range > 1 || d.id in special));
    for (const u of heroes) expect([u.id, u.range]).toEqual([u.id, special[u.id] ?? 4]);
  });

  test('an enhanced attack on its target, then the same damage to every enemy around the target', () => {
    for (const star of [1, 3] as const) {
      // Target (3,2); (4,2) and (3,3) beside it; (3,5) far away.
      const b = fakeBattle([{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 5 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.wan, star);
      b.cast('dragonlance');
      const raw = b.caster.stats.atk * DRAGON_LANCE.atk[star - 1];
      expect(b.log.hits[0]).toEqual({ target: 1, raw, effect: 'dragonlance', basic: true });
      const blast = b.log.hits.slice(1);
      expect(blast.map((h) => h.target).sort()).toEqual([2, 3]);
      expect(blast.every((h) => h.raw === raw && h.effect === 'dragonlanceblast' && !h.basic)).toBe(true);
    }
  });

  test('a target the hit kills still explodes', () => {
    const b = fakeBattle([{ x: 3, y: 2 }, { x: 4, y: 2 }]);
    b.fragile.add(1);
    b.cast('dragonlance');
    expect(b.log.hits.filter((h) => h.effect === 'dragonlanceblast').map((h) => h.target)).toEqual([2]);
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
    b.caster.stats = unitStats(UNIT_BY_ID.kari, 1);
    for (let i = 0; i < 4; i++) b.onHit('commandersmark');
    b.onHit('commandersmark', b.enemies[1]); // a different target: its own count
    expect(b.log.hits).toEqual([]);
    b.onHit('commandersmark');
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * COMMANDERS_MARK.burst[0], effect: 'markburst', basic: false }]);
    // The count starts over.
    for (let i = 0; i < 4; i++) b.onHit('commandersmark');
    expect(b.log.hits).toHaveLength(1);
  });

  test('Kari has hand-set stats per star, range 4, 40 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.kari, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3100, 5580, 13795]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([155, 235, 405]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([155, 235, 405]);
    expect([UNIT_BY_ID.kari.name, UNIT_BY_ID.kari.range, UNIT_BY_ID.kari.mana]).toEqual(['Kari', 4, 40]);
  });

  test('active: attack speed and attack for 5s, and marks explode at 4 while it lasts', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.kari, 2);
    b.caster.star = 2;
    b.cast('commandersmark');
    const bonus = Math.round(b.caster.stats.atk * COMMANDERS_MARK.atk[1]);
    expect(b.log.buffs).toEqual([
      {
        target: 0,
        mods: [
          { stat: 'attackSpeed', add: COMMANDERS_MARK.attackSpeed[1] },
          { stat: 'atk', add: bonus },
        ],
        seconds: COMMANDERS_MARK.seconds,
        effect: 'commandersmark',
      },
    ]);
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
    a.board[17] = { uid: 1, defId: 'kari', star: 1 };
    a.board[3] = { uid: 2, defId: 'knight', star: 3 };
    b.board[3] = { uid: 3, defId: 'paladin', star: 3 };
    const r = simulateCombat({ rng: 2 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'kari')!.id;
    const firstBurst = r.events.find((e) => e.type === 'effect' && e.effect === 'markburst');
    if (!firstBurst) throw new Error('no burst');
    const hitsBefore = r.events.filter((e) => e.type === 'attack' && e.id === me && e.t <= firstBurst.t);
    expect(hitsBefore).toHaveLength(COMMANDERS_MARK.marks);
  });
});

describe('Polar Barrage', () => {
  test('Irina has hand-set stats per star, faster at 3 stars, range 4', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.irina, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3350, 6025, 14900]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([165, 250, 370]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([165, 250, 370]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([75, 75, 70]);
    expect([1, 2, 3].map((s) => at(s as Star).attackTicks)).toEqual([12, 12, 10]);
    expect(UNIT_BY_ID.irina.range).toBe(4);
  });

  test('hits the 3x1 row around its target, then enhances its next 3 attacks (whole attacks, not shots)', () => {
    // Target at (3,1); enemies beside it at (2,1) and (4,1); one behind at (3,0) is out of the row.
    const b = fakeBattle([{ x: 3, y: 1 }, { x: 2, y: 1 }, { x: 4, y: 1 }, { x: 3, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.irina, 1);
    const volley = () => SKILLS.polarbarrage.volley!(b.caster);
    expect(volley()).toEqual({ shots: 3, power: POLAR_BARRAGE.shot });
    b.cast('polarbarrage');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * POLAR_BARRAGE.area[0] && !h.basic)).toBe(true);
    for (let n = 0; n < 3; n++) {
      expect(volley()).toEqual({ shots: 3, power: POLAR_BARRAGE.enhanced[0] / 3 });
      b.afterAttack('polarbarrage');
    }
    expect(volley()).toEqual({ shots: 3, power: POLAR_BARRAGE.shot });
  });

  test('in combat: every attack is 3 shots (mana once per attack); 3 enhanced attacks after each cast', () => {
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
    a.board[17] = { uid: 1, defId: 'irina', star: 2 };
    a.board[3] = { uid: 2, defId: 'knight', star: 3 };
    b.board[3] = { uid: 3, defId: 'titan', star: 3 };
    const r = simulateCombat({ rng: 3 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'irina')!.id;
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me);
    if (!cast) throw new Error('no cast');
    const shots = r.events.filter((e) => e.type === 'attack' && e.id === me);
    // Shots come in threes, all on the same tick.
    const ticks = new Map<number, number>();
    for (const e of shots) ticks.set(e.t, (ticks.get(e.t) ?? 0) + 1);
    expect([...ticks.values()].every((n) => n === 3)).toBe(true);
    // 75 mana at 10 per attack: the cast comes on the 8th attack, not after 3 attacks' worth of shots.
    expect(new Set(shots.filter((e) => e.t < cast.t).map((e) => e.t)).size).toBe(8);
    const plain = shots.filter((e) => e.type === 'attack' && e.t < cast.t && !e.crit).pop();
    const after = [...new Set(shots.filter((e) => e.t > cast.t).map((e) => e.t))];
    if (plain?.type !== 'attack') throw new Error('no attack before');
    const at = (t: number) => shots.find((e) => e.t === t && e.type === 'attack' && !e.crit);
    const dmg = after.map((t) => { const e = at(t); return e?.type === 'attack' ? e.damage : 0; });
    // The titan's armor doesn't change in between (no shred here), so enhanced shots are simply bigger.
    expect(dmg.slice(0, 3).every((d) => d > plain.damage * 3)).toBe(true);
    expect(dmg[3]).toBe(plain.damage);
  });
});

describe('Spirit Archers', () => {
  test('Melina has hand-set stats per star, range 12, 20 mana, Deadeye attack speed', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.melina, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3365, 6415, 44205]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([220, 330, 705]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([220, 330, 705]);
    expect([UNIT_BY_ID.melina.range, UNIT_BY_ID.melina.mana, UNIT_BY_ID.melina.attackTicks]).toEqual([12, 20, 12]);
  });

  test('every Deadeye attacks about 0.8 times a second', () => {
    for (const u of UNITS.filter((d) => d.traits.includes('deadeye'))) expect([u.id, u.attackTicks]).toEqual([u.id, 12]);
  });

  test('passive: attack speed for the whole fight', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.caster.star = 3;
    b.atStart('spiritarchers');
    expect(b.log.buffs).toEqual([{ target: 0, mods: [{ stat: 'attackSpeed', add: SPIRIT_ARCHERS.attackSpeed[2] }], seconds: Infinity, effect: 'spiritarchers' }]);
  });

  test('active: 1/2/6 spirits beside its target, each landing with a blast, each gone after 6s; recasts top up', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 1 }, { x: 4, y: 1 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.melina, star);
      b.cast('spiritarchers');
      const n = SPIRIT_ARCHERS.count[star - 1];
      expect(b.log.summons).toHaveLength(n);
      expect(b.log.summons.every((m) => m.skill.mirror === SPIRIT_ARCHERS.mirror[star - 1])).toBe(true);
      const blasts = b.log.hits.filter((h) => h.effect === 'spiritlanding');
      expect(blasts.length).toBeGreaterThanOrEqual(n); // the target is beside every spirit
      expect(blasts.every((h) => h.raw === b.caster.stats.atk * SPIRIT_ARCHERS.landing[star - 1] && !h.basic)).toBe(true);
      expect(b.log.repeats.map((r) => [r.seconds, r.times])).toEqual(Array(n).fill([SPIRIT_ARCHERS.seconds, 1]));
      // One falls early: the next cast brings back just that one.
      b.log.summons[0].hp = 0;
      b.cast('spiritarchers');
      expect(b.log.summons).toHaveLength(n + 1);
      // Time's up for all of them.
      for (const r of b.log.repeats) r.fn();
      expect(b.log.summons.every((m) => m.hp <= 0)).toBe(true);
    }
  });

  test('in combat: spirits repeat each of its attacks on the same target, crits included, then vanish', () => {
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
    a.board[17] = { uid: 1, defId: 'melina', star: 1 };
    a.board[3] = { uid: 2, defId: 'knight', star: 3 };
    // Deadeye crit chance via a second Deadeye, so crits show up.
    a.board[16] = { uid: 3, defId: 'ginger', star: 1 };
    b.board[3] = { uid: 4, defId: 'titan', star: 3 };
    b.board[4] = { uid: 5, defId: 'paladin', star: 3 };
    const r = simulateCombat({ rng: 5 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'melina')!.id;
    const summons = r.events.filter((e) => e.type === 'summon');
    expect(summons.length).toBeGreaterThan(0);
    const spirits = new Set(summons.map((e) => (e.type === 'summon' ? e.fighter.id : -1)));
    expect(r.events.some((e) => e.type === 'effect' && e.effect === 'spiritlanding')).toBe(true);
    // Every spirit shot follows one of Melina's, same tick, same target, same crit.
    const attacks = r.events.filter((e) => e.type === 'attack');
    for (const s of attacks) {
      if (s.type !== 'attack' || !spirits.has(s.id)) continue;
      const lead = attacks.find((x) => x.type === 'attack' && x.id === me && x.t === s.t && x.target === s.target);
      expect(lead).toBeDefined();
      expect(lead?.type === 'attack' && !!lead.crit).toBe(!!s.crit);
    }
    expect(attacks.some((s) => s.type === 'attack' && spirits.has(s.id))).toBe(true);
    // Spirits never act on their own: no moves, no casts.
    expect(r.events.some((e) => (e.type === 'move' || e.type === 'skill' || e.type === 'cast') && spirits.has(e.id))).toBe(false);
    // Each is gone within 6s of landing (sooner if killed or Melina fell).
    const sixSeconds = SPIRIT_ARCHERS.seconds * TICKS_PER_SECOND;
    for (const e of summons) {
      if (e.type !== 'summon') continue;
      const gone = r.events.find((x) => x.type === 'death' && x.id === e.fighter.id);
      if (gone) expect(gone.t - e.t).toBeLessThanOrEqual(sixSeconds);
      else expect(r.events[r.events.length - 1].t - e.t).toBeLessThan(sixSeconds);
    }
    expect(r.survivors.every((f) => !spirits.has(f.id))).toBe(true);
  });
});

describe('Sapping Touch', () => {
  test('Phove has hand-set stats per star, melee, 50 mana, 0.65 attacks a second', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.phove, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2030, 3655, 6575]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([105, 160, 210]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([105, 160, 210]);
    expect([UNIT_BY_ID.phove.name, UNIT_BY_ID.phove.range, UNIT_BY_ID.phove.mana, UNIT_BY_ID.phove.attackTicks]).toEqual(['Phove', 1, 50, 15]);
    // The enhanced attack in all: 490 / 490 / 685% of attack.
    expect(SAPPING_TOUCH.bonus.map((b) => Math.round((1 + b) * 100))).toEqual([490, 490, 685]);
  });

  test('an empowered attack, then -attack and -magic attack on the target for 4s', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.phove, star);
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
    a.board[3] = { uid: 1, defId: 'phove', star: 3 };
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
  test('Angela has hand-set stats per star, range 4, 40 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.angela, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([1705, 3070, 5525]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([90, 130, 175]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([90, 130, 175]);
    expect([UNIT_BY_ID.angela.name, UNIT_BY_ID.angela.range, UNIT_BY_ID.angela.mana]).toEqual(['Angela', 4, 40]);
  });

  test('Love Beam: 2 rows wide through its target, healing allies and hitting enemies on it', () => {
    // From (3,5) straight up at (3,1). (2,0) puts more enemies on the left, so the beam takes columns 2-3;
    // (5,0) is off it.
    const b = fakeBattle([{ x: 3, y: 1 }, { x: 2, y: 0 }, { x: 5, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.angela, 2);
    b.caster.star = 2;
    const ally: SkillFighter = { ...b.caster, id: 50, hp: 100, maxHp: 1500, x: 2, y: 4 };
    b.allies.push(ally);
    b.cast('taripenyembuh');
    const ap = b.caster.stats.ap;
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
    expect(b.log.hits.every((h) => h.raw === ap * TARI_PENYEMBUH.ap[1] && h.effect === 'lovebeam')).toBe(true);
    expect(b.log.heals).toEqual([{ target: 50, amount: ap * TARI_PENYEMBUH.heal[1] }]);
  });

  test('Love Beam leans to the side with more enemies', () => {
    const b = fakeBattle([{ x: 3, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 0 }]);
    b.cast('taripenyembuh');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
  });
});

describe('Shovel Slam', () => {
  test('Sora has hand-set stats per star, melee, 40 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.sora, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3545, 6380, 17345]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([180, 275, 410]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([180, 275, 410]);
    expect([UNIT_BY_ID.sora.name, UNIT_BY_ID.sora.range, UNIT_BY_ID.sora.mana]).toEqual(['Sora', 1, 40]);
    expect(SHOVEL_SLAM.atk).toEqual([2, 2, 10]);
  });

  test('3 slams (one on cast, two more 0.4s apart) into the 3x1 row; each hit stuns 0.5s', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.sora, 1);
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
    a.board[3] = { uid: 1, defId: 'sora', star: 2 };
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
  test('Hilos has hand-set stats per star, about 0.65 attacks/sec, melee, 60 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.hilos, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2235, 4020, 7225]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([115, 175, 230]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([115, 175, 230]);
    expect(UNIT_BY_ID.hilos.name).toBe('Hilos');
    expect([UNIT_BY_ID.hilos.range, UNIT_BY_ID.hilos.mana]).toEqual([1, 60]);
    expect(TICKS_PER_SECOND / UNIT_BY_ID.hilos.attackTicks).toBeCloseTo(0.65, 1);
  });

  test('an enhanced attack of magic attack as magic damage, then a flat shield on itself', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.hilos, star);
      b.cast('guardiansstrike');
      const i = star - 1;
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.ap * GUARDIANS_STRIKE.ap[i], effect: 'guardiansstrike', basic: true }]);
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

  test('a straight line runs through the target to the edge, at any angle', () => {
    expect(lineThrough({ x: 3, y: 5 }, { x: 3, y: 3 })).toEqual([{ x: 3, y: 4 }, { x: 3, y: 3 }, { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 3, y: 0 }]);
    expect(lineThrough({ x: 3, y: 3 }, { x: 5, y: 3 })).toEqual([{ x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }]);
    expect(lineThrough({ x: 2, y: 4 }, { x: 3, y: 3 })).toEqual([{ x: 3, y: 3 }, { x: 4, y: 2 }, { x: 5, y: 1 }, { x: 6, y: 0 }]);
    expect(lineThrough({ x: 1, y: 5 }, { x: 2, y: 2 })).toContainEqual({ x: 2, y: 2 });
    expect(lineThrough({ x: 3, y: 2 }, { x: 3, y: 1 })).toEqual([{ x: 3, y: 1 }, { x: 3, y: 0 }]);
  });

  test('Kanina has hand-set stats per star, range 4, 40 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.kanina, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2170, 3905, 7380]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([105, 155, 210]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([105, 155, 210]);
    expect([UNIT_BY_ID.kanina.name, UNIT_BY_ID.kanina.range, UNIT_BY_ID.kanina.mana]).toEqual(['Kanina', 4, 40]);
  });

  test('every Mage attacks about 0.75 times a second', () => {
    for (const u of UNITS.filter((d) => d.traits.includes('mage'))) expect([u.id, u.attackTicks]).toEqual([u.id, 13]);
  });

  test('the wave goes through her target, wherever it stands, and hits everyone in the line', () => {
    for (const star of [1, 2, 3] as const) {
      // From (3,5) toward the target at (5,3): (4,4) is on the way, (6,2) past it, (3,4) off the line.
      const b = fakeBattle([{ x: 5, y: 3 }, { x: 4, y: 4 }, { x: 6, y: 2 }, { x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.kanina, star);
      b.cast('tidalsurge');
      expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * TIDAL_SURGE.ap[star - 1] && h.effect === 'tidalsurge' && !h.basic)).toBe(true);
      expect(b.log.dashes).toEqual([]);
      expect(b.log.repeats).toEqual([]);
    }
  });

  test('a target beside her gets hit too', () => {
    const b = fakeBattle([{ x: 4, y: 5 }]);
    b.cast('tidalsurge');
    expect(b.log.hits.map((h) => h.target)).toEqual([1]);
  });
});

describe('Mist Ward', () => {
  test('Uranus has hand-set stats per star, melee, 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.uranus, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2030, 3655, 6575]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([105, 160, 210]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([105, 160, 210]);
    expect(UNIT_BY_ID.uranus.name).toBe('Uranus');
    expect([UNIT_BY_ID.uranus.range, UNIT_BY_ID.uranus.mana]).toEqual([1, 30]);
  });

  test('a flat shield on itself, nothing else', () => {
    for (const star of [1, 2, 3] as Star[]) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.star = star;
      b.cast('mistward');
      expect(b.log.shields).toEqual([{ amount: MIST_WARD.shield[star - 1], seconds: MIST_WARD.seconds }]);
      expect(b.log.shieldEnds).toEqual([null]);
      expect(b.log.hits).toEqual([]);
    }
  });

  test('in combat: it casts often', () => {
    const r = fightOf(14, [['uranus', 1, 3]], [['knight', 2, 3]]);
    const me = r.fighters.find((f) => f.defId === 'uranus')!.id;
    expect(r.events.filter((e) => e.type === 'skill' && e.id === me).length).toBeGreaterThan(2);
  });
});

describe('Misty Jab', () => {
  test('Aldo has hand-set stats per star, 0.75 attacks/sec, melee, 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.aldo, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2575, 4635, 8769]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([145, 215, 285]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([145, 215, 285]);
    expect(UNIT_BY_ID.aldo.name).toBe('Aldo');
    expect([UNIT_BY_ID.aldo.range, UNIT_BY_ID.aldo.mana]).toEqual([1, 30]);
    expect(TICKS_PER_SECOND / UNIT_BY_ID.aldo.attackTicks).toBeCloseTo(0.75, 1);
  });

  test('Misty Jab: an enhanced attack and a shield of its attack; every third cast hits harder', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.aldo, star);
      const atk = b.caster.stats.atk;
      for (let n = 0; n < 6; n++) b.cast('mistyjab');
      const i = star - 1;
      const [s, big] = [MISTY_JAB.atk[i], MISTY_JAB.bigAtk[i]];
      expect(b.log.hits.map((h) => h.raw)).toEqual([s, s, big, s, s, big].map((m) => atk * m));
      expect(b.log.hits.every((h) => h.basic && h.effect === 'mistyjab')).toBe(true);
      expect(b.log.shields).toEqual(Array.from({ length: 6 }, () => ({ amount: atk * MISTY_JAB.shield, seconds: MISTY_JAB.seconds })));
    }
  });
});

describe('shield layers', () => {
  test('a skill shield stacks on a Dauntless start shield instead of replacing it', () => {
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
    // Two Dauntless: Uranus starts with a big shield, then casts small Mist Wards on top.
    a.board[3] = { uid: 1, defId: 'uranus', star: 1 };
    a.board[17] = { uid: 2, defId: 'balman', star: 1 };
    b.board[3] = { uid: 3, defId: 'knight', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'uranus')!.id;
    const start = r.events.find((e) => e.type === 'shield' && e.id === me && e.t === 0);
    if (start?.type !== 'shield') throw new Error('no start shield');
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me)!;
    const after = r.events.filter((e) => e.type === 'shield' && e.id === me && e.t === cast.t).pop();
    if (after?.type !== 'shield') throw new Error('no ward');
    // The ward adds to what's left of the start shield.
    const left = r.events.filter((e) => e.type === 'shield' && e.id === me && e.t < cast.t).pop();
    expect(after.amount).toBe((left?.type === 'shield' ? left.amount : 0) + MIST_WARD.shield[0]);
  });
});

describe('Mist Boomerang', () => {
  test('beyond: carries on the line past the target, stopping at the edge', () => {
    expect(beyond({ x: 3, y: 5 }, { x: 5, y: 3 }, 2)).toEqual({ x: 6, y: 1 });
    expect(beyond({ x: 3, y: 5 }, { x: 3, y: 1 }, 2)).toEqual({ x: 3, y: 0 });
  });

  test('flies through its target and 2 tiles beyond, hitting everyone on the way, then again on the way back', () => {
    // From (3,5) at the target (3,3): out to (3,1). (3,4) is before it, (3,2) and (3,1) behind it; (3,0) is past the end.
    for (const star of [1, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 3, y: 0 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.nana, star);
      b.cast('mistboomerang');
      const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
      expect([by(1), by(2), by(3), by(4), by(5)]).toEqual([1, 1, 1, 1, 0]);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * MIST_BOOMERANG.out[star - 1] && h.effect === 'mistboomerang')).toBe(true);
      expect(b.log.repeats[0]).toMatchObject({ seconds: MIST_BOOMERANG.turn, times: 1 });
      b.log.repeats[0].fn();
      expect([by(1), by(2), by(3), by(4), by(5)]).toEqual([2, 2, 2, 2, 0]);
      expect(b.log.hits.slice(4).every((h) => h.raw === b.caster.stats.ap * MIST_BOOMERANG.back[star - 1])).toBe(true);
      expect(b.log.dashes).toEqual([]);
      expect(b.log.busy).toEqual([]);
    }
  });

  test('Nana has hand-set stats per star, range 4, 20 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.nana, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3565, 6415, 44202]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([185, 285, 605]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([185, 285, 605]);
    expect([UNIT_BY_ID.nana.name, UNIT_BY_ID.nana.range, UNIT_BY_ID.nana.mana]).toEqual(['Nana', 4, 20]);
  });
});

describe('Inked Strike', () => {
  test('Belle has hand-set stats per star, 0.75 attacks/sec, melee, 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.belle, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2025, 3645, 6550]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([130, 195, 260]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([130, 195, 260]);
    expect(UNIT_BY_ID.belle.name).toBe('Belle');
    expect([UNIT_BY_ID.belle.range, UNIT_BY_ID.belle.mana]).toEqual([1, 30]);
    expect(TICKS_PER_SECOND / UNIT_BY_ID.belle.attackTicks).toBeCloseTo(0.75, 1);
  });

  test('an enhanced attack of magic attack as magic damage, then heals a share of its missing hp', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.belle, star);
      b.caster.hp = 400; // of 1000: 600 missing
      b.cast('inkedstrike');
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.ap * INKED_STRIKE.ap[star - 1], effect: 'inkedstrike', basic: true }]);
      expect(b.log.heals).toEqual([{ target: 0, amount: 600 * INKED_STRIKE.heal }]);
    }
  });
});

describe('Unfolding Tale', () => {
  test('Mathilda has hand-set stats per star, range 4, 50 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.mathilda, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2170, 3905, 7380]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([105, 145, 195]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([105, 145, 195]);
    expect([UNIT_BY_ID.mathilda.name, UNIT_BY_ID.mathilda.range, UNIT_BY_ID.mathilda.mana]).toEqual(['Mathilda', 4, 50]);
  });

  test('hastes itself and its 2 nearest allies for 4s, then 3 bolts at different enemies when there are enough', () => {
    const b = fakeBattle([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.mathilda, 1);
    // Caster at (3,5): (2,5) and (4,5) are next to it; (0,5) is far.
    for (const [id, x] of [[60, 0], [61, 2], [62, 4]] as const) b.allies.push({ ...b.caster, id, x, y: 5 });
    b.cast('unfoldingtale');
    const hasted = b.log.buffs.filter((x) => x.effect === 'unfoldingtale').map((x) => x.target);
    expect(hasted[0]).toBe(0);
    expect(hasted.slice(1).sort()).toEqual([61, 62]);
    expect(b.log.buffs.every((x) => x.seconds === UNFOLDING_TALE.seconds)).toBe(true);
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
    b.caster.stats = unitStats(UNIT_BY_ID.vex, 1);
    b.cast('mythmadeflesh');
    const [beast] = b.log.summons;
    const spot = { x: beast.x, y: beast.y };
    expect(Math.max(...[1, 2, 3].map((id) => dist(spot, b.enemies[id - 1])))).toBeLessThanOrEqual(1);
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * MYTH_MADE_FLESH.landing[0])).toBe(true);
    expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.stuns.every((s) => s.seconds === MYTH_MADE_FLESH.stun[0])).toBe(true);
    expect(beast.skill.atk).toBe(b.caster.stats.ap * MYTH_MADE_FLESH.atk[0]);
    expect(beast.skill.mirror).toBeUndefined(); // a fighter, not a mirror
    expect(b.log.repeats).toEqual([]); // no aura unless protagonist
  });

  test('Vex has hand-set stats per star, range 4, 50 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.vex, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3100, 5580, 13795]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([145, 220, 325]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([145, 220, 325]);
    expect([UNIT_BY_ID.vex.name, UNIT_BY_ID.vex.range, UNIT_BY_ID.vex.mana]).toEqual(['Vex', 4, 50]);
  });

  test('as the protagonist: the landing hits harder, and the beast deals damage around it every second for 4s', () => {
    for (const star of [1, 3] as const) {
      const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.vex, star);
      b.caster.chosen = 'storyweaver';
      b.cast('mythmadeflesh');
      const ap = b.caster.stats.ap;
      const i = star - 1;
      expect(b.log.hits.map((h) => h.raw)).toEqual([1, 2].map(() => ap * (MYTH_MADE_FLESH.landing[i] + MYTH_MADE_FLESH.protagonistLanding[i])));
      expect(b.log.stuns.every((s) => s.seconds === MYTH_MADE_FLESH.stun[i])).toBe(true);
      expect(b.log.summons[0].skill.atk).toBeCloseTo(ap * MYTH_MADE_FLESH.atk[i]);
      expect(b.log.repeats[0]).toMatchObject({ seconds: 1, times: MYTH_MADE_FLESH.auraSeconds });
      b.log.hits.length = 0;
      b.log.repeats[0].fn();
      expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
      expect(b.log.hits.every((h) => h.raw === ap * MYTH_MADE_FLESH.aura[i] && h.effect === 'mythaura')).toBe(true);
    }
  });

  test('in combat: the beast lands, moves and attacks on its own, and outlives Vex', () => {
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
    a.board[17] = { uid: 1, defId: 'vex', star: 2 };
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
    const myth = r.fighters.find((f) => f.defId === 'vex')!.id;
    const dies = r.events.find((e) => e.type === 'death' && e.id === myth);
    if (dies) expect(r.events.some((e) => e.type === 'death' && e.id === beast && e.t === dies.t)).toBe(false);
  });
});

describe("Tale's End", () => {
  test('Altus has hand-set stats per star (mana too), melee', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.altus, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3770, 6785, 16775]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([175, 260, 390]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([175, 260, 390]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([60, 60, 40]);
    expect(UNIT_BY_ID.altus.name).toBe('Altus');
    expect(UNIT_BY_ID.altus.range).toBe(1);
  });

  const defBuff = (def: number) => ({
    target: 0,
    mods: [
      { stat: 'armor', add: def },
      { stat: 'mr', add: def },
    ],
    seconds: TALES_END.seconds,
    effect: 'talesend',
  });

  test('hits every enemy within 1 tile with magic attack, then gains armor and magic resist', () => {
    for (const star of [1, 2, 3] as Star[]) {
      // Around (3,5): (3,4) and (2,4) are within 1; (3,3) is 2 away.
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 3 }]);
      b.caster.stats = unitStats(UNIT_BY_ID.altus, star);
      b.caster.star = star;
      b.cast('talesend');
      const i = star - 1;
      expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * TALES_END.ap[i] && h.effect === 'talesend' && !h.basic)).toBe(true);
      expect(b.log.stuns).toEqual([]);
      expect(b.log.buffs).toEqual([defBuff(TALES_END.defense[i])]);
    }
  });

  test('as the protagonist: 2 tiles, harder hits, stuns, and more defense', () => {
    for (const star of [1, 3] as Star[]) {
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 3 }, { x: 0, y: 0 }]);
      b.caster.stats = unitStats(UNIT_BY_ID.altus, star);
      b.caster.star = star;
      b.caster.chosen = 'storyweaver';
      b.cast('talesend');
      const i = star - 1;
      expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * TALES_END.protagonistAp[i])).toBe(true);
      expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2, 3]);
      expect(b.log.stuns.every((s) => s.seconds === TALES_END.stun[i])).toBe(true);
      expect(b.log.buffs).toEqual([defBuff(TALES_END.protagonistDefense[i])]);
    }
    expect(within({ x: 3, y: 5 }, 2)).toHaveLength(14); // the board's bottom edge cuts it
  });
});

describe('Shade Bolts and Storm Flurry', () => {
  test('Harley has hand-set stats per star, range 4, 30 mana, magic attacks', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.harley, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([1705, 3070, 5520]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([90, 130, 175]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([90, 130, 175]);
    expect([UNIT_BY_ID.harley.name, UNIT_BY_ID.harley.range, UNIT_BY_ID.harley.mana, UNIT_BY_ID.harley.attackType]).toEqual(['Harley', 4, 30, 'magic']);
  });

  test('Shade Bolts: 3 equal magic bolts 0.7s apart; it keeps fighting meanwhile', () => {
    for (const star of [1, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.harley, star);
      b.cast('shadebolts');
      expect(b.log.hits).toHaveLength(1);
      expect(b.log.repeats[0]).toMatchObject({ seconds: SHADE_BOLTS.every, times: SHADE_BOLTS.hits - 1 });
      b.log.repeats[0].fn();
      b.log.repeats[0].fn();
      expect(b.log.hits).toHaveLength(3);
      expect(b.log.hits.every((h) => h.target === 1 && h.raw === b.caster.stats.ap * SHADE_BOLTS.ap[star - 1] && !h.basic)).toBe(true);
      expect(b.log.busy).toEqual([]);
    }
  });

  test('Clint has hand-set stats per star, range 4, 30 mana, about 0.8 attacks a second', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.clint, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2170, 3905, 7380]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([140, 210, 280]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([140, 210, 280]);
    expect([UNIT_BY_ID.clint.name, UNIT_BY_ID.clint.range, UNIT_BY_ID.clint.mana, UNIT_BY_ID.clint.attackTicks]).toEqual(['Clint', 4, 30, 12]);
  });

  test('Storm Flurry: 5 rapid physical shots at one target, skill hits (no item effects), never crits, busy while it lasts', () => {
    for (const star of [1, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.clint, star);
      b.cast('stormflurry');
      expect(b.log.busy).toEqual([true]);
      for (let i = 0; i < STORM_FLURRY.hits - 1; i++) b.log.repeats[0].fn();
      expect(b.log.busy).toEqual([true, false]);
      expect(b.log.hits).toHaveLength(STORM_FLURRY.hits);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * STORM_FLURRY.atk[star - 1] && !h.basic)).toBe(true);
    }
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
    a.board[17] = { uid: 1, defId: 'clint', star: 2 };
    a.board[16] = { uid: 2, defId: 'ginger', star: 1 };
    a.board[15] = { uid: 3, defId: 'mia', star: 1 };
    a.board[3] = { uid: 4, defId: 'knight', star: 3 };
    b.board[3] = { uid: 5, defId: 'paladin', star: 3 };
    b.board[4] = { uid: 6, defId: 'titan', star: 3 }; // enough to outlast a whole flurry
    const r = simulateCombat({ rng: 3 }, a, b);
    const flurry = r.events.filter((e) => e.type === 'effect' && e.effect === 'stormflurry');
    expect(flurry.length).toBeGreaterThanOrEqual(STORM_FLURRY.hits);
    expect(flurry.some((e) => e.type === 'effect' && e.crit)).toBe(false);
  });
});

describe('Gale Shot and Altar Spark', () => {
  test('Eudora has hand-set stats per star, 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.eudora, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([1550, 2790, 5020]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([80, 120, 160]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([80, 120, 160]);
    expect([UNIT_BY_ID.eudora.name, UNIT_BY_ID.eudora.mana, UNIT_BY_ID.eudora.range]).toEqual(['Eudora', 30, 4]);
  });

  test('Gale Shot: one magic lightning hit, then Weak (more damage taken) on the target', () => {
    for (const star of [1, 2, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.eudora, star);
      b.cast('galeshot');
      expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.ap * GALE_SHOT.ap[star - 1], effect: 'galeshot', basic: false }]);
      expect(b.log.buffs).toEqual([{ target: 1, mods: [{ stat: 'damageTaken', add: GALE_SHOT.weak[star - 1] }], seconds: GALE_SHOT.seconds, effect: 'weak' }]);
    }
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
    a.board[3] = { uid: 1, defId: 'eudora', star: 3 };
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

  test('Luo Yi has hand-set stats per star, 20 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.luoyi, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([1705, 3070, 5520]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([90, 130, 175]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([90, 130, 175]);
    expect([UNIT_BY_ID.luoyi.name, UNIT_BY_ID.luoyi.mana, UNIT_BY_ID.luoyi.range]).toEqual(['Luo Yi', 20, 4]);
  });

  test('the cone behind a target opens away from the caster: 3 wide, then 5', () => {
    const cells = coneBehind({ x: 3, y: 5 }, { x: 3, y: 3 }).map((p) => `${p.x},${p.y}`);
    expect(cells).toEqual(['2,2', '3,2', '4,2', '1,1', '2,1', '3,1', '4,1', '5,1']);
    // Mostly sideways: the cone opens sideways.
    expect(coneBehind({ x: 0, y: 3 }, { x: 3, y: 2 }, 1).map((p) => `${p.x},${p.y}`)).toEqual(['4,1', '4,2', '4,3']);
  });

  test('Altar Spark: the target and every enemy in the cone behind it, magic', () => {
    for (const star of [1, 3] as const) {
      // Caster (3,5) → target (3,3). Cone: (2..4, 2) and (1..5, 1). (3,4) is in front: no. (0,1) is outside.
      const b = fakeBattle([{ x: 3, y: 3 }, { x: 4, y: 2 }, { x: 1, y: 1 }, { x: 3, y: 4 }, { x: 0, y: 1 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.luoyi, star);
      b.cast('altarspark');
      expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * ALTAR_SPARK.ap[star - 1] && h.effect === 'altarspark')).toBe(true);
    }
  });
});

describe('Mage skills', () => {
  test('Val has hand-set stats per star, range 4, 20 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.val, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([1550, 2790, 5020]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([80, 120, 160]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([80, 120, 160]);
    expect([UNIT_BY_ID.val.name, UNIT_BY_ID.val.range, UNIT_BY_ID.val.mana]).toEqual(['Val', 4, 20]);
  });

  test('Grave Whisper passive: mana to itself and the allies directly left and right, not front, back or farther', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.caster.star = 2;
    // Caster at (3,5): (2,5) and (4,5) are left and right; (3,4) is in front; (0,5) is far.
    b.allies.push({ ...b.caster, id: 70, x: 2, y: 5 }, { ...b.caster, id: 71, x: 4, y: 5 }, { ...b.caster, id: 72, x: 3, y: 4 }, { ...b.caster, id: 73, x: 0, y: 5 });
    b.atStart('gravewhisper');
    expect(b.log.mana.map((m) => m.target).sort((x, y) => x - y)).toEqual([0, 70, 71]);
    expect(b.log.mana.every((m) => m.amount === GRAVE_WHISPER.mana[1])).toBe(true);
  });

  test('Grave Whisper active: a magic 3x1 row', () => {
    for (const star of [1, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 1 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.val, star);
      b.cast('gravewhisper');
      expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * GRAVE_WHISPER.ap[star - 1])).toBe(true);
    }
  });

  test('Zhuxin has hand-set stats per star, range 4, 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.zhuxin, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([1705, 3070, 5520]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([90, 130, 175]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([90, 130, 175]);
    expect([UNIT_BY_ID.zhuxin.name, UNIT_BY_ID.zhuxin.range, UNIT_BY_ID.zhuxin.mana]).toEqual(['Zhuxin', 4, 30]);
  });

  test('Ash Storm: a 3x3 fire around its target for 2s, 0.5s ticks', () => {
    for (const star of [1, 3] as const) {
      const b = fakeBattle([{ x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.zhuxin, star);
      b.cast('ashstorm');
      expect(b.log.burns).toHaveLength(1);
      expect(b.log.burns[0].cells).toHaveLength(9);
      expect(b.log.burns[0].seconds).toBe(ASH_STORM.seconds);
      // Each 0.5s tick deals half the per-second amount: the skill's per-tick number.
      expect(b.log.burns[0].perSecond / 2).toBeCloseTo(b.caster.stats.ap * ASH_STORM.ap[star - 1]);
    }
  });

  test('Gourd has hand-set stats per star, range 4, 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.gourd, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3100, 5580, 13795]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([130, 200, 295]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([130, 200, 295]);
    expect([UNIT_BY_ID.gourd.name, UNIT_BY_ID.gourd.range, UNIT_BY_ID.gourd.mana]).toEqual(['Gourd', 4, 30]);
  });

  test('Ether Beam: 12 ticks along the line through its target, hitting everyone on it each tick', () => {
    for (const star of [1, 3] as const) {
      // From (3,5) up through (3,2): (3,3) and (3,0) are on the line too; (2,2) isn't.
      const b = fakeBattle([{ x: 3, y: 2 }, { x: 3, y: 0 }, { x: 2, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.gourd, star);
      b.cast('etherbeam');
      expect(b.log.busy).toEqual([true]);
      for (let i = 0; i < ETHER_BEAM.ticks - 1; i++) b.log.repeats[0].fn();
      expect(b.log.busy).toEqual([true, false]);
      const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
      expect([by(1), by(2), by(3)]).toEqual([12, 12, 0]);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * ETHER_BEAM.ap[star - 1])).toBe(true);
    }
  });

  test('Ether Beam hits a target off the 8 directions (a knight-move away), every tick', () => {
    // From (3,5), (4,2) is 1 across and 3 up: not straight or diagonal.
    const b = fakeBattle([{ x: 4, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.gourd, 1);
    b.cast('etherbeam');
    for (let i = 0; i < ETHER_BEAM.ticks - 1; i++) b.log.repeats[0].fn();
    expect(b.log.hits.filter((h) => h.target === 1)).toHaveLength(ETHER_BEAM.ticks);
  });

  test('Ether Beam follows its target when it moves, and turns to the nearest enemy when it dies', () => {
    const b = fakeBattle([{ x: 3, y: 2 }, { x: 0, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.gourd, 1);
    b.cast('etherbeam');
    const [first, second] = b.enemies;
    first.x = 6; // it steps aside: the beam swings after it
    b.log.repeats[0].fn();
    expect(b.log.hits.at(-1)!.target).toBe(1);
    first.hp = 0; // it falls: the beam turns to the other enemy
    b.log.repeats[0].fn();
    expect(b.log.hits.at(-1)!.target).toBe(2);
    expect(second.hp).toBeGreaterThan(0);
  });
});

describe('Starward', () => {
  test('Minos has hand-set stats per star, about 0.65 attacks/sec, melee, 60 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.minos, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2030, 3655, 6575]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([105, 160, 210]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([105, 160, 210]);
    expect(UNIT_BY_ID.minos.name).toBe('Minos');
    expect([UNIT_BY_ID.minos.range, UNIT_BY_ID.minos.mana]).toEqual([1, 60]);
    expect(TICKS_PER_SECOND / UNIT_BY_ID.minos.attackTicks).toBeCloseTo(0.65, 1);
  });

  test('passive: flat whole-fight shields on itself and the allies directly left and right', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.caster.star = 2;
    // Caster at (3,5): (2,5) and (4,5) flank it; (3,4) is in front, not beside.
    b.allies.push({ ...b.caster, id: 70, x: 2, y: 5, maxHp: 800 }, { ...b.caster, id: 71, x: 4, y: 5, maxHp: 1200 }, { ...b.caster, id: 72, x: 3, y: 4 });
    b.atStart('starward');
    expect(b.log.shieldTargets.sort((x, y) => x - y)).toEqual([b.caster.id, 70, 71]);
    expect(b.log.shields.map((s) => s.amount)).toEqual([0, 1, 2].map(() => STARWARD.shield[1]));
    expect(b.log.shields.every((s) => s.seconds >= MAX_COMBAT_TICKS / TICKS_PER_SECOND)).toBe(true);
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
    // Uranus + Balman = Dauntless 2: Uranus starts shielded; Minos beside it adds more.
    a.board[3] = { uid: 1, defId: 'minos', star: 1 };
    a.board[4] = { uid: 2, defId: 'uranus', star: 1 };
    a.board[17] = { uid: 3, defId: 'balman', star: 1 };
    b.board[3] = { uid: 4, defId: 'knight', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const haze = r.fighters.find((f) => f.defId === 'uranus')!;
    const shields = r.events.filter((e) => e.type === 'shield' && e.id === haze.id && e.t === 0);
    const last = shields[shields.length - 1];
    expect(last?.type === 'shield' && last.amount).toBe(Math.round(haze.maxHp * DAUNTLESS.shield(1, true)) + STARWARD.shield[0]);
  });
});

describe('Comet Lunge and Zodiac Slam', () => {
  test('Martin has hand-set stats per star, melee, 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.martin, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2185, 3935, 7075]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([120, 180, 240]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([120, 180, 240]);
    expect(UNIT_BY_ID.martin.name).toBe('Martin');
    expect([UNIT_BY_ID.martin.range, UNIT_BY_ID.martin.mana]).toEqual([1, 30]);
  });

  test('every Weapon Master attacks about 0.75 times a second, except Dauntless ones (0.65)', () => {
    const units = Object.values(UNIT_BY_ID).filter((u) => u.traits.includes('weaponmaster'));
    expect(units.length).toBeGreaterThan(0);
    for (const u of units) expect([u.id, TICKS_PER_SECOND / u.attackTicks]).toEqual([u.id, expect.closeTo(u.traits.includes('dauntless') ? 0.65 : 0.75, 1)]);
  });

  test('Comet Lunge: an empowered hit of 400% / 400% / 500% attack, then a max-hp shield', () => {
    for (const star of [1, 2, 3] as Star[]) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.martin, star);
      b.cast('cometlunge');
      expect(b.log.hits).toHaveLength(1);
      expect(b.log.hits[0].raw).toBeCloseTo(b.caster.stats.atk * [4, 4, 5][star - 1]);
      expect(b.log.hits[0].basic).toBe(true);
      expect(b.log.buffs).toEqual([]);
      expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * 0.1, seconds: COMET_LUNGE.seconds }]);
    }
  });

  test('Hilman has hand-set stats per star, melee, 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.hilman, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3295, 5935, 11210]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([135, 205, 275]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([135, 205, 275]);
    expect(UNIT_BY_ID.hilman.name).toBe('Hilman');
    expect([UNIT_BY_ID.hilman.range, UNIT_BY_ID.hilman.mana]).toEqual([1, 30]);
  });

  test('every Dauntless unit attacks about 0.65 times a second', () => {
    const units = Object.values(UNIT_BY_ID).filter((u) => u.traits.includes('dauntless'));
    expect(units.length).toBeGreaterThan(0);
    for (const u of units) expect(TICKS_PER_SECOND / u.attackTicks).toBeCloseTo(0.65, 1);
  });

  test('Zodiac Slam: slashes the 3 tiles in front of it, toward its target, then shields by max hp', () => {
    for (const star of [1, 3] as Star[]) {
      // Caster at (3,5), target at (3,4): (3,4), (2,4) are in front; (3,3) is two away; (2,5) is beside it.
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 3 }, { x: 2, y: 5 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.hilman, star);
      b.cast('zodiacslam');
      const i = star - 1;
      expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * ZODIAC_SLAM.atk[i] && !h.basic)).toBe(true);
      expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * ZODIAC_SLAM.shield[i], seconds: ZODIAC_SLAM.seconds }]);
    }
    // A target to its right turns the slash sideways: (4,4), (4,5) are in front then.
    const side = fakeBattle([{ x: 4, y: 5 }, { x: 4, y: 4 }, { x: 3, y: 4 }]);
    side.caster.stats = unitStats(UNIT_BY_ID.hilman, 1);
    side.cast('zodiacslam');
    expect(side.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
  });

  test('in combat: the lunge lands; the slam shields by max hp', () => {
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
    a.board[3] = { uid: 1, defId: 'martin', star: 2 };
    a.board[4] = { uid: 2, defId: 'hilman', star: 2 };
    b.board[3] = { uid: 3, defId: 'paladin', star: 2 };
    b.board[4] = { uid: 4, defId: 'paladin', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    expect(r.events.some((e) => e.type === 'effect' && e.effect === 'cometlunge')).toBe(true);
    const blade = r.fighters.find((f) => f.defId === 'hilman')!;
    const slams = r.events.filter((e) => e.type === 'effect' && e.effect === 'zodiacslam');
    expect(slams.length).toBeGreaterThan(0);
    const shield = r.events.find((e) => e.type === 'shield' && e.id === blade.id && e.t === slams[0].t);
    expect(shield?.type === 'shield' && shield.amount).toBeGreaterThanOrEqual(Math.round(blade.maxHp * ZODIAC_SLAM.shield[1]));
  });
});

describe('Thunder Whirl and Puppet Snare', () => {
  test('Balman has hand-set stats per star, melee, 60 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.balman, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2235, 4020, 7225]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([115, 175, 230]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([115, 175, 230]);
    expect(UNIT_BY_ID.balman.name).toBe('Balman');
    expect([UNIT_BY_ID.balman.range, UNIT_BY_ID.balman.mana]).toEqual([1, 60]);
  });

  test('Thunder Whirl: armor and magic resist for the whirl, then 12 pulses 0.25s apart around itself', () => {
    for (const star of [1, 3] as Star[]) {
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.balman, star);
      b.cast('thunderwhirl');
      const i = star - 1;
      const def = THUNDER_WHIRL.defense[i];
      expect(b.log.buffs).toEqual([
        {
          target: 0,
          mods: [
            { stat: 'armor', add: def },
            { stat: 'mr', add: def },
          ],
          seconds: THUNDER_WHIRL.pulses * THUNDER_WHIRL.every,
          effect: 'thunderwhirl',
        },
      ]);
      expect(b.log.repeats[0]).toMatchObject({ seconds: THUNDER_WHIRL.every, times: THUNDER_WHIRL.pulses - 1 });
      for (let n = 1; n < THUNDER_WHIRL.pulses; n++) b.log.repeats[0].fn();
      const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
      expect([by(1), by(2), by(3)]).toEqual([THUNDER_WHIRL.pulses, THUNDER_WHIRL.pulses, 0]);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * THUNDER_WHIRL.atk[i])).toBe(true);
    }
  });

  test('Frank has hand-set stats per star, melee, 80 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.frank, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3065, 5525, 10440]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([135, 205, 275]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([135, 205, 275]);
    expect([UNIT_BY_ID.frank.range, UNIT_BY_ID.frank.mana]).toEqual([1, 80]);
  });

  test('Puppet Snare: hooks and drags the farthest enemy, shields itself, then slams everyone around it', () => {
    for (const star of [1, 3] as Star[]) {
      // From (3,5): the farthest is (0,0); one already beside it at (3,4); (5,3) stays out of reach.
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 5, y: 3 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.frank, star);
      b.cast('puppetsnare');
      const i = star - 1;
      const atk = b.caster.stats.atk;
      expect(b.log.hits[0]).toEqual({ target: 2, raw: atk * PUPPET_SNARE.hook[i], effect: 'puppetsnare', basic: false });
      expect(b.log.dashes).toHaveLength(1);
      expect(dist(b.enemies[1], b.caster)).toBe(1); // it was pulled in
      expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * PUPPET_SNARE.shield[i], seconds: PUPPET_SNARE.seconds }]);
      const slam = b.log.hits.slice(1);
      expect(slam.map((h) => h.target).sort()).toEqual([1, 2]);
      expect(slam.every((h) => h.raw === atk * PUPPET_SNARE.slam[i] && h.effect === 'puppetsnareslam')).toBe(true);
    }
  });

  test('Puppet Snare: a hook that kills drags nothing; the shield and slam still come', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 0, y: 0 }]);
    b.fragile.add(2);
    b.caster.stats = unitStats(UNIT_BY_ID.frank, 1);
    b.cast('puppetsnare');
    expect(b.log.dashes).toEqual([]);
    expect(b.log.shields).toHaveLength(1);
    expect(b.log.hits.filter((h) => h.effect === 'puppetsnareslam').map((h) => h.target)).toEqual([1]);
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

  test('Lola has hand-set stats per star (mana too), melee', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.lola, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([4070, 7330, 18115]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([175, 260, 390]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([175, 260, 390]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([60, 60, 40]);
    expect(UNIT_BY_ID.lola.name).toBe('Lola');
    expect(UNIT_BY_ID.lola.range).toBe(1);
  });

  test('the cone ahead opens out from her toward her target: 3 wide, then 5', () => {
    expect(coneAhead({ x: 3, y: 5 }, { x: 3, y: 1 }).map((p) => `${p.x},${p.y}`)).toEqual(['2,4', '3,4', '4,4', '1,3', '2,3', '3,3', '4,3', '5,3']);
    // A target off to the side: it opens sideways.
    expect(coneAhead({ x: 3, y: 3 }, { x: 0, y: 2 }, 1).map((p) => `${p.x},${p.y}`)).toEqual(['2,2', '2,3', '2,4']);
  });

  test('Pyre Blast: smashes the cone toward her target for attack plus her max hp, stuns, then shields herself', () => {
    for (const star of [1, 3] as Star[]) {
      // Caster at (3,5), target (3,4): (3,4) and (1,3) are in the cone; (3,2) is too far; (4,5) is beside.
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 1, y: 3 }, { x: 3, y: 2 }, { x: 4, y: 5 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.lola, star);
      b.cast('pyreblast');
      const i = star - 1;
      const raw = b.caster.stats.atk * PYRE_BLAST.atk[i] + b.caster.maxHp * PYRE_BLAST.hp[i];
      expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
      expect(b.log.hits.every((h) => h.raw === raw && !h.basic)).toBe(true);
      expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2]);
      expect(b.log.stuns.every((s) => s.seconds === PYRE_BLAST.stun[i])).toBe(true);
      expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * PYRE_BLAST.shield[i], seconds: PYRE_BLAST.seconds }]);
    }
  });

  test('Alice has hand-set stats per star (mana too), range 2 with frontline defenses', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.alice, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3990, 7180, 53760]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([230, 345, 740]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([230, 345, 740]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([60, 60, 20]);
    expect(UNIT_BY_ID.alice.name).toBe('Alice');
    expect([UNIT_BY_ID.alice.range, UNIT_BY_ID.alice.armor, UNIT_BY_ID.alice.mr]).toEqual([2, 36, 36]);
  });

  test('Dread Descent: curses the area around her target, then leaps into the densest spot, hits, stuns and heals', () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }, { x: 0, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.alice, 1);
    b.cast('dreaddescent');
    // The curse: her target's tile and the 8 around it (on the board), 50% of magic attack per 0.5s.
    expect(b.log.burns).toHaveLength(1);
    expect(b.log.burns[0].cells).toContain('5,0');
    expect(b.log.burns[0].perSecond).toBeCloseTo(b.caster.stats.ap * DREAD_DESCENT.dot[0] * 2);
    expect(b.log.burns[0].seconds).toBe(DREAD_DESCENT.dotSeconds);
    // Nothing else until the curse runs out.
    expect(b.log.dashes).toHaveLength(0);
    expect(b.log.repeats.map((r) => [r.seconds, r.times])).toEqual([[DREAD_DESCENT.dotSeconds, 1]]);
    b.log.repeats[0].fn();
    expect(b.log.dashes).toHaveLength(1);
    const raw = b.caster.stats.ap * DREAD_DESCENT.ap[0] + b.caster.maxHp * DREAD_DESCENT.hp[0];
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.hits.every((h) => h.raw === raw && !h.basic)).toBe(true);
    expect(b.log.stuns.map((s) => [s.target, s.seconds]).sort()).toEqual([1, 2, 3].map((t) => [t, DREAD_DESCENT.stun]));
    expect(b.log.heals).toEqual([{ target: 0, amount: raw * 3 * DREAD_DESCENT.heal[0] }]);
  });

  test('Dread Descent at 3 stars: she leaps to the middle of the board, and the landing hits every enemy', () => {
    const b = fakeBattle([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 6, y: 0 }]); // far from the middle
    b.caster.stats = unitStats(UNIT_BY_ID.alice, 3);
    b.caster.star = 3;
    b.cast('dreaddescent');
    b.log.repeats[0].fn();
    expect(b.log.dashes).toHaveLength(1);
    const to = b.log.dashes[0];
    expect(Math.abs(to.x - (GRID_W - 1) / 2)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(to.y - (GRID_H - 1) / 2)).toBeLessThanOrEqual(0.5);
    const raw = b.caster.stats.ap * DREAD_DESCENT.ap[2] + b.caster.maxHp * DREAD_DESCENT.hp[2];
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3, 4]);
    expect(b.log.hits.every((h) => h.raw === raw)).toBe(true);
    expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2, 3, 4]);
    expect(b.log.heals).toEqual([{ target: 0, amount: raw * 4 * DREAD_DESCENT.heal[2] }]);
  });
});

describe('Weapon Master skills', () => {
  test('Cici has hand-set stats per star, range 2 (backline defenses), 30 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.cici, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([1985, 3575, 6435]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([110, 165, 220]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([110, 165, 220]);
    expect(UNIT_BY_ID.cici.name).toBe('Cici');
    expect([UNIT_BY_ID.cici.range, UNIT_BY_ID.cici.mana, UNIT_BY_ID.cici.armor, UNIT_BY_ID.cici.mr]).toEqual([2, 30, 24, 24]);
  });

  test('Kindle Twice: two enhanced basic hits on its target, no lifesteal', () => {
    for (const star of [1, 3] as Star[]) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.cici, star);
      b.cast('kindletwice');
      expect(b.log.hits).toEqual([0, 1].map(() => ({ target: 1, raw: b.caster.stats.atk * KINDLE_TWICE.power[star - 1], effect: 'kindletwice', basic: true })));
      expect(b.log.buffs).toEqual([]);
    }
  });

  test('Suyu has hand-set stats per star, melee, 40 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.suyu, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3830, 6890, 17030]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([195, 295, 410]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([195, 295, 410]);
    expect(UNIT_BY_ID.suyu.name).toBe('Suyu');
    expect([UNIT_BY_ID.suyu.range, UNIT_BY_ID.suyu.mana]).toEqual([1, 40]);
  });

  test('Drake Rend: two slashes then a bigger finisher on the 3x1 row; the finisher heals by attack', () => {
    for (const star of [1, 3] as Star[]) {
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 4, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.suyu, star);
      b.cast('drakerend');
      expect(b.log.busy).toEqual([true]);
      expect(b.log.heals).toEqual([]);
      b.log.repeats[0].fn();
      b.log.repeats[0].fn();
      expect(b.log.busy).toEqual([true, false]);
      const i = star - 1;
      const atk = b.caster.stats.atk;
      const [s, f] = [atk * DRAKE_REND.slash[i], atk * DRAKE_REND.finisher[i]];
      expect(b.log.hits.map((h) => h.raw)).toEqual([s, s, s, s, f, f]);
      expect(b.log.heals).toEqual([{ target: 0, amount: atk * DRAKE_REND.heal[i] }]);
      expect(b.log.buffs).toEqual([]);
    }
  });

  test('Zhizong has hand-set stats per star, melee, 60 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.zhizong, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3830, 6890, 17030]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([180, 275, 410]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([180, 275, 410]);
    expect(UNIT_BY_ID.zhizong.name).toBe('Zhizong');
    expect([UNIT_BY_ID.zhizong.range, UNIT_BY_ID.zhizong.mana]).toEqual([1, 60]);
  });

  test('in combat: the finisher heals Suyu', () => {
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
    a.board[3] = { uid: 1, defId: 'suyu', star: 2 };
    b.board[3] = { uid: 2, defId: 'paladin', star: 2 };
    b.board[4] = { uid: 3, defId: 'knight', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'suyu')!.id;
    const fin = r.events.findIndex((e) => e.type === 'effect' && e.effect === 'drakerendfinisher');
    if (fin < 0) throw new Error('no finisher');
    expect(r.events.slice(fin, fin + 4).some((e) => e.type === 'heal' && e.id === me)).toBe(true);
  });
});

describe('Sky Reap', () => {
  // One whole attack: its hits (2 with a Fighter hit-again), then the attack's end.
  const swing = (b: ReturnType<typeof fakeBattle>, hits = 1) => {
    for (let n = 0; n < hits; n++) b.onHit('skyreap');
    b.afterAttack('skyreap');
  };

  test('passive: three plain attacks, then an empowered one that hits harder and heals (its hit-again too)', () => {
    for (const star of [1, 3] as Star[]) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.zhizong, star);
      const extras = () => b.log.hits.filter((h) => h.effect === 'skyreap').length;
      swing(b);
      swing(b);
      swing(b);
      expect([extras(), b.log.heals.length]).toEqual([0, 0]);
      swing(b, 2);
      expect([extras(), b.log.heals.length]).toEqual([2, 2]);
      const i = star - 1;
      expect(b.log.hits.every((h) => h.basic && h.raw === b.caster.stats.atk * SKY_REAP.empowered[i])).toBe(true);
      expect(b.log.heals.every((h) => h.target === 0 && h.amount === b.caster.stats.atk * SKY_REAP.heal[i])).toBe(true);
      // And the cycle starts over.
      swing(b);
      swing(b);
      swing(b);
      expect(extras()).toBe(2);
      swing(b);
      expect(extras()).toBe(3);
    }
  });

  test('active: +60% attack speed for 6s, and every third attack is empowered meanwhile', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.zhizong, 2);
    b.caster.star = 2;
    b.cast('skyreap');
    expect(b.log.buffs).toEqual([{ target: 0, mods: [{ stat: 'attackSpeed', add: SKY_REAP.attackSpeed }], seconds: SKY_REAP.seconds, effect: 'skyreap' }]);
    const seen: number[] = [];
    for (let n = 0; n < 6; n++) {
      swing(b);
      seen.push(b.log.hits.length);
    }
    expect(seen).toEqual([0, 0, 1, 1, 1, 2]);
  });

  test('active mid-count: two plain attacks already in, the next one is empowered', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.zhizong, 1);
    swing(b);
    swing(b);
    b.cast('skyreap');
    swing(b);
    expect(b.log.hits).toHaveLength(1);
  });

  test('in combat: empowered hits land on the same tick as the attack they ride on', () => {
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
    a.board[3] = { uid: 1, defId: 'zhizong', star: 2 };
    b.board[3] = { uid: 2, defId: 'paladin', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'zhizong')!.id;
    const extra = r.events.filter((e) => e.type === 'effect' && e.effect === 'skyreap');
    expect(extra.length).toBeGreaterThan(0);
    for (const e of extra) expect(r.events.some((x) => x.type === 'attack' && x.id === me && x.t === e.t)).toBe(true);
  });
});

describe('Undying Fury', () => {
  test('Thamar has hand-set stats per star (mana too), melee', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.thamar, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([4685, 8435, 58115]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([240, 365, 775]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([240, 365, 775]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([30, 30, 20]);
    expect(UNIT_BY_ID.thamar.name).toBe('Thamar');
    expect(UNIT_BY_ID.thamar.range).toBe(1);
  });

  test('passive: three plain attacks, then an empowered one (its hit-again too), and again', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.thamar, 1);
    const attack = (hits = 1) => {
      for (let n = 0; n < hits; n++) b.onHit('undyingfury');
      b.afterAttack('undyingfury');
    };
    const extras = () => b.log.hits.filter((h) => h.effect === 'undyingfuryhit').length;
    attack();
    attack();
    attack();
    expect(extras()).toBe(0);
    attack(2); // the 4th attack, with a Fighter hit-again: both hits are empowered
    expect(extras()).toBe(2);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * UNDYING_FURY.empowered[0] && h.basic)).toBe(true);
    attack();
    attack();
    attack();
    expect(extras()).toBe(2);
    attack();
    expect(extras()).toBe(3);
  });

  test('active: leaps into the densest spot and slams, then rages: attack speed and a physical aura for 4s', () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }, { x: 0, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.thamar, 1);
    b.cast('undyingfury');
    expect(b.log.dashes).toHaveLength(1);
    const slam = b.log.hits.filter((h) => h.effect === 'undyingfury');
    expect(slam.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(slam.every((h) => h.raw === b.caster.stats.atk * UNDYING_FURY.slam[0] && !h.basic)).toBe(true);
    expect(b.log.buffs).toEqual([{ target: 0, mods: [{ stat: 'attackSpeed', add: UNDYING_FURY.attackSpeed[0] }], seconds: UNDYING_FURY.seconds, effect: 'undyingfury' }]);
    expect(b.log.repeats[0]).toMatchObject({ seconds: UNDYING_FURY.every, times: 8 });
    for (let n = 0; n < 8; n++) b.log.repeats[0].fn();
    const aura = b.log.hits.filter((h) => h.effect === 'undyingfuryaura');
    const by = (id: number) => aura.filter((h) => h.target === id).length;
    expect([by(1), by(2), by(3), by(4)]).toEqual([8, 8, 8, 0]);
    expect(aura.every((h) => h.raw === b.caster.stats.atk * UNDYING_FURY.aura[0])).toBe(true);
  });

  test('active at 3 stars: leaps to the middle of the board, and the slam hits every enemy', () => {
    const b = fakeBattle([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 6, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.thamar, 3);
    b.caster.star = 3;
    b.cast('undyingfury');
    const to = b.log.dashes[0];
    expect(Math.abs(to.x - (GRID_W - 1) / 2)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(to.y - (GRID_H - 1) / 2)).toBeLessThanOrEqual(0.5);
    const slam = b.log.hits.filter((h) => h.effect === 'undyingfury');
    expect(slam.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(slam.every((h) => h.raw === b.caster.stats.atk * UNDYING_FURY.slam[2])).toBe(true);
  });

  test('in combat: the empowered attacks and the aura both land', () => {
    const r = fightOf(23, [['thamar', 2, 3]], [['titan', 2, 3], ['paladin', 2, 4]]);
    expect(r.events.some((e) => e.type === 'effect' && e.effect === 'undyingfuryhit')).toBe(true);
    expect(r.events.some((e) => e.type === 'effect' && e.effect === 'undyingfuryaura')).toBe(true);
  });
});

describe('Defender skills', () => {
  test('Edith has hand-set stats per star, melee, 60 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.edith, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2615, 4705, 8890]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([135, 205, 275]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([135, 205, 275]);
    expect(UNIT_BY_ID.edith.name).toBe('Edith');
    expect([UNIT_BY_ID.edith.range, UNIT_BY_ID.edith.mana]).toEqual([1, 60]);
  });

  test('Ashen Wall: knocks up the 3x3 ahead (damage and a stun), then shields itself', () => {
    for (const star of [1, 3] as Star[]) {
      // Caster at (3,5) facing up: (3,4), (2,2) are in the 3x3 ahead; (3,1) is too far, (0,4) to the side.
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 2 }, { x: 3, y: 1 }, { x: 0, y: 4 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.edith, star);
      b.cast('ashenwall');
      const i = star - 1;
      expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
      expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * ASHEN_WALL.atk[i] && !h.basic)).toBe(true);
      expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2]);
      expect(b.log.stuns.every((s) => s.seconds === ASHEN_WALL.stun[i])).toBe(true);
      expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * ASHEN_WALL.shield[i], seconds: ASHEN_WALL.seconds }]);
    }
  });

  test('Tig has hand-set stats per star, melee, 50 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.tig, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2615, 4705, 8890]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([135, 205, 275]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([135, 205, 275]);
    expect(UNIT_BY_ID.tig.name).toBe('Tig');
    expect([UNIT_BY_ID.tig.range, UNIT_BY_ID.tig.mana]).toEqual([1, 50]);
  });

  test('every Defender attacks about 0.65 times a second', () => {
    const defenders = Object.values(UNIT_BY_ID).filter((u) => u.traits.includes('defender'));
    expect(defenders.length).toBeGreaterThan(0);
    for (const u of defenders) expect(TICKS_PER_SECOND / u.attackTicks).toBeCloseTo(0.65, 1);
  });

  test('Crypt Seal: shields first, then slams everyone around it, stunning them', () => {
    for (const star of [1, 3] as Star[]) {
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.tig, star);
      b.cast('cryptseal');
      const i = star - 1;
      expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * CRYPT_SEAL.shield[i], seconds: CRYPT_SEAL.seconds }]);
      const byTarget = <T extends { target: number }>(xs: T[]) => [...xs].sort((x, y) => x.target - y.target);
      expect(byTarget(b.log.hits).map((h) => [h.target, h.raw])).toEqual([1, 2].map((t) => [t, b.caster.stats.atk * CRYPT_SEAL.atk[i]]));
      expect(byTarget(b.log.stuns)).toEqual([1, 2].map((target) => ({ target, seconds: CRYPT_SEAL.stun[i] })));
    }
  });

  test('Balia has hand-set stats per star (mana too), melee', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.balia, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([4250, 7650, 52685]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([230, 345, 740]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([230, 345, 740]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([60, 60, 20]);
    expect(UNIT_BY_ID.balia.name).toBe('Balia');
    expect(UNIT_BY_ID.balia.range).toBe(1);
  });

  test("Dragon's Dominion passive: Lava Shields on itself and both sides at the start, once: they explode when broken, and don't come back", () => {
    const b = fakeBattle([{ x: 2, y: 4 }, { x: 0, y: 0 }]);
    b.caster.maxHp = 2000;
    b.caster.stats = unitStats(UNIT_BY_ID.balia, 1);
    // Caster at (3,5): (2,5) and (4,5) are beside it; (6,5) isn't.
    b.allies.push({ ...b.caster, id: 70, x: 2, y: 5 }, { ...b.caster, id: 71, x: 4, y: 5 }, { ...b.caster, id: 72, x: 6, y: 5 });
    b.atStart('dragonsdominion');
    expect(b.log.shieldTargets.sort((x, y) => x - y)).toEqual([0, 70, 71]);
    expect(b.log.shields.every((s) => s.amount === 2000 * DRAGONS_DOMINION.lava[0] && s.seconds >= MAX_COMBAT_TICKS / TICKS_PER_SECOND)).toBe(true);
    // The shield on the ally at (2,5) breaks: the enemy at (2,4) is beside it, the one at (0,0) isn't.
    const at = b.log.shieldTargets.indexOf(70);
    b.log.shieldEnds[at]!();
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.ap * DRAGONS_DOMINION.explode[0], effect: 'lavashield', basic: false }]);
    // ...and no new shield.
    expect(b.log.shields).toHaveLength(3);
    // Balia gone: another shield breaking doesn't explode.
    b.caster.hp = 0;
    b.log.shieldEnds[b.log.shieldTargets.indexOf(71)]!();
    expect(b.log.hits).toHaveLength(1);
  });

  test("Dragon's Dominion active: lands among the enemy, hits by magic attack plus max hp, and taunts", () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }]);
    b.caster.maxHp = 2000;
    b.caster.stats = unitStats(UNIT_BY_ID.balia, 1);
    b.cast('dragonsdominion');
    expect(b.log.dashes).toHaveLength(1);
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.ap * DRAGONS_DOMINION.ap[0] + 2000 * DRAGONS_DOMINION.hp[0])).toBe(true);
    expect(b.log.taunts.map((x) => [x.target, x.by, x.seconds]).sort()).toEqual([1, 2, 3].map((id) => [id, 0, DRAGONS_DOMINION.taunt]));
    expect(b.log.shields).toEqual([]);
  });

  test('in combat: a broken Lava Shield explodes on the enemies around its holder', () => {
    const r = fightOf(11, [['balia', 1, 3], ['knight', 1, 4]], [['paladin', 3, 3], ['paladin', 3, 4], ['titan', 3, 2]]);
    expect(r.events.some((e) => e.type === 'effect' && e.effect === 'lavashield')).toBe(true);
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
    a.board[3] = { uid: 1, defId: 'balia', star: 2 };
    a.board[4] = { uid: 2, defId: 'knight', star: 2 };
    a.board[2] = { uid: 3, defId: 'knight', star: 2 };
    b.board[2] = { uid: 4, defId: 'paladin', star: 2 };
    b.board[3] = { uid: 5, defId: 'paladin', star: 2 };
    b.board[4] = { uid: 6, defId: 'paladin', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const dragon = r.fighters.find((f) => f.defId === 'balia')!.id;
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
  test('Dyroth has hand-set stats per star, 0.75 attacks/sec, melee, 20 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.dyroth, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([1840, 3310, 5960]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([110, 165, 220]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([110, 165, 220]);
    expect([UNIT_BY_ID.dyroth.range, UNIT_BY_ID.dyroth.mana]).toEqual([1, 20]);
    expect(TICKS_PER_SECOND / UNIT_BY_ID.dyroth.attackTicks).toBeCloseTo(0.75, 1);
  });

  test("Prajurit's Oath: hybrid lifesteal for itself and the allies directly left and right; active is an empowered attack that heals", () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.dyroth, 1);
    b.allies.push({ ...b.caster, id: 70, x: 2, y: 5 }, { ...b.caster, id: 71, x: 4, y: 5 }, { ...b.caster, id: 72, x: 3, y: 4 }, { ...b.caster, id: 73, x: 5, y: 5 });
    b.atStart('prajuritsoath');
    expect(b.log.buffs.map((x) => x.target).sort((x, y) => x - y)).toEqual([0, 70, 71]);
    expect(b.log.buffs[0].mods).toEqual([
      { stat: 'lifesteal', add: PRAJURITS_OATH.lifesteal },
      { stat: 'spellLifesteal', add: PRAJURITS_OATH.lifesteal },
    ]);
    expect(b.log.buffs[0].seconds).toBe(Infinity);
    for (const star of [1, 3] as Star[]) {
      const c = fakeBattle([{ x: 3, y: 4 }]);
      c.caster.stats = unitStats(UNIT_BY_ID.dyroth, star);
      c.caster.star = star;
      c.cast('prajuritsoath');
      const total = star === 3 ? 3.6 : 2.7;
      expect(c.log.hits).toHaveLength(1);
      expect(c.log.hits[0].raw).toBeCloseTo(c.caster.stats.atk * total);
      expect(c.log.hits[0].basic).toBe(true);
      expect(c.log.heals).toEqual([{ target: 0, amount: c.caster.maxHp * 0.05 }]);
    }
  });

  test('Phantom Step: dashes beside its target, strikes, stuns it and shields itself', () => {
    const b = fakeBattle([{ x: 3, y: 1 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.pacquiao, 2);
    b.caster.star = 2;
    b.cast('phantomstep');
    expect(b.log.dashes).toHaveLength(1);
    expect(dist(b.log.dashes[0], { x: 3, y: 1 })).toBe(1);
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * PHANTOM_STEP.atk[1], effect: 'phantomstep', basic: false }]);
    expect(b.log.stuns).toEqual([{ target: 1, seconds: PHANTOM_STEP.stun[1] }]);
    expect(b.log.shields).toEqual([{ amount: b.caster.maxHp * PHANTOM_STEP.shield[1], seconds: PHANTOM_STEP.seconds }]);
  });

  test('Yang has hand-set stats per star, 0.75 attacks/sec, melee, 50 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.yang, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3545, 6380, 15770]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([160, 275, 410]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([160, 275, 410]);
    expect(UNIT_BY_ID.yang.name).toBe('Yang');
    expect(UNIT_BY_ID.yang.range).toBe(1);
    expect(UNIT_BY_ID.yang.mana).toBe(50);
    expect(TICKS_PER_SECOND / UNIT_BY_ID.yang.attackTicks).toBeCloseTo(0.75, 1);
  });

  test('Pacquiao has hand-set stats per star, 0.75 attacks/sec, melee, 60 mana', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.pacquiao, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2370, 4265, 8060]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([145, 215, 285]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([145, 215, 285]);
    expect(UNIT_BY_ID.pacquiao.name).toBe('Pacquiao');
    expect([UNIT_BY_ID.pacquiao.range, UNIT_BY_ID.pacquiao.mana]).toEqual([1, 60]);
    expect(TICKS_PER_SECOND / UNIT_BY_ID.pacquiao.attackTicks).toBeCloseTo(0.75, 1);
  });

  test('Wyrm Frenzy: attack speed and a few empowered attacks that heal on every hit, hit-agains included', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.yang, 1);
    const atk = b.caster.stats.atk;
    b.cast('wyrmfrenzy');
    expect(b.log.hits).toEqual([]);
    expect(b.log.buffs).toEqual([
      {
        target: 0,
        mods: [
          { stat: 'attackSpeed', add: WYRM_FRENZY.attackSpeed[0] },
          { stat: 'atk', add: Math.round(atk * WYRM_FRENZY.bonus[0]) },
        ],
        seconds: Infinity,
        effect: 'wyrmfrenzy',
      },
    ]);
    // First attack: a hit plus a Fighter hit-again, both heal, one attack used up.
    b.onHit('wyrmfrenzy');
    b.onHit('wyrmfrenzy');
    b.afterAttack('wyrmfrenzy');
    expect(b.log.heals).toEqual([0, 1].map(() => ({ target: 0, amount: atk * WYRM_FRENZY.heal[0] })));
    expect(b.log.unbuffs).toEqual([]);
    for (let n = 1; n < WYRM_FRENZY.attacks[0]; n++) {
      b.onHit('wyrmfrenzy');
      b.afterAttack('wyrmfrenzy');
    }
    expect(b.log.heals).toHaveLength(WYRM_FRENZY.attacks[0] + 1);
    expect(b.log.unbuffs).toEqual(['wyrmfrenzy']);
    // Spent: plain attacks again.
    b.onHit('wyrmfrenzy');
    b.afterAttack('wyrmfrenzy');
    expect(b.log.heals).toHaveLength(WYRM_FRENZY.attacks[0] + 1);
  });

  test('Wyrm Frenzy in a real fight: the frenzy ends after its empowered attacks', () => {
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
    a.board[3] = { uid: 1, defId: 'yang', star: 1 };
    b.board[3] = { uid: 2, defId: 'paladin', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'yang')!.id;
    const cast = r.events.find((e) => e.type === 'skill' && e.id === me);
    expect(cast).toBeDefined();
    const after = r.events.flatMap((e) => (e.t > cast!.t && e.type === 'attack' && e.id === me && !e.again && !e.crit ? [e.damage] : []));
    // The empowered attacks hit harder than the plain ones after them.
    const n = WYRM_FRENZY.attacks[0];
    expect(after.length).toBeGreaterThan(n);
    expect(after[0]).toBeGreaterThan(after[n]);
  });

  test('Balang has hand-set stats per star (mana too), 0.75 attacks/sec, melee', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.balang, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([4075, 7335, 50535]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([215, 320, 680]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([215, 320, 680]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([50, 50, 20]);
    expect(UNIT_BY_ID.balang.range).toBe(1);
    expect(UNIT_BY_ID.balang.name).toBe('Balang');
    expect(TICKS_PER_SECOND / UNIT_BY_ID.balang.attackTicks).toBeCloseTo(0.75, 1);
  });
});

const fightOf = (seed: number, mine: [defId: string, star: Star, cell: number][], theirs: [defId: string, star: Star, cell: number][]) => {
  const state = createGame(seed, [
    { id: 'a', name: 'A', isBot: false },
    { id: 'b', name: 'B', isBot: false },
  ]);
  const [a, b] = state.players;
  for (const p of state.players) {
    p.board.fill(null);
    p.bench.fill(null);
    p.items = [];
  }
  let uid = 0;
  for (const [defId, star, cell] of mine) a.board[cell] = { uid: ++uid, defId, star };
  for (const [defId, star, cell] of theirs) b.board[cell] = { uid: ++uid, defId, star };
  return simulateCombat({ rng: seed }, a, b);
};

describe('Storm Fists', () => {
  test('passive: a chance to strike back at whoever hits it, for a share of its attack (rolled from the fight randomness)', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.attacked('stormfists'); // the fake roll is always 0: under any chance
    expect(b.log.hits).toEqual([{ target: 1, raw: b.caster.stats.atk * STORM_FISTS.counterPower, effect: 'stormfists', basic: true }]);
    expect(b.log.rolls).toEqual([1000]);
  });

  test('passive: more attack and damage all fight; only the 3-star turns into a turret', () => {
    for (const star of [1, 2, 3] as Star[]) {
      const b = fakeBattle([{ x: 3, y: 4 }]);
      b.caster.stats = unitStats(UNIT_BY_ID.balang, star);
      b.caster.star = star;
      b.atStart('stormfists');
      expect(b.log.buffs).toEqual([
        {
          target: 0,
          mods: [
            { stat: 'atk', add: Math.round(b.caster.stats.atk * STORM_FISTS.atk[star - 1]) },
            { stat: 'damageAmp', add: STORM_FISTS.damageAmp[star - 1] },
          ],
          seconds: Infinity,
          effect: 'stormfists',
        },
      ]);
      expect(b.log.stances).toEqual(star === 3 ? [{ rooted: true, noBasic: true }] : []);
      expect(b.log.repeats.map((r) => r.seconds)).toEqual(star === 3 ? [STORM_FISTS.jabEvery] : []);
    }
  });

  test('3-star turret: jabs a random enemy on a timer', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 0, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.balang, 3);
    b.caster.star = 3;
    b.atStart('stormfists');
    b.log.repeats[0].fn();
    b.log.repeats[0].fn();
    expect(b.log.hits).toEqual([0, 1].map(() => ({ target: 1, raw: b.caster.stats.atk * STORM_FISTS.jabPower, effect: 'stormfists', basic: true })));
  });

  test('active (1-2 star): channeled punches into the 3-wide strip ahead, immune to crowd control, busy meanwhile', () => {
    // Caster at (3,5) facing up: (3,4) and (2,0) are in the strip; (6,2) isn't.
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 0 }, { x: 6, y: 2 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.balang, 1);
    b.cast('stormfists');
    expect(b.log.busy).toEqual([true]);
    expect(b.log.immune).toHaveLength(1);
    expect(b.log.immune[0]).toBeGreaterThanOrEqual((STORM_FISTS.punches - 1) * STORM_FISTS.every);
    for (let n = 0; n < STORM_FISTS.punches - 1; n++) b.log.repeats[0].fn();
    expect(b.log.busy).toEqual([true, false]);
    const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
    expect([by(1), by(2), by(3)]).toEqual([STORM_FISTS.punches, STORM_FISTS.punches, 0]);
    expect(b.log.hits.every((h) => h.basic && h.raw === b.caster.stats.atk * STORM_FISTS.power)).toBe(true);
  });

  test('it punches toward its target: a target to the side turns the strip sideways', () => {
    // Caster at (3,5); its target at (5,5) is to the right: the strip runs right, rows 4-5 (6 is off the board).
    const b = fakeBattle([{ x: 5, y: 5 }, { x: 6, y: 4 }, { x: 3, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.balang, 1);
    b.cast('stormfists');
    const by = (id: number) => b.log.hits.filter((h) => h.target === id).length;
    expect([by(1), by(2), by(3)]).toEqual([1, 1, 0]);
    expect(facingStrip({ x: 3, y: 5 }, { x: 5, y: 5 })).toHaveLength(6); // 3 columns x 2 rows on the board
  });

  test('active (3 star): a combo of full attacks on one random enemy', () => {
    const b = fakeBattle([{ x: 3, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.balang, 3);
    b.caster.star = 3;
    b.cast('stormfists');
    expect(b.log.repeats.map((r) => [r.seconds, r.times])).toEqual([[STORM_FISTS.comboSeconds / (STORM_FISTS.comboHits - 1), STORM_FISTS.comboHits - 1]]);
    for (let n = 1; n < STORM_FISTS.comboHits; n++) b.log.repeats[0].fn();
    expect(b.log.attacks).toEqual(Array.from({ length: STORM_FISTS.comboHits }, () => ({ by: 0, target: 1, mult: STORM_FISTS.comboPower })));
    expect(b.log.immune).toEqual([]);
  });

  test('in combat: it counters ranged attackers too, from across the board', () => {
    const r = fightOf(26, [['balang', 2, 3]], [['archer', 3, 17], ['knight', 3, 3]]); // archer: back row, range 4
    const lord = r.fighters.find((f) => f.defId === 'balang')!.id;
    const archer = r.fighters.find((f) => f.defId === 'archer')!.id;
    const shots = r.events.filter((e) => e.type === 'attack' && e.id === archer && e.target === lord);
    const counters = r.events.filter((e) => e.type === 'effect' && e.effect === 'stormfists' && e.by === lord && e.target === archer && shots.some((s) => s.t === e.t));
    expect(shots.length).toBeGreaterThan(0);
    expect(counters.length).toBeGreaterThan(0);
  });

  test('in combat at 3 stars: it never walks or basic-attacks; it jabs a far-away enemy on a timer', () => {
    const r = fightOf(7, [['balang', 3, 3]], [['archer', 1, 17]]); // out of its reach, across the board
    const lord = r.fighters.find((f) => f.defId === 'balang')!.id;
    expect(r.events.some((e) => (e.type === 'move' || e.type === 'dash') && e.id === lord)).toBe(false);
    expect(r.events.some((e) => e.type === 'attack' && e.id === lord)).toBe(false);
    expect(r.events.filter((e) => e.type === 'effect' && e.effect === 'stormfists' && e.by === lord).length).toBeGreaterThan(0);
    expect(r.winner).toBe(0);
  });

  test('in combat: crowd control does not land during the channel', () => {
    const r = fightOf(3, [['balang', 2, 3]], [['pacquiao', 2, 3], ['pacquiao', 2, 4]]); // Pacquiao stuns
    const lord = r.fighters.find((f) => f.defId === 'balang')!.id;
    const casts = r.events.filter((e) => e.type === 'skill' && e.id === lord).map((e) => e.t);
    const stuns = r.events.filter((e) => e.type === 'stun' && e.id === lord).map((e) => e.t);
    expect(casts.length).toBeGreaterThan(0);
    expect(stuns.length).toBeGreaterThan(0);
    const channel = Math.ceil((STORM_FISTS.punches - 1) * STORM_FISTS.every * TICKS_PER_SECOND);
    for (const at of stuns) expect(casts.some((c) => at >= c && at <= c + channel)).toBe(false);
  });
});

describe("Wanderer's Volley", () => {
  test('Moscow, the glass cannon: low HP, high attack per star (mana: 50 / 50 / 20), range 4', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.moscow, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([2900, 5220, 35960]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([265, 400, 850]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([50, 50, 20]);
    expect([UNIT_BY_ID.moscow.range, UNIT_BY_ID.moscow.attackTicks]).toEqual([4, 12]);
  });

  test('a 3-wide projectile through its target to the edge, hitting everyone in its path', () => {
    // From (3,5), target (3,4) straight up: (2,1), (4,0) are in the path too; (0,2) and (6,0) aren't.
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 2, y: 1 }, { x: 4, y: 0 }, { x: 0, y: 2 }, { x: 6, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.moscow, 1);
    b.cast('wanderersvolley');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.hits.every((h) => h.raw === b.caster.stats.atk * WANDERERS_VOLLEY.atk[0] && !h.basic)).toBe(true);
  });

  test('aims at its target wherever it is: off to the side, or at an odd angle', () => {
    // Target (6,3): 3 right and 2 up, a mostly-sideways line. (3,5)'s column straight ahead is empty.
    const side = fakeBattle([{ x: 6, y: 3 }, { x: 3, y: 1 }]);
    side.caster.stats = unitStats(UNIT_BY_ID.moscow, 1);
    side.cast('wanderersvolley');
    expect(side.log.hits.map((h) => h.target)).toEqual([1]);
    // Target (5,1): 2 right and 4 up. Neighbours across the line get hit too; (0,0) far off it doesn't.
    const odd = fakeBattle([{ x: 5, y: 1 }, { x: 4, y: 2 }, { x: 0, y: 0 }]);
    odd.caster.stats = unitStats(UNIT_BY_ID.moscow, 1);
    odd.cast('wanderersvolley');
    expect(odd.log.hits.map((h) => h.target).sort()).toEqual([1, 2]);
  });

  test('wideLine always holds the target and is 3 wide across the line', () => {
    for (const to of [{ x: 6, y: 3 }, { x: 5, y: 1 }, { x: 0, y: 0 }, { x: 4, y: 2 }]) {
      expect(wideLine({ x: 3, y: 5 }, to).some((c) => c.x === to.x && c.y === to.y)).toBe(true);
    }
    // Straight up from (3,5): columns 2-4, rows 4 down to 0.
    expect(wideLine({ x: 3, y: 5 }, { x: 3, y: 4 })).toHaveLength(15);
    // 2 wide: columns 2-3, or 3-4 shifted.
    expect([...new Set(wideLine({ x: 3, y: 5 }, { x: 3, y: 4 }, 2).map((c) => c.x))].sort()).toEqual([2, 3]);
    expect([...new Set(wideLine({ x: 3, y: 5 }, { x: 3, y: 4 }, 2, 1).map((c) => c.x))].sort()).toEqual([3, 4]);
  });
});

describe('Meteor Fist', () => {
  test('Gatotkaca, the bruiser: more HP, less attack per star (mana too), melee, 0.75 attacks a second', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.gatotkaca, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([4300, 7740, 53320]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([190, 285, 610]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([190, 285, 610]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([50, 50, 20]);
    expect([UNIT_BY_ID.gatotkaca.name, UNIT_BY_ID.gatotkaca.range, UNIT_BY_ID.gatotkaca.attackTicks]).toEqual(['Gatotkaca', 1, 13]);
  });

  test('leaps into the densest spot, stuns everyone around, charges the next attack and heals', () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }, { x: 0, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.gatotkaca, 1);
    b.cast('bladedescent');
    expect(b.log.dashes).toHaveLength(1);
    expect(b.log.stuns.map((s) => s.target).sort()).toEqual([1, 2, 3]);
    expect(b.log.stuns.every((s) => s.seconds === BLADE_DESCENT.stun[0])).toBe(true);
    expect(b.log.hits).toEqual([]);
    expect(b.log.buffs).toEqual([{ target: 0, mods: [{ stat: 'basicAmp', add: BLADE_DESCENT.bonus[0] }], seconds: Infinity, effect: 'bladecharged' }]);
    expect(b.log.heals).toEqual([{ target: 0, amount: b.caster.maxHp * BLADE_DESCENT.heal[0] }]);
    expect(b.log.shields).toEqual([]);
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
    a.board[3] = { uid: 1, defId: 'gatotkaca', star: 1 };
    b.board[3] = { uid: 2, defId: 'titan', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'gatotkaca')!.id;
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
  test('Cyborg, the tank: the most HP, the least attack per star (mana: 40 / 40 / 20), melee, 0.65 attacks a second', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.cyborg, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([4900, 8820, 60760]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([170, 255, 545]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([40, 40, 20]);
    expect([UNIT_BY_ID.cyborg.name, UNIT_BY_ID.cyborg.range, UNIT_BY_ID.cyborg.attackTicks]).toEqual(['Cyborg', 1, 15]);
  });

  test('lands in the densest spot: tick, tick, tick, boom on that fixed area', () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }, { x: 0, y: 4 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.cyborg, 1);
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
  test('Novaria, the support: sturdy for the backline, the lowest attack (mana: 50 / 50 / 20), range 4, magic attacks', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.novaria, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3500, 6300, 43400]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([150, 225, 480]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([50, 50, 20]);
    expect([UNIT_BY_ID.novaria.name, UNIT_BY_ID.novaria.range, UNIT_BY_ID.novaria.attackType]).toEqual(['Novaria', 4, 'magic']);
  });

  test('passive: links 2 / 3 / 5 enemies by star', () => {
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
    b.caster.stats = unitStats(UNIT_BY_ID.novaria, 1);
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
    a.board[17] = { uid: 1, defId: 'novaria', star: 3 };
    a.board[3] = { uid: 2, defId: 'knight', star: 3 };
    b.board[2] = { uid: 3, defId: 'paladin', star: 2 };
    b.board[3] = { uid: 4, defId: 'paladin', star: 2 };
    b.board[4] = { uid: 5, defId: 'paladin', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const link = r.events.find((e) => e.type === 'link');
    if (link?.type !== 'link') throw new Error('no link');
    expect(link.ids).toHaveLength(3); // 3 stars links up to 4: here, all 3 enemies
    const knight = r.fighters.find((f) => f.defId === 'knight')!.id;
    const hit = r.events.findIndex((e) => e.type === 'attack' && e.id === knight && link.ids.includes(e.target));
    const first = r.events[hit];
    if (first?.type !== 'attack') throw new Error('no hit on a linked enemy');
    const spill = r.events.slice(hit + 1, hit + 4).filter((e) => e.type === 'effect' && e.effect === 'fatelink');
    expect(spill).toHaveLength(2);
    for (const e of spill) if (e.type === 'effect') expect(Math.abs(e.damage - first.damage * FATE_THREAD.share[2])).toBeLessThanOrEqual(1);
  });
});

describe('Southern Tide', () => {
  test('Roro, a Mage Plane Wanderer: hand-set stats per star (mana: 50 / 50 / 20), range 4, magic attacks', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.roro, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3300, 5940, 40920]);
    expect([1, 2, 3].map((s) => at(s as Star).ap)).toEqual([170, 255, 545]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([50, 50, 20]);
    expect([UNIT_BY_ID.roro.traits, UNIT_BY_ID.roro.range, UNIT_BY_ID.roro.attackType, UNIT_BY_ID.roro.freeSlot]).toEqual([['mage'], 4, 'magic', true]);
  });

  test('a 3-wide wave toward her target: damages and stuns enemies in it, heals allies in it', () => {
    // Caster (3,5), target straight up (3,3): the strip is columns 2-4 from row 4 up. (2,1) is in it, (6,3) isn't.
    const b = fakeBattle([{ x: 3, y: 3 }, { x: 2, y: 1 }, { x: 6, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.roro, 1);
    const ally = { ...b.caster, id: 9, x: 4, y: 4, skill: {} };
    const behind = { ...b.caster, id: 10, x: 3, y: 6, skill: {} };
    b.allies.push(ally, behind);
    b.cast('southerntide');
    const ap = b.caster.stats.ap;
    expect(b.log.hits).toEqual([1, 2].map((target) => ({ target, raw: ap * SOUTHERN_TIDE.ap[0], effect: 'southerntide', basic: false })));
    expect(b.log.stuns).toEqual([1, 2].map((target) => ({ target, seconds: SOUTHERN_TIDE.stun[0] })));
    expect(b.log.heals).toEqual([{ target: 9, amount: ap * SOUTHERN_TIDE.heal[0] }]);
  });

  test('passive: each cast makes the later tides stronger, up to the cap', () => {
    const b = fakeBattle([{ x: 3, y: 3 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.roro, 1);
    for (let n = 0; n < SOUTHERN_TIDE.maxGrow + 2; n++) b.cast('southerntide');
    const base = b.caster.stats.ap * SOUTHERN_TIDE.ap[0];
    const rises = b.log.hits.map((h) => +(h.raw / base).toFixed(2));
    expect(rises).toEqual([1, 1.15, 1.3, 1.45, 1.6, 1.6]);
  });
});

describe('Sumpah Palapa', () => {
  test('Gadjah Mada, a Defender Plane Wanderer: hand-set stats per star (mana: 60 / 60 / 20), melee', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.gadjahmada, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([4400, 7920, 54560]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([200, 300, 640]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([60, 60, 20]);
    expect([UNIT_BY_ID.gadjahmada.traits, UNIT_BY_ID.gadjahmada.range, UNIT_BY_ID.gadjahmada.freeSlot]).toEqual([['defender'], 1, true]);
  });

  test('shields every ally for a share of his max HP (himself twice as much) and taunts the enemies around him', () => {
    for (const star of [1, 2, 3] as const) {
      // (3,4) is beside him (taunted); (0,0) isn't.
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 0, y: 0 }]);
      b.caster.star = star;
      b.allies.push({ ...b.caster, id: 9, x: 0, y: 7, skill: {} });
      b.cast('sumpahpalapa');
      const amount = b.caster.maxHp * SUMPAH_PALAPA.shield[star - 1];
      expect(b.log.shieldTargets).toEqual([0, 9]);
      expect(b.log.shields).toEqual([
        { amount: amount * SUMPAH_PALAPA.self, seconds: SUMPAH_PALAPA.seconds },
        { amount, seconds: SUMPAH_PALAPA.seconds },
      ]);
      expect(b.log.taunts).toEqual([{ target: 1, by: 0, seconds: SUMPAH_PALAPA.taunt }]);
    }
  });
});

describe("Stalker's Mark", () => {
  test('Amon, the assassin: low HP, high attack per star (mana: 40 / 40 / 20), melee', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.amon, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([3300, 5940, 40920]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([255, 380, 815]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([40, 40, 20]);
    expect([UNIT_BY_ID.amon.name, UNIT_BY_ID.amon.range, UNIT_BY_ID.amon.attackTicks]).toEqual(['Amon', 1, 13]);
  });

  test('active: a knife at every enemy, then every knife homes in on his target', () => {
    for (const star of [1, 2] as const) {
      const b = fakeBattle([{ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 1, y: 2 }]);
      b.caster.star = star;
      b.caster.stats = unitStats(UNIT_BY_ID.amon, star);
      const atk = b.caster.stats.atk;
      b.cast('stalkersmark');
      expect(b.log.hits).toEqual([1, 2, 3, 4].map((target) => ({ target, raw: atk * STALKERS_MARK.out[star - 1], effect: 'stalkersknife', basic: false })));
      expect(b.log.repeats[0]).toMatchObject({ seconds: STALKERS_MARK.homeAfter, times: 1 });
      b.log.repeats[0].fn();
      // 4 at enemies and 4 more out to the edge make 8, and all 8 home in on his target (enemy 1).
      expect(b.log.hits.slice(4)).toEqual(Array(STALKERS_MARK.knives[0]).fill({ target: 1, raw: atk * STALKERS_MARK.home[star - 1], effect: 'stalkersmark', basic: false }));
      expect(b.log.dashes).toEqual([]);
    }
  });

  test('3★: twice as many, 2 at each enemy and at least 16 in all, all homing in on his target', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 1, y: 2 }]);
    b.caster.star = 3;
    b.caster.stats = unitStats(UNIT_BY_ID.amon, 3);
    const atk = b.caster.stats.atk;
    b.cast('stalkersmark');
    expect(b.log.hits.map((h) => h.target)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(b.log.hits.every((h) => h.raw === atk * STALKERS_MARK.out[2])).toBe(true);
    b.log.repeats[0].fn();
    expect(b.log.hits.slice(8)).toEqual(Array(16).fill({ target: 1, raw: atk * STALKERS_MARK.home[2], effect: 'stalkersmark', basic: false }));
  });

  test('a kill passes the rest of the homing knives on to the nearest enemy', () => {
    const b = fakeBattle([{ x: 3, y: 4 }, { x: 0, y: 0 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.amon, 1);
    b.cast('stalkersmark');
    b.fragile.add(1);
    b.log.repeats[0].fn();
    expect(b.log.hits.slice(2).map((h) => h.target)).toEqual([1, ...Array(STALKERS_MARK.knives[0] - 1).fill(2)]);
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
    // Sturdy enough that its hits leave them low rather than one-shot them; 2★ so the assassin outlasts two of them.
    a.board[3] = { uid: 1, defId: 'amon', star: 2 };
    b.board[3] = { uid: 2, defId: 'titan', star: 1 };
    b.board[4] = { uid: 3, defId: 'titan', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.defId === 'amon')!.id;
    const executions = r.events.filter((e) => e.type === 'effect' && e.effect === 'execute');
    expect(executions.length).toBeGreaterThan(0);
    for (const e of executions) {
      if (e.type !== 'effect') continue;
      expect(e.by).toBe(me);
      const victim = r.fighters.find((f) => f.id === e.target)!;
      expect(e.damage).toBeLessThan(victim.maxHp * STALKERS_MARK.execute[1]);
      expect(r.events.some((x) => x.type === 'death' && x.id === e.target && x.t === e.t)).toBe(true);
    }
  });
});

describe('Spectral Cataclysm', () => {
  test('Boss Alpha has 7g stats per star, above every 5g (mana: 50 / 50 / 20), melee', () => {
    const at = (star: Star) => unitStats(UNIT_BY_ID.bossalpha, star);
    expect([1, 2, 3].map((s) => at(s as Star).hp)).toEqual([6500, 11700, 80000]);
    expect([1, 2, 3].map((s) => at(s as Star).atk)).toEqual([370, 555, 1180]);
    expect([1, 2, 3].map((s) => at(s as Star).maxMana)).toEqual([50, 50, 20]);
    expect([UNIT_BY_ID.bossalpha.name, UNIT_BY_ID.bossalpha.tier, UNIT_BY_ID.bossalpha.range]).toEqual(['Boss Alpha', 7, 1]);
  });

  test('leaps into the densest spot: impact on the tiles around, then a bigger blast out to 3 tiles', () => {
    // A cluster around (5,1); (2,3) is within 3 of it, (0,5) isn't.
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }, { x: 2, y: 3 }, { x: 0, y: 5 }]);
    b.caster.stats = unitStats(UNIT_BY_ID.bossalpha, 1);
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
    expect(b.log.hitTypes.every((t) => t === 'adaptive')).toBe(true); // physical here: attack is the higher
  });

  test('adaptive: scales off magic attack when it is the higher', () => {
    const b = fakeBattle([{ x: 5, y: 0 }, { x: 6, y: 1 }, { x: 4, y: 2 }]);
    b.caster.stats = { ...unitStats(UNIT_BY_ID.bossalpha, 1), ap: 900 };
    b.cast('spectralcataclysm');
    b.log.repeats[0].fn();
    const hits = b.log.hits;
    expect(hits.length).toBeGreaterThan(0);
    expect(b.log.hitTypes.every((t) => t === 'adaptive')).toBe(true); // lands as magic in a fight (see combat tests)
    expect(hits.filter((h) => h.effect === 'spectralcataclysm').every((h) => h.raw === 900 * SPECTRAL_CATACLYSM.blast[0])).toBe(true);
  });
});

describe('Cursed Keris (Ken Arok)', () => {
  const ken = UNIT_BY_ID.kenarok;
  // He stands at (3,5) facing up. In the 3x2 ahead: (3,4) his target, (2,4), (4,3). Out: 3 deep, too wide, behind.
  const cells = [{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 4, y: 3 }, { x: 3, y: 2 }, { x: 5, y: 4 }, { x: 3, y: 6 }];

  test('one slash at the 3 wide, 2 deep block in front of him', () => {
    for (const star of [1, 2] as Star[]) {
      const b = fakeBattle(cells);
      b.caster.star = star;
      b.caster.stats = unitStats(ken, star);
      b.cast('kerisslash');
      const hits = [...b.log.hits].sort((x, y) => x.target - y.target);
      expect(hits.map((h) => h.target)).toEqual([1, 2, 3]);
      for (const h of hits) expect(h.raw).toBeCloseTo(b.caster.stats.atk * KERIS_SLASH.atk[star - 1]);
      expect(b.log.hitTypes.every((t) => t === 'physical')).toBe(true);
    }
  });

  test('at 3 stars the slash sweeps the entire board', () => {
    const b = fakeBattle(cells);
    b.caster.star = 3;
    b.caster.stats = unitStats(ken, 3);
    b.cast('kerisslash');
    expect(b.log.hits.map((h) => h.target).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const h of b.log.hits) expect(h.raw).toBeCloseTo(b.caster.stats.atk * KERIS_SLASH.atk[2]);
  });

  test('in combat it shows a half-moon slash: over the block below 3 stars, across the board at 3', () => {
    for (const [star, effect] of [[1, 'kerisslash'], [3, 'kerisslashall']] as const) {
      const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }, { id: 'b', name: 'B', isBot: false }]);
      const [a, b] = state.players;
      for (const p of state.players) {
        p.board.fill(null);
        p.bench.fill(null);
        p.items = [];
      }
      a.board[3] = { uid: 1, defId: 'kenarok', star };
      b.board[3] = { uid: 2, defId: 'titan', star: 2 };
      const r = simulateCombat({ rng: 1 }, a, b);
      expect(r.events.some((e) => e.type === 'projectile' && e.effect === effect)).toBe(true);
    }
  });
});

describe('Party Crasher (Johnnie)', () => {
  const johnnie = UNIT_BY_ID['johnnie-astral-fighter'];
  // Three enemies side by side up front, one off on its own.
  const cells = [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 6, y: 4 }];

  test('when combat starts, leaps into the thickest group: the higher of attack and magic attack plus a share of its own max hp', () => {
    for (const star of [1, 3] as Star[]) {
      const b = fakeBattle(cells);
      b.caster.star = star;
      b.caster.stats = unitStats(johnnie, star);
      b.atStart('partycrasher');
      const i = star - 1;
      expect(b.log.dashes).toEqual([{ x: 3, y: 2 }]);
      // Each one is shredded (Hunter) right before its hit.
      for (const id of [1, 2, 3]) expect(b.log.order.indexOf(`shred:${id}`)).toBe(b.log.order.indexOf(`hit:${id}`) - 1);
      const hits = [...b.log.hits].sort((x, y) => x.target - y.target);
      expect(hits.map((h) => h.target)).toEqual([1, 2, 3]);
      for (const h of hits) expect(h.raw).toBeCloseTo(b.caster.stats.ap * PARTY_CRASHER.leapAp[i] + b.caster.maxHp * PARTY_CRASHER.leapHp[i]);
      expect(b.log.hitTypes.every((t) => t === 'adaptive')).toBe(true);
    }
  });

  test('adaptive, like Alpha: both hits scale off whichever of attack and magic attack is higher', () => {
    const b = fakeBattle(cells);
    b.caster.stats = { ...unitStats(johnnie, 1), atk: 500, ap: 100 };
    b.cast('partycrasher');
    expect(b.log.hits.every((h) => h.raw === 500 * PARTY_CRASHER.ap[0])).toBe(true);
    expect(b.log.hitTypes.every((t) => t === 'adaptive')).toBe(true);
  });

  test('throws at the thickest group: every enemy in the 3x3 around the one aimed at is hit and stunned', () => {
    for (const star of [1, 3] as Star[]) {
      const b = fakeBattle(cells);
      b.caster.star = star;
      b.caster.stats = unitStats(johnnie, star);
      b.cast('partycrasher');
      const i = star - 1;
      const byTarget = <T extends { target: number }>(xs: T[]) => [...xs].sort((x, y) => x.target - y.target);
      expect(byTarget(b.log.hits).map((h) => [h.target, h.raw])).toEqual([1, 2, 3].map((t) => [t, b.caster.stats.ap * PARTY_CRASHER.ap[i]]));
      expect(byTarget(b.log.stuns)).toEqual([1, 2, 3].map((target) => ({ target, seconds: PARTY_CRASHER.stun[i] })));
    }
  });

  test('a Johnnie for every faction + role pair, each a 3-gold hero that costs nothing, attack speed by role', () => {
    const johnnies = Object.values(UNIT_BY_ID).filter((u) => u.johnnie);
    expect(johnnies.length).toBe(7 * 8);
    const left = ['mistbender', 'mooneater', 'storyweaver', 'phasewarper', 'scavenger'];
    for (const u of johnnies) {
      expect(u.traits.some((t) => left.includes(t))).toBe(false);
      expect(u.tier).toBe(3);
      expect(u.price).toBe(0);
      expect(u.traits.map((t) => TRAITS[t].kind)).toEqual(['faction', 'role']);
      expect(UNITS).not.toContain(u);
    }
    expect(UNIT_BY_ID['johnnie-astral-defender'].attackTicks).toBe(15);
    expect(UNIT_BY_ID['johnnie-astral-deadeye'].attackTicks).toBe(12);
  });
});

describe('fight-start order', () => {
  test("Johnnie leaps after every other passive, so buffs by position (an ally beside it) still reach it", () => {
    // A test-only unit: at the start of the fight, notes where its Johnnie ally stands.
    const seen: { x: number; y: number }[] = [];
    SKILLS.testwatch = {
      id: 'testwatch',
      name: 'Test Watch',
      desc: '',
      values: () => ({}),
      cast() {},
      atStart(api, caster) {
        for (const a of api.alliesOf(caster)) if (a.id !== caster.id) seen.push({ x: a.x, y: a.y });
      },
    };
    UNIT_BY_ID.testwatcher = { ...UNIT_BY_ID.footman, id: 'testwatcher', mana: 99_999, skill: 'testwatch' };
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
    // Johnnie first on the board, so it comes before the watcher in fighter order.
    a.board[0] = { uid: 1, defId: 'johnnie-astral-fighter', star: 1 };
    a.board[1] = { uid: 2, defId: 'testwatcher', star: 1 };
    b.board[3] = { uid: 3, defId: 'paladin', star: 1 };
    b.board[4] = { uid: 4, defId: 'paladin', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const start = r.fighters[0];
    expect(seen).toEqual([{ x: start.x, y: start.y }]); // not moved yet
    expect(r.events.some((e) => e.type === 'dash' && e.id === 0 && e.t === 0)).toBe(true); // then it leapt
    delete SKILLS.testwatch;
    delete UNIT_BY_ID.testwatcher;
  });
});

describe('Johnnie beside Mia', () => {
  test("gets Mia's attack speed aura even when it comes first on the board, then leaps", () => {
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
    a.board[0] = { uid: 1, defId: 'johnnie-cultoffire-fighter', star: 1 };
    a.board[1] = { uid: 2, defId: 'mia', star: 1 };
    b.board[3] = { uid: 3, defId: 'paladin', star: 1 };
    b.board[4] = { uid: 4, defId: 'paladin', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const johnnie = r.fighters.findIndex((f) => f.defId === 'johnnie-cultoffire-fighter');
    expect(r.events.some((e) => e.type === 'buff' && e.effect === 'pyreaura' && e.id === johnnie)).toBe(true);
    expect(r.events.some((e) => e.type === 'dash' && e.id === johnnie && e.t === 0)).toBe(true);
  });
});

describe('Johnnie leap and Hunter', () => {
  test("a Hunter Johnnie's leap already hits through the shred", () => {
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
    a.board[3] = { uid: 1, defId: 'johnnie-astral-hunter', star: 1 };
    a.board[10] = { uid: 2, defId: 'natalie', star: 1 }; // Hunter 2 with the Johnnie
    b.board[2] = { uid: 3, defId: 'paladin', star: 2 };
    b.board[3] = { uid: 4, defId: 'paladin', star: 2 };
    b.board[4] = { uid: 5, defId: 'paladin', star: 2 };
    const leap = (traits: boolean) =>
      simulateCombat({ rng: 1 }, a, b, { traits: [traits, traits] }).events.find((e) => e.type === 'effect' && e.effect === 'partycrasher') as { damage: number } | undefined;
    const withHunter = leap(true)!.damage;
    const without = leap(false)!.damage;
    expect(withHunter).toBeGreaterThan(without);
  });
});
