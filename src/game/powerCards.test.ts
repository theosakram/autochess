import { describe, expect, test } from 'bun:test';
import { applyAction, trimBoard } from './actions';
import { hurtPlayer } from './commanders';
import { simulateCombat } from './combat';
import { BOARD_COLS, BOARD_ROWS, MAX_COMBAT_TICKS, MAX_ITEMS_PER_UNIT, POWER_CARD_ROUNDS, roundAt, SHOP_ODDS, START_HP, TICKS_PER_SECOND } from './config';
import { createGame, resolveCombat, startRound } from './game';
import { fieldStats } from './inventory';
import { mergeUnits, pooledOf } from './merge';
import { addXp, boardCount, heroCapOf, roundIncome, xpToNext } from './player';
import { baseItemOf, enhancedId, EQUIPMENT, isEnhanced, ITEMS } from './items';
import { canDuplicate, duplicateBlock } from './duplicator';
import { ageTurrets, constellationOf, BADGE_TRAITS, badgeHeroes, BLAZING_VALOR, cashFortunes, gloriousClaim, checkChestTriggers, POWER_CARDS, cycleChests, cycleRefreshes, ENHANCING_CARDS, hurtExtraOf, powerMods, powerPool, shopOdds } from './powerCards';
import { refreshShop, shopPrice } from './shop';
import { syncPlayer } from './sync';
import { UNIT_BY_ID, UNITS } from './units';
import { playerTraits, TRAITS } from './traits';
import type { GameState, Player, PowerTier } from './types';

const SEEDS = [
  { id: 'a', name: 'A', isBot: false, commander: 'lukas' },
  { id: 'b', name: 'B', isBot: false, commander: 'lukas' },
];

test('power card rerolls: one per card, shared, so one card can take them all', () => {
  const state = createGame(1, SEEDS);
  const a = state.players[0];
  a.powerOffer = { tier: 'purple', cards: ['payday', 'fastGrowth'], rerolls: 0 };
  const pinned = a.powerOffer.cards[0];
  expect(applyAction(state, a.id, { type: 'rerollPower', slot: 1 }).ok).toBe(true);
  expect(applyAction(state, a.id, { type: 'rerollPower', slot: 1 }).ok).toBe(true);
  expect(applyAction(state, a.id, { type: 'rerollPower', slot: 0 }).ok).toBe(false); // all spent
  expect(a.powerOffer.cards[0]).toBe(pinned);
});

describe('power card offers', () => {
  const SEATS = [0, 1, 2, 3].map((i) => ({ id: `p${i}`, name: `P${i}`, isBot: false, commander: 'lukas' }));
  function atPowerRound(): GameState {
    const state = createGame(11, SEATS);
    while (state.round < POWER_CARD_ROUNDS[0]) {
      resolveCombat(state);
      startRound(state);
    }
    return state;
  }

  test('every player at the tier is offered the same cards', () => {
    const state = atPowerRound();
    const [first, ...rest] = state.players;
    expect(first.powerOffer!.cards).toHaveLength(2);
    for (const p of rest) expect(p.powerOffer!.cards).toEqual(first.powerOffer!.cards);
  });

  test('rerolls: a card once shown never comes back, and rerolls follow the same deck for everyone', () => {
    const state = atPowerRound();
    const [a, b] = state.players;
    const shown = new Set(a.powerOffer!.cards);
    for (let k = 0; k < 2; k++) {
      expect(applyAction(state, a.id, { type: 'rerollPower', slot: 0 }).ok).toBe(true);
      expect(shown.has(a.powerOffer!.cards[0])).toBe(false); // never one shown before, in either slot
      shown.add(a.powerOffer!.cards[0]);
    }
    // B rerolling the same way sees the same cards.
    applyAction(state, b.id, { type: 'rerollPower', slot: 0 });
    applyAction(state, b.id, { type: 'rerollPower', slot: 0 });
    expect(b.powerOffer!.cards).toEqual(a.powerOffer!.cards);
  });

  test('the deck skips a card the player already holds, and runs dry with no repeats', () => {
    const state = atPowerRound();
    const [a, b] = state.players;
    const [top, second] = b.powerOffer!.cards;
    // A, holding the deck's top card, is dealt fresh: it's skipped, the rest of the order kept.
    a.powerCards = [{ id: top, tier: 'blue' }];
    a.powerOffer = undefined;
    a.powerQueue = [{ tier: b.powerOffer!.tier, round: POWER_CARD_ROUNDS[0] }];
    applyAction(state, b.id, { type: 'pickPower', card: top });
    // Deal A's queued round through a pick-free path: drop in an offer and pick from it.
    a.powerOffer = { tier: 'blue', cards: ['payday'], rerolls: 0, round: -1 };
    applyAction(state, a.id, { type: 'pickPower', card: 'payday' });
    expect(a.powerOffer!.cards).not.toContain(top);
    expect(a.powerOffer!.cards[0]).toBe(second); // the deck's next card
    // Small deck: rerolls stop once every card has been shown.
    const offer = a.powerOffer!;
    offer.rerolls = -100; // unlimited, to drain it
    const seen = new Set(offer.cards);
    while (applyAction(state, a.id, { type: 'rerollPower', slot: 0 }).ok) {
      expect(seen.has(offer.cards[0])).toBe(false);
      seen.add(offer.cards[0]);
    }
    expect(seen.size).toBe(powerPool(offer.tier, a).length); // every card it can take, each once
  });
});

describe('Magic Immersion', () => {
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

  test('4 / 6 / 12 bonus mana per attack, only on heroes holding equipment', () => {
    const base = firstAttackMana(true, null);
    expect(firstAttackMana(true, 'blue') - base).toBe(4);
    expect(firstAttackMana(true, 'purple') - base).toBe(6);
    expect(firstAttackMana(true, 'gold') - base).toBe(12);
    expect(firstAttackMana(false, 'gold')).toBe(firstAttackMana(false, null));
  });

  test('offered on the power card rounds at the rolled tier; no time limit, and a missed round queues behind', () => {
    const state = createGame(7, SEEDS);
    const [a] = state.players;
    while (state.round < POWER_CARD_ROUNDS[0]) {
      resolveCombat(state);
      startRound(state);
    }
    expect(a.powerOffer?.tier).toBe(state.powerTiers![0]);
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'nope' }).ok).toBe(false);
    const offer = a.powerOffer;
    // Fights come and go: nothing is picked for the player, the offer just waits.
    while (state.round < POWER_CARD_ROUNDS[1]) {
      resolveCombat(state);
      startRound(state);
      expect(a.powerCards ?? []).toEqual([]);
    }
    expect(a.powerOffer).toBe(offer);
    expect(a.powerQueue).toEqual([{ tier: state.powerTiers![1], round: POWER_CARD_ROUNDS[1] }]);
    const first = offer!.cards[1];
    expect(applyAction(state, a.id, { type: 'pickPower', card: first }).ok).toBe(true);
    expect(a.powerCards).toEqual([{ id: first, tier: state.powerTiers![0] }]);
    // The queued round's offer comes up next, never with the card just taken.
    expect(a.powerOffer?.tier).toBe(state.powerTiers![1]);
    expect(a.powerOffer?.cards).not.toContain(first);
    expect(a.powerQueue).toBeUndefined();
    resolveCombat(state);
    expect(a.powerCards).toHaveLength(1);
  });
});

describe('Breath of Berserk', () => {
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
      a.powerOffer = { tier, cards: ['payday'], rerolls: 0 };
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

describe('Full Throttle', () => {
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
    a.powerOffer = { tier: 'purple', cards: ['fastGrowth'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'fastGrowth' }).ok).toBe(true);
    expect(a.level).toBe(7);
  });
});

describe('Rising Fury', () => {
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

describe('Meltdown Armor', () => {
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

describe('Dimensional Shoot', () => {
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

describe('Uncertain Fortune', () => {
  test('on the pick: 5 / 7 / 9 or 10 / 14 / 18 gold, about half the time each', () => {
    for (const [tier, low, high] of [['blue', 5, 10], ['purple', 7, 14], ['gold', 9, 18]] as const) {
      const state = createGame(9, SEEDS);
      const [a] = state.players;
      let highs = 0;
      const n = 1000;
      for (let i = 0; i < n; i++) {
        a.gold = 0;
        a.powerCards = [];
        a.powerOffer = { tier, cards: ['feelingLucky'], rerolls: 0 };
        expect(applyAction(state, a.id, { type: 'pickPower', card: 'feelingLucky' }).ok).toBe(true);
        expect(a.gold === low || a.gold === high).toBe(true);
        if (a.gold === high) highs++;
      }
      expect(Math.abs(highs / n - 0.5)).toBeLessThan(0.05);
    }
  });
});

describe('no card twice', () => {
  test('a held card (any tier) is never offered, rerolled into or transmuted into', () => {
    const p = createGame(215, SEEDS).players[0];
    p.powerCards = [{ id: 'healingFountain', tier: 'blue' }, { id: 'theHunt', tier: 'gold' }];
    for (const tier of ['blue', 'purple', 'gold'] as const) {
      expect(powerPool(tier, p)).not.toContain('healingFountain');
      expect(powerPool(tier, p)).not.toContain('theHunt');
    }
    expect(powerPool('gold')).toContain('healingFountain'); // the plain list (the gallery) still has it
  });
});

describe('overtime', () => {
  test('fights last 40s; from 30s every unit gains 10% attack speed and damage each second', () => {
    expect(MAX_COMBAT_TICKS).toBe(40 * TICKS_PER_SECOND);
    const state = createGame(217, SEEDS);
    const [a, b] = state.players;
    a.items = [];
    b.items = [];
    a.board.fill(null);
    b.board.fill(null);
    // A mirror match long enough to reach overtime.
    a.board[3] = { uid: 1030, defId: 'minos', star: 3 };
    b.board[3] = { uid: 1031, defId: 'minos', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
    const ot = r.events.filter((e) => e.type === 'buff' && e.effect === 'overtime');
    expect(ot.length).toBeGreaterThan(0);
    expect(ot.every((e) => e.t === 30 * TICKS_PER_SECOND)).toBe(true);
    // Attacks come faster in overtime than before it.
    const kn = r.fighters.find((f) => f.side === 0)!.id;
    const times = r.events.flatMap((e) => (e.type === 'attack' && e.id === kn ? [e.t] : []));
    const gaps = (from: number, to: number) => {
      const ts = times.filter((x) => x >= from && x < to);
      return (ts[ts.length - 1] - ts[0]) / Math.max(1, ts.length - 1);
    };
    if (times.some((x) => x >= 36 * TICKS_PER_SECOND)) expect(gaps(36 * TICKS_PER_SECOND, 40 * TICKS_PER_SECOND)).toBeLessThan(gaps(10 * TICKS_PER_SECOND, 30 * TICKS_PER_SECOND));
    expect(r.events.every((e) => e.t <= MAX_COMBAT_TICKS)).toBe(true);
  });
});

describe('Healing Fountain', () => {
  test('3 / 4 / 5 gold on the pick, and the commander heals 2 / 3 / 4 every round, up to full', () => {
    for (const [tier, n, heal] of [['blue', 3, 2], ['purple', 4, 3], ['gold', 5, 4]] as const) {
      const state = createGame(11, SEEDS);
      const [a] = state.players;
      a.powerOffer = { tier, cards: ['healingFountain'], rerolls: 0 };
      const gold = a.gold;
      expect(applyAction(state, a.id, { type: 'pickPower', card: 'healingFountain' }).ok).toBe(true);
      expect(a.gold - gold).toBe(n);
      a.hp = 50;
      startRound(state);
      expect(a.hp).toBe(50 + heal);
      a.hp = START_HP - 1;
      startRound(state);
      expect(a.hp).toBe(START_HP);
    }
  });
});

describe('Rock Solid', () => {
  test('a 20 / 30 / 40 commander shield that soaks player damage before hp', () => {
    for (const [tier, n] of [['blue', 20], ['purple', 30], ['gold', 40]] as const) {
      const state = createGame(13, SEEDS);
      const [a] = state.players;
      a.powerOffer = { tier, cards: ['paladin'], rerolls: 0 };
      expect(applyAction(state, a.id, { type: 'pickPower', card: 'paladin' }).ok).toBe(true);
      expect(a.shield).toBe(n);
      hurtPlayer(a, n - 5);
      expect([a.shield, a.hp]).toEqual([5, START_HP]);
      hurtPlayer(a, 12);
      expect([a.shield, a.hp]).toEqual([0, START_HP - 7]);
    }
  });
});

describe('Glittering Jewels', () => {
  test('9 / 13 / 19 free shop refreshes on the pick', () => {
    for (const [tier, n] of [['blue', 9], ['purple', 13], ['gold', 19]] as const) {
      const state = createGame(17, SEEDS);
      const [a] = state.players;
      a.powerOffer = { tier, cards: ['shoppingSpree'], rerolls: 0 };
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

describe("Barrier's Seal", () => {
  test('650 / 1000 / 1500 max hp on front-row heroes only', () => {
    const state = createGame(1, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.items = [];
    a.board[3] = { uid: 1, defId: 'minos', star: 1 }; // front row
    a.board[BOARD_COLS + 3] = { uid: 2, defId: 'minos', star: 1 }; // second row
    const hp = () => {
      const s = fieldStats(a, playerTraits(a));
      return [1, 2].map((uid) => s.get(uid)!.hp);
    };
    const base = hp();
    for (const [tier, n] of [['blue', 650], ['purple', 1000], ['gold', 1500]] as const) {
      a.powerCards = [{ id: 'barriersSeal', tier }];
      expect(hp()).toEqual([base[0] + n, base[1]]);
    }
  });
});

describe('Frontier Blitz', () => {
  test('10 / 20 / 30% hybrid attack on the leftmost and rightmost columns, every row', () => {
    for (const [tier, n] of [['blue', 0.1], ['purple', 0.2], ['gold', 0.3]] as const) {
      const p = { powerCards: [{ id: 'frontierBlitz', tier }] } as Player;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (const col of [0, BOARD_COLS - 1]) {
          const mods = powerMods(p, row * BOARD_COLS + col, 0, 0);
          expect(mods).toContainEqual({ stat: 'atk', pct: n });
          expect(mods).toContainEqual({ stat: 'ap', pct: n });
        }
        for (let col = 1; col < BOARD_COLS - 1; col++) expect(powerMods(p, row * BOARD_COLS + col, 0, 0)).toEqual([]);
      }
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

describe('Ethereal Essence', () => {
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

describe('All-Around Warrior', () => {
  test('160 / 320 / 480 max hp, 10 / 20 / 30 armor and magic resist, 5 / 10 / 15% hybrid attack on every hero', () => {
    for (const [tier, hp, def, atk] of [['blue', 160, 10, 0.05], ['purple', 320, 20, 0.1], ['gold', 480, 30, 0.15]] as const) {
      expect(powerMods({ powerCards: [{ id: 'sturdyWarrior', tier }] } as Player, 10, 0, 0)).toEqual([
        { stat: 'hp', add: hp },
        { stat: 'armor', add: def },
        { stat: 'mr', add: def },
        { stat: 'atk', pct: atk },
        { stat: 'ap', pct: atk },
      ]);
    }
  });
});

describe('Elite Team / Peerless Valor', () => {
  const speed = (id: string, defId: string) =>
    powerMods({ powerCards: [{ id, tier: 'purple' }], board: [] as Player['board'] } as Player, 10, 0, 0, defId).find((m) => m.stat === 'attackSpeed');

  test('purple only', () => {
    for (const id of ['eliteTeam', 'peerlessValor', 'pasDeDeux']) {
      expect(powerPool('purple')).toContain(id);
      for (const tier of ['blue', 'gold'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });

  test('Elite Team: 30% attack speed on heroes costing under 3 gold', () => {
    for (const u of UNITS.filter((d) => d.shop !== false)) expect(speed('eliteTeam', u.id)).toEqual(u.tier < 3 ? { stat: 'attackSpeed', add: 0.3 } : undefined);
  });

  test('Peerless Valor: 25% attack speed on heroes costing 4 gold or more', () => {
    for (const u of UNITS.filter((d) => d.shop !== false)) expect(speed('peerlessValor', u.id)).toEqual(u.tier >= 4 ? { stat: 'attackSpeed', add: 0.25 } : undefined);
  });
});

describe('Pas de Deux', () => {
  test('two copies of a hero on the board: both gain 30% hybrid attack and 30% max hp', () => {
    const state = createGame(1, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.items = [];
    a.board[3] = { uid: 1, defId: 'minos', star: 1 };
    a.board[4] = { uid: 2, defId: 'eudora', star: 1 };
    const stats = () => fieldStats(a, playerTraits(a));
    const base = stats();
    a.powerCards = [{ id: 'pasDeDeux', tier: 'purple' }];
    expect(stats().get(1)!.hp).toBe(base.get(1)!.hp); // alone: nothing
    a.board[5] = { uid: 3, defId: 'minos', star: 2 };
    const pair = stats();
    a.powerCards = [];
    const plain = stats();
    for (const uid of [1, 3]) {
      expect(Math.abs(pair.get(uid)!.hp - plain.get(uid)!.hp * 1.3)).toBeLessThanOrEqual(1);
      expect(Math.abs(pair.get(uid)!.atk - plain.get(uid)!.atk * 1.3)).toBeLessThanOrEqual(1);
    }
    expect(pair.get(2)!.hp).toBe(plain.get(2)!.hp);
  });

  test('a hero reaching 3★ brings a 2★ copy, even with the pool empty; selling it returns only what it took', () => {
    const state = createGame(59, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.bench.fill(null);
    a.powerCards = [{ id: 'pasDeDeux', tier: 'purple' }];
    a.bench[0] = { uid: 901, defId: 'minos', star: 2 };
    a.bench[1] = { uid: 902, defId: 'minos', star: 2 };
    a.bench[2] = { uid: 903, defId: 'minos', star: 1 };
    a.bench[3] = { uid: 904, defId: 'minos', star: 1 };
    state.pool.minos = 0; // (the shop's copy is already out of the pool)
    a.shop[0] = 'minos';
    a.gold = 10;
    expect(applyAction(state, a.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    const minos = [...a.board, ...a.bench].filter((u) => u?.defId === 'minos');
    expect(minos.map((u) => u!.star).sort()).toEqual([2, 3]);
    expect(state.pool.minos).toBe(0);
    const gift = minos.find((u) => u!.star === 2)!;
    expect([gift.copies, gift.shortfall]).toEqual([undefined, 3]); // normal stars, none from the pool
    const at = a.bench.indexOf(gift);
    expect(applyAction(state, a.id, { type: 'sell', from: { area: 'bench', index: at } }).ok).toBe(true);
    expect(state.pool.minos).toBe(0);
  });

  test('a made-up 2★ merged further still never hands the missing copies to the pool', () => {
    const state = createGame(59, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.bench.fill(null);
    a.bench[0] = { uid: 901, defId: 'minos', star: 2, shortfall: 3 };
    a.bench[1] = { uid: 902, defId: 'minos', star: 2 };
    a.bench[2] = { uid: 903, defId: 'minos', star: 2 };
    mergeUnits(a, 'minos');
    const three = a.bench.find(Boolean)!;
    expect([three.star, three.copies, three.shortfall, pooledOf(three)]).toEqual([3, undefined, 3, 6]);
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

describe('Purest Power', () => {
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

describe('Excellent Recruit', () => {
  test('blue and purple only', () => {
    for (const tier of ['blue', 'purple'] as const) expect(powerPool(tier)).toContain('excellentRecruit');
    expect(powerPool('gold')).not.toContain('excellentRecruit');
  });

  test('I / II: 3 random 3 / 4-cost heroes from the pool onto the bench', () => {
    for (const [tier, cost] of [['blue', 3], ['purple', 4]] as const) {
      const state = createGame(23, SEEDS);
      const [a] = state.players;
      a.bench.fill(null);
      const pooled = () => Object.values(state.pool).reduce((n, c) => n + c, 0);
      const before = pooled();
      a.powerOffer = { tier, cards: ['excellentRecruit'], rerolls: 0 };
      expect(applyAction(state, a.id, { type: 'pickPower', card: 'excellentRecruit' }).ok).toBe(true);
      const got = a.bench.filter((u) => u).map((u) => UNITS.find((d) => d.id === u!.defId)!);
      expect(got.length).toBeGreaterThan(0); // fewer than 3 if they merged
      expect(got.every((d) => (d.shopTier ?? d.tier) === cost)).toBe(true);
      expect(before - pooled()).toBe(3);
    }
  });

  test('a full bench: the heroes go on the board, past the level limit', () => {
    const state = createGame(23, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    for (let i = 0; i < a.bench.length; i++) a.bench[i] = { uid: 900 + i, defId: 'minos', star: 2 };
    a.level = 1;
    a.powerOffer = { tier: 'purple', cards: ['excellentRecruit'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'excellentRecruit' }).ok).toBe(true);
    const fielded = a.board.flatMap((u) => (u ? [UNITS.find((d) => d.id === u.defId)!] : [])).filter((d) => !d.piece);
    expect(fielded.length).toBeGreaterThan(0); // fewer than 3 if they merged
    expect(fielded.every((d) => (d.shopTier ?? d.tier) === 4)).toBe(true);
  });
});

describe('Cyclical Support', () => {
  test('a chest on the pick, then one every 8 / 7 / 6 rounds', () => {
    for (const [tier, every] of [['blue', 8], ['purple', 7], ['gold', 6]] as const) {
      const state = createGame(29, SEEDS);
      const [a] = state.players;
      delete a.itemOffer;
      a.powerOffer = { tier, cards: ['cyclicalSupport'], rerolls: 0 };
      expect(applyAction(state, a.id, { type: 'pickPower', card: 'cyclicalSupport' }).ok).toBe(true);
      expect(a.offerFrom).toBe('chest');
      expect((a as Player).itemOffer?.length).toBeGreaterThan(0);
      const from = state.round;
      const due: number[] = [];
      for (let r = from + 1; r <= from + every * 2; r++) {
        a.itemOffer = undefined;
        a.chests = { kills: 0, earned: 0, waiting: 0 };
        state.round = r;
        cycleChests(state, a);
        if (a.itemOffer) due.push(r);
      }
      expect(due).toEqual([from + every, from + every * 2]);
    }
  });
});

describe('Jump the Gun', () => {
  test('11 / 18 / 25 XP on the pick', () => {
    for (const [tier, n] of [['blue', 11], ['purple', 18], ['gold', 25]] as const) {
      const state = createGame(31, SEEDS);
      const [a] = state.players;
      a.level = 9;
      a.xp = 0;
      const need = xpToNext(a)!;
      a.powerOffer = { tier, cards: ['jumpTheGun'], rerolls: 0 };
      expect(applyAction(state, a.id, { type: 'pickPower', card: 'jumpTheGun' }).ok).toBe(true);
      expect(n < need ? [a.level, a.xp] : [a.level]).toEqual(n < need ? [9, n] : [10]);
    }
  });
});

describe('Dark Blade', () => {
  // A lifestealing enemy (Haas's Claw) vs a knight; how much it heals per point of damage it deals.
  const ratio = (tier: PowerTier | null) => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 2 };
    if (tier) a.powerCards = [{ id: 'darkBlade', tier }];
    b.board[3] = { uid: 2, defId: 'knight', star: 2 };
    b.items = [{ uid: 86, id: 'haasclaw', tier: 1, holder: 2 }];
    const r = simulateCombat({ rng: 1 }, a, b);
    const foe = r.fighters.find((f) => f.side === 1)!.id;
    const h = r.events.filter((e) => e.type === 'heal' && e.id === foe).at(-1)!;
    const hit = r.events.filter((e) => e.type === 'attack' && e.id === foe && e.t === h.t).at(-1)!;
    return h.type === 'heal' && hit.type === 'attack' ? h.amount / hit.damage : 0;
  };

  test("its heroes' damage cuts the target's healing by 30 / 40 / 50%", () => {
    const base = ratio(null);
    expect(base).toBeGreaterThan(0);
    // The heals are small and rounded, so only roughly.
    for (const [tier, cut] of [['blue', 0.3], ['purple', 0.4], ['gold', 0.5]] as const) expect(Math.abs(ratio(tier) / base - (1 - cut))).toBeLessThan(0.08);
  });
});

describe("Rogue's Aid", () => {
  test('blue only: a Thief Tool to the inventory', () => {
    expect(powerPool('blue')).toContain('roguesAid');
    for (const tier of ['purple', 'gold'] as const) expect(powerPool(tier)).not.toContain('roguesAid');
    const state = createGame(37, SEEDS);
    const [a] = state.players;
    a.items = [];
    a.powerOffer = { tier: 'blue', cards: ['roguesAid'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'roguesAid' }).ok).toBe(true);
    expect(a.items.map((i) => [i.id, i.tier, i.holder])).toEqual([['thieftool', 1, null]]);
  });
});

describe('Customize Recruitment', () => {
  const odds = (level: number, ...tiers: PowerTier[]) =>
    shopOdds(level, { powerCards: tiers.map((tier) => ({ id: 'customizeRecruitment', tier })) } as Player).map((n) => Math.round(n * 10) / 10);

  test('blue and purple only', () => {
    for (const tier of ['blue', 'purple'] as const) expect(powerPool(tier)).toContain('customizeRecruitment');
    expect(powerPool('gold')).not.toContain('customizeRecruitment');
  });

  test('I: 3-costs +10 points, 1 & 2-costs -5 each', () => {
    expect(odds(3, 'blue')).toEqual([55, 25, 20, 0, 0]);
    expect(odds(6, 'blue')).toEqual([20, 25, 50, 5, 0]);
  });

  test('II: 4-costs +10 points, 1 & 2 & 3-costs -5 each, scaled back to 100%', () => {
    // Level 6: 25/30/40/5/0 -> 20/25/35/15/0 (95) -> scaled.
    expect(odds(6, 'purple')).toEqual([21.1, 26.3, 36.8, 15.8, 0]);
    expect(odds(6, 'purple').reduce((a, b) => a + b, 0)).toBeCloseTo(100, 0);
  });

  test("no boost at levels that don't roll that cost yet", () => {
    expect(odds(1, 'blue')).toEqual(SHOP_ODDS[0]);
    expect(odds(4, 'purple')).toEqual(SHOP_ODDS[3]);
  });

  test('the shop rolls with it', () => {
    const share = (tier: PowerTier | null) => {
      const state = createGame(41, SEEDS);
      const [a] = state.players;
      a.level = 6;
      a.powerCards = tier ? [{ id: 'customizeRecruitment', tier }] : [];
      let threes = 0;
      for (let i = 0; i < 400; i++) {
        refreshShop(state, a);
        threes += a.shop.filter((id) => id && UNITS.find((u) => u.id === id)?.tier === 3).length;
      }
      return threes;
    };
    expect(share('blue')).toBeGreaterThan(share(null));
  });
});

describe('purple-only cards', () => {
  test('Fateful Dice, Counter Action, Apex Weaponry: purple only', () => {
    for (const id of ['fatefulDice', 'counterAction', 'apexWeaponry']) {
      expect(powerPool('purple')).toContain(id);
      for (const tier of ['blue', 'gold'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });
});

describe('Fateful Dice', () => {
  test('a Mirror Device on the pick', () => {
    const state = createGame(43, SEEDS);
    const [a] = state.players;
    a.mirrors = 1;
    a.powerOffer = { tier: 'purple', cards: ['fatefulDice'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'fatefulDice' }).ok).toBe(true);
    expect(a.mirrors).toBe(2);
  });
});

describe('Counter Action', () => {
  const pick = (hp: number) => {
    const state = createGame(47, SEEDS);
    const [a] = state.players;
    delete a.itemOffer;
    a.chests = undefined;
    a.hp = hp;
    a.powerOffer = { tier: 'purple', cards: ['counterAction'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'counterAction' }).ok).toBe(true);
    return { state, a };
  };

  // Chests opened or waiting.
  const chests = (p: Player) => (p.chests?.waiting ?? 0) + (p.offerFrom === 'chest' && p.itemOffer?.length ? 1 : 0);

  test('3 Equipment Chests once the commander drops below 55 HP, only once', () => {
    const { state, a } = pick(START_HP);
    hurtPlayer(a, START_HP - 55); // at 55: not below yet
    checkChestTriggers(state, a);
    expect(chests(a)).toBe(0);
    hurtPlayer(a, 1);
    checkChestTriggers(state, a);
    expect(chests(a)).toBe(3);
    expect(a.chestTriggers).toEqual([]);
    hurtPlayer(a, 10);
    checkChestTriggers(state, a);
    expect(chests(a)).toBe(3);
  });

  test('checked at the start of a round (after the fight that hurt)', () => {
    const { state, a } = pick(START_HP);
    hurtPlayer(a, 50);
    startRound(state);
    expect(a.chestTriggers).toEqual([]);
  });

  test('already below 55 on the pick: now', () => {
    const { a } = pick(40);
    expect(chests(a)).toBe(3);
  });
});

describe('Apex Weaponry', () => {
  test('4 gold now; 2 Equipment Chests at level 8, 2 more at level 9', () => {
    const state = createGame(53, SEEDS);
    const [a] = state.players;
    delete a.itemOffer;
    a.chests = undefined;
    a.level = 7;
    a.xp = 0;
    a.gold = 0;
    a.powerOffer = { tier: 'purple', cards: ['apexWeaponry'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'apexWeaponry' }).ok).toBe(true);
    expect(a.gold).toBe(4);
    expect((a as Player).chests?.waiting ?? 0).toBe(0);
    const waiting = () => (a.chests?.waiting ?? 0) + (a.itemOffer?.length ? 1 : 0);
    // Buys XP until the next level.
    const toNext = () => {
      a.gold = 1000;
      const lv = a.level;
      while (a.level === lv) expect(applyAction(state, a.id, { type: 'levelUp' }).ok).toBe(true);
    };
    toNext();
    expect(a.level).toBe(8);
    expect(waiting()).toBe(2);
    delete a.itemOffer;
    (a as Player).chests!.waiting = 0;
    toNext();
    expect(a.level).toBe(9);
    expect(waiting()).toBe(2);
    expect(a.chestTriggers).toEqual([]);
  });
});

describe('Reinforcement Plus', () => {
  test('blue and purple only', () => {
    for (const tier of ['blue', 'purple'] as const) expect(powerPool(tier)).toContain('reinforcementPlus');
    expect(powerPool('gold')).not.toContain('reinforcementPlus');
  });

  test('I / II: a random 2★ 3 / 4-cost hero, its copies out of the pool', () => {
    for (const [tier, cost] of [['blue', 3], ['purple', 4]] as const) {
      const state = createGame(61, SEEDS);
      const [a] = state.players;
      a.bench.fill(null);
      const pooled = () => Object.values(state.pool).reduce((n, c) => n + c, 0);
      const before = pooled();
      a.powerOffer = { tier, cards: ['reinforcementPlus'], rerolls: 0 };
      expect(applyAction(state, a.id, { type: 'pickPower', card: 'reinforcementPlus' }).ok).toBe(true);
      const got = a.bench.filter(Boolean);
      expect(got).toHaveLength(1);
      expect(got[0]!.star).toBe(2);
      expect(UNITS.find((d) => d.id === got[0]!.defId)!.tier).toBe(cost);
      expect(before - pooled()).toBe(3);
    }
  });

  test('a full bench: on the board', () => {
    const state = createGame(61, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    for (let i = 0; i < a.bench.length; i++) a.bench[i] = { uid: 900 + i, defId: 'minos', star: 2 };
    a.powerOffer = { tier: 'blue', cards: ['reinforcementPlus'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'reinforcementPlus' }).ok).toBe(true);
    expect(a.board.filter((u) => u && !UNITS.find((d) => d.id === u.defId)!.piece).map((u) => u!.star)).toEqual([2]);
  });
});

describe('purple-only cards (2)', () => {
  test('Fast Promotion, Valor\'s Embrace, Fortified Defense, Vanguard Leader, Rogue Mercenary, Forbidden Power, Legacy of Valor', () => {
    for (const id of ['fastPromotion', 'valorsEmbrace', 'fortifiedDefense', 'vanguardLeader', 'rogueMercenary', 'forbiddenPower', 'legacyOfValor']) {
      expect(powerPool('purple')).toContain(id);
      for (const tier of ['blue', 'gold'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });
});

const pickPurple = (seed: number, card: string, setup?: (a: Player) => void, setState?: (s: GameState) => void) => {
  const state = createGame(seed, SEEDS);
  const [a] = state.players;
  a.board.fill(null);
  a.bench.fill(null);
  setup?.(a);
  setState?.(state);
  a.powerOffer = { tier: 'purple', cards: [card], rerolls: 0 };
  expect(applyAction(state, a.id, { type: 'pickPower', card }).ok).toBe(true);
  return { state, a };
};

describe('Fast Promotion', () => {
  test('the next hero bought comes 2★; the one after is normal', () => {
    const { state, a } = pickPurple(67, 'fastPromotion');
    a.gold = 20;
    const pool = state.pool.minos;
    a.shop[0] = 'minos';
    expect(applyAction(state, a.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    expect(a.bench.filter(Boolean).map((u) => [u!.defId, u!.star])).toEqual([['minos', 2]]);
    expect(state.pool.minos).toBe(pool - 2); // the bought copy was already out of the pool
    expect(a.promoteNext).toBeUndefined();
    a.shop[1] = 'eudora';
    expect(applyAction(state, a.id, { type: 'buy', slot: 1 }).ok).toBe(true);
    expect(a.bench.find((u) => u?.defId === 'eudora')?.star).toBe(1);
  });
});

describe("Valor's Embrace", () => {
  // Wan (Dragon Altar) behind a 1★ Eudora that falls fast to a 3★ Balia. `orbed`: a Minos holding a
  // Dragon Altar orb instead of Wan.
  const fight = (card: boolean, orbed = false) => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[3] = { uid: 1, defId: 'eudora', star: 1 };
    a.board[BOARD_COLS * 2 + 3] = { uid: 2, defId: orbed ? 'minos' : 'wan', star: orbed ? 3 : 1 }; // a sturdy Minos outlives Eudora
    a.mistOrbs = orbed ? [{ uid: 50, trait: 'dragonaltar', holder: 2 }] : [];
    if (card) a.powerCards = [{ id: 'valorsEmbrace', tier: 'purple' }];
    b.board[3] = { uid: 3, defId: 'balia', star: orbed ? 2 : 3 };
    return simulateCombat({ rng: 1 }, a, b);
  };

  test("an ally's death shields Dragon Altar heroes for 8% of its max hp", () => {
    const shields = (r: ReturnType<typeof fight>) => {
      const wan = r.fighters.find((f) => f.defId === 'wan')!.id;
      return r.events.filter((e) => e.type === 'shield' && e.id === wan);
    };
    expect(shields(fight(false))).toHaveLength(0);
    const r = fight(true);
    const eudora = r.fighters.find((f) => f.defId === 'eudora')!;
    const first = shields(r)[0];
    expect(first?.type === 'shield' && first.amount).toBe(Math.round(eudora.maxHp * 0.08));
  });

  test('a hero made Dragon Altar by an orb gets it too', () => {
    // Shield events give the total, and Minos has shields of its own: look at the tick Eudora falls.
    const atDeath = (card: boolean) => {
      const r = fight(card, true);
      const minos = r.fighters.find((f) => f.side === 0 && f.defId === 'minos')!.id;
      const eudora = r.fighters.find((f) => f.defId === 'eudora')!;
      const died = r.events.find((e) => e.type === 'death' && e.id === eudora.id)!.t;
      const e = r.events.filter((x) => x.type === 'shield' && x.id === minos && x.t === died).at(-1);
      return { amount: e?.type === 'shield' ? e.amount : null, share: Math.round(eudora.maxHp * 0.08) };
    };
    const plain = atDeath(false).amount ?? 0;
    const { amount, share } = atDeath(true);
    expect((amount ?? 0) - plain).toBe(share);
  });
});

describe('Fortified Defense', () => {
  test('a hero holding 3 equipment shields itself and its left and right neighbours for 1400', () => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[2] = { uid: 1, defId: 'minos', star: 1 };
    a.board[3] = { uid: 2, defId: 'minos', star: 1 };
    a.board[4] = { uid: 3, defId: 'eudora', star: 1 };
    a.board[6] = { uid: 4, defId: 'eudora', star: 1 };
    a.board[5 + BOARD_COLS] = { uid: 5, defId: 'eudora', star: 1 }; // another row
    a.items = ['seahalberd', 'haasclaw', 'berserkerfury'].map((id, i) => ({ uid: 80 + i, id, tier: 1, holder: 2 }));
    b.board[3] = { uid: 6, defId: 'minos', star: 1 };
    // Each of our fighters' shield when the fight starts (other start shields, e.g. from traits, included).
    const startShields = (card: boolean) => {
      a.powerCards = card ? [{ id: 'fortifiedDefense', tier: 'purple' }] : [];
      const r = simulateCombat({ rng: 1 }, a, b);
      const amount = new Map<string, number>();
      for (const e of r.events) {
        if (e.type !== 'shield' || e.t !== 0) continue;
        const f = r.fighters.find((x) => x.id === e.id)!;
        if (f.side === 0) amount.set(`${f.x},${f.y}`, e.amount);
      }
      return { r, amount };
    };
    const plain = startShields(false).amount;
    const { r, amount } = startShields(true);
    const holder = r.fighters.find((f) => f.side === 0 && f.items.length === 3)!;
    for (const f of r.fighters.filter((x) => x.side === 0)) {
      const key = `${f.x},${f.y}`;
      const near = f.y === holder.y && Math.abs(f.x - holder.x) <= 1;
      expect((amount.get(key) ?? 0) - (plain.get(key) ?? 0)).toBe(near ? 1400 : 0);
    }
  });
});

describe('Vanguard Leader', () => {
  test('25% hybrid attack on every hero; the commander takes 2 more damage from a lost fight', () => {
    const p = { powerCards: [{ id: 'vanguardLeader', tier: 'purple' }] } as Player;
    expect(powerMods(p, 10, 0, 0)).toEqual([
      { stat: 'atk', pct: 0.25 },
      { stat: 'ap', pct: 0.25 },
    ]);
    expect(hurtExtraOf(p)).toBe(2);
    expect(hurtExtraOf({} as Player)).toBe(0);
  });
});

describe('Rogue Mercenary', () => {
  test('a random 4-cost hero with a permanent 25% damage and 1000 hp, kept through merges', () => {
    const { state, a } = pickPurple(71, 'rogueMercenary');
    const merc = a.bench.find(Boolean)!;
    expect(UNITS.find((d) => d.id === merc.defId)!.tier).toBe(4);
    expect(merc.merc).toBe(true);
    // On the board: +1000 hp and +25% damage over a plain copy.
    a.bench[a.bench.indexOf(merc)] = null;
    a.board[3] = merc;
    a.board[5] = { uid: 999, defId: merc.defId, star: 1 };
    a.items = [];
    const s = fieldStats(a, playerTraits(a));
    expect(s.get(merc.uid)!.hp - s.get(999)!.hp).toBe(1000);
    expect(s.get(merc.uid)!.damageAmp - s.get(999)!.damageAmp).toBeCloseTo(0.25);
    // Merged into another copy: the buff carries over.
    a.bench[0] = { uid: 998, defId: merc.defId, star: 1 };
    a.board[5] = null;
    a.board[2] = { uid: 997, defId: merc.defId, star: 1 }; // the board copy found first keeps the hero
    mergeUnits(a, merc.defId);
    const two = [...a.board, ...a.bench].find((u) => u?.defId === merc.defId)!;
    expect([two.star, two.merc]).toEqual([2, true]);
    void state;
  });
});

describe('Forbidden Power', () => {
  test('back-row heroes: 10% less max hp, 30% more damage; others untouched', () => {
    const p = { powerCards: [{ id: 'forbiddenPower', tier: 'purple' }] } as Player;
    for (let col = 0; col < BOARD_COLS; col++) {
      expect(powerMods(p, BOARD_COLS * (BOARD_ROWS - 1) + col, 0, 0)).toEqual([
        { stat: 'hp', pct: -0.1 },
        { stat: 'damageAmp', add: 0.3 },
      ]);
      for (let row = 0; row < BOARD_ROWS - 1; row++) expect(powerMods(p, row * BOARD_COLS + col, 0, 0)).toEqual([]);
    }
  });
});

describe('Legacy of Valor', () => {
  test('only heroes of costs the shop rolls at the player level', () => {
    for (const seed of [73, 79, 83, 89, 97]) {
      const { a } = pickPurple(seed, 'legacyOfValor', (p) => {
        p.mistOrbs = [];
        p.level = 1; // 1-costs only
      });
      for (const u of [...a.bench, ...a.board]) if (u && !UNITS.find((d) => d.id === u.defId)!.piece) expect(UNITS.find((d) => d.id === u.defId)!.tier).toBe(1);
    }
  });

  test('a random faction orb and 2 random heroes of that faction', () => {
    for (const seed of [73, 79, 83]) {
      const { a } = pickPurple(seed, 'legacyOfValor', (p) => (p.mistOrbs = []));
      expect(a.mistOrbs).toHaveLength(1);
      const trait = a.mistOrbs![0].trait;
      expect(TRAITS[trait].kind).toBe('faction');
      const got = [...a.bench, ...a.board].filter((u) => u && !UNITS.find((d) => d.id === u.defId)!.piece);
      expect(got.length).toBeGreaterThan(0); // 2, or 1 if they merged
      expect(got.reduce((n, u) => n + 3 ** (u!.star - 1), 0)).toBe(2);
      expect(got.every((u) => UNITS.find((d) => d.id === u!.defId)!.traits.includes(trait))).toBe(true);
    }
  });
});

describe('Adequate Stock', () => {
  test('blue and purple only', () => {
    for (const tier of ['blue', 'purple'] as const) expect(powerPool(tier)).toContain('adequateStock');
    expect(powerPool('gold')).not.toContain('adequateStock');
  });

  test('I / II: a free shop refresh every 2 rounds / every round, banked', () => {
    for (const [tier, every] of [['blue', 2], ['purple', 1]] as const) {
      const state = createGame(101, SEEDS);
      const [a] = state.players;
      a.freeRerolls = 0;
      a.powerOffer = { tier, cards: ['adequateStock'], rerolls: 0 };
      expect(applyAction(state, a.id, { type: 'pickPower', card: 'adequateStock' }).ok).toBe(true);
      expect(a.freeRerolls).toBe(0); // none on the pick
      const from = state.round;
      for (let r = from + 1; r <= from + 6; r++) {
        state.round = r;
        cycleRefreshes(state, a);
      }
      expect(a.freeRerolls).toBe(6 / every);
    }
  });
});

describe('Trust Fund', () => {
  test('purple only: 8 / 16 / 25 gold on reaching level 8 / 9 / 10, once each', () => {
    expect(powerPool('purple')).toContain('trustFund');
    for (const tier of ['blue', 'gold'] as const) expect(powerPool(tier)).not.toContain('trustFund');
    const state = createGame(103, SEEDS);
    const [a] = state.players;
    a.level = 7;
    a.gold = 0;
    a.powerOffer = { tier: 'purple', cards: ['trustFund'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'trustFund' }).ok).toBe(true);
    expect(a.gold).toBe(0);
    a.level = 8;
    checkChestTriggers(state, a);
    expect(a.gold).toBe(8);
    checkChestTriggers(state, a);
    expect(a.gold).toBe(8);
    a.level = 10; // two at once
    checkChestTriggers(state, a);
    expect(a.gold).toBe(8 + 16 + 25);
    expect(a.chests?.waiting ?? 0).toBe(0);
  });
});

describe('Astral Judgement / Crushing Claw: purple only', () => {
  test('offered on purple rounds only', () => {
    for (const id of ['astralJudgement', 'crushingClaw']) {
      expect(powerPool('purple')).toContain(id);
      for (const tier of ['blue', 'gold'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });
});

describe('Astral Judgement', () => {
  // Minos and a 2★ Martin (the Sovereign) vs a sturdy 2★ Hilman.
  const fight = (card: boolean) => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[2] = { uid: 1, defId: 'minos', star: 1 };
    a.board[3] = { uid: 2, defId: 'martin', star: 2 };
    if (card) a.powerCards = [{ id: 'astralJudgement', tier: 'purple' }];
    b.board[3] = { uid: 3, defId: 'hilman', star: 2 }; // lasts long enough
    return simulateCombat({ rng: 1 }, a, b);
  };

  test("the Sovereign's skill hits bring pure Judgement Bolts, at most once every 3s", () => {
    expect(fight(false).events.some((e) => e.type === 'effect' && e.effect === 'astralJudgement')).toBe(false);
    const r = fight(true);
    const martin = r.fighters.find((f) => f.defId === 'martin')!.id;
    const bolts = r.events.filter((e) => e.type === 'effect' && e.effect === 'astralJudgement');
    expect(bolts.length).toBeGreaterThan(0);
    expect(bolts.every((e) => e.type === 'effect' && e.by === martin && e.damage > 0)).toBe(true);
    const ticks = [...new Set(bolts.map((e) => e.t))];
    for (let i = 1; i < ticks.length; i++) expect(ticks[i] - ticks[i - 1]).toBeGreaterThanOrEqual(3 * TICKS_PER_SECOND);
  });
});

describe('Crushing Claw', () => {
  // Eudora and Balman (Skybringer 2) vs a sturdy 2★ Hilman.
  const fight = (card: boolean) => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    a.board[2] = { uid: 1, defId: 'eudora', star: 1 };
    a.board[3] = { uid: 2, defId: 'balman', star: 1 };
    if (card) a.powerCards = [{ id: 'crushingClaw', tier: 'purple' }];
    b.board[3] = { uid: 3, defId: 'hilman', star: 2 }; // lasts long enough
    return simulateCombat({ rng: 1 }, a, b);
  };
  const firstStrike = (r: ReturnType<typeof fight>) => r.events.find((e) => e.type === 'effect' && e.effect === 'skybringer');

  test('lightning deals 25% more, as pure damage, and lowers armor and magic resist by 20 for the fight', () => {
    const plain = firstStrike(fight(false));
    const r = fight(true);
    const crush = firstStrike(r);
    expect(plain?.type === 'effect' && crush?.type === 'effect').toBe(true);
    if (plain?.type !== 'effect' || crush?.type !== 'effect') return;
    // Pure and 25% more: well above the magic strike that its magic resist cuts down.
    expect(crush.damage).toBeGreaterThan(plain.damage * 1.25);
    const debuffs = r.events.filter((e) => e.type === 'debuff' && e.effect === 'crushingClaw');
    expect(debuffs).toHaveLength(1); // once per enemy, for the whole fight
    expect(debuffs[0].type === 'debuff' && [debuffs[0].armor, debuffs[0].mr]).toEqual([20, 20]);
    expect(fight(false).events.some((e) => e.type === 'debuff' && e.effect === 'crushingClaw')).toBe(false);
  });
});

describe('purple-only cards (3)', () => {
  test('Emergency Rift, Exclusive Offering, Neon Zenith, Transmutation', () => {
    for (const id of ['emergencyRift', 'exclusiveOffering', 'neonZenith', 'transmutation']) {
      expect(powerPool('purple')).toContain(id);
      for (const tier of ['blue', 'gold'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });
});

describe('Emergency Rift', () => {
  test('25 souls now, and a second, different Plane Wanderer: 1★ until III-5, then 2★ for good', () => {
    const { state, a } = pickPurple(107, 'emergencyRift', (p) => (p.stacks = {}));
    expect(a.stacks.necromancer).toBe(25);
    // The grave's pick is still open: the Rift's Wanderer is neither of those on offer.
    const offer = a.rewardOffer!.necromancer;
    const extra = a.bench.find(Boolean)!;
    expect(TRAITS.necromancer.stacks!.rewardUnits).toContain(extra.defId);
    expect(offer).not.toContain(extra.defId);
    applyAction(state, a.id, { type: 'pickReward', trait: 'necromancer', unit: offer[0] });
    expect(extra.star).toBe(1);
    state.round = roundAt(3, 5) - 1;
    syncPlayer(state, a);
    expect(extra.star).toBe(1);
    state.round = roundAt(3, 5);
    syncPlayer(state, a);
    expect(extra.star).toBe(2);
    state.round = roundAt(5, 1);
    a.stacks.necromancer = 999; // the grave's own Wanderer goes to 3★; this one stays 2★
    syncPlayer(state, a);
    expect(extra.star).toBe(2);
    expect([...a.bench, ...a.board].filter((u) => u?.defId === extra.defId)).toHaveLength(1);
  });

  test('a full bench and board: it waits for room', () => {
    const { state, a } = pickPurple(109, 'emergencyRift', (p) => {
      p.stacks = {};
      p.bench.fill(null).forEach((_, i) => (p.bench[i] = { uid: 700 + i, defId: 'minos', star: 2 }));
      p.board.fill(null).forEach((_, i) => (p.board[i] = { uid: 800 + i, defId: 'eudora', star: 2 }));
    });
    const extra = a.rift!.defId;
    expect([...a.bench, ...a.board].some((u) => u?.defId === extra)).toBe(false);
    (a as Player).bench[0] = null;
    a.bench[1] = null; // (the commander's piece may claim a slot first)
    syncPlayer(state, a);
    expect([...a.bench, ...a.board].some((u) => u?.defId === extra)).toBe(true);
    expect(a.rift!.given).toBe(true);
  });
});

describe('Exclusive Offering', () => {
  test('a second Pyre Offering; each gives the cult 80% of its bearer\'s attack, the bearers none', () => {
    const state = createGame(113, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.bench.fill(null);
    a.items = [];
    a.board[0] = { uid: 1, defId: 'cici', star: 1 };
    a.board[1] = { uid: 2, defId: 'mia', star: 1 };
    a.board[3] = { uid: 3, defId: 'minos', star: 1 };
    a.board[4] = { uid: 4, defId: 'eudora', star: 1 };
    syncPlayer(state, a);
    expect(a.items.filter((i) => baseItemOf(i.id) === 'offering')).toHaveLength(1);
    a.powerOffer = { tier: 'purple', cards: ['exclusiveOffering'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'exclusiveOffering' }).ok).toBe(true);
    const offerings = a.items.filter((i) => baseItemOf(i.id) === 'offering');
    expect(offerings).toHaveLength(2);
    expect(offerings.every((i) => i.id === 'offering+')).toBe(true); // and enhanced
    const before = fieldStats(a, playerTraits(a));
    offerings[0].holder = 3;
    offerings[1].holder = 4;
    const after = fieldStats(a, playerTraits(a));
    const gift = (uid: number) => Math.round(Math.max(after.get(uid)!.atk, after.get(uid)!.ap) * 0.8);
    expect(after.get(1)!.atk - before.get(1)!.atk).toBeCloseTo(gift(3) + gift(4), -1);
    // The bearers themselves gain nothing from either Offering.
    // The bearers get no share: only each Offering's own +25% attack (they're enhanced here).
    expect(Math.abs(after.get(3)!.atk - before.get(3)!.atk * (1 + ITEMS.offering.mods(1)[0].pct!))).toBeLessThanOrEqual(1);
    expect(Math.abs(after.get(4)!.atk - before.get(4)!.atk * (1 + ITEMS.offering.mods(1)[0].pct!))).toBeLessThanOrEqual(1);
  });
});

describe('Neon Zenith', () => {
  test('Gourd on reaching level 8, Alice on level 9', () => {
    const { state, a } = pickPurple(127, 'neonZenith', (p) => (p.level = 7));
    const has = (id: string) => [...a.bench, ...a.board].some((u) => u?.defId === id);
    expect(has('gourd') || has('alice')).toBe(false);
    a.level = 8;
    checkChestTriggers(state, a);
    expect([has('gourd'), has('alice')]).toEqual([true, false]);
    a.level = 9;
    checkChestTriggers(state, a);
    expect(has('alice')).toBe(true);
    expect(a.chestTriggers).toEqual([]);
  });
});

describe('Transmutation', () => {
  test('after 4 rounds the card turns into a random gold power card', () => {
    const state = createGame(131, SEEDS);
    const [a] = state.players;
    a.powerOffer = { tier: 'purple', cards: ['transmutation'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'transmutation' }).ok).toBe(true);
    const from = state.round;
    while (state.round < from + 3) {
      resolveCombat(state);
      startRound(state);
      expect(a.powerCards?.some((c) => c.id === 'transmutation')).toBe(true);
    }
    const held = a.powerCards!.length;
    resolveCombat(state);
    startRound(state);
    expect(state.round).toBe(from + 4);
    expect(a.powerCards?.some((c) => c.id === 'transmutation')).toBe(false);
    expect(a.powerCards).toHaveLength(held); // swapped, not added
    const gold = a.powerCards!.at(-1)!;
    expect(gold.tier).toBe('gold');
    expect(powerPool('gold')).toContain(gold.id);
  });
});

describe('trait perk cards', () => {
  const PERK_CARDS = ['koPunch', 'aftershock', 'blazingValor', 'whirlOfCarnage', 'hailOfShots', 'starChorus'];

  test('purple only', () => {
    for (const id of PERK_CARDS) {
      expect(powerPool('purple')).toContain(id);
      for (const tier of ['blue', 'gold'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });

  // Our `mine` (cells -> [defId, star]) vs a sturdy 2★ Hilman, with or without the card.
  const fight = (card: string | null, mine: [number, string, 1 | 2 | 3][], setup?: (a: Player) => void) => {
    const state = createGame(1, SEEDS);
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
      p.items = [];
    }
    mine.forEach(([cell, defId, star], i) => (a.board[cell] = { uid: i + 1, defId, star }));
    if (card) a.powerCards = [{ id: card, tier: 'purple' }];
    setup?.(a);
    b.board[3] = { uid: 99, defId: 'hilman', star: 2 };
    return simulateCombat({ rng: 1 }, a, b);
  };
  const effects = (r: ReturnType<typeof fight>, effect: string) => r.events.filter((e) => e.type === 'effect' && e.effect === effect);

  test('KO Punch: Fighters\' basic attacks sometimes stun for 1.5s', () => {
    const stuns = (card: string | null) => fight(card, [[3, 'belle', 2]]).events.filter((e) => e.type === 'stun' && e.effect === 'koPunch');
    expect(stuns(null)).toHaveLength(0);
    const got = stuns('koPunch');
    expect(got.length).toBeGreaterThan(0);
    for (const e of got) if (e.type === 'stun') expect(e.until - e.t).toBe(1.5 * TICKS_PER_SECOND);
  });

  test('Aftershock: a Defender blasts the tiles around it for every 30% of hp lost (3 at most)', () => {
    expect(effects(fight(null, [[3, 'minos', 1]]), 'aftershock')).toHaveLength(0);
    const r = fight('aftershock', [[3, 'minos', 1]]);
    const minos = r.fighters.find((f) => f.defId === 'minos')!;
    const blasts = effects(r, 'aftershock');
    expect(blasts.length).toBeGreaterThan(0);
    expect(new Set(blasts.map((e) => e.t)).size).toBeLessThanOrEqual(3);
    expect(blasts.every((e) => e.type === 'effect' && e.by === minos.id)).toBe(true);
  });

  test('Blazing Valor: shielded Dauntless gain each second, for 5s at most', () => {
    const aegis = (a: Player) => (a.items = [{ uid: 70, id: 'aegis', tier: 1, holder: 1 }]);
    const buffs = (card: string | null) =>
      fight(card, [[3, 'uranus', 2]], aegis).events.filter((e) => e.type === 'buff' && e.effect === 'blazingValor');
    expect(buffs(null)).toHaveLength(0);
    const got = buffs('blazingValor');
    expect(got.length).toBeGreaterThan(0);
    expect(got.length).toBeLessThanOrEqual(5);
  });

  test('Blazing Valor: 3% a second, then +8% at 5s: 23% max hp and hybrid attack in all', () => {
    // Straight through the numbers: 5 seconds of 3%, the last with the 8% bonus.
    let total = 0;
    for (let s = 1; s <= BLAZING_VALOR.seconds; s++) total += BLAZING_VALOR.perSecond + (s === BLAZING_VALOR.seconds ? BLAZING_VALOR.bonus : 0);
    expect(total).toBeCloseTo(0.23);
  });

  test('Whirl of Carnage: a Weapon Master\'s cast hits the tiles around it for 130% of its attack', () => {
    expect(effects(fight(null, [[3, 'martin', 2]]), 'whirlOfCarnage')).toHaveLength(0);
    const r = fight('whirlOfCarnage', [[3, 'martin', 2]]);
    const martin = r.fighters.find((f) => f.defId === 'martin')!.id;
    const casts = r.events.filter((e) => e.type === 'skill' && e.id === martin).map((e) => e.t);
    const whirls = effects(r, 'whirlOfCarnage');
    expect(whirls.length).toBeGreaterThan(0);
    expect(whirls.every((e) => casts.includes(e.t))).toBe(true);
  });

  test('Hail of Shots: Deadeyes attack faster early on', () => {
    const early = (card: string | null) => {
      const r = fight(card, [[17, 'wan', 2]]);
      const wan = r.fighters.find((f) => f.defId === 'wan')!.id;
      return r.events.filter((e) => e.type === 'attack' && e.id === wan && e.t < 5 * TICKS_PER_SECOND).length;
    };
    expect(early('hailOfShots')).toBeGreaterThan(early(null));
  });

  test('Cutthroat and Critical Spellcraft: purple only', () => {
    for (const id of ['cutthroat', 'criticalSpellcraft']) {
      expect(powerPool('purple')).toContain(id);
      for (const tier of ['blue', 'gold'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });

  test('Cutthroat: every 4s a Hunter\'s next basic attack adds 180% adaptive damage', () => {
    expect(effects(fight(null, [[3, 'katarina', 2]]), 'cutthroat')).toHaveLength(0);
    const r = fight('cutthroat', [[3, 'katarina', 2]]);
    const kat = r.fighters.find((f) => f.defId === 'katarina')!.id;
    const cuts = effects(r, 'cutthroat');
    expect(cuts.length).toBeGreaterThan(0);
    expect(cuts[0].t).toBeGreaterThanOrEqual(4 * TICKS_PER_SECOND);
    for (let i = 1; i < cuts.length; i++) expect(cuts[i].t - cuts[i - 1].t).toBeGreaterThanOrEqual(4 * TICKS_PER_SECOND);
    // Each comes with one of its basic attacks.
    const attacks = new Set(r.events.filter((e) => e.type === 'attack' && e.id === kat).map((e) => e.t));
    expect(cuts.every((e) => attacks.has(e.t))).toBe(true);
  });

  test('Critical Spellcraft: a Mage\'s skill hits crit 60% of the time, for 150%', () => {
    const skillHits = (card: string | null) => {
      const r = fight(card, [[17, 'zhuxin', 2]]);
      const id = r.fighters.find((f) => f.defId === 'zhuxin')!.id;
      return r.events.filter((e) => e.type === 'effect' && e.by === id);
    };
    expect(skillHits(null).some((e) => e.type === 'effect' && e.crit)).toBe(false);
    const hits = skillHits('criticalSpellcraft');
    const crits = hits.filter((e) => e.type === 'effect' && e.crit);
    expect(crits.length).toBeGreaterThan(0);
    expect(crits.length / hits.length).toBeGreaterThan(0.3);
    expect(crits.length / hits.length).toBeLessThan(0.9);
  });

  test('Star Chorus: a Stargazer\'s cast hits 2 random enemies for 65% of its magic attack', () => {
    expect(effects(fight(null, [[17, 'eudora', 2]]), 'starChorus')).toHaveLength(0);
    const r = fight('starChorus', [[17, 'eudora', 2]]);
    const chorus = effects(r, 'starChorus');
    expect(chorus.length).toBeGreaterThan(0);
    const perTick = new Map<number, number>();
    for (const e of chorus) perTick.set(e.t, (perTick.get(e.t) ?? 0) + 1);
    expect([...perTick.values()].every((n) => n <= 2)).toBe(true); // one enemy here, so 1 each
  });
});

describe('gold cards', () => {
  const pickGold = (seed: number, card: string, setup?: (a: Player) => void, setState?: (s: GameState) => void) => {
    const state = createGame(seed, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.bench.fill(null);
    setup?.(a);
    setState?.(state);
    a.powerOffer = { tier: 'gold', cards: [card], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card }).ok).toBe(true);
    return { state, a };
  };

  test('gold only', () => {
    for (const id of ['allysCall', 'theHunt', 'holyObjects', 'fortified', 'fullyArmed', 'territoryAgreement']) {
      expect(powerPool('gold')).toContain(id);
      for (const tier of ['blue', 'purple'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });

  test('The Hunt, Holy Objects, Fortified: their three equipment and 10 gold', () => {
    const sets: [string, string[]][] = [
      ['theHunt', ['goldenstaff', 'demonhuntersword', 'seahalberd']],
      ['holyObjects', ['spellbladetalisman', 'glowingwand', 'icequeenwand']],
      ['fortified', ['dominanceice', 'bladearmor', 'guardianhelmet']],
    ];
    for (const [card, items] of sets) {
      let gold = 0;
      const { a } = pickGold(161, card, (p) => {
        p.items = [];
        gold = p.gold;
      });
      expect(a.items.map((i) => i.id).sort()).toEqual([...items].sort());
      expect(a.items.every((i) => i.holder === null && i.tier === 1)).toBe(true);
      expect(a.gold).toBe(gold + 10);
    }
  });

  test("Ally's Call: a star-up gives a 1★ hero sharing a trait with it", () => {
    const { state, a } = pickGold(163, 'allysCall', (p) => {
      p.level = 5;
      p.bench[0] = { uid: 901, defId: 'balman', star: 1 };
      p.bench[1] = { uid: 902, defId: 'balman', star: 1 };
    });
    state.pool.balman--;
    a.gold = 50;
    a.shop[0] = 'balman';
    expect(applyAction(state, a.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    const units = [...a.bench, ...a.board].filter((u): u is NonNullable<typeof u> => !!u && !UNIT_BY_ID[u.defId].piece);
    expect(units.some((u) => u.defId === 'balman' && u.star === 2)).toBe(true);
    const ally = units.filter((u) => u.defId !== 'balman');
    expect(ally).toHaveLength(1);
    expect(ally[0].star).toBe(1);
    expect(UNIT_BY_ID[ally[0].defId].traits.some((t) => UNIT_BY_ID.balman.traits.includes(t))).toBe(true);
  });

  test("Ally's Call: nothing without the card", () => {
    const state = createGame(163, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.bench.fill(null);
    a.bench[0] = { uid: 901, defId: 'balman', star: 1 };
    a.bench[1] = { uid: 902, defId: 'balman', star: 1 };
    a.gold = 50;
    a.shop[0] = 'balman';
    expect(applyAction(state, a.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    expect([...a.bench, ...a.board].filter((u) => u && !UNIT_BY_ID[u.defId].piece)).toHaveLength(1);
  });

  test('Fully Armed: heroes holding nothing borrow one attack and one armor piece for the fight', () => {
    const { state, a } = pickGold(167, 'fullyArmed', (p) => (p.items = []));
    const b = state.players[1];
    a.board.fill(null);
    a.bench.fill(null);
    a.board[3] = { uid: 801, defId: 'zhuxin', star: 1 }; // magic
    a.board[4] = { uid: 802, defId: 'balman', star: 1 }; // physical
    a.board[5] = { uid: 803, defId: 'mia', star: 1 }; // holds an item: borrows nothing
    a.items = [{ uid: 990, id: 'waraxe', tier: 1, holder: 803 }];
    b.board.fill(null);
    b.board[3] = { uid: 804, defId: 'hilos', star: 1 };
    state.round = 4; // a player round
    const fights = resolveCombat(state);
    const mine = fights.find((x) => x.home === a.id || x.away === a.id)!;
    const side = mine.home === a.id ? 0 : 1;
    const held = (defId: string) => mine.result.fighters.find((f) => f.side === side && f.defId === defId)!.items.map((i) => i.id);
    expect(held('zhuxin').map((i) => ITEMS[i].group).sort()).toEqual(['armor', 'magic']);
    expect(held('balman').map((i) => ITEMS[i].group).sort()).toEqual(['armor', 'physical']);
    expect(held('mia')).toEqual(['waraxe']);
    // Taken back after.
    expect(a.items.some((i) => i.loan)).toBe(false);
    expect(a.items.filter((i) => i.holder === 801 || i.holder === 802)).toEqual([]);
  });

  test('Territory Agreement: 55 gold, and no level past 7', () => {
    let gold = 0;
    const { state, a } = pickGold(171, 'territoryAgreement', (p) => {
      p.level = 6;
      gold = p.gold;
    });
    expect(a.gold).toBe(gold + 55);
    a.gold = 500;
    expect(applyAction(state, a.id, { type: 'levelUp' }).ok).toBe(true);
    expect(a.level).toBe(7);
    expect(applyAction(state, a.id, { type: 'levelUp' }).ok).toBe(false);
    addXp(a, 500);
    expect([a.level, a.xp]).toEqual([7, 0]);
  });

  test('more gold cards: gold only', () => {
    for (const id of ['partysOpening', 'sharpArmory', 'openingPromotion', 'vaultUpgrade']) {
      expect(powerPool('gold')).toContain(id);
      for (const tier of ['blue', 'purple'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });

  test("Party's Opening: one more hero on the board, and 3 gold", () => {
    let gold = 0;
    const { state, a } = pickGold(173, 'partysOpening', (p) => {
      p.level = 4;
      gold = p.gold;
    });
    expect(a.gold).toBe(gold + 3);
    expect(heroCapOf(a)).toBe(5);
    // Five fielded at level 4: none trimmed at the fight.
    a.board.fill(null);
    for (const [i, id] of ['minos', 'val', 'eudora', 'cici', 'dyroth'].entries()) a.board[i] = { uid: 950 + i, defId: id, star: 1 };
    trimBoard(state, a);
    expect(boardCount(a)).toBe(5);
  });

  test('Sharp Armory: back-row heroes gain 10% hybrid attack per basic attack, up to 8', () => {
    const run = (card: string | null, cell: number) => {
      const state = createGame(175, SEEDS);
      const [a, b] = state.players;
      a.items = [];
      b.items = [];
      a.powerCards = card ? [{ id: card, tier: 'gold' }] : [];
      a.board.fill(null);
      a.board[cell] = { uid: 960, defId: 'eudora', star: 2 };
      if (cell !== 3) a.board[3] = { uid: 962, defId: 'titan', star: 3 }; // a tank in front, for a long fight
      b.board.fill(null);
      b.board[3] = { uid: 961, defId: 'titan', star: 3 };
      return simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
    };
    const back = BOARD_COLS * (BOARD_ROWS - 1) + 2;
    const buffs = (r: ReturnType<typeof simulateCombat>) => r.events.filter((e) => e.type === 'buff' && e.effect === 'sharpArmory');
    expect(buffs(run(null, back))).toHaveLength(0);
    expect(buffs(run('sharpArmory', 2))).toHaveLength(0); // front row: nothing
    const got = buffs(run('sharpArmory', back));
    expect(got.length).toBe(8); // one per stack, up to 8
  });

  test('Opening Promotion: the first hero bought each round is free; 2 gold now', () => {
    let gold = 0;
    const { state, a } = pickGold(177, 'openingPromotion', (p) => (gold = p.gold));
    expect(a.gold).toBe(gold + 2);
    a.gold = 10;
    a.shop[0] = 'balman';
    a.shop[1] = 'minos';
    expect(shopPrice(a, 0)).toBe(0);
    expect(applyAction(state, a.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    expect(a.gold).toBe(10);
    expect(shopPrice(a, 1)).toBe(1); // the second costs as usual
    expect(applyAction(state, a.id, { type: 'buy', slot: 1 }).ok).toBe(true);
    expect(a.gold).toBe(9);
    // Back next round.
    for (const pl of state.players) pl.powerOffer = undefined;
    startRound(state);
    expect(a.freeBuy).toBe(1);
  });

  test('Vault Upgrade: interest up to 8 (at 40 banked), and 18 gold', () => {
    let gold = 0;
    const { a } = pickGold(179, 'vaultUpgrade', (p) => (gold = p.gold));
    expect(a.gold).toBe(gold + 18);
    a.gold = 39;
    expect(roundIncome(a, 5).interest).toBe(6);
    a.gold = 40;
    expect(roundIncome(a, 5).interest).toBe(8);
    a.gold = 90;
    expect(roundIncome(a, 5).interest).toBe(8);
  });

  test('Full Throttle III: 5 XP on the pick; I and II none', () => {
    const { a } = pickGold(181, 'fastGrowth', (p) => {
      p.level = 8;
      p.xp = 0;
    });
    expect([a.level, a.xp]).toEqual([8, 5]);
    expect(POWER_CARDS.fastGrowth.pickXp?.purple).toBeUndefined();
  });

  test('Golden Era, The More the Merrier, Death Oracle, Copycat: gold only', () => {
    for (const id of ['goldenEra', 'moreTheMerrier', 'deathOracle', 'copycat']) {
      expect(powerPool('gold')).toContain(id);
      for (const tier of ['blue', 'purple'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });

  test('Golden Era: 10 free refreshes now, 5 more per level gained', () => {
    const { a } = pickGold(183, 'goldenEra', (p) => {
      p.freeRerolls = 0;
      p.level = 4;
      p.xp = 0;
    });
    expect(a.freeRerolls).toBe(10);
    addXp(a, xpToNext(a)!);
    expect([a.level, a.freeRerolls]).toEqual([5, 15]);
  });

  test('The More the Merrier: 1 gold per active synergy after a fight', () => {
    const run = (card: boolean) => {
      const state = createGame(185, SEEDS);
      for (const pl of state.players) {
        pl.powerOffer = undefined;
        pl.items = [];
        pl.board.fill(null);
        pl.bench.fill(null);
      }
      const [a, b] = state.players;
      if (card) a.powerCards = [{ id: 'moreTheMerrier', tier: 'gold' }];
      // Two Cult of Fire and two Mage: two synergies, at least.
      a.board[3] = { uid: 970, defId: 'zhuxin', star: 1 };
      a.board[4] = { uid: 971, defId: 'mia', star: 1 };
      a.board[5] = { uid: 972, defId: 'val', star: 1 };
      b.board[3] = { uid: 973, defId: 'minos', star: 1 };
      state.round = 4;
      const before = a.gold;
      const fights = resolveCombat(state);
      const mine = fights.find((x) => x.home === a.id || x.away === a.id)!;
      const side = mine.home === a.id ? 0 : 1;
      return { gained: a.gold - before, active: Object.values(mine.result.traits[side]).filter((l) => l > 0).length };
    };
    const off = run(false);
    const on = run(true);
    expect(on.active).toBeGreaterThanOrEqual(2);
    expect(on.gained - off.gained).toBe(on.active);
  });

  test('Death Oracle: a 35 shield; 35 refreshes cost 1 hp instead of gold, never the last', () => {
    const { state, a } = pickGold(187, 'deathOracle', (p) => {
      p.shield = 0;
      p.freeRerolls = 0;
    });
    expect(a.shield).toBe(35);
    expect(a.bloodRefreshes).toBe(35);
    a.gold = 10;
    const hp = a.hp;
    expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(true);
    expect([a.hp, a.gold, a.bloodRefreshes]).toEqual([hp - 1, 10, 34]);
    // Free refreshes go first.
    a.freeRerolls = 1;
    expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(true);
    expect([a.hp, a.bloodRefreshes]).toEqual([hp - 1, 34]);
    // At 1 hp: gold as usual.
    a.hp = 1;
    expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(true);
    expect([a.hp, a.gold, a.bloodRefreshes]).toEqual([1, 8, 34]);
    // Used up: gold again.
    a.hp = 50;
    a.bloodRefreshes = 1;
    expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(true);
    expect(a.hp).toBe(49);
    expect(a.bloodRefreshes).toBeUndefined();
    expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(true);
    expect([a.hp, a.gold]).toEqual([49, 6]);
  });

  test('Copycat: 6 gold and a Duplicator: 3 copies of an equipment, never a trait item', () => {
    let gold = 0;
    const { state, a } = pickGold(189, 'copycat', (p) => {
      gold = p.gold;
      p.items = [
        { uid: 980, id: 'waraxe', tier: 1, holder: null },
        { uid: 981, id: 'offering', tier: 1, holder: null },
        { uid: 982, id: 'keris', tier: 1, holder: null },
      ];
    });
    expect(a.gold).toBe(gold + 6);
    expect(a.duplicators).toBe(1);
    expect(applyAction(state, a.id, { type: 'useDuplicator', item: 981 }).ok).toBe(false);
    expect(applyAction(state, a.id, { type: 'useDuplicator', item: 982 }).ok).toBe(false);
    expect(applyAction(state, a.id, { type: 'useDuplicator', item: 980 }).ok).toBe(true);
    expect(a.items.filter((i) => i.id === 'waraxe')).toHaveLength(4);
    expect(a.duplicators).toBeUndefined();
    expect(applyAction(state, a.id, { type: 'useDuplicator', item: 980 }).ok).toBe(false); // none left
  });

  test('Shield of Fortune (Slow / Fast): gold only, two cards', () => {
    for (const id of ['shieldOfFortuneSlow', 'shieldOfFortuneFast']) {
      expect(powerPool('gold')).toContain(id);
      for (const tier of ['blue', 'purple'] as const) expect(powerPool(tier)).not.toContain(id);
    }
    expect(POWER_CARDS.shieldOfFortuneSlow.name).toBe('Shield of Fortune (Slow)');
    expect(POWER_CARDS.shieldOfFortuneFast.name).toBe('Shield of Fortune (Fast)');
  });

  test('Shield of Fortune: gold and a 30 shield now; after the rounds, what is left turns to gold', () => {
    for (const [card, gold, rounds] of [['shieldOfFortuneSlow', 10, 5], ['shieldOfFortuneFast', 15, 2]] as const) {
      let before = 0;
      const { state, a } = pickGold(191, card, (p) => {
        p.shield = 0;
        before = p.gold;
      });
      expect(a.gold).toBe(before + gold);
      expect(a.shield).toBe(30);
      hurtPlayer(a, 12); // 18 left
      const at = state.round + rounds;
      state.round = at - 1;
      cashFortunes(state, a);
      expect(a.shield).toBe(18); // not yet
      state.round = at;
      const g = a.gold;
      cashFortunes(state, a);
      expect([a.gold - g, a.shield, a.fortunes]).toEqual([18, undefined, undefined]);
    }
  });

  test('Shield of Fortune: damage takes its shield first, so another shield never turns to gold', () => {
    const { state, a } = pickGold(193, 'shieldOfFortuneFast', (p) => (p.shield = 20)); // e.g. Rock Solid's
    expect(a.shield).toBe(50);
    hurtPlayer(a, 25); // all from the Fortune's 30: 5 of it left, the other 20 untouched
    state.round += 2;
    const g = a.gold;
    cashFortunes(state, a);
    expect([a.gold - g, a.shield]).toEqual([5, 20]);
  });

  test('Glorious Claim, Experienced Shuffle, Turret of Guardians, Divine Execution: gold only', () => {
    for (const id of ['gloriousClaim', 'experiencedShuffle', 'turretOfGuardians', 'divineExecution']) {
      expect(powerPool('gold')).toContain(id);
      for (const tier of ['blue', 'purple'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });

  test('Glorious Claim: a win stores 4; two wins pay 8; a loss pays what is stored; a draw nothing', () => {
    const p = createGame(195, SEEDS).players[0];
    p.powerCards = [{ id: 'gloriousClaim', tier: 'gold' }];
    p.gold = 0;
    gloriousClaim(p, true, false);
    expect([p.gold, p.claim]).toEqual([0, 4]);
    gloriousClaim(p, false, false); // draw
    expect([p.gold, p.claim]).toEqual([0, 4]);
    gloriousClaim(p, true, false);
    expect(p.gold).toBe(8);
    expect(p.claim).toBeUndefined();
    gloriousClaim(p, true, false);
    gloriousClaim(p, false, true);
    expect(p.gold).toBe(12);
    expect(p.claim).toBeUndefined();
    // Without the card: nothing.
    const q = createGame(195, SEEDS).players[1];
    q.gold = 0;
    gloriousClaim(q, true, false);
    expect([q.gold, q.claim]).toEqual([0, undefined]);
  });

  test('Experienced Shuffle: 25 XP now; the first manual refresh each round gives 2 XP', () => {
    const { state, a } = pickGold(197, 'experiencedShuffle', (p) => {
      p.level = 9;
      p.xp = 0;
    });
    expect(a.xp).toBe(25);
    a.gold = 20;
    a.freeRerolls = 0;
    expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(true);
    expect(a.xp).toBe(27);
    expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(true);
    expect(a.xp).toBe(27); // once a round
    state.round++;
    expect(applyAction(state, a.id, { type: 'reroll' }).ok).toBe(true);
    expect(a.xp).toBe(29);
  });

  test('Turret of Guardians: 2 Turrets, each one faction and one role, 1★, a star every 7 rounds', () => {
    const { state, a } = pickGold(199, 'turretOfGuardians');
    const turrets = [...a.bench, ...a.board].filter((u) => u && UNIT_BY_ID[u.defId].turret);
    expect(turrets).toHaveLength(2);
    for (const t of turrets) {
      const def = UNIT_BY_ID[t!.defId];
      expect(t!.star).toBe(1);
      expect(def.range).toBe(12);
      expect(def.rooted).toBe(true);
      expect(def.traits.filter((x) => TRAITS[x].kind === 'faction')).toHaveLength(1);
      expect(def.traits.filter((x) => TRAITS[x].kind === 'role')).toHaveLength(1);
      expect(def.hp).toBe(UNIT_BY_ID.vex.hp); // a 4-gold hero's stats
    }
    const from = state.round;
    state.round = from + 6;
    ageTurrets(state, a);
    expect(turrets.map((t) => t!.star)).toEqual([1, 1]);
    state.round = from + 7;
    ageTurrets(state, a);
    expect(turrets.map((t) => t!.star)).toEqual([2, 2]);
    state.round = from + 30;
    ageTurrets(state, a);
    expect(turrets.map((t) => t!.star)).toEqual([3, 3]);
  });

  test('Turret: never moves in a fight', () => {
    const state = createGame(201, SEEDS);
    const [a, b] = state.players;
    a.items = [];
    b.items = [];
    a.board.fill(null);
    b.board.fill(null);
    a.board[BOARD_COLS * (BOARD_ROWS - 1)] = { uid: 990, defId: 'turret-astral-deadeye', star: 1 };
    b.board[3] = { uid: 991, defId: 'minos', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
    const id = r.fighters.find((f) => f.defId === 'turret-astral-deadeye')!.id;
    expect(r.events.some((e) => e.type === 'move' && e.id === id)).toBe(false);
    expect(r.events.some((e) => e.type === 'attack' && e.id === id)).toBe(true);
  });

  test('Divine Execution: enemies under 15% are finished off by your heroes', () => {
    const run = (card: boolean) => {
      const state = createGame(203, SEEDS);
      const [a, b] = state.players;
      a.items = [];
      b.items = [];
      a.powerCards = card ? [{ id: 'divineExecution', tier: 'gold' }] : [];
      a.board.fill(null);
      b.board.fill(null);
      a.board[3] = { uid: 992, defId: 'balman', star: 3 };
      b.board[3] = { uid: 993, defId: 'titan', star: 2 };
      return simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
    };
    const executions = (r: ReturnType<typeof run>) => r.events.flatMap((e) => (e.type === 'effect' && e.effect === 'divineExecution' ? [e] : []));
    expect(executions(run(false))).toHaveLength(0);
    const r = run(true);
    const ex = executions(r);
    expect(ex.length).toBe(1);
    const titan = r.fighters.find((f) => f.defId === 'titan')!;
    expect(ex[0].damage).toBeLessThan(titan.maxHp * 0.15);
    expect(ex[0].damage).toBeGreaterThan(0);
  });

  test('Turrets: straight to the board, no slot taken, never sold', () => {
    const { state, a } = pickGold(205, 'turretOfGuardians', (p) => (p.level = 1));
    const cells = a.board.flatMap((u, i) => (u && UNIT_BY_ID[u.defId].turret ? [i] : []));
    expect(cells).toHaveLength(2);
    expect(boardCount(a)).toBe(0);
    trimBoard(state, a);
    expect(a.board.filter((u) => u && UNIT_BY_ID[u.defId].turret)).toHaveLength(2);
    expect(applyAction(state, a.id, { type: 'sell', from: { area: 'board', index: cells[0] } }).ok).toBe(false);
  });

  test('Divine Execution: 550 true damage to enemies on the tiles around the executed', () => {
    const state = createGame(207, SEEDS);
    const [a, b] = state.players;
    a.items = [];
    b.items = [];
    a.powerCards = [{ id: 'divineExecution', tier: 'gold' }];
    a.board.fill(null);
    b.board.fill(null);
    a.board[3] = { uid: 994, defId: 'balman', star: 3 };
    for (const [i, c] of [2, 3, 4].entries()) b.board[c] = { uid: 995 + i, defId: 'titan', star: 2 };
    const r = simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
    const of = (effect: string) => r.events.flatMap((e) => (e.type === 'effect' && e.effect === effect ? [e] : []));
    const ex = of('divineExecution');
    expect(ex.length).toBeGreaterThan(0);
    const smites = of('divineSmite');
    expect(smites.length).toBeGreaterThan(0);
    // Each smite lands with an execution.
    for (const sm of smites) {
      const at = ex.filter((e) => e.t === sm.t);
      expect(at.length).toBeGreaterThan(0);
      expect(sm.damage).toBeLessThanOrEqual(550);
    }
  });

  test('Disco Fever and Synergy Constellation: gold only', () => {
    for (const id of ['discoFever', 'synergyConstellation']) {
      expect(powerPool('gold')).toContain(id);
      for (const tier of ['blue', 'purple'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });

  test('Disco Fever: from the start, every 6s, 2 random enemies dance for 2s', () => {
    const run = (card: boolean) => {
      const state = createGame(209, SEEDS);
      const [a, b] = state.players;
      a.items = [];
      b.items = [];
      a.powerCards = card ? [{ id: 'discoFever', tier: 'gold' }] : [];
      a.board.fill(null);
      b.board.fill(null);
      a.board[3] = { uid: 1001, defId: 'titan', star: 3 };
      for (const [i, c] of [2, 3, 4].entries()) b.board[c] = { uid: 1002 + i, defId: 'knight', star: 2 };
      return simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
    };
    const dances = (r: ReturnType<typeof run>) => r.events.flatMap((e) => (e.type === 'stun' && e.effect === 'disco' ? [e] : []));
    expect(dances(run(false))).toHaveLength(0);
    const r = run(true);
    const d = dances(r);
    const at = [...new Set(d.map((e) => e.t))];
    expect(at[0]).toBe(0);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBe(6 * TICKS_PER_SECOND);
    expect(d.filter((e) => e.t === 0)).toHaveLength(2);
    expect(new Set(d.filter((e) => e.t === 0).map((e) => e.id)).size).toBe(2);
    expect(d.every((e) => e.until - e.t === 2 * TICKS_PER_SECOND)).toBe(true);
    const side = (id: number) => r.fighters.find((f) => f.id === id)!.side;
    expect(d.every((e) => side(e.id) === 1)).toBe(true);
  });

  test('Disco Fever: the 2 strongest heroes (star, then cost) gain 35% hybrid attack', () => {
    const p = createGame(211, SEEDS).players[0];
    p.items = [];
    p.board.fill(null);
    p.board[0] = { uid: 1010, defId: 'minos', star: 3 }; // 3★ 1-cost
    p.board[1] = { uid: 1011, defId: 'vex', star: 2 }; // 2★ 4-cost
    p.board[2] = { uid: 1012, defId: 'balman', star: 2 }; // 2★ 2-cost
    const plain = fieldStats(p, {});
    p.powerCards = [{ id: 'discoFever', tier: 'gold' }];
    const buffed = fieldStats(p, {});
    const ratio = (uid: number) => buffed.get(uid)!.atk / plain.get(uid)!.atk;
    expect(ratio(1010)).toBeCloseTo(1.35, 2);
    expect(ratio(1011)).toBeCloseTo(1.35, 2);
    expect(ratio(1012)).toBeCloseTo(1, 5);
  });

  test('Synergy Constellation: 2.5% hybrid attack per active synergy, +50% at 10', () => {
    const p = createGame(213, SEEDS).players[0];
    expect(constellationOf(p, 4)).toBe(0);
    p.powerCards = [{ id: 'synergyConstellation', tier: 'gold' }];
    expect(constellationOf(p, 4)).toBeCloseTo(0.1, 5);
    expect(constellationOf(p, 9)).toBeCloseTo(0.225, 5);
    expect(constellationOf(p, 10)).toBeCloseTo(0.75, 5);
    // On the field: two Cult of Fire + two Mage.
    p.items = [];
    p.board.fill(null);
    p.board[0] = { uid: 1020, defId: 'zhuxin', star: 1 };
    p.board[1] = { uid: 1021, defId: 'mia', star: 1 };
    p.board[2] = { uid: 1022, defId: 'val', star: 1 };
    const levels = playerTraits(p);
    const active = Object.values(levels).filter((l) => l > 0).length;
    expect(active).toBeGreaterThan(0);
    const with_ = fieldStats(p, levels).get(1020)!.atk;
    p.powerCards = [];
    const without = fieldStats(p, levels).get(1020)!.atk;
    expect(with_ / without).toBeCloseTo((1 + 0.025 * active + (active >= 10 ? 0.5 : 0)) / 1, 1);
  });

  test('Territory Agreement: never offered past level 7', () => {
    const p = createGame(1, SEEDS).players[0];
    p.level = 7;
    expect(powerPool('gold', p)).toContain('territoryAgreement');
    p.level = 8;
    expect(powerPool('gold', p)).not.toContain('territoryAgreement');
    expect(powerPool('gold', p)).toContain('theHunt');
  });
});

describe('badges', () => {
  test('15 badges, purple only, each with a 2-gold hero to give', () => {
    expect(BADGE_TRAITS).toHaveLength(15);
    for (const t of ['mistbender', 'scavenger', 'phasewarper', 'storyweaver', 'mooneater']) expect(BADGE_TRAITS).not.toContain(t);
    for (const t of BADGE_TRAITS) {
      const id = `${t}Badge`;
      expect(POWER_CARDS[id].name).toBe(`${TRAITS[t].name} Badge`);
      expect(powerPool('purple')).toContain(id);
      for (const tier of ['blue', 'gold'] as const) expect(powerPool(tier)).not.toContain(id);
      expect(badgeHeroes(t).length).toBeGreaterThan(0);
    }
    // Two badges may share a hero.
    expect(badgeHeroes('dauntless')).toEqual(['balman']);
    expect(badgeHeroes('skybringer')).toEqual(['balman']);
  });

  test("the trait's orb and a 2-gold hero of it, outside the pool", () => {
    for (const t of BADGE_TRAITS) {
      const { state, a } = pickPurple(151, `${t}Badge`, (p) => {
        p.mistOrbs = [];
        p.bench.fill(null);
      });
      expect(a.mistOrbs!.map((o) => o.trait)).toEqual([t]);
      const got = [...a.bench, ...a.board].filter((u) => u && badgeHeroes(t).includes(u.defId));
      expect(got).toHaveLength(1);
      expect(UNIT_BY_ID[got[0]!.defId].tier).toBe(2);
      const fresh = createGame(151, SEEDS).pool[got[0]!.defId];
      expect(state.pool[got[0]!.defId]).toBe(fresh); // pool untouched
      expect(got[0]!.shortfall).toBe(1);
    }
  });

  test('regardless of the pool; selling it returns nothing', () => {
    const { state, a } = pickPurple(153, 'dauntlessBadge', (p) => {
      p.mistOrbs = [];
      p.bench.fill(null);
    }, (st) => (st.pool.balman = 0));
    expect(a.mistOrbs!.map((o) => o.trait)).toEqual(['dauntless']);
    const i = a.bench.findIndex((u) => u?.defId === 'balman');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(applyAction(state, a.id, { type: 'sell', from: { area: 'bench', index: i } }).ok).toBe(true);
    expect(state.pool.balman).toBe(0);
  });

  test('merged with bought copies: only the bought ones go back', () => {
    const { state, a } = pickPurple(157, 'dauntlessBadge', (p) => {
      p.mistOrbs = [];
      p.bench[0] = { uid: 901, defId: 'balman', star: 1 };
      p.bench[1] = { uid: 902, defId: 'balman', star: 1 };
    });
    const two = [...a.bench, ...a.board].find((u) => u?.defId === 'balman' && u.star === 2)!;
    expect(two.shortfall).toBe(1);
    const pool = state.pool.balman;
    expect(applyAction(state, a.id, { type: 'sell', from: { area: 'bench', index: a.bench.indexOf(two) } }).ok).toBe(true);
    expect(state.pool.balman).toBe(pool + 2);
  });
});

describe('blessings', () => {
  const ITEM_OF: Record<string, string | null> = {
    weaponmaster: 'waraxe', necromancer: null, fighter: 'goldenstaff', dauntless: 'antiquecuirass', defender: 'ancientwrath',
    hunter: 'wintercrown', mage: 'spellbladetalisman', deadeye: 'berserkerfury', stargazer: 'icequeenwand',
    dragonaltar: null, cultoffire: null, spectre: null, astral: null, gustiwana: null, skybringer: null,
  };

  test('15 blessings, gold only, named after their trait', () => {
    for (const t of BADGE_TRAITS) {
      const id = `${t}Blessing`;
      expect(POWER_CARDS[id].name).toBe(`${TRAITS[t].name} Blessing`);
      expect(powerPool('gold')).toContain(id);
      for (const tier of ['blue', 'purple'] as const) expect(powerPool(tier)).not.toContain(id);
    }
  });

  test("the trait's orb, a 2-gold hero of it, and its item or an Equipment Chest to pick from", () => {
    for (const t of BADGE_TRAITS) {
      const state = createGame(219, SEEDS);
      const [a] = state.players;
      a.board.fill(null);
      a.bench.fill(null);
      a.items = [];
      a.mistOrbs = [];
      a.itemOffer = undefined;
      a.chests = undefined;
      a.powerOffer = { tier: 'gold', cards: [`${t}Blessing`], rerolls: 0 };
      expect(applyAction(state, a.id, { type: 'pickPower', card: `${t}Blessing` }).ok).toBe(true);
      expect(a.mistOrbs!.map((o) => o.trait)).toEqual([t]);
      const heroes = [...a.bench, ...a.board].filter((u) => u && badgeHeroes(t).includes(u.defId));
      expect(heroes).toHaveLength(1);
      const item = ITEM_OF[t];
      if (item) {
        expect(a.items.map((i) => i.id)).toEqual([item]);
        expect(a.itemOffer ?? []).toHaveLength(0);
      } else {
        expect(a.items).toHaveLength(0);
        expect(a.itemOffer!.length).toBeGreaterThan(0); // the chest, open to pick from
      }
    }
  });
});

describe('hero cards', () => {
  const CARDS: [string, string][] = [
    ['quakingBlow', 'minos'],
    ['cycloneSigil', 'val'],
    ['backlineBreach', 'siyunyin'],
    ['demonicWrath', 'phove'],
    ['forkedLightning', 'eudora'],
    ['virtuoso', 'cici'],
    ['abyssalSmash', 'dyroth'],
    ['vengefulAegis', 'uranus'],
  ];

  test('purple only, each for its 1-cost hero', () => {
    for (const [id, hero] of CARDS) {
      expect(powerPool('purple')).toContain(id);
      for (const tier of ['blue', 'gold'] as const) expect(powerPool(tier)).not.toContain(id);
      expect(UNITS.find((d) => d.id === hero)!.tier).toBe(1);
    }
  });

  test('a 3★ copy of the hero, outside the pool, with +35% hybrid attack and max hp', () => {
    for (const [card, hero] of CARDS) {
      const { a } = pickPurple(137, card, (p) => (p.items = []));
      const got = [...a.bench, ...a.board].find((u) => u?.defId === hero && u.star === 3)!;
      expect(got.signature).toBe(true);
      expect(got.shortfall).toBe(9); // all 9 copies made up: none from the pool
      // Same hero, same star, without the card's buff.
      a.bench[a.bench.indexOf(got)] = null;
      a.board[3] = got;
      a.board[5] = { uid: 9999, defId: hero, star: 3 };
      const s = fieldStats(a, playerTraits(a));
      const [mine, plain] = [s.get(got.uid)!, s.get(9999)!];
      expect(Math.abs(mine.hp - plain.hp * 1.35)).toBeLessThanOrEqual(2);
      expect(Math.abs(mine.atk - plain.atk * 1.35)).toBeLessThanOrEqual(2);
      expect(Math.abs(mine.ap - plain.ap * 1.35)).toBeLessThanOrEqual(2);
    }
  });

  test('the pool untouched, and selling it returns nothing', () => {
    const s2 = createGame(139, SEEDS);
    const [b] = s2.players;
    b.board.fill(null);
    b.bench.fill(null);
    s2.pool.minos = 4;
    b.powerOffer = { tier: 'purple', cards: ['quakingBlow'], rerolls: 0 };
    expect(applyAction(s2, b.id, { type: 'pickPower', card: 'quakingBlow' }).ok).toBe(true);
    const got = [...b.bench, ...b.board].find((u) => u?.defId === 'minos')!;
    expect([got.star, s2.pool.minos]).toEqual([3, 4]);
    const gold = b.gold;
    expect(applyAction(s2, b.id, { type: 'sell', from: { area: 'bench', index: b.bench.indexOf(got) } }).ok).toBe(true);
    expect(s2.pool.minos).toBe(4);
    expect(b.gold).toBeGreaterThan(gold); // still sells for gold
  });

  test('no room: it waits, then arrives', () => {
    const { state, a } = pickPurple(149, 'virtuoso', (p) => {
      p.bench.forEach((_, i) => (p.bench[i] = { uid: 700 + i, defId: 'minos', star: 2 }));
      p.board.forEach((_, i) => (p.board[i] = { uid: 800 + i, defId: 'eudora', star: 2 }));
    });
    expect(a.signatures).toEqual(['cici']);
    (a as Player).bench[0] = null;
    a.bench[1] = null; // (the commander's piece may claim a slot first)
    syncPlayer(state, a);
    expect([...a.bench, ...a.board].some((u) => u?.defId === 'cici' && u.star === 3 && u.signature)).toBe(true);
    expect(a.signatures).toBeUndefined();
  });
});

describe('Prime Selection', () => {
  const pick = (tier: PowerTier) => {
    const state = createGame(19, SEEDS);
    const [a] = state.players;
    a.powerOffer = { tier, cards: ['factionSynergy'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'factionSynergy' }).ok).toBe(true);
    return { state, a };
  };
  const isOrbTrait = (id: string) => TRAITS[id].kind === 'faction' || TRAITS[id].kind === 'role';

  test('blue only: never offered (or rerolled into) at purple or gold', () => {
    expect(powerPool('blue')).toContain('factionSynergy');
    for (const tier of ['purple', 'gold'] as const) expect(powerPool(tier)).not.toContain('factionSynergy');
  });

  test('a choice of 3 different factions or roles; the pick goes to the inventory', () => {
    const { state, a } = pick('blue');
    const offer = a.factionOrbOffer!;
    expect(new Set(offer).size).toBe(3);
    expect(offer.every(isOrbTrait)).toBe(true);
    expect(a.mistOrbs ?? []).toHaveLength(0);
    expect(applyAction(state, a.id, { type: 'pickFactionOrb', trait: 'nope' }).ok).toBe(false);
    expect(applyAction(state, a.id, { type: 'pickFactionOrb', trait: offer[1] }).ok).toBe(true);
    expect(a.mistOrbs!.map((o) => [o.trait, o.holder])).toEqual([[offer[1], null]]);
    expect(a.factionOrbOffer).toBeUndefined();
  });

  test('roles come up too', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const state = createGame(seed, SEEDS);
      const [a] = state.players;
      a.powerOffer = { tier: 'blue', cards: ['factionSynergy'], rerolls: 0 };
      applyAction(state, a.id, { type: 'pickPower', card: 'factionSynergy' });
      for (const id of a.factionOrbOffer ?? []) kinds.add(TRAITS[id].kind);
    }
    expect([...kinds].sort()).toEqual(['faction', 'role']);
  });

  test('left unpicked: never picked for the player, the offer waits', () => {
    const { state, a } = pick('blue');
    const offer = a.factionOrbOffer;
    resolveCombat(state);
    expect(a.mistOrbs ?? []).toEqual([]);
    expect(a.factionOrbOffer).toBe(offer);
  });
});

describe('cards that enhance items', () => {
  const pick = (card: string, setup?: (state: GameState, a: Player) => void) => {
    const state = createGame(23, SEEDS);
    const [a] = state.players;
    setup?.(state, a);
    a.powerOffer = { tier: 'purple', cards: [card], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card }).ok).toBe(true);
    return { state, a };
  };

  test('Manic Slam and co. (purple): an enhanced item now; copies owned, and later ones, enhanced too', () => {
    for (const { id, item } of ENHANCING_CARDS) {
      expect(POWER_CARDS[id].tiers).toEqual(['purple']);
      const { state, a } = pick(id, (s, p) => p.items.push({ uid: s.nextUid++, id: item, tier: 1, holder: null }));
      expect(a.items.filter((i) => baseItemOf(i.id) === item).map((i) => i.id)).toEqual([enhancedId(item), enhancedId(item)]);
      a.items.push({ uid: state.nextUid++, id: item, tier: 1, holder: null }); // a later drop
      syncPlayer(state, a);
      expect(a.items.every((i) => baseItemOf(i.id) !== item || i.id === enhancedId(item))).toBe(true);
      expect(POWER_CARDS[id].desc('purple')).toContain(`Enhanced ${ITEMS[item].name}`);
    }
  });

  test('Gustiwana Unbound: Keris, Blangkon and Jimat enhanced, now and later; +5 free refreshes', () => {
    const { state, a } = pick('gustiwanaUnbound', (s, p) => p.items.push({ uid: s.nextUid++, id: 'keris', tier: 2, holder: null }));
    expect(a.items.find((i) => baseItemOf(i.id) === 'keris')).toMatchObject({ id: 'keris+', tier: 2 });
    expect(a.freeRerolls).toBe(5);
    a.items.push({ uid: state.nextUid++, id: 'jimat', tier: 1, holder: null });
    syncPlayer(state, a);
    expect(a.items.some((i) => i.id === 'jimat+')).toBe(true);
  });

  test('Exclusive Offering: Pyre Offerings enhanced', () => {
    const { a } = pick('exclusiveOffering', (s, p) => p.items.push({ uid: s.nextUid++, id: 'offering', tier: 1, holder: null }));
    expect(a.items.some((i) => i.id === 'offering+')).toBe(true);
  });

  test('an enhanced trait item still counts for its trait: no extra copies granted', () => {
    const state = createGame(23, SEEDS);
    const [a] = state.players;
    a.board.fill(null);
    a.bench.fill(null);
    a.items = [];
    const gusti = UNITS.filter((u) => u.traits.includes('gustiwana') && u.shop !== false);
    gusti.slice(0, 4).forEach((u, i) => (a.board[i] = { uid: 500 + i, defId: u.id, star: 1 }));
    syncPlayer(state, a);
    const n = a.items.length;
    expect(n).toBeGreaterThan(0);
    for (const it of a.items) it.id = enhancedId(it.id);
    syncPlayer(state, a);
    expect(a.items.length).toBe(n);
  });
});

describe('Novel Equipment', () => {
  const pick = () => {
    const state = createGame(29, SEEDS);
    const [a] = state.players;
    a.items = [];
    a.powerOffer = { tier: 'gold', cards: ['novelEquipment'], rerolls: 0 };
    expect(applyAction(state, a.id, { type: 'pickPower', card: 'novelEquipment' }).ok).toBe(true);
    return { state, a };
  };

  test('gold only: 3 different random equipment, enhanced, straight to the inventory', () => {
    expect(POWER_CARDS.novelEquipment.tiers).toEqual(['gold']);
    const { a } = pick();
    expect(a.items).toHaveLength(3);
    expect(new Set(a.items.map((i) => i.id)).size).toBe(3);
    for (const it of a.items) {
      expect(isEnhanced(it.id)).toBe(true);
      expect(EQUIPMENT).toContain(baseItemOf(it.id));
      expect(it.holder).toBeNull();
    }
    expect(a.enhancedItems).toEqual(a.items.map((i) => baseItemOf(i.id)));
  });

  test('later copies of those items come enhanced; others do not', () => {
    const { state, a } = pick();
    const mine = a.enhancedItems![0];
    const other = EQUIPMENT.find((e) => !a.enhancedItems!.includes(e))!;
    a.items.push({ uid: state.nextUid++, id: mine, tier: 1, holder: null }, { uid: state.nextUid++, id: other, tier: 1, holder: null });
    syncPlayer(state, a);
    expect(a.items.filter((i) => baseItemOf(i.id) === mine).every((i) => i.id === enhancedId(mine))).toBe(true);
    expect(a.items.some((i) => i.id === other)).toBe(true);
  });
});

describe('Copycat: no copying enhanced equipment', () => {
  test('the duplicator refuses an enhanced item, takes its base', () => {
    expect(canDuplicate('waraxe')).toBe(true);
    expect(canDuplicate('waraxe+')).toBe(false);
    const state = createGame(29, SEEDS);
    const [a] = state.players;
    a.duplicators = 1;
    a.items = [{ uid: 900, id: 'waraxe+', tier: 1, holder: null }];
    expect(duplicateBlock(a, 900)).toContain("can't be copied");
    expect(POWER_CARDS.copycat.desc('gold')).toContain('not enhanced');
  });
});
