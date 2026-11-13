import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { createGame, startRound } from './game';
import { refreshShop } from './shop';
import { syncPlayer } from './sync';
import { SPECTRE, unitStats } from './traits';
import type { GameState, Player, Star } from './types';
import { UNIT_BY_ID, UNITS } from './units';

function newGame(): GameState {
  const state = createGame(8, [
    { id: 'a', name: 'A', isBot: false },
    { id: 'b', name: 'B', isBot: false },
  ]);
  for (const p of state.players) {
    p.board.fill(null);
    p.bench.fill(null);
    p.items = [];
    p.gold = 200;
    p.level = 9;
  }
  return state;
}

let uid = 97_000;
const put = (p: Player, defId: string, cell: number, star: Star = 1) => (p.board[cell] = { uid: ++uid, defId, star });
const owned = (p: Player) => [...p.board, ...p.bench].flatMap((u) => (u ? [`${u.defId}${u.star}`] : [])).sort();

// Buys copies from the shop until `defId` reaches 2 stars.
function twoStar(state: GameState, p: Player, defId: string): void {
  for (let i = 0; i < 3; i++) {
    p.shop[0] = defId;
    state.pool[defId]--;
    expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(true);
  }
}

describe('Boss Alpha merges four at a time', () => {
  test('4 x 1★ -> 2★, 4 x 2★ -> 3★; three copies stay apart', () => {
    const state = newGame();
    const p = state.players[0];
    const buy = () => {
      p.shop[0] = 'bossalpha';
      expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    };
    for (let i = 0; i < 3; i++) buy();
    expect(owned(p)).toEqual(['bossalpha1', 'bossalpha1', 'bossalpha1']);
    buy();
    expect(owned(p)).toEqual(['bossalpha2']);
    for (let i = 0; i < 12; i++) buy();
    expect(owned(p)).toEqual(['bossalpha3']);
  });

  test('with a full bench, the fourth copy still completes the merge', () => {
    const state = newGame();
    const p = state.players[0];
    for (let i = 0; i < 3; i++) put(p, 'bossalpha', i);
    p.bench.fill(null).forEach((_, i) => (p.bench[i] = { uid: ++uid, defId: 'val', star: 1 }));
    p.shop[0] = 'bossalpha';
    expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    expect(owned(p).filter((x) => x.startsWith('bossalpha'))).toEqual(['bossalpha2']);
  });
});

describe('Spectre', () => {
  test('seven units at 1, 2, 3, 3, 4, 5, 7 gold; the 7-gold is Spectre only', () => {
    const units = UNITS.filter((u) => u.shop !== false && u.traits.includes('spectre')).sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 3, 3, 4, 5, 7]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'spectre'))).toEqual([['scavenger'], ['deadeye'], ['fighter'], ['hunter'], ['mage'], ['dauntless'], []]);
  });

  test('Spectres deal more damage; at 10 they also gain HP and Boss Alpha fights a star higher', () => {
    for (const level of [1, 2, 3]) {
      expect(unitStats(UNIT_BY_ID.phove, 1, { levels: { spectre: level } }).damageAmp).toBeCloseTo(SPECTRE.damageAmp[level - 1]);
      expect(unitStats(UNIT_BY_ID.footman, 1, { levels: { spectre: level } }).damageAmp).toBe(0);
    }
    const plain = unitStats(UNIT_BY_ID.bossalpha, 1);
    const ten = unitStats(UNIT_BY_ID.bossalpha, 1, { levels: { spectre: 4 } });
    // A star higher: its 2★ numbers at 1★, and past 3★ its 3★ numbers x1.8.
    const per = UNIT_BY_ID.bossalpha.starStats!;
    expect(plain.hp).toBe(per.hp[0]);
    expect(ten.hp).toBe(Math.round(per.hp[1] * (1 + SPECTRE.hp[3])));
    expect(ten.atk).toBe(per.atk[1]);
    expect(unitStats(UNIT_BY_ID.bossalpha, 3, { levels: { spectre: 4 } }).atk).toBe(Math.round(per.atk[2] * 1.8));
  });

  test('Spectre 2: two-starring a 1- or 2-gold Spectre gives a free one a cost higher, from the pool', () => {
    const state = newGame();
    const p = state.players[0];
    put(p, 'phove', 0);
    put(p, 'ginger', 1);
    const before = state.pool.ginger;
    twoStar(state, p, 'phove');
    // The fielded Phove + 3 bought = a 2★ and a spare 1★; the 2★ conjured a ginger.
    expect(owned(p)).toEqual(['ginger1', 'ginger1', 'phove1', 'phove2']);
    expect(state.pool.ginger).toBe(before - 1);
    twoStar(state, p, 'ginger');
    // ginger: 2 owned + 3 bought = a 2★ plus two spare 1★... and a free 3-gold Spectre.
    const threes = owned(p).filter((u) => u.startsWith('saber') || u.startsWith('pacquiao'));
    expect(threes).toHaveLength(1);
  });

  test('a 3-gold Spectre two-starred at Spectre 2 waits, and pays its gift on reaching Spectre 4', () => {
    const state = newGame();
    const p = state.players[0];
    put(p, 'phove', 0);
    put(p, 'ginger', 1);
    twoStar(state, p, 'saber');
    expect(owned(p).some((u) => u.startsWith('gourd'))).toBe(false); // Spectre 2: not yet
    expect(p.promotionsWaiting).toEqual([{ trait: 'spectre', defId: 'saber', star: 2 }]);
    // Field the 2★ Saber (bought to the bench) and a 4th Spectre.
    const at = p.bench.findIndex((u) => u?.defId === 'saber');
    p.board[3] = p.bench[at];
    p.bench[at] = null;
    put(p, 'pacquiao', 2);
    syncPlayer(state, p);
    expect(owned(p).filter((u) => u === 'gourd1')).toHaveLength(1);
    expect(p.promotionsWaiting).toBeUndefined();
    syncPlayer(state, p);
    expect(owned(p).filter((u) => u === 'gourd1')).toHaveLength(1); // paid once
    // Two-starring at Spectre 4 pays right away, as before.
    twoStar(state, p, 'pacquiao');
    expect(owned(p).filter((u) => u === 'gourd1')).toHaveLength(2);
    expect(owned(p).filter((u) => u.startsWith('alice'))).toEqual([]);
  });

  test('a waiting gift is dropped if the hero is sold before the level is reached', () => {
    const state = newGame();
    const p = state.players[0];
    put(p, 'phove', 0);
    put(p, 'ginger', 1);
    twoStar(state, p, 'saber');
    for (const slots of [p.board, p.bench]) slots.forEach((u, i) => u?.defId === 'saber' && (slots[i] = null));
    put(p, 'pacquiao', 2);
    put(p, 'gourd', 3);
    syncPlayer(state, p);
    expect(owned(p).filter((u) => u.startsWith('gourd'))).toEqual(['gourd1']); // only the one put down
    expect(p.promotionsWaiting).toBeUndefined();
  });

  test('Spectre 6: two-starring the 5-gold unlocks Boss Alpha in this player\'s shop and gives one', () => {
    const state = newGame();
    const [p, other] = state.players;
    ['phove', 'ginger', 'saber', 'pacquiao', 'gourd', 'alice'].forEach((d, i) => put(p, d, i));
    const draws = (pl: Player) => {
      let seen = 0;
      for (let i = 0; i < 200; i++) {
        refreshShop(state, pl);
        seen += pl.shop.filter((id) => id === 'bossalpha').length;
      }
      return seen;
    };
    expect(draws(p)).toBe(0);
    p.bench.fill(null);
    twoStar(state, p, 'alice');
    expect(p.unlocked).toEqual(['bossalpha']);
    expect(owned(p)).toContain('bossalpha1');
    expect(draws(p)).toBeGreaterThan(0);
    expect(draws(other)).toBe(0);
  });

  test('a gift lands on the board when the bench is full', () => {
    const state = newGame();
    const p = state.players[0];
    put(p, 'phove', 0);
    put(p, 'ginger', 1);
    put(p, 'phove', 2);
    put(p, 'phove', 3);
    p.bench.fill(null).forEach((_, i) => (p.bench[i] = { uid: ++uid, defId: 'footman', star: 1 }));
    // Two Phoves fielded, a third bought into a full bench: it merges straight in.
    p.shop[0] = 'phove';
    state.pool.phove--;
    expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    expect(p.gifts).toEqual([]);
    expect(p.board.some((u) => u?.defId === 'ginger')).toBe(true);
  });

  test('Boss Alpha costs 7 and is never in anyone\'s shop before it is unlocked', () => {
    const state = newGame();
    expect(UNIT_BY_ID.bossalpha.tier).toBe(7);
    for (let i = 0; i < 20; i++) {
      startRound(state);
      for (const p of state.players) expect(p.shop).not.toContain('bossalpha');
    }
  });
});
