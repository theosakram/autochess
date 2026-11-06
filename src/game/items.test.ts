import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { simulateCombat } from './combat';
import { TICKS_PER_SECOND } from './config';
import { createGame } from './game';
import { effectiveTier, fieldStats, syncItems } from './inventory';
import { BLANGKON, itemCard, JIMAT, KERIS, OFFERING } from './items';
import { returnShop } from './shop';
import { CULT_OF_FIRE, GUSTIWANA, traitCounts } from './traits';
import type { GameState, Player, Star } from './types';

const GW_UNITS = ['prajurit', 'penari', 'dalang', 'senopati', 'resi', 'batarakala'];

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

  test('Keris: Mortal Strike every 5s hits every enemy for pure damage', () => {
    const r = duel(
      { id: 'keris', tier: 3 },
      [['prajurit', 3, 3], ['penari', 3, 17]],
      [['titan', 3, 3], ['paladin', 3, 6]],
    );
    const holder = r.fighters.find((f) => f.defId === 'prajurit')!;
    const strikes = r.events.filter((e) => e.type === 'effect' && e.effect === 'keris' && e.by === holder.id);
    const every = KERIS.every * TICKS_PER_SECOND;
    expect(strikes.length).toBeGreaterThan(0);
    expect(strikes.every((e) => e.t % every === 0)).toBe(true);
    expect(new Set(strikes.filter((e) => e.t === every).map((e) => e.type === 'effect' && e.target)).size).toBe(2);
  });

  test('Blangkon: stuns enemies in the 3x3 in front at battle start, and they wait it out', () => {
    // Wearer in my front row, column 3 (a second Gustiwana in the back activates the trait);
    // one enemy right across the middle line, another far off to the side.
    const r = duel({ id: 'blangkon', tier: 2 }, [['senopati', 1, 3], ['penari', 1, 20]], [['footman', 1, 3], ['archer', 1, 20]]);
    const stuns = r.events.filter((e) => e.type === 'stun');
    const across = r.fighters.find((f) => f.defId === 'footman')!;
    const until = BLANGKON.stun[1] * TICKS_PER_SECOND;
    expect(stuns.map((e) => e.type === 'stun' && [e.id, e.until])).toEqual([[across.id, until]]);
    const firstAct = r.events.find((e) => (e.type === 'attack' || e.type === 'move') && e.id === across.id)!;
    expect(firstAct.t).toBeGreaterThanOrEqual(until);
  });

  test('Jimat: every heal is lifesteal from a hit the holder just dealt', () => {
    const r = duel({ id: 'jimat', tier: 1 }, [['prajurit', 2, 3], ['dalang', 1, 20]], [['titan', 2, 3]]); // no healer: every heal is lifesteal
    const holder = r.fighters.find((f) => f.defId === 'prajurit')!;
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
    // A lone Gustiwana unit: trait inactive, so no Mortal Strike.
    const r = duel({ id: 'keris', tier: 3 }, [['prajurit', 3, 3]], [['titan', 3, 3]]);
    expect(r.events.some((e) => e.type === 'effect' && e.effect === 'keris')).toBe(false);
    expect(r.fighters[0].items).toEqual([]);
  });
});

describe('Cult of Fire and the Pyre Offering', () => {
  const cult = (p: Player) => field(p, [['kindler', 1, 0], ['ashbinder', 1, 15], ['titan', 1, 3], ['footman', 1, 4]]);

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
    const [kindler, , titan] = cult(p);
    syncItems(state, p);
    const offering = p.items[0].uid;
    expect(applyAction(state, p.id, { type: 'equip', item: offering, unit: kindler })).toEqual({
      ok: false,
      error: "Cult of Fire units can't hold the Pyre Offering",
    });
    expect(applyAction(state, p.id, { type: 'equip', item: offering, unit: titan }).ok).toBe(true);
  });

  test("every cultist gains a share of the holder's attack; nobody else does", () => {
    const state = newGame();
    const p = state.players[0];
    const [kindler, ashbinder, titan, footman] = cult(p);
    syncItems(state, p);
    applyAction(state, p.id, { type: 'equip', item: p.items[0].uid, unit: titan });
    const levels = { cultoffire: 1 };
    const without = fieldStats({ ...p, items: [] }, levels);
    const withIt = fieldStats(p, levels);
    const gain = Math.round(withIt.get(titan)!.atk * OFFERING.share[0]);
    expect(withIt.get(kindler)!.atk).toBe(without.get(kindler)!.atk + gain);
    expect(withIt.get(ashbinder)!.atk).toBe(without.get(ashbinder)!.atk + gain);
    expect(withIt.get(titan)!.atk).toBe(without.get(titan)!.atk);
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
    expect(stats.get(titan)!.armor).toBe(plain.get(titan)!.armor + CULT_OF_FIRE.defense[0]);
    expect(stats.get(titan)!.mr).toBe(plain.get(titan)!.mr + CULT_OF_FIRE.defense[0]);
    expect(stats.get(footman)!.armor).toBe(plain.get(footman)!.armor);
  });

  test('works at the cult level as its tier, and not at all when the cult is inactive', () => {
    const item = { uid: 1, id: 'offering', tier: 1, holder: null };
    expect(effectiveTier(item, { cultoffire: 3 })).toBe(3);
    expect(effectiveTier(item, {})).toBe(0);
  });
});
