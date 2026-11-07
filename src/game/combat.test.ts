import { BASE_REWARD, baseReward, LOSE_STREAK_BONUS, WIN_GOLD, WIN_STREAK_BONUS } from './config';
import { interest, recordFight, streakBonus } from './player';
import { describe, expect, test } from 'bun:test';
import { defenseMult, simulateCombat, type CombatEvent } from './combat';
import { BASE_CRIT_DAMAGE, BASE_DAMAGE, CAST_MULT, START_HP } from './config';
import { createGame, isGameOver, resolveCombat, startRound } from './game';
import { dist, GRID_H, GRID_W, gridIndex, safestCell } from './grid';
import { activeTraits, DAUNTLESS, DEADEYE, DEFENDER, DRAGON_ALTAR, FIGHTER, gainStacks, MAGE, MOONEATER, PHASEWARPER, SKYBRINGER, STORYWEAVER, traitCounts, traitLevel, TRAITS, traitTiles, unitMods, unitStats, unitTriggers, WEAPON_MASTER } from './traits';
import { attackInterval } from './stats';
import { UNIT_BY_ID } from './units';
import type { GameState, Player, Star } from './types';

// A game on I-2, the first round players fight each other (I-1 is the creeps).
function newGame(n = 2, seed = 42): GameState {
  const state = createGame(
    seed,
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: false })),
  );
  state.round = 2;
  return state;
}

let uid = 10_000;
function field(p: Player, units: [defId: string, star: Star, index: number][]): void {
  p.board.fill(null);
  for (const [defId, star, index] of units) p.board[index] = { uid: uid++, defId, star };
}

describe('simulateCombat', () => {
  test('is deterministic for a given rng state', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['footman', 1, 0], ['archer', 1, 9]]);
    field(b, [['banshee', 1, 2], ['imp', 1, 12]]);
    expect(simulateCombat({ rng: 5 }, a, b)).toEqual(simulateCombat({ rng: 5 }, a, b));
  });

  test('empty board loses instantly, empty vs empty is a draw', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['footman', 1, 0]]);
    field(b, []);
    const r = simulateCombat({ rng: 1 }, a, b);
    expect(r.winner).toBe(0);
    expect(r.ticks).toBe(0);
    field(a, []);
    expect(simulateCombat({ rng: 1 }, a, b).winner).toBeNull();
  });

  test('stronger board wins', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['titan', 2, 3]]);
    field(b, [['footman', 1, 3], ['archer', 1, 10]]);
    const r = simulateCombat({ rng: 7 }, a, b);
    expect(r.winner).toBe(0);
    expect(r.survivors.length).toBe(1);
    expect(r.events.some((e) => e.type === 'move')).toBe(true);
  });

  test('away side is rotated so front lines face each other', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['footman', 1, 0]]); // front row, leftmost
    field(b, [['footman', 1, 0]]);
    const [home, away] = simulateCombat({ rng: 1 }, a, b).fighters;
    expect([home.x, home.y]).toEqual([0, GRID_H / 2]);
    expect([away.x, away.y]).toEqual([GRID_W - 1, GRID_H / 2 - 1]);
  });

  test('replayed events never put two living units on one cell', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['footman', 1, 0], ['banshee', 1, 1], ['archer', 1, 9], ['knight', 1, 4], ['soulreaper', 1, 6]]);
    field(b, [['footman', 1, 2], ['soulreaper', 1, 3], ['imp', 1, 11], ['paladin', 1, 5], ['archer', 1, 14]]);
    const r = simulateCombat({ rng: 3 }, a, b);
    const pos = new Map(r.fighters.map((f) => [f.id, `${f.x},${f.y}`]));
    let lastT = 0;
    for (const e of r.events) {
      expect(e.t).toBeGreaterThanOrEqual(lastT);
      lastT = e.t;
      if (e.type === 'move') pos.set(e.id, `${e.x},${e.y}`);
      if (e.type === 'death') pos.delete(e.id);
      const cells = [...pos.values()];
      expect(new Set(cells).size).toBe(cells.length);
    }
  });
});

describe('resolveCombat', () => {
  test('loser takes base damage plus surviving stars', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['titan', 3, 0], ['footman', 2, 1]]);
    field(b, [['footman', 1, 0]]);
    const [fight] = resolveCombat(state);
    const winnerHome = fight.home === a.id;
    expect(fight.result.winner).toBe(winnerHome ? 0 : 1);
    expect(fight.damage).toBe(BASE_DAMAGE + 3 + 2);
    expect(b.hp).toBe(START_HP - fight.damage);
    expect(a.hp).toBe(START_HP);
  });

  test('odd player count adds a ghost fight that only hurts the real player', () => {
    const state = newGame(3);
    for (const p of state.players) field(p, [['footman', 1, 0]]);
    const fights = resolveCombat(state);
    expect(fights.length).toBe(2);
    const ghost = fights.find((f) => f.ghost)!;
    const host = state.players.find((p) => p.id === ghost.away)!;
    const real = fights.find((f) => !f.ghost)!;
    // The ghost's owner only loses hp from their own real fight, if at all.
    if (real.home !== host.id && real.away !== host.id) expect(host.hp).toBe(START_HP);
  });

  test('knocked-out players get a place and their units go back to the pool', () => {
    const state = newGame(2);
    const [a, b] = state.players;
    field(a, [['titan', 3, 0]]);
    field(b, [['wisp', 1, 0]]);
    b.hp = 1;
    // b's shop and bench (starter units) go back to the pool too.
    const wispsBack = 1 + b.shop.filter((id) => id === 'wisp').length + b.bench.reduce((n, u) => n + (u?.defId === 'wisp' ? 3 ** (u.star - 1) : 0), 0);
    const wispsBefore = state.pool.wisp;
    resolveCombat(state);
    expect(b.hp).toBe(0);
    expect(b.place).toBe(2);
    expect(a.place).toBe(1);
    expect(state.pool.wisp).toBe(wispsBefore + wispsBack);
    expect(isGameOver(state)).toBe(true);
  });
});

describe('traits', () => {
  test('duplicates count once toward a trait', () => {
    const b: Player['board'] = Array(32).fill(null);
    b[0] = { uid: 1, defId: 'banshee', star: 1 };
    b[1] = { uid: 2, defId: 'banshee', star: 1 };
    expect(traitCounts(b).hunter).toBe(1);
    b[2] = { uid: 3, defId: 'soulreaper', star: 1 };
    b[3] = { uid: 4, defId: 'penari', star: 1 }; // Gustiwana + Scavenger
    expect(traitCounts(b)).toEqual({ hunter: 2, necromancer: 1, spectre: 1, gustiwana: 1, scavenger: 1 });
    expect(activeTraits(b)).toEqual({ hunter: 1 });
  });

  test('armor reduces damage, negative armor amplifies it', () => {
    expect(defenseMult(0)).toBe(1);
    expect(defenseMult(100)).toBe(0.5);
    expect(defenseMult(-100)).toBe(1.5);
  });

  test('Hunter shred applies in full from the first hit', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['soulreaper', 1, 3], ['banshee', 1, 4]]);
    field(b, [['titan', 3, 3]]);
    const hits = (traits: [boolean, boolean]) =>
      simulateCombat({ rng: 1 }, a, b, { traits })
        .events.filter((e) => e.type === 'attack' && e.id === 0)
        .map((e) => (e.type === 'attack' ? e.damage : 0));
    const on = hits([true, true]);
    const off = hits([false, false]);
    expect(on[0]).toBeGreaterThan(off[0]);
    expect(new Set(on).size).toBe(1);
  });

  test('Stargazers cast sooner with the trait active', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['altarkeeper', 1, 15], ['chronicler', 1, 18]]);
    field(b, [['footman', 1, 3]]);
    const firstCast = (traits: [boolean, boolean]) =>
      simulateCombat({ rng: 1 }, a, b, { traits }).events.find((e) => (e.type === 'cast' || e.type === 'skill') && e.id === 0)?.t ?? Infinity;
    expect(firstCast([true, true])).toBeLessThan(firstCast([false, false]));
  });
});

describe('dragon altar', () => {
  const altar = DRAGON_ALTAR.tiles[0];
  const offAltar = Array.from({ length: 21 }, (_, i) => i).find((i) => !altar.includes(i))!;

  test('only allies starting on an altar get the bonus, Dragon Altar units 3x', () => {
    const state = newGame();
    const [a, b] = state.players;
    // Two Dragon Altar units activate level 1; a neutral footman shares the altar row.
    field(a, [['drakeling', 1, altar[0]], ['wyrmfang', 1, offAltar], ['footman', 1, altar[1]]]);
    field(b, [['footman', 1, 3]]);
    const { fighters } = simulateCombat({ rng: 1 }, a, b);
    const [drake, scale, foot] = ['drakeling', 'wyrmfang', 'footman'].map((id) => fighters.find((f) => f.defId === id && f.side === 0)!);
    const bonus = DRAGON_ALTAR.allyBonus[0];
    expect(drake.onTile).toBe(true);
    expect(drake.maxHp).toBe(Math.round(UNIT_BY_ID.drakeling.hp * (1 + DRAGON_ALTAR.memberBonus[0])));
    expect(scale.onTile).toBe(false);
    expect(scale.maxHp).toBe(UNIT_BY_ID.wyrmfang.hp);
    expect(foot.maxHp).toBe(Math.round(UNIT_BY_ID.footman.hp * (1 + bonus)));
  });

  test('no altars without the trait', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['drakeling', 1, altar[0]]]);
    field(b, [['footman', 1, 3]]);
    expect(simulateCombat({ rng: 1 }, a, b).fighters[0].onTile).toBe(false);
  });

  test('level 10 is its own breakpoint', () => {
    expect(traitLevel('dragonaltar', 6)).toBe(3);
    expect(traitLevel('dragonaltar', 10)).toBe(4);
    expect(traitTiles({ dragonaltar: 4 }).size).toBe(21);
  });
});

describe('trait plumbing', () => {
  // A unit is at most one faction. Roles: one, except where the design deliberately gives two.
  test('every unit has at most one faction, and two roles only by design', () => {
    const twoRoles = ['dalang', 'nebulaseer', 'rarajonggrang'];
    for (const u of Object.values(UNIT_BY_ID)) {
      const kinds = u.traits.map((id) => TRAITS[id].kind);
      expect(kinds.filter((k) => k === 'faction').length).toBeLessThanOrEqual(1);
      expect(kinds.filter((k) => k === 'role').length).toBeLessThanOrEqual(twoRoles.includes(u.id) ? 2 : 1);
    }
  });

  test('every trait description key has one value per breakpoint', () => {
    for (const t of Object.values(TRAITS)) {
      const values = t.values();
      const keys = [...t.desc.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) expect(values[k]?.length).toBe(t.breakpoints.length);
    }
  });

  test('mods only come from active traits, and members get their extras', () => {
    const def = UNIT_BY_ID.banshee; // Hunter; Stargazer's team regen reaches it too
    expect(unitMods(def, { levels: {}, cell: 0 })).toEqual([]);
    const mods = unitMods(def, { levels: { hunter: 1, stargazer: 1 }, cell: 0 });
    expect(mods.map((m) => m.stat).sort()).toEqual(['armorShred', 'manaRegen']);
    const outsider = unitMods(UNIT_BY_ID.footman, { levels: { hunter: 1 }, cell: 0 })[0];
    const member = unitMods(def, { levels: { hunter: 1 }, cell: 0 })[0];
    expect(member.add!).toBeGreaterThan(outsider.add!);
  });
});

describe('magic damage and skybringer', () => {
  test('casts are magic: reduced by mr, not armor', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['imp', 1, 3]]);
    field(b, [['footman', 1, 3]]);
    const cast = simulateCombat({ rng: 1 }, a, b).events.find((e) => e.type === 'cast' && e.id === 0);
    expect(cast?.type === 'cast' && cast.damage).toBe(Math.round(UNIT_BY_ID.imp.ap * CAST_MULT * defenseMult(UNIT_BY_ID.footman.mr)));
  });

  test('lightning strikes every enemy 3 times, 3s apart, as magic % max hp', () => {
    const state = newGame();
    const [a, b] = state.players;
    // Everyone sturdy enough to live past the third strike at 9s.
    field(a, [['tempestknight', 1, 0], ['thunderlord', 1, 6]]);
    field(b, [['titan', 3, 0], ['paladin', 3, 6]]);
    const r = simulateCombat({ rng: 1 }, a, b);
    const zaps = r.events.filter((e): e is Extract<CombatEvent, { type: 'effect' }> => e.type === 'effect' && e.effect === 'skybringer');
    expect([...new Set(zaps.map((e) => e.t))]).toEqual([30, 60, 90]);
    expect(zaps.length).toBe(6);
    const titan = r.fighters.find((f) => f.defId === 'titan')!;
    const first = zaps.find((e) => e.type === 'effect' && e.target === titan.id)!;
    expect(first.damage).toBe(Math.round(titan.maxHp * SKYBRINGER.lightning[0] * defenseMult(UNIT_BY_ID.titan.mr)));
  });

  test('damage amp only boosts Skybringers', () => {
    const sky = unitMods(UNIT_BY_ID.galekin, { levels: { skybringer: 1 }, cell: 0 });
    expect(sky).toEqual([{ stat: 'damageAmp', add: SKYBRINGER.damageAmp[0] }]);
    expect(unitMods(UNIT_BY_ID.footman, { levels: { skybringer: 1 }, cell: 0 })).toEqual([]);
  });
});

describe('deadeye', () => {
  test('crit chance goes to every ally, crit damage only to Deadeyes', () => {
    const footman = unitStats(UNIT_BY_ID.footman, 1, { levels: { deadeye: 1 } });
    const deadeye = unitStats(UNIT_BY_ID.senopati, 1, { levels: { deadeye: 1 } });
    expect(footman.critChance).toBe(DEADEYE.critChance[0]);
    expect(deadeye.critChance).toBe(DEADEYE.critChance[0]);
    expect(footman.critDamage).toBe(BASE_CRIT_DAMAGE);
    expect(deadeye.critDamage).toBe(BASE_CRIT_DAMAGE + DEADEYE.critDamage[0]);
  });

  test('only basic attacks crit, for critDamage x the normal hit', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['senopati', 1, 15], ['gloomshot', 1, 17]]);
    field(b, [['titan', 2, 3]]);
    const r = simulateCombat({ rng: 3 }, a, b);
    const deadeyeId = r.fighters.find((f) => f.defId === 'senopati')!.id;
    type Hit = Extract<CombatEvent, { type: 'attack' | 'cast' }>;
    const hits = r.events.filter((e): e is Hit => e.type === 'attack' && e.id === deadeyeId);
    const crits = hits.filter((e) => e.crit);
    expect(crits.length).toBeGreaterThan(0);
    expect(crits.length).toBeLessThan(hits.length);
    expect(r.events.some((e) => e.type === 'cast' && e.crit)).toBe(false);
    // Same target, no shred involved: a crit is exactly critDamage x the normal hit before rounding.
    const normal = hits.find((e) => !e.crit)!.damage;
    const crit = crits[0].damage;
    expect(Math.abs(crit - normal * (BASE_CRIT_DAMAGE + DEADEYE.critDamage[0]))).toBeLessThanOrEqual(2);
  });
});

describe('phasewarper', () => {
  test('first drop below 50% warps away, heals and adds damage, once', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['shadewalker', 1, 3], ['rarajonggrang', 1, 17]]);
    field(b, [['titan', 1, 3]]);
    const r = simulateCombat({ rng: 1 }, a, b);
    const blade = r.fighters.find((f) => f.defId === 'shadewalker')!;
    const warps = r.events.filter((e) => e.type === 'trigger' && e.id === blade.id);
    expect(warps.length).toBe(1);
    const warp = warps[0];
    if (warp.type !== 'trigger') throw new Error('unreachable');
    expect(warp.heal).toBe(Math.round(blade.maxHp * PHASEWARPER.heal[0]));
    // It was below half when it warped, and the heal brought it back up.
    expect(warp.hp - warp.heal).toBeLessThan(blade.maxHp * PHASEWARPER.below);
    // It ended up somewhere else, out of the Titan's reach.
    expect([warp.x, warp.y]).not.toEqual([blade.x, blade.y]);
  });

  test('only members carry the trigger', () => {
    expect(unitTriggers({ phasewarper: 1 }, UNIT_BY_ID.shadewalker)).toHaveLength(1);
    expect(unitTriggers({ phasewarper: 1 }, UNIT_BY_ID.footman)).toHaveLength(0);
  });

  test('safest cell is the free tile farthest from threats', () => {
    const occupied = new Int16Array(GRID_W * GRID_H).fill(-1);
    const to = safestCell(occupied, { x: 3, y: 3 }, [{ x: 0, y: 0 }]);
    // Diagonal steps count as 1, so the whole far column is equally safe.
    expect(dist(to, { x: 0, y: 0 })).toBe(GRID_W - 1);
    occupied[gridIndex(to)] = 0;
    expect(safestCell(occupied, { x: 3, y: 3 }, [{ x: 0, y: 0 }])).not.toEqual(to);
  });
});

describe('storyweaver', () => {
  test('the game rolls one 4-gold Storyweaver as protagonist, for everyone, all game', () => {
    const picked = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const state = createGame(seed, [{ id: 'p', name: 'P', isBot: false }]);
      expect(UNIT_BY_ID[state.chosen.storyweaver].tier).toBe(4);
      picked.add(state.chosen.storyweaver);
    }
    const eligible = Object.values(UNIT_BY_ID).filter((u) => u.tier === 4 && u.traits.includes('storyweaver')).map((u) => u.id);
    expect([...picked].sort()).toEqual(eligible.sort());
    expect(eligible.sort()).toEqual(['mythweaver', 'taleshield']);
  });

  test('every fielded copy of the protagonist is crowned, on both sides, only while active', () => {
    const state = newGame();
    const [a, b] = state.players;
    const chosen = { storyweaver: 'taleshield' };
    field(a, [['inkling', 1, 0], ['taleshield', 1, 2], ['mythweaver', 1, 16]]);
    field(b, [['inkling', 1, 0], ['taleshield', 1, 2]]);
    const fighters = simulateCombat({ rng: 1 }, a, b, { chosen }).fighters;
    expect(fighters.filter((f) => f.chosen).map((f) => [f.side, f.defId])).toEqual([
      [0, 'taleshield'],
      [1, 'taleshield'],
    ]);
    field(b, [['taleshield', 1, 2]]); // a lone Storyweaver: trait inactive, so no crown
    expect(simulateCombat({ rng: 1 }, a, b, { chosen }).fighters.filter((f) => f.side === 1 && f.chosen)).toHaveLength(0);
  });

  test('protagonist gets the enhanced skill and damage per story', () => {
    const field = { levels: { storyweaver: 2 }, cell: 5, chosen: { storyweaver: 'taleshield' }, stacks: { storyweaver: 10 } };
    const hero = unitStats(UNIT_BY_ID.taleshield, 1, field);
    const extra = unitStats(UNIT_BY_ID.mythweaver, 1, field);
    expect(hero.damageAmp).toBeCloseTo(STORYWEAVER.perStack[1] * 10);
    expect(hero.skillAmp).toBeCloseTo(STORYWEAVER.enhancedCast[1]); // levels: { storyweaver: 2 } is the second breakpoint
    expect(extra.damageAmp).toBe(0);
    expect(extra.skillAmp).toBe(0);
  });

  test('stories: +1 per enemy death, max 3 per fight and 30 total, only while active', () => {
    const p = newGame().players[0];
    const kills = (n: number) => () => ({ kills: n, memberSkills: 0 });
    gainStacks(p, { storyweaver: 1 }, kills(5));
    expect(p.stacks.storyweaver).toBe(3);
    gainStacks(p, {}, kills(5));
    expect(p.stacks.storyweaver).toBe(3);
    for (let i = 0; i < 20; i++) gainStacks(p, { storyweaver: 1 }, kills(3));
    expect(p.stacks.storyweaver).toBe(30);
  });

  test('resolveCombat adds stories to the player that ran Storyweaver', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['taleshield', 3, 3], ['mythweaver', 3, 16]]);
    field(b, [['footman', 1, 2], ['archer', 1, 4]]);
    resolveCombat(state);
    expect(a.stacks.storyweaver).toBe(2);
    expect(b.stacks.storyweaver).toBeUndefined();
  });
});

describe('mooneater', () => {
  // Board cells are row * 7 + col, row 0 = front. Home column c is grid x = c; away column c is x = 6 - c.
  test("stuns enemies in the Mooneater's column and hastes every ally in it, behind or in front", () => {
    const state = newGame();
    const [a, b] = state.players;
    // Dwarapala in the back of column 2, a Footman in front of it, another Footman in column 4.
    // Rara Jonggrang (the 2nd Mooneater) sits in column 6.
    field(a, [['dwarapala', 1, 16], ['footman', 1, 2], ['footman', 1, 4], ['rarajonggrang', 1, 20]]);
    // Enemy footman lands in grid column 2 (away col 4); enemy archer in grid column 3.
    field(b, [['footman', 1, 4], ['archer', 1, 3]]);
    const r = simulateCombat({ rng: 1 }, a, b);
    const at = (side: number, x: number) => r.fighters.filter((f) => f.side === side && f.x === x).map((f) => f.id);

    const stunned = r.events.filter((e) => e.type === 'stun').map((e) => e.type === 'stun' && e.id);
    expect(stunned).toEqual(at(1, 2));
    const until = r.events.find((e) => e.type === 'stun');
    expect(until?.type === 'stun' && until.until).toBe(MOONEATER.stun[0] * 10);

    const hasted = new Set(r.events.filter((e) => e.type === 'buff').map((e) => e.type === 'buff' && e.id));
    expect(hasted).toEqual(new Set([...at(0, 2), ...at(0, 6)]));
    expect(at(0, 4).some((id) => hasted.has(id))).toBe(false);
  });

  test('two Mooneaters in one column do not stack the haste', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['dwarapala', 1, 16], ['rarajonggrang', 1, 9]]); // both column 2
    field(b, [['footman', 1, 0]]);
    const buffs = simulateCombat({ rng: 1 }, a, b).events.filter((e) => e.type === 'buff');
    expect(buffs).toHaveLength(2); // one per ally, not two each
  });

  test('attack speed shortens the time between attacks', () => {
    const base = unitStats(UNIT_BY_ID.footman, 1);
    expect(attackInterval(base)).toBe(UNIT_BY_ID.footman.attackTicks);
    const hasted = attackInterval({ ...base, attackSpeed: 1 + MOONEATER.attackSpeed[0] });
    expect(hasted).toBe(Math.round(UNIT_BY_ID.footman.attackTicks / (1 + MOONEATER.attackSpeed[0])));
    expect(hasted).toBeLessThan(UNIT_BY_ID.footman.attackTicks);
  });
});

describe('attack types', () => {
  test("Resi's basic attacks are magic: reduced by magic resist, not armor", () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['resi', 1, 17]]);
    field(b, [['knight', 1, 3]]); // lots of armor, less magic resist
    const r = simulateCombat({ rng: 1 }, a, b);
    const resi = r.fighters.find((f) => f.defId === 'resi')!;
    const hit = r.events.find((e) => e.type === 'attack' && e.id === resi.id);
    const expected = Math.round(UNIT_BY_ID.resi.ap * defenseMult(UNIT_BY_ID.knight.mr));
    expect(hit?.type === 'attack' && !hit.crit && hit.damage).toBe(expected);
  });

  test('Gustiwana 4-golds: Senopati is physical Deadeye, Resi magical Stargazer, both ranged', () => {
    expect(UNIT_BY_ID.senopati.traits).toEqual(['gustiwana', 'deadeye']);
    expect(UNIT_BY_ID.resi.traits).toEqual(['gustiwana', 'stargazer']);
    expect(UNIT_BY_ID.senopati.range).toBeGreaterThan(1);
    expect(UNIT_BY_ID.resi.range).toBeGreaterThan(1);
    expect(UNIT_BY_ID.senopati.attackType ?? 'physical').toBe('physical');
    expect(UNIT_BY_ID.resi.attackType).toBe('magic');
  });
});

describe('mage', () => {
  test('Mage raises magic attack only: allies a little, Mages a lot', () => {
    const plain = (id: string) => unitStats(UNIT_BY_ID[id], 1);
    const ally = unitStats(UNIT_BY_ID.footman, 1, { levels: { mage: 1 } });
    const caster = unitStats(UNIT_BY_ID.boneadept, 1, { levels: { mage: 1 } });
    expect(ally.ap).toBe(Math.round(plain('footman').ap * (1 + MAGE.allies[0])));
    expect(caster.ap).toBe(Math.round(plain('boneadept').ap * (1 + MAGE.allies[0] + MAGE.mageBonus[0])));
    expect(ally.atk).toBe(plain('footman').atk);
  });

  test("a Mage's magic attacks hit harder with the trait; a physical ally's attacks don't change", () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['boneadept', 1, 17], ['ethersage', 1, 18], ['footman', 1, 3]]);
    field(b, [['paladin', 3, 3]]);
    const firstHit = (traits: [boolean, boolean], defId: string) => {
      const r = simulateCombat({ rng: 1 }, a, b, { traits });
      const id = r.fighters.find((f) => f.defId === defId)!.id;
      const e = r.events.find((x) => x.type === 'attack' && x.id === id);
      return e?.type === 'attack' ? e.damage : 0;
    };
    expect(firstHit([true, true], 'boneadept')).toBeGreaterThan(firstHit([false, false], 'boneadept'));
    expect(firstHit([true, true], 'footman')).toBe(firstHit([false, false], 'footman'));
  });
});

describe('physical and magic attack', () => {
  test('physical attackers hit with attack, magic attackers with magic attack', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['footman', 1, 3], ['boneadept', 1, 17]]);
    field(b, [['knight', 1, 3]]);
    const r = simulateCombat({ rng: 1 }, a, b);
    const hit = (defId: string) => {
      const id = r.fighters.find((f) => f.defId === defId)!.id;
      const e = r.events.find((x) => x.type === 'attack' && x.id === id && !x.crit);
      return e?.type === 'attack' ? e.damage : -1;
    };
    expect(hit('footman')).toBe(Math.round(UNIT_BY_ID.footman.atk * defenseMult(UNIT_BY_ID.knight.armor)));
    expect(hit('boneadept')).toBe(Math.round(UNIT_BY_ID.boneadept.ap * defenseMult(UNIT_BY_ID.knight.mr)));
  });

  test('every unit has both stats, and magic attackers lean on magic attack', () => {
    // Summons take their damage from whoever summoned them.
    for (const u of Object.values(UNIT_BY_ID).filter((u) => !u.summon && !u.piece)) {
      expect(u.atk).toBeGreaterThan(0);
      expect(u.ap).toBeGreaterThan(0);
      if (u.attackType === 'magic') expect(u.ap).toBeGreaterThan(u.atk);
    }
  });
});

describe('defender', () => {
  test('six units at 1, 2, 3, 3, 4, 5 gold, crossing Astral, Mooneater, Cult of Fire, Storyweaver and Dragon Altar', () => {
    const units = Object.values(UNIT_BY_ID).filter((u) => u.shop !== false && u.traits.includes('defender')).sort((a, b) => a.tier - b.tier);
    expect(units.map((u) => u.tier)).toEqual([1, 2, 3, 3, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'defender'))).toEqual([['astral'], ['mooneater'], ['cultoffire'], ['necromancer'], ['storyweaver'], ['dragonaltar']]);
  });

  test('allies gain armor and magic resist, Defenders more', () => {
    const plain = (id: string) => unitStats(UNIT_BY_ID[id], 1);
    for (const level of [1, 2, 3]) {
      const ally = unitStats(UNIT_BY_ID.footman, 1, { levels: { defender: level } });
      const def = unitStats(UNIT_BY_ID.dwarapala, 1, { levels: { defender: level } });
      const a = DEFENDER.allies[level - 1];
      const d = a + DEFENDER.defenderBonus[level - 1];
      expect([ally.armor - plain('footman').armor, ally.mr - plain('footman').mr]).toEqual([a, a]);
      expect([def.armor - plain('dwarapala').armor, def.mr - plain('dwarapala').mr]).toEqual([d, d]);
    }
  });
});

describe('weapon master', () => {
  test('six units at 1, 2, 3, 4, 4, 5 gold, crossing Cult of Fire, Astral, Gustiwana, Dragon Altar and Skybringer', () => {
    const units = Object.values(UNIT_BY_ID)
      .filter((u) => u.shop !== false && u.traits.includes('weaponmaster'))
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 3, 4, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'weaponmaster'))).toEqual([['cultoffire'], ['astral'], ['gustiwana', 'dauntless'], ['dragonaltar'], ['skybringer'], ['necromancer']]);
  });

  test('Weapon Masters gain hybrid lifesteal and attack; other allies nothing', () => {
    const plain = (id: string) => unitStats(UNIT_BY_ID[id], 1);
    for (const level of [1, 2, 3]) {
      const i = level - 1;
      const ally = unitStats(UNIT_BY_ID.footman, 1, { levels: { weaponmaster: level } });
      const master = unitStats(UNIT_BY_ID.revenant, 1, { levels: { weaponmaster: level } });
      expect([ally.lifesteal, ally.spellLifesteal, ally.atk]).toEqual([0, 0, plain('footman').atk]);
      expect(master.lifesteal).toBeCloseTo(WEAPON_MASTER.lifesteal[i]);
      expect(master.spellLifesteal).toBeCloseTo(WEAPON_MASTER.lifesteal[i]);
      expect(master.atk).toBe(Math.round(plain('revenant').atk * (1 + WEAPON_MASTER.attack[i])));
      expect(master.ap).toBe(plain('revenant').ap);
    }
    // Each breakpoint is a clear step up.
    for (const arr of [WEAPON_MASTER.lifesteal, WEAPON_MASTER.attack]) expect(arr[0] < arr[1] && arr[1] < arr[2]).toBe(true);
  });
});

describe('fighter', () => {
  test('six units at 1, 2, 3, 3, 4, 5 gold, crossing Gustiwana, Storyweaver, Dragon Altar and Skybringer', () => {
    const units = Object.values(UNIT_BY_ID)
      .filter((u) => u.shop !== false && u.traits.includes('fighter'))
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 3, 3, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'fighter'))).toEqual([['gustiwana'], ['storyweaver'], ['mistbender'], ['spectre'], ['dragonaltar'], ['skybringer']]);
  });

  test('only Fighters gain basic attack damage and hit-again chance', () => {
    for (const level of [1, 2, 3]) {
      const ally = unitStats(UNIT_BY_ID.footman, 1, { levels: { fighter: level } });
      const member = unitStats(UNIT_BY_ID.fogfist, 1, { levels: { fighter: level } });
      expect([ally.basicAmp, ally.hitAgain]).toEqual([0, 0]);
      expect([member.basicAmp, member.hitAgain]).toEqual([FIGHTER.basicAmp[level - 1], FIGHTER.hitAgain[level - 1]]);
    }
  });

  test('basic attacks deal more, and an extra hit follows the attack it came from, never another extra hit', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['fogfist', 1, 3], ['phantomblade', 1, 4]]);
    field(b, [['knight', 2, 3], ['paladin', 2, 4]]);
    const r = simulateCombat({ rng: 9 }, a, b);
    const brawler = r.fighters.find((f) => f.defId === 'fogfist')!.id;
    const attacks = r.events.filter((e) => e.type === 'attack');
    const plain = attacks.find((e) => e.type === 'attack' && e.id === brawler && !e.crit && !e.again && r.fighters[e.target].defId === 'knight');
    const knightArmor = unitStats(UNIT_BY_ID.knight, 2).armor;
    expect(plain?.type === 'attack' && plain.damage).toBe(Math.round(UNIT_BY_ID.fogfist.atk * (1 + FIGHTER.basicAmp[0]) * defenseMult(knightArmor)));
    const agains = attacks.filter((e) => e.type === 'attack' && e.again);
    expect(agains.length).toBeGreaterThan(0);
    for (const e of agains) {
      const i = r.events.indexOf(e);
      const prev = r.events.slice(0, i).reverse().find((x) => x.type === 'attack' && e.type === 'attack' && x.id === e.id);
      expect(prev?.t).toBe(e.t);
      expect(prev?.type === 'attack' && prev.again).toBeFalsy();
    }
  });
});

describe('dragon altar lineup', () => {
  test('1, 2, 3, 4, 4, 5 gold crossing Hunter, Stargazer, Deadeye, Weapon Master, Fighter and Defender', () => {
    const units = Object.values(UNIT_BY_ID)
      .filter((u) => u.shop !== false && u.traits.includes('dragonaltar'))
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 3, 4, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'dragonaltar'))).toEqual([['hunter'], ['stargazer'], ['deadeye'], ['weaponmaster'], ['fighter'], ['defender']]);
  });
});

describe('dauntless', () => {
  test('six units at 1, 2, 3, 3, 4, 5 gold; Dalang is Gustiwana, Weapon Master and Dauntless', () => {
    const units = Object.values(UNIT_BY_ID)
      .filter((u) => u.shop !== false && u.traits.includes('dauntless'))
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 3, 3, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'dauntless'))).toEqual([['mistbender'], ['skybringer'], ['gustiwana', 'weaponmaster'], ['astral'], ['cultoffire'], ['spectre']]);
  });

  test('Dauntless units start with a shield of their max hp, others none; it soaks hits first', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['hazeguard', 1, 3], ['thunderhawk', 1, 17], ['footman', 1, 4]]);
    field(b, [['knight', 1, 3]]);
    const r = simulateCombat({ rng: 2 }, a, b);
    const shields = r.events.filter((e) => e.t === 0 && e.type === 'shield');
    const id = (defId: string) => r.fighters.find((f) => f.defId === defId)!.id;
    expect(shields.map((e) => e.type === 'shield' && [e.id, e.amount]).sort()).toEqual(
      [
        [id('hazeguard'), Math.round(UNIT_BY_ID.hazeguard.hp * DAUNTLESS.shield[0])],
        [id('thunderhawk'), Math.round(UNIT_BY_ID.thunderhawk.hp * DAUNTLESS.shield[0])],
      ].sort(),
    );
    const firstHit = r.events.find((e) => e.type === 'attack' && e.target === id('hazeguard'));
    expect(firstHit?.type === 'attack' && firstHit.hp).toBe(UNIT_BY_ID.hazeguard.hp);
  });
});

describe('skybringer lineup', () => {
  test('1, 2, 3, 4, 4, 5 gold crossing Stargazer, Dauntless, Phasewarper, Hunter, Weapon Master and Fighter', () => {
    const units = Object.values(UNIT_BY_ID)
      .filter((u) => u.shop !== false && u.traits.includes('skybringer'))
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 3, 4, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'skybringer'))).toEqual([['stargazer'], ['dauntless'], ['phasewarper'], ['weaponmaster'], ['hunter'], ['fighter']]);
  });
});

describe('cult of fire lineup', () => {
  test('1, 2, 2, 3, 4, 5 gold crossing Weapon Master, Mage, Deadeye, Defender, Dauntless and Hunter', () => {
    const units = Object.values(UNIT_BY_ID)
      .filter((u) => u.shop !== false && u.traits.includes('cultoffire'))
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 2, 3, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'cultoffire'))).toEqual([['weaponmaster'], ['mage'], ['deadeye'], ['defender'], ['dauntless'], ['hunter']]);
  });
});

describe('stargazer lineup', () => {
  test('1, 2, 3, 3, 4, 5 gold crossing Skybringer, Dragon Altar, Storyweaver, Astral (+Hunter) and Gustiwana', () => {
    const units = Object.values(UNIT_BY_ID)
      .filter((u) => u.shop !== false && u.traits.includes('stargazer'))
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 3, 3, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'stargazer'))).toEqual([['skybringer'], ['dragonaltar'], ['storyweaver'], ['astral', 'hunter'], ['gustiwana'], ['mistbender']]);
  });
});

describe('hunter lineup', () => {
  test('1, 2, 3, 3, 4, 5 gold crossing Dragon Altar, Astral (+Stargazer), Skybringer and Cult of Fire', () => {
    const units = Object.values(UNIT_BY_ID)
      .filter((u) => u.shop !== false && u.traits.includes('hunter'))
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 3, 3, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'hunter'))).toEqual([['dragonaltar'], ['necromancer'], ['astral', 'stargazer'], ['spectre'], ['skybringer'], ['cultoffire']]);
  });
});

describe('deadeye lineup', () => {
  test('2, 2, 3, 4, 4, 5 gold crossing Cult of Fire, Dragon Altar, Gustiwana, Astral and Mooneater', () => {
    const units = Object.values(UNIT_BY_ID)
      .filter((u) => u.shop !== false && u.traits.includes('deadeye'))
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([2, 2, 3, 4, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'deadeye'))).toEqual([['spectre'], ['cultoffire'], ['dragonaltar'], ['astral'], ['gustiwana'], ['mooneater']]);
  });
});

describe('mage lineup', () => {
  test('1, 2, 3, 4, 4, 5 gold crossing Necromancer, Cult of Fire, Mooneater (+Phasewarper), Storyweaver and Astral', () => {
    const units = Object.values(UNIT_BY_ID)
      .filter((u) => u.shop !== false && u.traits.includes('mage'))
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 3, 4, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'mage'))).toEqual([['necromancer'], ['cultoffire'], ['mooneater', 'phasewarper'], ['spectre'], ['storyweaver'], ['astral']]);
    expect(units.every((u) => u.attackType === 'magic')).toBe(true);
  });
});

describe('phasewarper lineup', () => {
  test('2, 3, 3, 5 gold crossing Necromancer, Mooneater (+Mage), Skybringer and Gustiwana', () => {
    const units = Object.values(UNIT_BY_ID)
      .filter((u) => u.shop !== false && u.traits.includes('phasewarper'))
      .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([2, 3, 3, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'phasewarper'))).toEqual([['necromancer'], ['mooneater', 'mage'], ['skybringer'], ['gustiwana']]);
  });
});

describe('dauntless are frontliners', () => {
  test('every Dauntless unit is melee: the shield belongs where the hits land', () => {
    for (const u of Object.values(UNIT_BY_ID).filter((u) => u.traits.includes('dauntless'))) expect([u.id, u.range]).toEqual([u.id, 1]);
  });
});

describe('economy', () => {
  test('basic reward goes up each stage, then stays', () => {
    expect([1, 4, 5, 10, 11, 17, 40].map(baseReward)).toEqual([4, 4, 5, 5, 6, 7, 7]);
    expect(BASE_REWARD).toEqual([4, 5, 6, 7]);
  });

  test('interest: 10+ banked gives 2, 20+ gives 4 (cap)', () => {
    expect([0, 9, 10, 19, 20, 55].map(interest)).toEqual([0, 0, 2, 2, 4, 4]);
  });

  test('streaks: +n wins / -n losses in a row; a draw counts as a loss; bonus from the tables', () => {
    const state = newGame();
    const [a] = state.players;
    a.gold = 0;
    recordFight(a, true, WIN_GOLD);
    recordFight(a, true, WIN_GOLD);
    expect(a.streak).toBe(2);
    expect(a.gold).toBe(2 * WIN_GOLD);
    recordFight(a, false, WIN_GOLD);
    expect(a.streak).toBe(-1);
    expect(a.gold).toBe(2 * WIN_GOLD);
    expect([1, 2, 3, 9].map(streakBonus)).toEqual([WIN_STREAK_BONUS[1], WIN_STREAK_BONUS[2], WIN_STREAK_BONUS[3], WIN_STREAK_BONUS[WIN_STREAK_BONUS.length - 1]]);
    expect([-1, -2, -3, -9].map(streakBonus)).toEqual([LOSE_STREAK_BONUS[1], LOSE_STREAK_BONUS[2], LOSE_STREAK_BONUS[3], LOSE_STREAK_BONUS[LOSE_STREAK_BONUS.length - 1]]);
  });

  test('a win pays +1 at once, counting toward interest; the round then pays basic + interest + streak', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['titan', 3, 0]]);
    field(b, [['footman', 1, 0]]);
    a.gold = 19;
    b.gold = 19;
    a.streak = 2;
    b.streak = -2;
    resolveCombat(state);
    expect(a.gold).toBe(19 + WIN_GOLD);
    expect(b.gold).toBe(19);
    expect(a.streak).toBe(3);
    expect(b.streak).toBe(-3);
    const round = state.round;
    startRound(state);
    expect(a.gold).toBe(20 + baseReward(round) + 4 + WIN_STREAK_BONUS[3]);
    expect(b.gold).toBe(19 + baseReward(round) + 2 + LOSE_STREAK_BONUS[3]);
  });

  test('monster rounds leave streaks alone and pay no win gold', () => {
    const state = newGame();
    state.round = 1; // I-1, the creeps
    const [a] = state.players;
    a.streak = 2;
    a.gold = 0;
    resolveCombat(state);
    expect(a.streak).toBe(2);
    expect(a.gold).toBe(0);
  });
});
