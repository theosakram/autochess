import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { boxTurn, closeBox, isBoxRound, openBox, takenBy } from './box';
import { roundAt } from './config';
import { createGame } from './game';
import { heroCapOf } from './player';
import { UNIT_BY_ID } from './units';

function game(humans = 1) {
  const state = createGame(5, Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: i >= humans })));
  state.players.forEach((p, i) => (p.hp = 100 - i * 5)); // p7 lowest
  return state;
}

describe('Box round', () => {
  test('follows the last round of every stage', () => {
    expect([1, 2, 3, 4, 5].map(isBoxRound)).toEqual([false, false, false, true, false]);
    expect(isBoxRound(roundAt(2, 6))).toBe(true);
    expect(isBoxRound(roundAt(3, 6))).toBe(true);
    expect(isBoxRound(roundAt(3, 5))).toBe(false);
  });

  test('prizes by stage: heroes by cost, 2 capacity, 8 items and orbs', () => {
    const kinds = (round: number) => {
      const state = game(0);
      state.round = round;
      openBox(state);
      const box = state.box!;
      const n = (k: string) => box.prizes.filter((x) => x.kind === k).length;
      const costs = box.prizes.flatMap((x) => (x.kind === 'hero' ? [UNIT_BY_ID[x.defId].tier] : [])).sort();
      return { costs, cap: n('capacity'), items: n('item'), orbs: n('orb') };
    };
    expect(kinds(roundAt(1, 4))).toEqual({ costs: [4, 4, 4], cap: 2, items: 8, orbs: 0 });
    expect(kinds(roundAt(2, 6))).toEqual({ costs: [4, 4, 5], cap: 2, items: 7, orbs: 1 });
    expect(kinds(roundAt(3, 6))).toEqual({ costs: [5, 5, 5], cap: 2, items: 6, orbs: 2 });
    expect(kinds(roundAt(4, 6))).toEqual({ costs: [5, 5, 5], cap: 2, items: 5, orbs: 3 });
    expect(kinds(roundAt(6, 6))).toEqual({ costs: [5, 5, 5], cap: 2, items: 5, orbs: 3 });
  });

  test('lowest hp picks first; bots pick until a person is up, then wait', () => {
    const state = game(1); // p0 is the person, with the most hp: last
    state.round = roundAt(1, 4);
    openBox(state);
    const box = state.box!;
    expect(box.order).toEqual(['p7', 'p6', 'p5', 'p4', 'p3', 'p2', 'p1', 'p0']);
    expect(box.picks).toHaveLength(7);
    expect(boxTurn(box)).toBe('p0');
    // Bots took both capacities first.
    expect(box.prizes[box.picks[0]].kind).toBe('capacity');
    expect(heroCapOf(state.players[7])).toBe(state.players[7].level + 1);
    // Not the person's turn: refused. Their turn: a free prize, not a taken one.
    const taken = box.picks[0];
    expect(applyAction(state, 'p0', { type: 'pickBox', prize: taken }).ok).toBe(false);
    const free = box.prizes.findIndex((_, i) => !box.picks.includes(i));
    expect(applyAction(state, 'p0', { type: 'pickBox', prize: free }).ok).toBe(true);
    expect(takenBy(box, free)).toBe('p0');
    expect(boxTurn(box)).toBeNull();
  });

  test('untaken heroes go back to the pool', () => {
    const state = game(0);
    state.players.splice(2); // two players: two picks, three heroes, so at least one is left
    state.round = roundAt(1, 4);
    const pool = { ...state.pool };
    openBox(state);
    const heroes = state.box!.prizes.flatMap((x, i) => (x.kind === 'hero' && !state.box!.picks.includes(i) ? [x.defId] : []));
    closeBox(state);
    expect(state.box).toBeUndefined();
    for (const id of heroes) expect(state.pool[id]).toBe(pool[id]);
  });
});
