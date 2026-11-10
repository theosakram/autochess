import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { simulateCombat } from './combat';
import { TICKS_PER_SECOND } from './config';
import { createGame } from './game';
import { effectiveTier, fieldStats, syncItems } from './inventory';
import { BLANGKON, isItemCard, itemCard, ITEMS, JIMAT, KERIS, OFFERING } from './items';
import { refreshShop, returnShop } from './shop';
import { CULT_OF_FIRE, DRAGON_ALTAR, GUSTIWANA, traitCounts } from './traits';
import type { GameState, Player, Star } from './types';
import { UNIT_BY_ID } from './units';

const GW_UNITS = ['dyroth', 'angela', 'frank', 'kari', 'lunox', 'lance'];

function newGame(): GameState {
  const state = createGame(11, [
    { id: 'a', name: 'A', isBot: false },
    { id: 'b', name: 'B', isBot: false },
  ]);
  for (const p of state.players) {
    p.bench.fill(null);
    p.board.fill(null);
  }
  return state;
}

let uid = 50_000;
function field(p: Player, units: [defId: string, star: Star, cell: number][]): number[] {
  p.board.fill(null);
  return units.map(([defId, star, cell]) => {
    p.board[cell] = { uid: ++uid, defId, star };
    return uid;
  });
}

const gwBoard = (p: Player, n: number) => field(p, GW_UNITS.slice(0, n).map((d, i) => [d, 1, i] as [string, Star, number]));

describe('Gustiwana items', () => {
  test('only Gustiwana units can hold them, and not through an orb', () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    p.board.fill(null);
    p.bench.fill(null);
    p.board[0] = { uid: 1, defId: 'cici', star: 1 };
    p.board[1] = { uid: 2, defId: 'angela', star: 1 };
    p.orb = { defId: 'cici', trait: 'gustiwana' };
    for (const id of ['keris', 'blangkon', 'jimat']) {
      const item = { uid: 500, id, tier: 1, holder: null };
      p.items = [item];
      expect(applyAction(state, p.id, { type: 'equip', item: 500, unit: 1 })).toEqual({ ok: false, error: `Only Gustiwana units can hold the ${ITEMS[id].name}` });
      expect(applyAction(state, p.id, { type: 'equip', item: 500, unit: 2 }).ok).toBe(true);
    }
  });

  test('1 / 2 / 3 items at Gustiwana 2 / 4 / 6, random order, no repeats, kept when the trait drops', () => {
    const state = newGame();
    const p = state.players[0];
    for (const [units, owned] of [[2, 1], [4, 2], [6, 3], [0, 3]] as const) {
      gwBoard(p, units);
      syncItems(state, p);
      expect(p.items).toHaveLength(owned);
    }
    expect(new Set(p.items.map((i) => i.id))).toEqual(new Set(GUSTIWANA.items.pool));
    expect(p.items.every((i) => i.tier === 1)).toBe(true);
  });

  test('items work only while Gustiwana is active, and at max tier at 10', () => {
    const item = { uid: 1, id: 'keris', tier: 2, holder: null };
    expect(effectiveTier(item, {})).toBe(0);
    expect(effectiveTier(item, { gustiwana: 3 })).toBe(2);
    expect(effectiveTier(item, { gustiwana: GUSTIWANA.items.topLevel })).toBe(4);
  });

  test('upgrade cards are free, raise the tier, and stop at the shop cap', () => {
    const state = newGame();
    const p = state.players[0];
    gwBoard(p, 2);
    syncItems(state, p);
    const item = p.items[0];
    returnShop(state, p);
    p.gold = 0;
    for (let tier = 2; tier <= GUSTIWANA.items.maxShopTier; tier++) {
      p.shop[0] = itemCard(item.id);
      expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(true);
      expect(item.tier).toBe(tier);
      expect(p.gold).toBe(0);
    }
    p.shop[0] = itemCard(item.id);
    expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(false);
    // Cards never came from the unit pool, so returning the shop doesn't add any.
    const pool = { ...state.pool };
    returnShop(state, p);
    expect(state.pool).toEqual(pool);
  });

  test('buying an upgrade card puts a hero in its slot', () => {
    const state = newGame();
    const p = state.players[0];
    gwBoard(p, 2);
    syncItems(state, p);
    returnShop(state, p);
    p.shop[0] = itemCard(p.items[0].id);
    expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    expect(p.shop[0] && !isItemCard(p.shop[0])).toBe(true);
  });

  test('a shop never offers two upgrade cards for the same item', () => {
    const state = newGame();
    const p = state.players[0];
    gwBoard(p, 2);
    syncItems(state, p);
    const chance = GUSTIWANA.items.shopChance;
    GUSTIWANA.items.shopChance = 1;
    try {
      for (let i = 0; i < 20; i++) {
        refreshShop(state, p);
        const cards = p.shop.filter((id): id is string => !!id && isItemCard(id));
        expect(new Set(cards).size).toBe(cards.length);
        expect(cards.length).toBeLessThanOrEqual(p.items.length);
      }
    } finally {
      GUSTIWANA.items.shopChance = chance;
    }
  });

  test('a unit holds at most 3 items; selling it returns them', () => {
    const state = newGame();
    const p = state.players[0];
    const [first] = gwBoard(p, 6);
    syncItems(state, p);
    for (const it of p.items) expect(applyAction(state, p.id, { type: 'equip', item: it.uid, unit: first }).ok).toBe(true);
    p.items.push({ uid: 999, id: 'keris', tier: 1, holder: null });
    expect(applyAction(state, p.id, { type: 'equip', item: 999, unit: first }).ok).toBe(false);
    p.items.pop();
    expect(applyAction(state, p.id, { type: 'sell', from: { area: 'board', index: 0 } }).ok).toBe(true);
    expect(p.items.every((it) => it.holder === null)).toBe(true);
  });
});

describe('item effects in combat', () => {
  function duel(item: { id: string; tier: number }, mine: [string, Star, number][], theirs: [string, Star, number][]) {
    const state = newGame();
    const [a, b] = state.players;
    const uids = field(a, mine);
    field(b, theirs);
    a.items = [{ uid: 1, id: item.id, tier: item.tier, holder: uids[0] }];
    return simulateCombat({ rng: 1 }, a, b);
  }

  test('Keris: Justice every 5s strikes the 3x3 with the most enemies, for pure damage', () => {
    // Two enemies side by side in the front row (columns 2 and 3), an archer far back in the corner: only the pair is struck.
    const r = duel(
      { id: 'keris', tier: 3 },
      [['dyroth', 3, 3], ['angela', 3, 17]],
      [['titan', 3, 2], ['paladin', 3, 3], ['archer', 3, 20]],
    );
    const holder = r.fighters.find((f) => f.defId === 'dyroth')!;
    const strikes = r.events.filter((e) => e.type === 'effect' && e.effect === 'keris' && e.by === holder.id);
    const every = KERIS.every * TICKS_PER_SECOND;
    expect(strikes.length).toBeGreaterThan(0);
    expect(strikes.every((e) => e.t % every === 0)).toBe(true);
    const id = (defId: string) => r.fighters.find((f) => f.defId === defId)!.id;
    const first = new Set(strikes.filter((e) => e.t === every).map((e) => e.type === 'effect' && e.target));
    expect([...first].sort()).toEqual([id('titan'), id('paladin')].sort());
  });

  test('Keris: +20% attack and magic attack at every tier; Justice 8 / 15 / 20 / 100% of attack, one per unit', () => {
    const def = ITEMS.keris;
    for (const tier of [1, 2, 3, 4]) {
      expect(def.mods(tier)).toEqual([{ stat: 'atk', pct: 0.2 }, { stat: 'ap', pct: 0.2 }]);
      expect(def.pulse!(tier)).toEqual({ every: 5, atkPct: [0.08, 0.15, 0.2, 1][tier - 1], damageType: 'pure', area: '3x3' });
    }
    // Two Kerises on one unit: Justice still strikes once per 5s.
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }, { id: 'b', name: 'B', isBot: false }]);
    const [a, b] = state.players;
    for (const p of state.players) { p.board.fill(null); p.bench.fill(null); p.items = []; }
    a.board[3] = { uid: 1, defId: 'dyroth', star: 3 };
    a.board[17] = { uid: 2, defId: 'angela', star: 3 };
    b.board[3] = { uid: 3, defId: 'titan', star: 3 };
    a.items = [{ uid: 1, id: 'keris', tier: 1, holder: 1 }, { uid: 2, id: 'keris', tier: 3, holder: 1 }];
    const r = simulateCombat({ rng: 1 }, a, b);
    const at5 = r.events.filter((e) => e.type === 'effect' && e.effect === 'keris' && e.t === KERIS.every * TICKS_PER_SECOND);
    expect(at5).toHaveLength(1);
  });

  test('Blangkon: stuns enemies in the 3x3 in front at battle start, and they wait it out', () => {
    // Wearer in my front row, column 3 (a second Gustiwana in the back activates the trait);
    // one enemy right across the middle line, another far off to the side.
    const r = duel({ id: 'blangkon', tier: 2 }, [['kari', 1, 3], ['angela', 1, 20]], [['footman', 1, 3], ['archer', 1, 20]]);
    const stuns = r.events.filter((e) => e.type === 'stun');
    const across = r.fighters.find((f) => f.defId === 'footman')!;
    const until = BLANGKON.stun[1] * TICKS_PER_SECOND;
    expect(stuns.map((e) => e.type === 'stun' && [e.id, e.until])).toEqual([[across.id, until]]);
    const firstAct = r.events.find((e) => (e.type === 'attack' || e.type === 'move') && e.id === across.id)!;
    expect(firstAct.t).toBeGreaterThanOrEqual(until);
  });

  test('Blangkon: +20% max HP at every tier, plus Nether (unique): +25 / 35 / 50% more, stun 1 / 1 / 2s', () => {
    const def = ITEMS.blangkon;
    for (const tier of [1, 2, 3]) {
      expect(def.mods(tier)).toEqual([{ stat: 'hp', pct: 0.2 }]);
      expect(def.unique!(tier)).toEqual([{ stat: 'hp', pct: [0.25, 0.35, 0.5][tier - 1] }]);
      expect(def.opener!(tier).stunSeconds).toBe([1, 1, 2][tier - 1]);
    }
    // Tier 4: +200% in all, a 3s stun.
    expect(0.2 + def.unique!(4)[0].pct!).toBeCloseTo(2);
    expect(def.opener!(4).stunSeconds).toBe(3);
  });

  test('Jimat: 20% lifesteal and spell lifesteal at every tier; Sakti (unique) +25 / 35 / 55 / 150% damage, +65% max HP at tier 4', () => {
    const def = ITEMS.jimat;
    for (const tier of [1, 2, 3, 4]) {
      expect(def.mods(tier)).toEqual([{ stat: 'lifesteal', add: 0.2 }, { stat: 'spellLifesteal', add: 0.2 }]);
      expect(def.unique!(tier)).toEqual([
        { stat: 'damageAmp', add: [0.25, 0.35, 0.55, 1.5][tier - 1] },
        ...(tier === 4 ? [{ stat: 'hp' as const, pct: 0.65 }] : []),
      ]);
    }
  });

  test('Jimat: every heal is lifesteal from a hit the holder just dealt', () => {
    const r = duel({ id: 'jimat', tier: 1 }, [['kari', 2, 3], ['frank', 1, 20]], [['titan', 2, 3]]); // no healer: every heal is lifesteal
    const holder = r.fighters.find((f) => f.defId === 'kari')!;
    const heals = r.events.filter((e) => e.type === 'heal' && e.id === holder.id);
    expect(heals.length).toBeGreaterThan(0);
    for (const heal of heals) {
      if (heal.type !== 'heal') continue;
      // The hit it came from is the holder's latest one before it (a death may be logged in between).
      const hit = r.events
        .slice(0, r.events.indexOf(heal))
        .reverse()
        .find((e) => ((e.type === 'attack' || e.type === 'cast') && e.id === holder.id) || (e.type === 'effect' && e.by === holder.id));
      expect(hit?.t).toBe(heal.t);
      if (hit?.type !== 'attack' && hit?.type !== 'cast' && hit?.type !== 'effect') throw new Error('heal without a hit');
      // Basic attacks (and skills' enhanced basic hits) heal by lifesteal, the rest by spell lifesteal.
      const rate = hit.type === 'cast' ? JIMAT.spellLifesteal : Math.max(JIMAT.lifesteal, JIMAT.spellLifesteal);
      expect(heal.amount).toBeLessThanOrEqual(Math.round(hit.damage * rate));
    }
  });

  test('items do nothing without Gustiwana active', () => {
    // A lone Gustiwana unit: trait inactive, so no Justice.
    const r = duel({ id: 'keris', tier: 3 }, [['dyroth', 3, 3]], [['titan', 3, 3]]);
    expect(r.events.some((e) => e.type === 'effect' && e.effect === 'keris')).toBe(false);
    expect(r.fighters[0].items).toEqual([]);
  });
});

describe('Cult of Fire and the Pyre Offering', () => {
  const cult = (p: Player) => field(p, [['cici', 1, 0], ['zhuxin', 1, 15], ['titan', 1, 3], ['footman', 1, 4]]);

  test('one Offering, granted when the cult activates', () => {
    const state = newGame();
    const p = state.players[0];
    cult(p);
    syncItems(state, p);
    syncItems(state, p);
    expect(p.items.map((i) => i.id)).toEqual(['offering']);
  });

  test('cultists cannot hold it, outsiders can', () => {
    const state = newGame();
    const p = state.players[0];
    const [cici, , titan] = cult(p);
    syncItems(state, p);
    const offering = p.items[0].uid;
    expect(applyAction(state, p.id, { type: 'equip', item: offering, unit: cici })).toEqual({
      ok: false,
      error: "Cult of Fire units can't hold the Pyre Offering",
    });
    expect(applyAction(state, p.id, { type: 'equip', item: offering, unit: titan }).ok).toBe(true);
  });

  test("every cultist gains a share of the holder's attack; nobody else does", () => {
    const state = newGame();
    const p = state.players[0];
    const [cici, zhuxin, titan, footman] = cult(p);
    syncItems(state, p);
    applyAction(state, p.id, { type: 'equip', item: p.items[0].uid, unit: titan });
    const levels = { cultoffire: 1 };
    const without = fieldStats({ ...p, items: [] }, levels);
    const withIt = fieldStats(p, levels);
    const gain = Math.round(withIt.get(titan)!.atk * OFFERING.share[0]);
    expect(withIt.get(cici)!.atk).toBe(without.get(cici)!.atk + gain);
    expect(withIt.get(zhuxin)!.atk).toBe(without.get(zhuxin)!.atk + gain);
    // The bearer gets no share, only the item's own +25% attack.
    expect(Math.abs(withIt.get(titan)!.atk - without.get(titan)!.atk * (1 + OFFERING.hybridAtk))).toBeLessThanOrEqual(1);
    expect(withIt.get(footman)!.atk).toBe(without.get(footman)!.atk);
  });

  test('the bearer gets the cult unit bonus but does not count toward the cult', () => {
    const state = newGame();
    const p = state.players[0];
    const [, , titan, footman] = cult(p);
    syncItems(state, p);
    const countBefore = traitCounts(p.board).cultoffire;
    applyAction(state, p.id, { type: 'equip', item: p.items[0].uid, unit: titan });
    expect(traitCounts(p.board).cultoffire).toBe(countBefore);
    const levels = { cultoffire: 1 };
    const stats = fieldStats(p, levels);
    const plain = fieldStats({ ...p, items: [] }, levels);
    // The bearer burns its targets like a cultist; a plain ally doesn't.
    expect(stats.get(titan)!.burnOnHit).toBeCloseTo(plain.get(titan)!.burnOnHit + CULT_OF_FIRE.burn[0]);
    expect(stats.get(footman)!.burnOnHit).toBe(0);
  });

  test('works at the cult level as its tier, and not at all when the cult is inactive', () => {
    const item = { uid: 1, id: 'offering', tier: 1, holder: null };
    expect(effectiveTier(item, { cultoffire: 3 })).toBe(3);
    expect(effectiveTier(item, {})).toBe(0);
  });
});

describe('orbs', () => {
  test("an orb's synergy gives its holder the member bonus (Balang with a Dragon Altar orb, on an altar)", () => {
    const state = newGame();
    const p = state.players[0];
    const altar = DRAGON_ALTAR.tiles[0][0];
    p.board[altar] = { uid: 1, defId: 'balang', star: 1 };
    const levels = { dragonaltar: 1 };
    const plain = fieldStats(p, levels).get(1)!;
    p.orb = { defId: 'balang', trait: 'dragonaltar' };
    const orbed = fieldStats(p, levels).get(1)!;
    const base = UNIT_BY_ID.balang.hp;
    expect(plain.hp).toBeCloseTo(base * (1 + DRAGON_ALTAR.allyBonus[0]), 0);
    expect(orbed.hp).toBeCloseTo(base * (1 + DRAGON_ALTAR.memberBonus[0]), 0);
  });
});
