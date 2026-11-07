import { describe, expect, test } from 'bun:test';
import { defenseMult, simulateCombat } from './combat';
import { EQUIPMENT_DROPS, isEquipmentRound, isMonsterRound, roundAt } from './config';
import { createGame, resolveCombat, startRound } from './game';
import { effectiveTier, fieldStats } from './inventory';
import { AEGIS, BASIC_ITEMS, BERSERKER_FURY, DIVINE_GLAIVE, GLOWING_WAND, HOLY_CRYSTAL, ICE_QUEEN_WAND, DOMINANCE_ICE, ANTIQUE_CUIRASS, GUARDIAN_HELMET, BLADE_ARMOR, THUNDER_BELT, ORACLE, ANCIENT_WRATH, RED_CLOAK, SCYTHE, BLADE_OF_DESPAIR, DEMON_HUNTER_SWORD, EQUIPMENT, GOLDEN_STAFF, HAAS_CLAW, INSPIRE, ITEMS, PURIFY, PURPLE_BUFF, RETRIBUTION, REVITALIZE, SEA_HALBERD, SHEEP_STICK, SPELLBLADE_TALISMAN, THIEF_TOOL, WAR_AXE, WINTER_CROWN } from './items';
import { stageItems } from './inventory';
import { applyAction } from './actions';
import { LUKAS } from './commanders';
import { BASIC_ITEM_ROUND, TICKS_PER_SECOND } from './config';
import { MONSTER_ID } from './monsters';
import { CULT_OF_FIRE, playerTraits, unitStats } from './traits';
import { UNIT_BY_ID } from './units';

const SEEDS = [
  { id: 'a', name: 'A', isBot: true },
  { id: 'b', name: 'B', isBot: true },
  { id: 'c', name: 'C', isBot: true },
];

describe('monster rounds', () => {
  test('I-1 (creeps), then round 3 of every stage from II: II-3, III-3, IV-3, ...', () => {
    const rounds = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(rounds.filter(isMonsterRound)).toEqual([1, roundAt(2, 3), roundAt(3, 3), roundAt(4, 3), roundAt(5, 3)]);
    expect(rounds.filter(isEquipmentRound)).toEqual([7, 13, 19, 25]);
  });

  test('I-1: everyone fights creeps, no equipment (they drop the basic item pick on I-2); a loss costs hp', () => {
    const state = createGame(11, SEEDS);
    expect(state.round).toBe(1);
    const before = new Map(state.players.map((p) => [p.id, { hp: p.hp, items: p.items.length }]));
    const fights = resolveCombat(state);
    for (const f of fights) {
      expect(f.away).toBe(MONSTER_ID);
      expect(f.loot).toBe(0);
      const p = state.players.find((x) => x.id === f.home)!;
      expect(p.hp).toBe(before.get(p.id)!.hp - (f.result.winner === 1 ? f.damage : 0));
    }
    startRound(state);
    for (const p of state.players) expect(p.itemOffer?.every((id) => BASIC_ITEMS.includes(id)) ?? true).toBe(true);
  });

  test('II-3: everyone fights the monsters; win or lose, 2 loot picks each, and a loss still costs hp', () => {
    const state = createGame(11, SEEDS);
    while (state.round < roundAt(2, 3)) {
      resolveCombat(state);
      startRound(state);
    }
    const before = new Map(state.players.map((p) => [p.id, { hp: p.hp, items: p.items.length }]));
    const fights = resolveCombat(state);
    expect(fights).toHaveLength(3);
    for (const f of fights) {
      expect(f.away).toBe(MONSTER_ID);
      expect(f.monster).toBe(true);
      expect(f.loot).toBe(EQUIPMENT_DROPS);
      const p = state.players.find((x) => x.id === f.home)!;
      expect(p.items.length).toBe(before.get(p.id)!.items);
      expect(p.hp).toBe(before.get(p.id)!.hp - (f.result.winner === 1 ? f.damage : 0));
    }
    // Next round: the picks open one at a time, each one physical, one magic or hybrid, one armor.
    for (const p of state.players) p.isBot = false; // bots would pick on the spot
    startRound(state);
    for (const p of state.players) {
      const items = p.items.length;
      for (let pick = 0; pick < EQUIPMENT_DROPS; pick++) {
        expect(p.offerFrom).toBe('loot');
        const groups = p.itemOffer!.map((id) => ITEMS[id].group);
        expect(groups).toHaveLength(3);
        expect(groups[0]).toBe('physical');
        expect(['magic', 'hybrid']).toContain(groups[1]!);
        expect(groups[2]).toBe('armor');
        for (const id of p.itemOffer!) expect(EQUIPMENT).toContain(id);
        expect(applyAction(state, p.id, { type: 'pickItem', item: p.itemOffer![1] }).ok).toBe(true);
      }
      expect(p.items.length).toBe(items + EQUIPMENT_DROPS);
      expect(p.loot).toBe(0);
    }
  });
});

describe('War Axe', () => {
  test('equipment: works with no trait, +25% physical attack and +10% spell lifesteal', () => {
    const state = createGame(1, SEEDS);
    const p = state.players[0];
    p.board.fill(null);
    p.items = [{ uid: 70, id: 'waraxe', tier: 1, holder: 900 }];
    p.board[0] = { uid: 900, defId: 'kindler', star: 1 };
    const levels = playerTraits(p);
    expect(ITEMS.waraxe.trait).toBeUndefined();
    expect(effectiveTier(p.items[0], levels)).toBe(1);
    const s = fieldStats(p, levels, {}).get(900)!;
    const base = unitStats(UNIT_BY_ID.kindler, 1, { levels });
    expect(Math.abs(s.atk - base.atk * (1 + WAR_AXE.atk))).toBeLessThanOrEqual(1); // stats round
    expect(s.spellLifesteal - base.spellLifesteal).toBeCloseTo(WAR_AXE.spellLifesteal);
  });

  test('Fighting Spirit: stacks with damage dealt, up to 5, the 5th adding the damage bonus; unique per holder', () => {
    const fight = (axes: number) => {
      const state = createGame(1, SEEDS);
      const [a, b] = state.players;
      for (const p of state.players) {
        p.board.fill(null);
        p.bench.fill(null);
        p.items = [];
      }
      a.board[3] = { uid: 1, defId: 'kindler', star: 2 };
      a.items = Array.from({ length: axes }, (_, i) => ({ uid: 80 + i, id: 'waraxe', tier: 1, holder: 1 }));
      b.board[3] = { uid: 2, defId: 'titan', star: 2 };
      return simulateCombat({ rng: 1 }, a, b);
    };
    const r = fight(1);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const spirits = r.events.filter((e) => e.type === 'buff' && e.effect === 'fightingspirit' && e.id === me);
    // One buff per new stack: it climbs to 5 and holds while the hits keep coming.
    expect(spirits.length).toBeGreaterThanOrEqual(WAR_AXE.stacks);
    // Two axes: the passive is unique, so it climbs the same way.
    const r2 = fight(2);
    const first = (res: typeof r) => res.events.filter((e) => e.type === 'buff' && e.effect === 'fightingspirit').slice(0, WAR_AXE.stacks).length;
    expect(first(r2)).toBe(first(r));
  });
});

describe("Haas's Claw", () => {
  test('+20% physical attack, +15% crit chance each; the 15% lifesteal counts once per hero', () => {
    const state = createGame(1, SEEDS);
    const p = state.players[0];
    p.board.fill(null);
    p.board[0] = { uid: 900, defId: 'kindler', star: 1 };
    const levels = playerTraits(p);
    const base = unitStats(UNIT_BY_ID.kindler, 1, { levels });
    const withClaws = (n: number) => {
      p.items = Array.from({ length: n }, (_, i) => ({ uid: 90 + i, id: 'haasclaw', tier: 1, holder: 900 }));
      return fieldStats(p, levels, {}).get(900)!;
    };
    const one = withClaws(1);
    expect(EQUIPMENT).toContain('haasclaw');
    expect(one.critChance - base.critChance).toBeCloseTo(HAAS_CLAW.critChance);
    expect(one.lifesteal - base.lifesteal).toBeCloseTo(HAAS_CLAW.lifesteal);
    const two = withClaws(2);
    expect(two.critChance - base.critChance).toBeCloseTo(2 * HAAS_CLAW.critChance);
    expect(two.lifesteal - base.lifesteal).toBeCloseTo(HAAS_CLAW.lifesteal); // unique: not doubled
  });
});

describe('basic items', () => {
  test('round 2 offers random basic items (never monster loot); pick one, or the first is taken at the fight', () => {
    expect(BASIC_ITEMS).toContain('aegis');
    expect(EQUIPMENT).not.toContain('aegis');
    const state = createGame(4, [{ id: 'you', name: 'You', isBot: false }, ...SEEDS]);
    const p = state.players[0];
    applyAction(state, p.id, { type: 'pickCommander', commander: 'lukas' });
    while (state.round < BASIC_ITEM_ROUND) {
      resolveCombat(state);
      startRound(state);
    }
    expect(p.itemOffer?.length).toBe(Math.min(3, BASIC_ITEMS.length));
    for (const id of p.itemOffer!) expect(BASIC_ITEMS).toContain(id);
    // Bots already picked theirs.
    for (const bot of state.players.slice(1)) expect(bot.itemOffer).toBeUndefined();
    const items = p.items.length;
    expect(applyAction(state, p.id, { type: 'pickItem', item: 'waraxe' }).ok).toBe(false);
    expect(applyAction(state, p.id, { type: 'pickItem', item: p.itemOffer![0] }).ok).toBe(true);
    expect(p.items.length).toBe(items + 1);
    expect(p.itemOffer).toBeUndefined();
  });

  test('an unpicked basic item is taken when the fight starts', () => {
    const state = createGame(4, [{ id: 'you', name: 'You', isBot: false }, ...SEEDS]);
    const p = state.players[0];
    applyAction(state, p.id, { type: 'pickCommander', commander: 'lukas' });
    while (state.round < BASIC_ITEM_ROUND) {
      resolveCombat(state);
      startRound(state);
    }
    const offered = p.itemOffer![0];
    resolveCombat(state);
    expect(p.items.some((i) => i.id === offered)).toBe(true);
    expect(p.itemOffer).toBeUndefined();
  });
});

describe('Aegis', () => {
  test('at fight start: the holder and its left and right neighbours get 25% of their max hp as a shield, once per holder', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    // Front row: 2, [3 holder], 4, and 6 out of reach; one more behind the holder.
    for (const cell of [2, 3, 4, 6, 10]) a.board[cell] = { uid: cell + 1, defId: 'knight', star: 1 };
    a.items = [
      { uid: 90, id: 'aegis', tier: 1, holder: 4 },
      { uid: 91, id: 'aegis', tier: 1, holder: 4 }, // a second copy: unique, no extra shield
    ];
    b.board[3] = { uid: 50, defId: 'titan', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const shields = r.events.filter((e) => e.type === 'shield' && e.t === 0);
    const at = (cell: number) => {
      // Board cell -> the fighter that started there (side 0, front row is y = 3).
      const x = cell % 7;
      const y = 3 + Math.floor(cell / 7);
      return r.fighters.find((f) => f.side === 0 && f.x === x && f.y === y)!;
    };
    const shielded = shields.map((e) => (e.type === 'shield' ? e.id : -1)).sort();
    expect(shielded).toEqual([at(2).id, at(3).id, at(4).id].sort());
    for (const e of shields) if (e.type === 'shield') {
      const f = r.fighters.find((x) => x.id === e.id)!;
      expect(e.amount).toBe(Math.round(f.maxHp * AEGIS.share));
      expect(e.until).toBe(AEGIS.seconds * TICKS_PER_SECOND);
    }
  });
});

describe('Inspire', () => {
  test('+20/30/40/50% attack speed by stage (I, II, III, IV+), once per hero', () => {
    const state = createGame(1, SEEDS);
    const p = state.players[0];
    p.board.fill(null);
    p.board[0] = { uid: 900, defId: 'kindler', star: 1 };
    p.items = [
      { uid: 95, id: 'inspire', tier: 1, holder: 900 },
      { uid: 96, id: 'inspire', tier: 1, holder: 900 }, // unique: a second one adds nothing
    ];
    const levels = playerTraits(p);
    const base = unitStats(UNIT_BY_ID.kindler, 1, { levels }).attackSpeed;
    for (const [round, bonus] of [[1, 0.2], [4, 0.2], [5, 0.3], [10, 0.3], [11, 0.4], [16, 0.4], [17, 0.5], [55, 0.5]] as const) {
      state.round = round;
      stageItems(state, p);
      expect(fieldStats(p, levels, {}).get(900)!.attackSpeed - base).toBeCloseTo(bonus);
    }
    expect(INSPIRE.attackSpeed).toEqual([0.2, 0.3, 0.4, 0.5]);
    expect(BASIC_ITEMS).toContain('inspire');
  });
});

describe('Purify', () => {
  function fight(withPurify: boolean) {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 3 };
    if (withPurify) a.items = [{ uid: 97, id: 'purify', tier: 1, holder: 1 }];
    // The Ash Warden taunts; the Wandering Fist leaps in and stuns.
    b.board[3] = { uid: 2, defId: 'ashwarden', star: 1 };
    b.board[4] = { uid: 3, defId: 'wanderingblade', star: 1 };
    return simulateCombat({ rng: 1 }, a, b);
  }

  test('+15% attack speed; no stuns, taunts or pulls on it for the first 30s', () => {
    const plain = fight(false);
    const me = (r: ReturnType<typeof fight>) => r.fighters.find((f) => f.side === 0)!.id;
    const cc = (r: ReturnType<typeof fight>) =>
      r.events.filter((e) => (e.type === 'stun' || e.type === 'taunt' || e.type === 'dash') && e.id === me(r) && e.t < PURIFY.seconds * TICKS_PER_SECOND);
    expect(cc(plain).length).toBeGreaterThan(0); // these enemies do control it without Purify
    expect(cc(fight(true))).toEqual([]);
  });
});

describe('Retribution', () => {
  test('+20/30/40/50% damage by stage, once per hero', () => {
    const state = createGame(1, SEEDS);
    const p = state.players[0];
    p.board.fill(null);
    p.board[0] = { uid: 900, defId: 'kindler', star: 1 };
    p.items = [
      { uid: 98, id: 'retribution', tier: 1, holder: 900 },
      { uid: 99, id: 'retribution', tier: 1, holder: 900 }, // unique
    ];
    const levels = playerTraits(p);
    const base = unitStats(UNIT_BY_ID.kindler, 1, { levels }).damageAmp;
    for (const [round, bonus] of [[2, 0.2], [roundAt(2, 1), 0.3], [roundAt(3, 6), 0.4], [roundAt(4, 1), 0.5], [40, 0.5]] as const) {
      state.round = round;
      stageItems(state, p);
      expect(fieldStats(p, levels, {}).get(900)!.damageAmp - base).toBeCloseTo(bonus);
    }
    expect(RETRIBUTION.damage).toEqual([0.2, 0.3, 0.4, 0.5]);
    expect(BASIC_ITEMS).toContain('retribution');
  });
});

describe('Revitalize', () => {
  test('under 50% hp once: a spring heals allies around that spot 6% of max hp each second, 5 times', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 2 };
    a.board[4] = { uid: 2, defId: 'knight', star: 2 };
    a.items = [{ uid: 93, id: 'revitalize', tier: 1, holder: 1 }];
    b.board[3] = { uid: 3, defId: 'titan', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const springs = r.events.filter((e) => e.type === 'ground' && e.effect === 'revitalize');
    expect(springs).toHaveLength(1);
    const start = springs[0].t;
    const heals = r.events.filter((e) => e.type === 'heal' && e.t >= start && e.t < start + REVITALIZE.seconds * TICKS_PER_SECOND);
    expect(heals.length).toBeGreaterThan(0);
    for (const e of heals) if (e.type === 'heal') {
      const f = r.fighters.find((x) => x.id === e.id)!;
      expect(f.side).toBe(0);
      expect(e.amount).toBeLessThanOrEqual(Math.round(f.maxHp * REVITALIZE.heal));
    }
    // At most one heal per ally per second, and never more than 5 rounds of them.
    const ticks = new Set(heals.map((e) => e.t));
    expect(ticks.size).toBeLessThanOrEqual(REVITALIZE.seconds / REVITALIZE.every);
  });
});

describe('Golden Staff', () => {
  test('+15% attack speed; each basic attack adds 2% more, up to 50 stacks, for the whole fight', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 2 };
    a.items = [{ uid: 94, id: 'goldenstaff', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'titan', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const attacks = r.events.filter((e) => e.type === 'attack' && e.id === me);
    const stacks = r.events.filter((e) => e.type === 'buff' && e.effect === 'impulsive' && e.id === me);
    // One new stack per basic attack until the cap, never more.
    expect(stacks.length).toBe(Math.min(attacks.length, GOLDEN_STAFF.stacks));
    for (const e of stacks) if (e.type === 'buff') expect(e.until).toBeUndefined(); // lasts the whole fight
    // It attacks faster as it goes: later gaps between its attacks are shorter than the first.
    const gaps = attacks.slice(1).map((e, i) => e.t - attacks[i].t).filter((g) => g > 0);
    expect(gaps[gaps.length - 1]).toBeLessThan(gaps[0]);
  });
});

describe('Blade of Despair', () => {
  test('+20% physical attack; hits on targets under 50% hp are 25% stronger, from that very hit', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 3 };
    a.items = [{ uid: 92, id: 'bladeofdespair', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'paladin', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const foe = r.fighters.find((f) => f.side === 1)!;
    // Its plain attacks on the foe: before and after the foe drops under half.
    const hits = r.events.filter((e) => e.type === 'attack' && e.id === me && !e.crit && !e.again);
    let hpBefore = foe.maxHp;
    let high = 0;
    let low = 0;
    for (const e of hits) {
      if (e.type !== 'attack') continue;
      if (hpBefore >= foe.maxHp * BLADE_OF_DESPAIR.below) high = high || e.damage;
      else low = low || e.damage;
      hpBefore = e.hp;
    }
    expect(high).toBeGreaterThan(0);
    expect(low).toBeGreaterThan(0);
    expect(low / high).toBeCloseTo(1 + BLADE_OF_DESPAIR.amp, 1);
    expect(r.events.some((e) => e.type === 'buff' && e.effect === 'despair' && e.id === me)).toBe(true);
  });
});

describe("Berserker's Fury", () => {
  test('+10% physical attack, +20% crit chance, +40% crit damage', () => {
    const state = createGame(1, SEEDS);
    const p = state.players[0];
    p.board.fill(null);
    p.board[0] = { uid: 900, defId: 'kindler', star: 1 };
    p.items = [{ uid: 89, id: 'berserkerfury', tier: 1, holder: 900 }];
    const levels = playerTraits(p);
    const base = unitStats(UNIT_BY_ID.kindler, 1, { levels });
    const s = fieldStats(p, levels, {}).get(900)!;
    expect(Math.abs(s.atk - base.atk * (1 + BERSERKER_FURY.atk))).toBeLessThanOrEqual(1);
    expect(s.critChance - base.critChance).toBeCloseTo(BERSERKER_FURY.critChance);
    expect(s.critDamage - base.critDamage).toBeCloseTo(BERSERKER_FURY.critDamage);
    expect(EQUIPMENT).toContain('berserkerfury');
  });
});

describe('Demon Hunter Sword', () => {
  test('+10% attack speed; every basic attack bites 2% of the target max hp as physical damage', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 2 };
    a.items = [{ uid: 88, id: 'demonhuntersword', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'titan', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const foe = r.fighters.find((f) => f.side === 1)!;
    const attacks = r.events.filter((e) => e.type === 'attack' && e.id === me);
    const bites = r.events.filter((e) => e.type === 'effect' && e.effect === 'engulf' && e.by === me);
    expect(bites.length).toBe(attacks.length);
    const raw = foe.maxHp * DEMON_HUNTER_SWORD.engulf;
    // Physical, so the titan's armor trims it.
    for (const e of bites) if (e.type === 'effect') expect(e.damage).toBeLessThanOrEqual(Math.round(raw));
    expect(bites[0].type === 'effect' && bites[0].damage).toBeGreaterThan(0);
  });
});

describe('Sea Halberd', () => {
  function fight(withHalberd: boolean) {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 2 };
    if (withHalberd) a.items = [{ uid: 87, id: 'seahalberd', tier: 1, holder: 1 }];
    // A lifestealing enemy: Haas's Claw.
    b.board[3] = { uid: 2, defId: 'knight', star: 2 };
    b.items = [{ uid: 86, id: 'haasclaw', tier: 1, holder: 2 }];
    return simulateCombat({ rng: 1 }, a, b);
  }

  test('+15% physical attack and 25 defense penetration (unique attribute)', () => {
    const state = createGame(1, SEEDS);
    const p = state.players[0];
    p.board.fill(null);
    p.board[0] = { uid: 900, defId: 'kindler', star: 1 };
    p.items = [
      { uid: 85, id: 'seahalberd', tier: 1, holder: 900 },
      { uid: 84, id: 'seahalberd', tier: 1, holder: 900 },
    ];
    const levels = playerTraits(p);
    const base = unitStats(UNIT_BY_ID.kindler, 1, { levels });
    const s = fieldStats(p, levels, {}).get(900)!;
    expect(s.armorShred - base.armorShred).toBe(SEA_HALBERD.penetration); // once, not twice
  });

  test("Lifebane: the target's lifesteal heals 40% less once it's been hit", () => {
    const heals = (r: ReturnType<typeof fight>) => {
      const foe = r.fighters.find((f) => f.side === 1)!.id;
      return r.events.filter((e) => e.type === 'heal' && e.id === foe);
    };
    const cut = fight(true);
    expect(cut.events.some((e) => e.type === 'debuff' && e.effect === 'lifebane')).toBe(true);
    // Each of its lifesteal heals vs the damage of the attack that caused it.
    const ratio = (r: ReturnType<typeof fight>) => {
      const foe = r.fighters.find((f) => f.side === 1)!.id;
      const h = heals(r).at(-1)!;
      const hit = r.events.filter((e) => e.type === 'attack' && e.id === foe && e.t === h.t).at(-1)!;
      return h.type === 'heal' && hit.type === 'attack' ? h.amount / hit.damage : 0;
    };
    expect(heals(fight(false)).length).toBeGreaterThan(0);
    expect(ratio(cut) / ratio(fight(false))).toBeCloseTo(1 - SEA_HALBERD.cut, 1);
  });
});

describe('Ice Queen Wand', () => {
  test('+15% magic attack, +15% spell vamp; skill damage slows the target attack speed by 15% for 5s', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'ethersage', star: 2 }; // a spellcaster: its skill is skill damage
    a.items = [{ uid: 83, id: 'icequeenwand', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'knight', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const foe = r.fighters.find((f) => f.side === 1)!.id;
    const chills = r.events.filter((e) => e.type === 'buff' && e.effect === 'icebound');
    expect(chills.length).toBeGreaterThan(0);
    for (const e of chills) if (e.type === 'buff') {
      expect(e.id).toBe(foe);
      expect(e.by).toBe(me);
      expect(e.until! - e.t).toBe(ICE_QUEEN_WAND.seconds * TICKS_PER_SECOND);
    }
    // Only skill damage chills: the first chill comes with its first skill, not its first basic attack.
    const firstSkill = r.events.find((e) => (e.type === 'skill' || e.type === 'cast') && e.id === me)!;
    expect(chills[0].t).toBe(firstSkill.t);

    const p = state.players[0];
    p.board.fill(null);
    p.board[0] = { uid: 900, defId: 'kindler', star: 1 };
    p.items = [{ uid: 82, id: 'icequeenwand', tier: 1, holder: 900 }];
    const levels = playerTraits(p);
    const base = unitStats(UNIT_BY_ID.kindler, 1, { levels });
    const s = fieldStats(p, levels, {}).get(900)!;
    expect(Math.abs(s.ap - base.ap * (1 + ICE_QUEEN_WAND.ap))).toBeLessThanOrEqual(1);
    expect(s.spellLifesteal - base.spellLifesteal).toBeCloseTo(ICE_QUEEN_WAND.spellVamp);
  });
});

describe('Glowing Wand', () => {
  test('Scorch: skill damage burns 2.5% max hp (min 10) every second for 3s, refreshed per hit', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'ethersage', star: 2 };
    a.items = [{ uid: 81, id: 'glowingwand', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'knight', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const foe = r.fighters.find((f) => f.side === 1)!;
    const burns = r.events.filter((e) => e.type === 'effect' && e.effect === 'scorch');
    expect(burns.length).toBeGreaterThan(0);
    const firstSkill = r.events.find((e) => (e.type === 'skill' || e.type === 'cast') && e.id === me)!;
    expect(burns[0].t).toBe(firstSkill.t + TICKS_PER_SECOND); // first tick a second after the hit
    const raw = Math.max(GLOWING_WAND.min, foe.maxHp * GLOWING_WAND.burn);
    for (const e of burns) if (e.type === 'effect') {
      expect(e.by).toBe(me);
      expect(e.target).toBe(foe.id);
      expect(e.damage).toBeLessThanOrEqual(Math.round(raw)); // magic resist only trims it
    }
    // Ticks are a second apart: never two in one second from one wand.
    for (let i = 1; i < burns.length; i++) expect(burns[i].t - burns[i - 1].t).toBeGreaterThanOrEqual(TICKS_PER_SECOND);
  });
});

describe('Holy Crystal', () => {
  test('+20% magic attack; Mystery: +10% skill damage, once per hero', () => {
    const state = createGame(1, SEEDS);
    const p = state.players[0];
    p.board.fill(null);
    p.board[0] = { uid: 900, defId: 'ethersage', star: 1 };
    p.items = [
      { uid: 79, id: 'holycrystal', tier: 1, holder: 900 },
      { uid: 78, id: 'holycrystal', tier: 1, holder: 900 },
    ];
    const levels = playerTraits(p);
    const s = fieldStats(p, levels, {}).get(900)!;
    const held = p.items;
    p.items = [];
    const base = fieldStats(p, levels, {}).get(900)!;
    p.items = held;
    expect(Math.abs(s.ap - base.ap * (1 + 2 * HOLY_CRYSTAL.ap))).toBeLessThanOrEqual(2); // the attribute stacks
    expect(s.skillAmp - base.skillAmp).toBeCloseTo(HOLY_CRYSTAL.skillDamage); // the passive doesn't
  });
});

describe('Divine Glaive', () => {
  test('+25% magic attack; its magic damage ignores 35% of the target magic resist (once per hero)', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    // A magic basic attacker against a plain knight: its first hit shows the resist it got through.
    a.board[3] = { uid: 1, defId: 'boneadept', star: 1 };
    a.items = [
      { uid: 77, id: 'divineglaive', tier: 1, holder: 1 },
      { uid: 76, id: 'divineglaive', tier: 1, holder: 1 }, // unique attribute: no extra penetration
    ];
    b.board[3] = { uid: 2, defId: 'knight', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!;
    const hit = r.events.find((e) => e.type === 'attack' && e.id === me.id && !e.crit);
    if (hit?.type !== 'attack') throw new Error('no attack');
    const levels = playerTraits(a);
    const ap = fieldStats(a, levels, {}).get(1)!.ap;
    const mr = UNIT_BY_ID.knight.mr * (1 - DIVINE_GLAIVE.magicPen);
    expect(hit.damage).toBe(Math.round(ap * defenseMult(mr)));
  });
});

describe('Winter Crown', () => {
  test('Freeze: once, under 25% (or a lethal hit): untouchable and untargeted for 1s, healing 10% max hp', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 1 };
    a.board[4] = { uid: 2, defId: 'knight', star: 1 };
    a.items = [{ uid: 75, id: 'wintercrown', tier: 1, holder: 1 }];
    b.board[3] = { uid: 3, defId: 'titan', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0 && f.x === 3)!;
    const freezes = r.events.filter((e) => e.type === 'buff' && e.effect === 'freeze');
    expect(freezes).toHaveLength(1);
    const f = freezes[0];
    if (f.type !== 'buff') throw new Error();
    expect(f.id).toBe(me.id);
    // While frozen: nobody hits it, and it heals 10% of max hp.
    const during = r.events.filter((e) => e.t >= f.t && e.t < f.until!);
    // (The hit that froze it lands on the same tick, just before.)
    const hits = during.filter((e) => e.t > f.t && (e.type === 'attack' || e.type === 'effect') && e.target === me.id && e.damage > 0);
    expect(hits).toEqual([]);
    const healed = during.filter((e) => e.type === 'heal' && e.id === me.id).reduce((n, e) => n + (e.type === 'heal' ? e.amount : 0), 0);
    expect(Math.abs(healed - me.maxHp * WINTER_CROWN.heal)).toBeLessThanOrEqual(WINTER_CROWN.seconds * TICKS_PER_SECOND);
    // It froze on the way down: under a quarter of its max hp, never dead before.
    expect(r.events.some((e) => e.type === 'death' && e.id === me.id && e.t <= f.t)).toBe(false);
  });
});

describe('Winter Crown, lethal hit', () => {
  test('a hit that would kill leaves it at 1 hp, frozen instead of dead', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    // Lukas's beast on b's back row, tuned to a sure kill for this test.
    b.commander = 'lukas'; // set, not picked: a bot already rolled a random commander
    b.board.fill(null);
    b.board[17] = { uid: 9, defId: 'divinebeast', star: 1 };
    b.board[3] = { uid: 8, defId: 'knight', star: 1 };
    a.commander = null;
    a.board[3] = { uid: 1, defId: 'knight', star: 1 };
    a.items = [{ uid: 74, id: 'wintercrown', tier: 1, holder: 1 }];
    const saved = LUKAS.innate.damage;
    LUKAS.innate.damage = 5; // 500% of max hp
    try {
      const r = simulateCombat({ rng: 1 }, a, b);
      const me = r.fighters.find((f) => f.side === 0)!.id;
      const beam = r.events.find((e) => e.type === 'effect' && e.effect === 'divinebeast' && e.target === me);
      expect(beam?.type === 'effect' && beam.hp).toBe(1);
      expect(r.events.some((e) => e.type === 'buff' && e.effect === 'freeze' && e.id === me && e.t === 0)).toBe(true);
      expect(r.events.some((e) => e.type === 'death' && e.id === me && e.t === 0)).toBe(false);
    } finally {
      LUKAS.innate.damage = saved;
    }
  });
});

describe('Spellblade Talisman', () => {
  test('+15% attack and magic attack; starts the fight with 55% of max mana', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'ethersage', star: 1 };
    a.items = [{ uid: 73, id: 'spellbladetalisman', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'knight', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!;
    expect(me.mana).toBe(Math.floor(me.maxMana * SPELLBLADE_TALISMAN.startMana));
    const levels = playerTraits(a);
    const s = fieldStats(a, levels, {}).get(1)!;
    a.items = [];
    const base = fieldStats(a, levels, {}).get(1)!;
    expect(Math.abs(s.atk - base.atk * (1 + SPELLBLADE_TALISMAN.hybridAtk))).toBeLessThanOrEqual(1);
    expect(Math.abs(s.ap - base.ap * (1 + SPELLBLADE_TALISMAN.hybridAtk))).toBeLessThanOrEqual(1);
  });
});

describe('Purple Buff', () => {
  test('+10% attack and magic attack; 10 mana back after every skill cast', () => {
    const manaAfterCast = (withBuff: boolean) => {
      const state = createGame(1, SEEDS);
      const [a, b] = state.players;
      for (const p of state.players) {
        p.board.fill(null);
        p.bench.fill(null);
        p.items = [];
      }
      a.board[3] = { uid: 1, defId: 'wyrmcaller', star: 2 }; // a one-shot skill, then back to attacking
      if (withBuff) a.items = [{ uid: 72, id: 'purplebuff', tier: 1, holder: 1 }];
      b.board[3] = { uid: 2, defId: 'knight', star: 2 };
      const r = simulateCombat({ rng: 1 }, a, b);
      const me = r.fighters.find((f) => f.side === 0)!.id;
      const cast = r.events.findIndex((e) => e.type === 'skill' && e.id === me);
      const next = r.events.slice(cast + 1).find((e) => (e.type === 'attack' || e.type === 'skill') && e.id === me);
      if (cast < 0 || next?.type !== 'attack') throw new Error('no cast then attack');
      return next.mana;
    };
    expect(manaAfterCast(true) - manaAfterCast(false)).toBe(PURPLE_BUFF.castMana);
  });
});

describe('Sheep Stick', () => {
  test('sheeps the highest-star enemy for 3s at the start, then its attack target for 1.5s every 12s', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 3 };
    a.items = [{ uid: 71, id: 'sheepstick', tier: 1, holder: 1 }];
    b.board[2] = { uid: 2, defId: 'knight', star: 1 };
    b.board[3] = { uid: 3, defId: 'titan', star: 2 }; // the highest star
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const titan = r.fighters.find((f) => f.defId === 'titan')!.id;
    const sheeps = r.events.filter((e) => e.type === 'stun' && e.effect === 'sheep' && e.by === me);
    expect(sheeps[0]).toMatchObject({ t: 0, id: titan, until: SHEEP_STICK.opening * TICKS_PER_SECOND });
    const onHit = sheeps.slice(1);
    expect(onHit.length).toBeGreaterThan(0);
    for (const e of onHit) if (e.type === 'stun') expect(e.until - e.t).toBe(SHEEP_STICK.onHit * TICKS_PER_SECOND);
    for (let i = 1; i < onHit.length; i++) expect(onHit[i].t - onHit[i - 1].t).toBeGreaterThanOrEqual(SHEEP_STICK.cooldown * TICKS_PER_SECOND);
  });
});

describe('Thief Tool', () => {
  test('takes all 3 slots: nothing else on its holder, and not on a hero already holding items', () => {
    const state = createGame(1, SEEDS);
    const p = state.players[0];
    p.board.fill(null);
    p.board[0] = { uid: 900, defId: 'kindler', star: 1 };
    p.board[1] = { uid: 901, defId: 'kindler', star: 1 };
    p.items = [
      { uid: 60, id: 'thieftool', tier: 1, holder: null },
      { uid: 61, id: 'waraxe', tier: 1, holder: 901 },
      { uid: 62, id: 'haasclaw', tier: 1, holder: null },
    ];
    expect(applyAction(state, p.id, { type: 'equip', item: 60, unit: 901 }).ok).toBe(false);
    expect(applyAction(state, p.id, { type: 'equip', item: 60, unit: 900 }).ok).toBe(true);
    expect(applyAction(state, p.id, { type: 'equip', item: 62, unit: 900 }).ok).toBe(false);
  });

  test('each fight it copies 2 different random equipment onto its holder, for that fight only', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 2 };
    a.items = [{ uid: 63, id: 'thieftool', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'knight', star: 2 };
    const r = simulateCombat({ rng: 7 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!;
    const ids = me.items.map((i) => i.id);
    expect(ids).toContain('thieftool');
    const copies = ids.filter((id) => id !== 'thieftool');
    expect(copies).toHaveLength(THIEF_TOOL.copies);
    expect(new Set(copies).size).toBe(THIEF_TOOL.copies);
    for (const id of copies) expect(EQUIPMENT).toContain(id);
    expect(a.items).toHaveLength(1); // the player keeps just the Tool
  });
});

describe('Cult of Fire burn', () => {
  test("a cultist's basic attacks burn the target for a share of its max hp per second, magic; so does the Offering bearer", () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    // Cult of Fire 2: Kindler and Pyre Guard; the Offering on a plain Knight.
    a.board[2] = { uid: 1, defId: 'kindler', star: 1 };
    a.board[3] = { uid: 2, defId: 'pyreguard', star: 1 };
    a.board[4] = { uid: 3, defId: 'knight', star: 1 };
    a.items = [{ uid: 70, id: 'offering', tier: 1, holder: 3 }];
    b.board[3] = { uid: 9, defId: 'titan', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const titan = r.fighters.find((f) => f.side === 1)!;
    const burns = r.events.filter((e) => e.type === 'effect' && e.effect === 'cultburn');
    expect(burns.length).toBeGreaterThan(0);
    const raw = titan.maxHp * CULT_OF_FIRE.burn[0];
    for (const e of burns) if (e.type === 'effect') expect(e.damage).toBeLessThanOrEqual(Math.round(raw)); // magic resist trims it
    const knight = r.fighters.find((f) => f.defId === 'knight' && f.side === 0)!.id;
    expect(burns.some((e) => e.type === 'effect' && e.by === knight)).toBe(true); // the bearer burns too
  });
});

describe('Dominance Ice', () => {
  const setup = (withItem: boolean) => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 3 }; // front row middle
    if (withItem) a.items = [{ uid: 84, id: 'dominanceice', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'footman', star: 1 }; // walks up to it
    b.board[20] = { uid: 3, defId: 'archer', star: 1 }; // back corner: 3 cells away, in range, never moves
    return { a, b };
  };

  test('+50 magic resist, +10% max HP', () => {
    const { a } = setup(true);
    const levels = playerTraits(a);
    const s = fieldStats(a, levels, {}).get(1)!;
    const base = unitStats(UNIT_BY_ID.knight, 3, { levels });
    expect(s.mr - base.mr).toBe(DOMINANCE_ICE.mr);
    expect(Math.abs(s.hp - base.hp * (1 + DOMINANCE_ICE.hp))).toBeLessThanOrEqual(1);
  });

  test('Arctic Cold: enemies within 2 cells lose 20% attack speed; farther ones are untouched', () => {
    const { a, b } = setup(true);
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const footman = r.fighters.find((f) => f.defId === 'footman')!.id;
    const archer = r.fighters.find((f) => f.defId === 'archer')!.id;
    const chills = r.events.filter((e) => e.type === 'buff' && e.effect === 'arcticcold');
    expect(chills.some((e) => e.type === 'buff' && e.id === footman)).toBe(true);
    // The archer stays put 3 cells away: no chill until the footman falls and the holder walks over.
    const footmanDies = r.events.find((e) => e.type === 'death' && e.id === footman)!.t;
    expect(chills.some((e) => e.type === 'buff' && e.id === archer && e.t <= footmanDies)).toBe(false);
    for (const e of chills) if (e.type === 'buff') {
      expect(e.by).toBe(me);
      expect(e.until! - e.t).toBe(DOMINANCE_ICE.linger * TICKS_PER_SECOND);
    }
    // Slowed: the footman attacks less often than it does against a holder without the item.
    const attacks = (withItem: boolean) => {
      const s = setup(withItem);
      const fight = simulateCombat({ rng: 1 }, s.a, s.b);
      const id = fight.fighters.find((f) => f.defId === 'footman')!.id;
      return fight.events.filter((e) => e.type === 'attack' && e.id === id && e.t < 200).length;
    };
    expect(attacks(true)).toBeLessThan(attacks(false));
  });

  test('the holder gains 25% more mana from taking hits', () => {
    const firstHitMana = (withItem: boolean) => {
      const { a, b } = setup(withItem);
      const r = simulateCombat({ rng: 1 }, a, b);
      const me = r.fighters.find((f) => f.side === 0)!.id;
      const hit = r.events.find((e) => e.type === 'attack' && e.target === me && !r.events.some((x) => x.type === 'attack' && x.id === me && x.t <= e.t))!;
      return hit.type === 'attack' ? hit.targetMana : 0;
    };
    expect(firstHitMana(false)).toBe(5);
    expect(firstHitMana(true)).toBe(Math.floor(5 * (1 + DOMINANCE_ICE.hurtMana)));
  });
});

describe('Antique Cuirass', () => {
  const setup = (withItem: boolean) => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'titan', star: 1 };
    if (withItem) a.items = [{ uid: 85, id: 'antiquecuirass', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'paladin', star: 3 }; // tanky: lives through many hits
    return { a, b };
  };

  test('+10% max HP, 10% damage reduction', () => {
    const { a } = setup(true);
    const levels = playerTraits(a);
    const s = fieldStats(a, levels, {}).get(1)!;
    const base = unitStats(UNIT_BY_ID.titan, 1, { levels });
    expect(Math.abs(s.hp - base.hp * (1 + ANTIQUE_CUIRASS.hp))).toBeLessThanOrEqual(1);
    expect(s.damageTaken - base.damageTaken).toBeCloseTo(-ANTIQUE_CUIRASS.reduction);
  });

  test('Deter: each hit on the holder takes 4% attack and magic attack off the attacker for 3s, up to 5 stacks', () => {
    const { a, b } = setup(true);
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const foe = r.fighters.find((f) => f.side === 1)!.id;
    const deters = r.events.filter((e) => e.type === 'buff' && e.effect === 'deter');
    // One per paladin hit on the holder: attacks and casts alike.
    const damaging = r.events.filter((e) => (e.type === 'attack' || e.type === 'cast') && e.id === foe && e.target === me && e.damage > 0);
    expect(deters.length).toBe(damaging.length);
    const hits = damaging.filter((e) => e.type === 'attack');
    for (const e of deters) if (e.type === 'buff') {
      expect(e.id).toBe(foe);
      expect(e.by).toBe(me);
      expect(e.until! - e.t).toBe(ANTIQUE_CUIRASS.seconds * TICKS_PER_SECOND);
    }
    expect(deters.length).toBeGreaterThan(ANTIQUE_CUIRASS.max);
    // Damage drops as stacks build, then holds at 5 stacks (20% less attack): compare first and later hits.
    const first = hits[0].type === 'attack' ? hits[0].damage : 0;
    const later = hits.slice(ANTIQUE_CUIRASS.max, ANTIQUE_CUIRASS.max + 3).map((e) => (e.type === 'attack' && !e.crit ? e.damage : 0)).filter(Boolean);
    for (const d of later) expect(d / first).toBeCloseTo(1 - ANTIQUE_CUIRASS.perStack * ANTIQUE_CUIRASS.max, 1);
  });

  test('takes 10% less damage', () => {
    const firstHit = (withItem: boolean) => {
      const { a, b } = setup(withItem);
      const r = simulateCombat({ rng: 1 }, a, b);
      const hit = r.events.find((e) => e.type === 'attack' && e.id === r.fighters.find((f) => f.side === 1)!.id && !e.crit)!;
      return hit.type === 'attack' ? hit.damage : 0;
    };
    expect(firstHit(true) / firstHit(false)).toBeCloseTo(1 - ANTIQUE_CUIRASS.reduction, 1);
  });
});

describe('Guardian Helmet', () => {
  test('+15% max HP; heals 1.5% of max HP every second', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 1 };
    a.items = [{ uid: 86, id: 'guardianhelmet', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'paladin', star: 2 };
    const levels = playerTraits(a);
    const s = fieldStats(a, levels, {}).get(1)!;
    const base = unitStats(UNIT_BY_ID.knight, 1, { levels });
    expect(Math.abs(s.hp - base.hp * (1 + GUARDIAN_HELMET.hp))).toBeLessThanOrEqual(1);

    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!;
    const heals = r.events.filter((e) => e.type === 'heal' && e.id === me.id);
    expect(heals.length).toBeGreaterThan(1);
    for (const e of heals) if (e.type === 'heal') {
      expect(e.t % TICKS_PER_SECOND).toBe(0);
      expect(e.amount).toBeLessThanOrEqual(Math.round(me.maxHp * GUARDIAN_HELMET.regen));
    }
    // A full tick of regen once it's hurt enough.
    expect(heals.some((e) => e.type === 'heal' && e.amount === Math.round(me.maxHp * GUARDIAN_HELMET.regen))).toBe(true);
  });
});

describe('Blade Armor', () => {
  const fight = (withItem: boolean) => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 1 };
    if (withItem) a.items = [{ uid: 87, id: 'bladearmor', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'paladin', star: 2 };
    return { a, b, r: simulateCombat({ rng: 1 }, a, b) };
  };

  test('+50 armor; every basic attack on the holder sends 30% of its damage back, physical', () => {
    const { a, r } = fight(true);
    const levels = playerTraits(a);
    expect(fieldStats(a, levels, {}).get(1)!.armor - unitStats(UNIT_BY_ID.knight, 1, { levels }).armor).toBe(BLADE_ARMOR.armor);

    const me = r.fighters.find((f) => f.side === 0)!.id;
    const foe = r.fighters.find((f) => f.side === 1)!.id;
    const hits = r.events.filter((e) => e.type === 'attack' && e.id === foe && e.target === me && e.damage > 0);
    const back = r.events.filter((e) => e.type === 'effect' && e.effect === 'vengeance');
    expect(back.length).toBe(hits.length);
    hits.forEach((h, i) => {
      const v = back[i];
      if (h.type !== 'attack' || v.type !== 'effect') return;
      expect(v.t).toBe(h.t);
      expect(v.by).toBe(me);
      expect(v.target).toBe(foe);
      // The paladin's armor trims it below 30% of the hit.
      expect(v.damage).toBeGreaterThan(0);
      expect(v.damage).toBeLessThan(h.damage * BLADE_ARMOR.reflect);
    });
    // Casts aren't basic attacks: no vengeance at those ticks unless a basic attack landed too.
    const casts = r.events.filter((e) => e.type === 'cast' && e.id === foe);
    for (const c of casts) expect(back.filter((v) => v.t === c.t).length).toBe(hits.filter((h) => h.t === c.t).length);
  });
});

describe('Thunder Belt', () => {
  test('+30 armor and magic resist; every 3s the next basic attack blasts the target and its neighbours for 8% of max HP, magic', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'paladin', star: 2 };
    a.items = [{ uid: 88, id: 'thunderbelt', tier: 1, holder: 1 }];
    // Three footmen in a row: the middle one is in front, its neighbours stand next to it.
    b.board[2] = { uid: 2, defId: 'footman', star: 2 };
    b.board[3] = { uid: 3, defId: 'footman', star: 2 };
    b.board[4] = { uid: 4, defId: 'footman', star: 2 };
    b.board[17] = { uid: 5, defId: 'archer', star: 1 }; // back row: far from any target
    const levels = playerTraits(a);
    const s = fieldStats(a, levels, {}).get(1)!;
    const base = unitStats(UNIT_BY_ID.paladin, 2, { levels });
    expect(s.armor - base.armor).toBe(THUNDER_BELT.defense);
    expect(s.mr - base.mr).toBe(THUNDER_BELT.defense);

    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!;
    const archer = r.fighters.find((f) => f.defId === 'archer')!.id;
    const blasts = r.events.filter((e) => e.type === 'effect' && e.effect === 'thunder');
    const times = [...new Set(blasts.map((e) => e.t))];
    expect(times.length).toBeGreaterThan(1);
    // Each blast rides on one of its basic attacks, at least 3s apart.
    for (const t of times) expect(r.events.some((e) => e.type === 'attack' && e.id === me.id && e.t === t)).toBe(true);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(THUNDER_BELT.every * TICKS_PER_SECOND);
    // The first one splashes onto a neighbour too, never the faraway archer; magic resist trims it.
    expect(blasts.filter((e) => e.t === times[0]).length).toBeGreaterThan(1);
    expect(blasts.some((e) => e.type === 'effect' && e.target === archer && e.t === times[0])).toBe(false);
    for (const e of blasts) if (e.type === 'effect') expect(e.damage).toBeLessThan(me.maxHp * THUNDER_BELT.share);
  });
});

describe('Oracle', () => {
  test('+30 armor and magic resist; at the start, every other ally in its row gains +20 of each for the fight', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 1 }; // holder, front row
    a.board[0] = { uid: 2, defId: 'footman', star: 1 }; // same row, far end
    a.board[6] = { uid: 3, defId: 'footman', star: 1 }; // same row, other end
    a.board[10] = { uid: 4, defId: 'archer', star: 1 }; // the row behind: no buff
    a.items = [{ uid: 89, id: 'oracle', tier: 1, holder: 1 }];
    b.board[3] = { uid: 5, defId: 'footman', star: 1 };
    const levels = playerTraits(a);
    const s = fieldStats(a, levels, {}).get(1)!;
    const base = unitStats(UNIT_BY_ID.knight, 1, { levels });
    expect(s.armor - base.armor).toBe(ORACLE.defense);
    expect(s.mr - base.mr).toBe(ORACLE.defense);

    const r = simulateCombat({ rng: 1 }, a, b);
    const holder = r.fighters.find((f) => f.side === 0 && f.defId === 'knight')!.id;
    const archer = r.fighters.find((f) => f.defId === 'archer')!.id;
    const resist = r.events.filter((e) => e.type === 'buff' && e.effect === 'resist');
    const ids = resist.map((e) => (e.type === 'buff' ? e.id : -1)).sort();
    const rowmates = r.fighters.filter((f) => f.side === 0 && f.defId === 'footman').map((f) => f.id).sort();
    expect(ids).toEqual(rowmates);
    for (const e of resist) if (e.type === 'buff') {
      expect(e.t).toBe(0);
      expect(e.by).toBe(holder);
      expect(e.until).toBeUndefined(); // the whole fight
    }
    expect(ids).not.toContain(archer);
    expect(ids).not.toContain(holder);
  });
});

describe('Ancient Wrath', () => {
  test('+15% max HP; taunts enemies within 2 cells at the start; more armor and magic resist the more enemies target it', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 2 }; // holder, front middle
    a.board[0] = { uid: 2, defId: 'footman', star: 1 }; // an ally the enemies could go for instead
    a.items = [{ uid: 90, id: 'ancientwrath', tier: 1, holder: 1 }];
    b.board[2] = { uid: 3, defId: 'footman', star: 1 };
    b.board[3] = { uid: 4, defId: 'footman', star: 1 };
    b.board[4] = { uid: 5, defId: 'footman', star: 1 };
    b.board[20] = { uid: 6, defId: 'archer', star: 1 }; // back corner: out of reach
    const levels = playerTraits(a);
    expect(Math.abs(fieldStats(a, levels, {}).get(1)!.hp - unitStats(UNIT_BY_ID.knight, 2, { levels }).hp * (1 + ANCIENT_WRATH.hp))).toBeLessThanOrEqual(1);

    const r = simulateCombat({ rng: 1 }, a, b);
    const holder = r.fighters.find((f) => f.side === 0 && f.defId === 'knight')!.id;
    const foes = r.fighters.filter((f) => f.side === 1 && f.defId === 'footman').map((f) => f.id).sort();
    const archer = r.fighters.find((f) => f.defId === 'archer')!.id;
    const taunts = r.events.filter((e) => e.type === 'taunt' && e.by === holder);
    expect(taunts.map((e) => (e.type === 'taunt' ? e.id : -1)).sort()).toEqual(foes);
    for (const e of taunts) if (e.type === 'taunt') {
      expect(e.t).toBe(0);
      expect(e.until - e.t).toBe(ANCIENT_WRATH.seconds * TICKS_PER_SECOND);
    }
    expect(taunts.some((e) => e.type === 'taunt' && e.id === archer)).toBe(false);
    // The bonus is on from the start (3 taunted enemies), and changes as they fall.
    const bonus = r.events.filter((e) => e.type === 'buff' && e.effect === 'provocation' && e.id === holder);
    expect(bonus[0].t).toBe(0);
    expect(bonus.length).toBeGreaterThan(1);
  });

  test('the bonus is worth 10 armor and magic resist per enemy targeting the holder', () => {
    // Taunted enemies hit a holder with more armor: compare the first hit against a holder without it.
    const firstHit = (withItem: boolean) => {
      const state = createGame(1, SEEDS);
      const [a, b] = state.players;
      for (const p of state.players) {
        p.board.fill(null);
        p.bench.fill(null);
        p.items = [];
      }
      a.board[3] = { uid: 1, defId: 'knight', star: 2 };
      if (withItem) a.items = [{ uid: 90, id: 'ancientwrath', tier: 1, holder: 1 }];
      b.board[2] = { uid: 3, defId: 'footman', star: 1 };
      b.board[3] = { uid: 4, defId: 'footman', star: 1 };
      const r = simulateCombat({ rng: 1 }, a, b);
      const hit = r.events.find((e) => e.type === 'attack' && r.fighters[e.id].side === 1 && !e.crit)!;
      return hit.type === 'attack' ? hit.damage : 0;
    };
    const armor = UNIT_BY_ID.knight.armor;
    const expected = defenseMult(armor + 2 * ANCIENT_WRATH.perTargeter) / defenseMult(armor);
    expect(firstHit(true) / firstHit(false)).toBeCloseTo(expected, 1);
  });
});

describe('equipment groups', () => {
  test('every equipment is physical, magic, hybrid or armor; nothing else has a group', () => {
    for (const id of EQUIPMENT) expect(['physical', 'magic', 'hybrid', 'armor']).toContain(ITEMS[id].group!);
    for (const def of Object.values(ITEMS)) if (!EQUIPMENT.includes(def.id)) expect(def.group).toBeUndefined();
  });
});

describe("Ruby's Cloak and Scythe", () => {
  const fresh = () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    return { a, b };
  };

  test('Cloak: +20% max HP; once a fight it gets back up with 30% HP instead of dying', () => {
    const { a, b } = fresh();
    a.board[3] = { uid: 1, defId: 'knight', star: 1 };
    a.items = [{ uid: 91, id: 'redcloak', tier: 1, holder: 1 }];
    b.board[3] = { uid: 2, defId: 'titan', star: 3 }; // kills it twice
    const levels = playerTraits(a);
    expect(Math.abs(fieldStats(a, levels, {}).get(1)!.hp - unitStats(UNIT_BY_ID.knight, 1, { levels }).hp * (1 + RED_CLOAK.hp))).toBeLessThanOrEqual(1);

    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!;
    const up = r.events.filter((e) => e.type === 'buff' && e.effect === 'mastery' && e.id === me.id);
    expect(up.length).toBe(1);
    const heal = r.events.find((e) => e.type === 'heal' && e.id === me.id && e.t === up[0].t)!;
    expect(heal.type === 'heal' && heal.hp).toBe(Math.round(me.maxHp * RED_CLOAK.revive));
    // Never dies at that moment; the second time it's down for good.
    const deaths = r.events.filter((e) => e.type === 'death' && e.id === me.id);
    expect(deaths.length).toBe(1);
    expect(deaths[0].t).toBeGreaterThan(up[0].t);
  });

  test('Cloak: basic attacks move the Rage Mark to their target; the marked enemy dying heals up to 10% of max HP', () => {
    const { a, b } = fresh();
    a.board[3] = { uid: 1, defId: 'paladin', star: 3 };
    a.items = [{ uid: 91, id: 'redcloak', tier: 1, holder: 1 }];
    b.board[2] = { uid: 2, defId: 'footman', star: 1 };
    b.board[3] = { uid: 3, defId: 'footman', star: 1 };
    b.board[4] = { uid: 4, defId: 'footman', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!;
    const marks = r.events.filter((e) => e.type === 'buff' && e.effect === 'ragemark' && e.until === undefined);
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) if (m.type === 'buff') {
      expect(m.by).toBe(me.id);
      // Put on by one of its basic attacks on that enemy.
      expect(r.events.some((e) => e.type === 'attack' && e.id === me.id && e.target === m.id && e.t === m.t)).toBe(true);
    }
    // A marked enemy's death heals it (when it's hurt): a heal on the same tick, never more than 10%.
    const markedDeaths = r.events.filter((e) => e.type === 'death' && marks.some((m) => m.type === 'buff' && m.id === e.id));
    expect(markedDeaths.length).toBeGreaterThan(0);
    const heals = r.events.filter((e) => e.type === 'heal' && e.id === me.id);
    for (const h of heals) if (h.type === 'heal') expect(h.amount).toBeLessThanOrEqual(Math.round(me.maxHp * RED_CLOAK.markHeal));
    expect(heals.some((h) => markedDeaths.some((d) => d.t === h.t))).toBe(true);
  });

  test('Scythe: +20% attack and magic attack; every 2s it strikes the Rage Marked enemy, anywhere', () => {
    const { a, b } = fresh();
    a.board[3] = { uid: 1, defId: 'knight', star: 2 };
    a.board[17] = { uid: 2, defId: 'archer', star: 1 }; // back row
    a.items = [
      { uid: 91, id: 'redcloak', tier: 1, holder: 1 },
      { uid: 92, id: 'scythe', tier: 1, holder: 2 },
    ];
    b.board[3] = { uid: 3, defId: 'paladin', star: 2 };
    b.board[20] = { uid: 4, defId: 'archer', star: 1 };
    const levels = playerTraits(a);
    const s = fieldStats(a, levels, {}).get(2)!;
    const base = unitStats(UNIT_BY_ID.archer, 1, { levels });
    expect(Math.abs(s.atk - base.atk * (1 + SCYTHE.hybridAtk))).toBeLessThanOrEqual(1);

    const r = simulateCombat({ rng: 1 }, a, b);
    const cloak = r.fighters.find((f) => f.side === 0 && f.defId === 'knight')!.id;
    const reaper = r.fighters.find((f) => f.side === 0 && f.defId === 'archer')!.id;
    const strikes = r.events.filter((e) => e.type === 'effect' && e.effect === 'hunt');
    expect(strikes.length).toBeGreaterThan(1);
    for (let i = 1; i < strikes.length; i++) expect(strikes[i].t - strikes[i - 1].t).toBeGreaterThanOrEqual(SCYTHE.every * TICKS_PER_SECOND);
    // Each strike lands on whoever the Cloak marked last.
    for (const e of strikes) if (e.type === 'effect') {
      expect(e.by).toBe(reaper);
      const mark = r.events.filter((m) => m.type === 'buff' && m.effect === 'ragemark' && m.until === undefined && m.by === cloak && m.t <= e.t).at(-1)!;
      expect(mark.type === 'buff' && mark.id).toBe(e.target);
      expect(e.damage).toBeGreaterThan(0);
    }
  });

  test("when the Cloak's wearer gets back up, the Scythe's wearer gains +55% attack and magic attack", () => {
    const { a, b } = fresh();
    a.board[3] = { uid: 1, defId: 'knight', star: 1 };
    a.board[17] = { uid: 2, defId: 'archer', star: 2 };
    a.items = [
      { uid: 91, id: 'redcloak', tier: 1, holder: 1 },
      { uid: 92, id: 'scythe', tier: 1, holder: 2 },
    ];
    b.board[3] = { uid: 3, defId: 'titan', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const reaper = r.fighters.find((f) => f.side === 0 && f.defId === 'archer')!.id;
    const up = r.events.find((e) => e.type === 'buff' && e.effect === 'mastery')!;
    const fury = r.events.filter((e) => e.type === 'buff' && e.effect === 'huntfury');
    expect(fury.length).toBe(1);
    expect(fury[0].t).toBe(up.t);
    expect(fury[0].type === 'buff' && fury[0].id).toBe(reaper);
    // Strikes on the titan after it hit harder than the ones before.
    const strikes = r.events.filter((e) => e.type === 'effect' && e.effect === 'hunt');
    const before = strikes.filter((e) => e.t < up.t).map((e) => (e.type === 'effect' ? e.damage : 0));
    const after = strikes.filter((e) => e.t > up.t).map((e) => (e.type === 'effect' ? e.damage : 0));
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    expect(after[0] / before[0]).toBeCloseTo(1 + SCYTHE.fury, 1);
  });
});
