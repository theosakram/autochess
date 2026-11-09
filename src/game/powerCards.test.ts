import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { hurtPlayer } from './commanders';
import { simulateCombat } from './combat';
import { BOARD_COLS, BOARD_ROWS, MAX_ITEMS_PER_UNIT, POWER_CARD_ROUNDS, START_HP, TICKS_PER_SECOND } from './config';
import { createGame, resolveCombat, startRound } from './game';
import { fieldStats } from './inventory';
import { roundIncome, xpToNext } from './player';
import { powerMods } from './powerCards';
import { UNITS } from './units';
import { playerTraits, TRAITS } from './traits';
import type { Player, PowerTier } from './types';

const SEEDS = [
  { id: 'a', name: 'A', isBot: false, commander: 'lukas' },
  { id: 'b', name: 'B', isBot: false, commander: 'lukas' },
];

describe('Magic Surge', () => {
  // Mana after the first basic attack, for a hero with or without an item, with or without the card.
  const firstAttackMana = (item: boolean, tier: PowerTier | null) => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'minos', star: 1 };
    if (item) a.items = [{ uid: 72, id: 'purplebuff', tier: 1, holder: 1 }];
    if (tier) a.powerCards = [{ id: 'magicSurge', tier }];
    b.board[3] = { uid: 2, defId: 'knight', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const hit = r.events.find((e) => e.type === 'attack' && e.id === me);
    if (hit?.type !== 'attack') throw new Error('no attack');
    return hit.mana;
  };

  test('4 / 8 / 16 bonus mana per attack, only on heroes holding equipment', () => {
    const base = firstAttackMana(true, null);
    expect(firstAttackMana(true, 'blue') - base).toBe(4);
    expect(firstAttackMana(true, 'purple') - base).toBe(8);
    expect(firstAttackMana(true, 'gold') - base).toBe(16);
    expect(firstAttackMana(false, 'gold')).toBe(firstAttackMana(false, null));
  });

  test('offered on the power card rounds at the rolled tier; unpicked defaults to the first', () => {
    const state = createGame(7, SEEDS);
    const [a] = state.players;
    while (state.round < POWER_CARD_ROUNDS[0]) {
      resolveCombat(state);
      startRound(state);
    }
    expect(a.powerOffer?.tier).toBe(state.powerTiers![0]);
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'nope' }).ok).toBe(false);
    const first = a.powerOffer!.cards[0];
    resolveCombat(state);
    expect(a.powerCards).toEqual([{ id: first, tier: state.powerTiers![0] }]);
    expect(a.powerOffer).toBeUndefined();
  });
});

describe('Breath of the Wild', () => {
  test('8 / 16 / 32% lifesteal and spell lifesteal on every fielded hero, stacking with a second copy', () => {
    const state = createGame(1, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.items = [];
    a.board[3] = { uid: 1, defId: 'minos', star: 1 };
    a.board[4] = { uid: 2, defId: 'eudora', star: 1 };
    const steal = () => [...fieldStats(a, playerTraits(a)).values()].map((s) => [s.lifesteal, s.spellLifesteal]);
    const base = steal();
    for (const [tier, n] of [['blue', 0.08], ['purple', 0.16], ['gold', 0.32]] as const) {
      a.powerCards = [{ id: 'breathOfTheWild', tier }];
      steal().forEach(([l, s], i) => {
        expect(l - base[i][0]).toBeCloseTo(n);
        expect(s - base[i][1]).toBeCloseTo(n);
      });
    }
    a.powerCards = [{ id: 'breathOfTheWild', tier: 'blue' }, { id: 'breathOfTheWild', tier: 'purple' }];
    expect(steal()[0][0] - base[0][0]).toBeCloseTo(0.24);
  });
});

describe('Premium Client', () => {
  test('25 / 35 / 45% chance per manual refresh to bank a free one, used before gold', () => {
    for (const [tier, chance] of [['blue', 0.25], ['purple', 0.35], ['gold', 0.45]] as const) {
      const state = createGame(3, SEEDS);
      const [a] = state.players;
      a.powerCards = [{ id: 'premiumClient', tier }];
      const n = 2000;
      let gained = 0;
      for (let i = 0; i < n; i++) {
        a.gold = 2;
        a.freeRerolls = 0;
        expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(true);
        expect(a.gold).toBe(0);
        gained += a.freeRerolls;
      }
      expect(Math.abs(gained / n - chance)).toBeLessThan(0.04);
    }
    // A banked one is spent instead of gold.
    const state = createGame(3, SEEDS);
    const [a] = state.players;
    a.gold = 0;
    a.freeRerolls = 1;
    expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(true);
    expect(a.freeRerolls).toBe(0);
    expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(false);
  });
});

describe('Payday', () => {
  test('6 / 7 / 8 gold on the pick, then as much with each of the next 1 / 2 / 3 rounds', () => {
    for (const [tier, gold, rounds] of [['blue', 6, 1], ['purple', 7, 2], ['gold', 8, 3]] as const) {
      const state = createGame(5, SEEDS);
      const [a] = state.players;
      a.powerOffer = { tier, cards: ['payday'], rerolled: [] };
      const before = a.gold;
      expect(applyAction(state, a.id, { type: 'pickPower', card: 'payday' }).ok).toBe(true);
      expect(a.gold - before).toBe(gold);
      const paid: number[] = [];
      for (let i = 0; i < rounds + 1; i++) {
        resolveCombat(state);
        paid.push(roundIncome(a, state.round).payday);
        startRound(state);
      }
      expect(paid).toEqual([...Array(rounds).fill(gold), 0]);
      expect(a.payday).toEqual([]);
    }
  });
});

describe('Fast Growth', () => {
  test('15 / 20 / 25% less XP per level, levelling up on the pick if already past the new bar', () => {
    const state = createGame(5, SEEDS);
    const [a] = state.players;
    a.level = 6; // 32 XP to level 7
    a.xp = 0;
    for (const [tier, need] of [['blue', 27], ['purple', 26], ['gold', 24]] as const) {
      a.powerCards = [{ id: 'fastGrowth', tier }];
      expect(xpToNext(a)).toBe(need);
    }
    a.powerCards = [];
    a.xp = 26;
    a.powerOffer = { tier: 'purple', cards: ['fastGrowth'], rerolled: [] };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'fastGrowth' }).ok).toBe(true);
    expect(a.level).toBe(7);
  });
});

describe('Berserk', () => {
  // A basic attack's damage at about `sec` seconds in, with or without the card.
  const hitAt = (tier: PowerTier | null, sec: number) => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'minos', star: 1 };
    if (tier) a.powerCards = [{ id: 'berserk', tier }];
    b.board[3] = { uid: 2, defId: 'minos', star: 3 }; // stands long enough
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const hit = r.events.find((e) => e.type === 'attack' && e.id === me && e.t >= sec * TICKS_PER_SECOND);
    if (hit?.type !== 'attack') throw new Error(`no attack after ${sec}s`);
    return hit.damage;
  };

  test('1 / 2 / 3% hybrid attack a second, capped at 15s (15 / 30 / 45%)', () => {
    const base = hitAt(null, 16);
    for (const [tier, total] of [['blue', 0.15], ['purple', 0.3], ['gold', 0.45]] as const) {
      expect(hitAt(tier, 16) / base).toBeCloseTo(1 + total, 1);
    }
    expect(hitAt('gold', 0)).toBe(hitAt(null, 0)); // nothing before the first second
    expect(hitAt('gold', 22)).toBe(hitAt('gold', 16)); // no more after 15s
  });
});

describe('Kamikaze', () => {
  test('a dying hero blasts the enemies next to it for 10 / 20 / 30% of its max hp; none without the card', () => {
    const blasts = (tier: PowerTier | null) => {
      const state = createGame(1, SEEDS);
      const [a, b] = state.players;
      for (const p of state.players) {
        p.board.fill(null);
        p.bench.fill(null);
        p.items = [];
      }
      a.board[3] = { uid: 1, defId: 'eudora', star: 1 }; // dies to the 3-star, which stands next to it
      if (tier) a.powerCards = [{ id: 'kamikaze', tier }];
      b.board[3] = { uid: 2, defId: 'belle', star: 3 };
      const r = simulateCombat({ rng: 1 }, a, b);
      const me = r.fighters.find((f) => f.side === 0)!;
      return { maxHp: me.maxHp, hits: r.events.filter((e) => e.type === 'effect' && e.effect === 'kamikaze' && e.by === me.id) };
    };
    expect(blasts(null).hits).toHaveLength(0);
    let last = 0;
    for (const tier of ['blue', 'purple', 'gold'] as const) {
      const { hits } = blasts(tier);
      expect(hits.length).toBeGreaterThan(0);
      const dealt = hits.reduce((n, e) => n + (e.type === 'effect' ? e.damage : 0), 0);
      expect(dealt).toBeGreaterThan(last);
      last = dealt;
    }
  });
});

describe('Sharpshooter', () => {
  // A ranged hero's first basic attack on a ranged target across the board.
  const firstShot = (tier: PowerTier | null) => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'eudora', star: 1 }; // range 4
    if (tier) a.powerCards = [{ id: 'sharpshooter', tier }];
    b.board[BOARD_COLS * (BOARD_ROWS - 1) + 3] = { uid: 2, defId: 'eudora', star: 1 }; // back row, ranged: stays tiles apart
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const shot = r.events.find((e) => e.type === 'attack' && e.id === me);
    if (shot?.type !== 'attack') throw new Error('no attack');
    return shot;
  };

  test('6 / 8 / 10% more damage per tile between hero and target', () => {
    const base = firstShot(null);
    expect(base.t).toBeGreaterThan(0);
    for (const [tier, pct] of [['blue', 0.06], ['purple', 0.08], ['gold', 0.1]] as const) {
      const shot = firstShot(tier);
      expect(shot.t).toBe(base.t); // same moment, same distance
      // Front row to the far back row: 3 apart, 2 tiles between.
      expect(Math.abs(shot.damage - base.damage * (1 + pct * 2))).toBeLessThanOrEqual(1);
    }
  });
});

describe('Feeling Lucky', () => {
  test('on the pick: 5 / 7 / 9 or 10 / 14 / 18 gold, about half the time each', () => {
    for (const [tier, low, high] of [['blue', 5, 10], ['purple', 7, 14], ['gold', 9, 18]] as const) {
      const state = createGame(9, SEEDS);
      const [a] = state.players;
      let highs = 0;
      const n = 1000;
      for (let i = 0; i < n; i++) {
        a.gold = 0;
        a.powerCards = [];
        a.powerOffer = { tier, cards: ['feelingLucky'], rerolled: [] };
        expect(applyAction(state, a.id, { type: 'pickPower', card: 'feelingLucky' }).ok).toBe(true);
        expect(a.gold === low || a.gold === high).toBe(true);
        if (a.gold === high) highs++;
      }
      expect(Math.abs(highs / n - 0.5)).toBeLessThan(0.05);
    }
  });
});

describe('Healing Fountain', () => {
  test('3 / 4 / 5 gold on the pick, and the commander heals as much every round, up to full', () => {
    for (const [tier, n] of [['blue', 3], ['purple', 4], ['gold', 5]] as const) {
      const state = createGame(11, SEEDS);
      const [a] = state.players;
      a.powerOffer = { tier, cards: ['healingFountain'], rerolled: [] };
      const gold = a.gold;
      expect(applyAction(state, a.id, { type: 'pickPower', card: 'healingFountain' }).ok).toBe(true);
      expect(a.gold - gold).toBe(n);
      a.hp = 50;
      startRound(state);
      expect(a.hp).toBe(50 + n);
      a.hp = START_HP - 1;
      startRound(state);
      expect(a.hp).toBe(START_HP);
    }
  });
});

describe('Paladin', () => {
  test('a 20 / 30 / 40 commander shield that soaks player damage before hp', () => {
    for (const [tier, n] of [['blue', 20], ['purple', 30], ['gold', 40]] as const) {
      const state = createGame(13, SEEDS);
      const [a] = state.players;
      a.powerOffer = { tier, cards: ['paladin'], rerolled: [] };
      expect(applyAction(state, a.id, { type: 'pickPower', card: 'paladin' }).ok).toBe(true);
      expect(a.shield).toBe(n);
      hurtPlayer(a, n - 5);
      expect([a.shield, a.hp]).toEqual([5, START_HP]);
      hurtPlayer(a, 12);
      expect([a.shield, a.hp]).toEqual([0, START_HP - 7]);
    }
  });
});

describe('Shopping Spree', () => {
  test('6 / 12 / 18 free shop refreshes on the pick', () => {
    for (const [tier, n] of [['blue', 6], ['purple', 12], ['gold', 18]] as const) {
      const state = createGame(17, SEEDS);
      const [a] = state.players;
      a.powerOffer = { tier, cards: ['shoppingSpree'], rerolled: [] };
      expect(applyAction(state, a.id, { type: 'pickPower', card: 'shoppingSpree' }).ok).toBe(true);
      expect(a.freeRerolls).toBe(n);
      a.gold = 0;
      expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(true);
      expect(a.freeRerolls).toBe(n - 1);
    }
  });
});

describe('Solid Front', () => {
  test('20 / 35 / 50 armor and magic resist on front-row heroes only', () => {
    const state = createGame(1, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.items = [];
    a.board[3] = { uid: 1, defId: 'minos', star: 1 }; // front row
    a.board[BOARD_COLS + 3] = { uid: 2, defId: 'minos', star: 1 }; // second row
    const def = () => {
      const s = fieldStats(a, playerTraits(a));
      return [1, 2].map((uid) => [s.get(uid)!.armor, s.get(uid)!.mr]);
    };
    const base = def();
    for (const [tier, n] of [['blue', 20], ['purple', 35], ['gold', 50]] as const) {
      a.powerCards = [{ id: 'solidFront', tier }];
      expect(def()).toEqual([[base[0][0] + n, base[0][1] + n], base[1]]);
    }
  });
});

describe('Mana Sovereign', () => {
  test('back-row heroes start with 25 / 50 / 75% mana; others with none', () => {
    const start = (tier: PowerTier | null) => {
      const state = createGame(1, SEEDS);
      const [a, b] = state.players;
      for (const p of state.players) {
        p.board.fill(null);
        p.bench.fill(null);
        p.items = [];
      }
      a.board[BOARD_COLS * (BOARD_ROWS - 1) + 3] = { uid: 1, defId: 'minos', star: 1 }; // back row, 60 mana
      a.board[3] = { uid: 2, defId: 'minos', star: 1 }; // front row
      if (tier) a.powerCards = [{ id: 'manaSovereign', tier }];
      b.board[3] = { uid: 3, defId: 'minos', star: 1 };
      return simulateCombat({ rng: 1 }, a, b).fighters.filter((f) => f.side === 0).map((f) => [f.y, f.mana / f.maxMana]);
    };
    for (const [tier, share] of [['blue', 0.25], ['purple', 0.5], ['gold', 0.75]] as const) {
      const fs = start(tier);
      const back = Math.max(...fs.map(([y]) => y));
      for (const [y, m] of fs) expect(m).toBe(y === back ? share : 0);
    }
  });
});

describe("Angel's Blessing", () => {
  test('10 / 20 / 30% skill damage on every hero, and 10 / 15 / 20% max mana back after a cast', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'eudora', star: 2 }; // a one-shot skill, then back to attacking
    b.board[3] = { uid: 2, defId: 'knight', star: 2 };
    const ampOf = () => fieldStats(a, playerTraits(a)).get(1)!.skillAmp;
    const manaAfterCast = () => {
      const r = simulateCombat({ rng: 1 }, a, b);
      const me = r.fighters.find((f) => f.side === 0)!;
      const cast = r.events.findIndex((e) => e.type === 'skill' && e.id === me.id);
      const next = r.events.slice(cast + 1).find((e) => (e.type === 'attack' || e.type === 'skill') && e.id === me.id);
      if (cast < 0 || next?.type !== 'attack') throw new Error('no cast then attack');
      return { mana: next.mana, max: me.maxMana };
    };
    const amp0 = ampOf();
    const base = manaAfterCast();
    for (const [tier, amp, refund] of [['blue', 0.1, 0.1], ['purple', 0.2, 0.15], ['gold', 0.3, 0.2]] as const) {
      a.powerCards = [{ id: 'angelsBlessing', tier }];
      expect(ampOf() - amp0).toBeCloseTo(amp);
      expect(manaAfterCast().mana - base.mana).toBe(Math.floor(base.max * refund));
    }
  });
});

describe('Sturdy Warrior', () => {
  test('5 / 10 / 15% max hp, attack and magic attack on every hero', () => {
    const state = createGame(1, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.items = [];
    a.board[3] = { uid: 1, defId: 'minos', star: 1 };
    a.board[BOARD_COLS * (BOARD_ROWS - 1)] = { uid: 2, defId: 'eudora', star: 2 };
    const stats = () => [...fieldStats(a, playerTraits(a)).values()].map((s) => [s.hp, s.atk, s.ap]);
    const base = stats();
    for (const [tier, pct] of [['blue', 0.05], ['purple', 0.1], ['gold', 0.15]] as const) {
      a.powerCards = [{ id: 'sturdyWarrior', tier }];
      stats().forEach((row, i) => row.forEach((v, k) => expect(Math.abs(v - base[i][k] * (1 + pct))).toBeLessThanOrEqual(1)));
    }
  });
});

describe('Fully Loaded', () => {
  test('10 / 20 / 30% more damage for heroes holding a full set of equipment only', () => {
    const state = createGame(1, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.board[3] = { uid: 1, defId: 'minos', star: 1 };
    a.board[4] = { uid: 2, defId: 'minos', star: 1 };
    a.items = [
      ...Array.from({ length: MAX_ITEMS_PER_UNIT }, (_, i) => ({ uid: 100 + i, id: 'purplebuff', tier: 1, holder: 1 })),
      { uid: 200, id: 'purplebuff', tier: 1, holder: 2 },
    ];
    const amp = () => [1, 2].map((uid) => fieldStats(a, playerTraits(a)).get(uid)!.damageAmp);
    const base = amp();
    for (const [tier, n] of [['blue', 0.1], ['purple', 0.2], ['gold', 0.3]] as const) {
      a.powerCards = [{ id: 'fullyLoaded', tier }];
      const [full, one] = amp();
      expect(full - base[0]).toBeCloseTo(n);
      expect(one).toBe(base[1]);
    }
  });
});

describe('Teamwork', () => {
  test('20 / 25 / 30% hybrid attack per synergy of 6+ the hero is in (twice when both are)', () => {
    for (const [tier, n] of [['blue', 0.2], ['purple', 0.25], ['gold', 0.3]] as const) {
      expect(powerMods({ powerCards: [{ id: 'teamwork', tier }] } as Player, 10, 0, 1)).toContainEqual({ stat: 'atk', pct: n });
      expect(powerMods({ powerCards: [{ id: 'teamwork', tier }] } as Player, 10, 0, 2)).toContainEqual({ stat: 'ap', pct: n * 2 });
      expect(powerMods({ powerCards: [{ id: 'teamwork', tier }] } as Player, 10, 0, 0)).toEqual([]);
    }
    // On a real board: a faction of 6 and a role of 6 sharing one hero.
    const shop = UNITS.filter((u) => !u.piece && u.shop !== false);
    const kinds = (k: 'faction' | 'role') => Object.values(TRAITS).filter((t) => t.kind === k).map((t) => t.id);
    let pick: { both: string; f: string[]; r: string[]; other: string } | null = null;
    for (const F of kinds('faction'))
      for (const R of kinds('role')) {
        const both = shop.find((u) => u.traits.includes(F) && u.traits.includes(R));
        const f = shop.filter((u) => u.traits.includes(F) && !u.traits.includes(R)).slice(0, 5);
        const r = shop.filter((u) => u.traits.includes(R) && !u.traits.includes(F)).slice(0, 5);
        const other = shop.find((u) => !u.traits.includes(F) && !u.traits.includes(R));
        if (!pick && both && f.length === 5 && r.length === 5 && other) pick = { both: both.id, f: f.map((u) => u.id), r: r.map((u) => u.id), other: other.id };
      }
    if (!pick) throw new Error('no faction and role with 6 heroes each');
    const state = createGame(1, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.items = [];
    [pick.both, ...pick.f, ...pick.r, pick.other].forEach((defId, i) => (a.board[i] = { uid: i + 1, defId, star: 1 }));
    const atk = () => fieldStats(a, playerTraits(a));
    a.powerCards = [];
    const base = atk();
    a.powerCards = [{ id: 'teamwork', tier: 'gold' }];
    const up = atk();
    const gain = (uid: number) => up.get(uid)!.atk - base.get(uid)!.atk;
    expect(gain(2)).toBeGreaterThan(0); // the faction only
    expect(gain(1)).toBeGreaterThan(gain(2) * 1.5); // in both: counted twice
    expect(gain(12)).toBe(0); // in neither
  });
});

describe('Faction Synergy', () => {
  const pick = (tier: PowerTier) => {
    const state = createGame(19, SEEDS);
    const [a] = state.players;
    a.powerOffer = { tier, cards: ['factionSynergy'], rerolled: [] };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'factionSynergy' }).ok).toBe(true);
    return { state, a };
  };
  const isFaction = (id: string) => TRAITS[id].kind === 'faction';

  test('I: a random faction orb straight to the inventory', () => {
    const { a } = pick('blue');
    expect(a.factionOrbOffer).toBeUndefined();
    expect(a.mistOrbs).toHaveLength(1);
    expect(isFaction(a.mistOrbs![0].trait)).toBe(true);
  });

  test('II / III: a choice of 2 / 3 different factions; the pick goes to the inventory', () => {
    for (const [tier, n] of [['purple', 2], ['gold', 3]] as const) {
      const { state, a } = pick(tier);
      const offer = a.factionOrbOffer!;
      expect(new Set(offer).size).toBe(n);
      expect(offer.every(isFaction)).toBe(true);
      expect(a.mistOrbs ?? []).toHaveLength(0);
      expect(applyAction(state, a.id, { type: 'pickFactionOrb', trait: 'nope' }).ok).toBe(false);
      expect(applyAction(state, a.id, { type: 'pickFactionOrb', trait: offer[1] }).ok).toBe(true);
      expect(a.mistOrbs!.map((o) => [o.trait, o.holder])).toEqual([[offer[1], null]]);
      expect(a.factionOrbOffer).toBeUndefined();
    }
  });

  test('left unpicked: the first on offer when the fight starts', () => {
    const { state, a } = pick('gold');
    const first = a.factionOrbOffer![0];
    resolveCombat(state);
    expect(a.mistOrbs!.map((o) => o.trait)).toEqual([first]);
  });
});
