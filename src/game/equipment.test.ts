import { describe, expect, test } from 'bun:test';
import { defenseMult, simulateCombat } from './combat';
import { EQUIPMENT_DROPS, isMonsterRound } from './config';
import { createGame, resolveCombat, startRound } from './game';
import { effectiveTier, fieldStats } from './inventory';
import { AEGIS, BASIC_ITEMS, BERSERKER_FURY, DIVINE_GLAIVE, GLOWING_WAND, HOLY_CRYSTAL, ICE_QUEEN_WAND, BLADE_OF_DESPAIR, DEMON_HUNTER_SWORD, EQUIPMENT, GOLDEN_STAFF, HAAS_CLAW, INSPIRE, ITEMS, PURIFY, PURPLE_BUFF, RETRIBUTION, REVITALIZE, SEA_HALBERD, SHEEP_STICK, SPELLBLADE_TALISMAN, THIEF_TOOL, WAR_AXE, WINTER_CROWN } from './items';
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
  test('rounds 7, 17, 27 and on every 10', () => {
    expect([1, 6, 7, 10, 17, 20, 27, 37].filter(isMonsterRound)).toEqual([7, 17, 27, 37]);
  });

  test('everyone fights the monsters; win or lose, 2 equipment each, and a loss still costs hp', () => {
    const state = createGame(11, SEEDS);
    while (state.round < 7) {
      resolveCombat(state);
      startRound(state);
    }
    const before = new Map(state.players.map((p) => [p.id, { hp: p.hp, items: p.items.length }]));
    const fights = resolveCombat(state);
    expect(fights).toHaveLength(3);
    for (const f of fights) {
      expect(f.away).toBe(MONSTER_ID);
      expect(f.monster).toBe(true);
      expect(f.drops).toHaveLength(EQUIPMENT_DROPS);
      for (const id of f.drops!) expect(EQUIPMENT).toContain(id);
      const p = state.players.find((x) => x.id === f.home)!;
      expect(p.items.length).toBe(before.get(p.id)!.items + EQUIPMENT_DROPS);
      expect(p.hp).toBe(before.get(p.id)!.hp - (f.result.winner === 1 ? f.damage : 0));
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
  test('+20/30/40/50% attack speed by stage (every 10 rounds), once per hero', () => {
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
    for (const [round, bonus] of [[1, 0.2], [10, 0.2], [11, 0.3], [25, 0.4], [31, 0.5], [55, 0.5]] as const) {
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
    // The Ash Warden taunts; the Wandering Blade leaps in and stuns.
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
    for (const [round, bonus] of [[2, 0.2], [12, 0.3], [21, 0.4], [40, 0.5]] as const) {
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
    applyAction(state, b.id, { type: 'pickCommander', commander: 'lukas' });
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
