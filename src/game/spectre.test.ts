import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { createGame, startRound } from './game';
import { refreshShop } from './shop';
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

describe('Spectre', () => {
  test('seven units at 1, 2, 3, 3, 4, 5, 7 gold; the 7-gold is Spectre only', () => {
    const units = UNITS.filter((u) => u.shop !== false && u.traits.includes('spectre')).sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 3, 3, 4, 5, 7]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'spectre'))).toEqual([['scavenger'], ['deadeye'], ['fighter'], ['hunter'], ['mage'], ['dauntless'], []]);
  });

  test('Spectres deal more damage; at 10 they also gain HP and the Eidolon fights a star higher', () => {
    for (const level of [1, 2, 3]) {
      expect(unitStats(UNIT_BY_ID.wisp, 1, { levels: { spectre: level } }).damageAmp).toBeCloseTo(SPECTRE.damageAmp[level - 1]);
      expect(unitStats(UNIT_BY_ID.footman, 1, { levels: { spectre: level } }).damageAmp).toBe(0);
    }
    const plain = unitStats(UNIT_BY_ID.eidolon, 1);
    const ten = unitStats(UNIT_BY_ID.eidolon, 1, { levels: { spectre: 4 } });
    expect(ten.hp).toBe(Math.round(UNIT_BY_ID.eidolon.hp * 1.8 * (1 + SPECTRE.hp[3])));
    expect(ten.atk).toBe(Math.round(plain.atk * 1.8));
    expect(unitStats(UNIT_BY_ID.eidolon, 3, { levels: { spectre: 4 } }).atk).toBe(Math.round(UNIT_BY_ID.eidolon.atk * 5.832));
  });

  test('Spectre 2: two-starring a 1- or 2-gold Spectre gives a free one a cost higher, from the pool', () => {
    const state = newGame();
    const p = state.players[0];
    put(p, 'wisp', 0);
    put(p, 'gloomshot', 1);
    const before = state.pool.gloomshot;
    twoStar(state, p, 'wisp');
    // The fielded wisp + 3 bought = a 2★ and a spare 1★; the 2★ conjured a gloomshot.
    expect(owned(p)).toEqual(['gloomshot1', 'gloomshot1', 'wisp1', 'wisp2']);
    expect(state.pool.gloomshot).toBe(before - 1);
    twoStar(state, p, 'gloomshot');
    // gloomshot: 2 owned + 3 bought = a 2★ plus two spare 1★... and a free 3-gold Spectre.
    const threes = owned(p).filter((u) => u.startsWith('soulreaper') || u.startsWith('phantomblade'));
    expect(threes).toHaveLength(1);
  });

  test('Spectre 2 does nothing for 3-gold Spectres; Spectre 4 does', () => {
    const state = newGame();
    const p = state.players[0];
    put(p, 'wisp', 0);
    put(p, 'gloomshot', 1);
    twoStar(state, p, 'soulreaper');
    expect(owned(p).some((u) => u.startsWith('ethersage'))).toBe(false);
    put(p, 'phantomblade', 2);
    put(p, 'ethersage', 3);
    twoStar(state, p, 'phantomblade');
    expect(owned(p).filter((u) => u.startsWith('wraithlord'))).toEqual([]);
    expect(owned(p).filter((u) => u === 'ethersage1')).toHaveLength(2);
  });

  test('Spectre 6: two-starring the 5-gold unlocks the Eidolon in this player\'s shop and gives one', () => {
    const state = newGame();
    const [p, other] = state.players;
    ['wisp', 'gloomshot', 'soulreaper', 'phantomblade', 'ethersage', 'wraithlord'].forEach((d, i) => put(p, d, i));
    const draws = (pl: Player) => {
      let seen = 0;
      for (let i = 0; i < 200; i++) {
        refreshShop(state, pl);
        seen += pl.shop.filter((id) => id === 'eidolon').length;
      }
      return seen;
    };
    expect(draws(p)).toBe(0);
    p.bench.fill(null);
    twoStar(state, p, 'wraithlord');
    expect(p.unlocked).toEqual(['eidolon']);
    expect(owned(p)).toContain('eidolon1');
    expect(draws(p)).toBeGreaterThan(0);
    expect(draws(other)).toBe(0);
  });

  test('a gift waits for bench room', () => {
    const state = newGame();
    const p = state.players[0];
    put(p, 'wisp', 0);
    put(p, 'gloomshot', 1);
    put(p, 'wisp', 2);
    put(p, 'wisp', 3);
    p.bench.fill(null).forEach((_, i) => (p.bench[i] = { uid: ++uid, defId: 'footman', star: 1 }));
    // Two wisps fielded, a third bought into a full bench: it merges straight in.
    p.shop[0] = 'wisp';
    state.pool.wisp--;
    expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    expect(p.gifts).toEqual(['gloomshot']);
    applyAction(state, p.id, { type: 'sell', from: { area: 'bench', index: 0 } });
    expect(p.gifts).toEqual([]);
    expect(p.bench.some((u) => u?.defId === 'gloomshot')).toBe(true);
  });

  test('the Eidolon costs 7 and is never in anyone\'s shop before it is unlocked', () => {
    const state = newGame();
    expect(UNIT_BY_ID.eidolon.tier).toBe(7);
    for (let i = 0; i < 20; i++) {
      startRound(state);
      for (const p of state.players) expect(p.shop).not.toContain('eidolon');
    }
  });
});
