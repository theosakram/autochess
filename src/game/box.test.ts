import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { bonusPicks, boxTurn, closeBox, isBoxRound, openBox, takenBy } from './box';
import { VEX } from './commanders';
import { roundAt } from './config';
import { createGame } from './game';
import { heroCapOf } from './player';
import { UNIT_BY_ID } from './units';

function game(humans = 1) {
  const state = createGame(5, Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: i >= humans })));
  state.players.forEach((p, i) => {
    p.hp = 100 - i * 5; // p7 lowest
    p.commander = 'lukas'; // bots roll a random commander: none with Box perks unless a test says so
    p.commanderCard = null;
  });
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

describe('Vex', () => {
  test('first 3 boxes: +10 gold and a bonus pick after everyone; not on the 4th', () => {
    for (const [stage, sub, gold, bonus] of [[1, 4, true, 1], [3, 6, true, 1], [4, 6, false, 0]] as const) {
      const state = game(0);
      const vex = state.players[0]; // most hp: picks last, then the bonus pick
      vex.commander = 'vex';
      state.round = roundAt(stage, sub);
      const before = vex.gold;
      openBox(state);
      const box = state.box!;
      expect(vex.gold - before).toBe(gold ? VEX.box.gold : 0);
      expect(box.bonus ?? 0).toBe(bonus);
      expect(box.order.length).toBe(8 + bonus);
      if (bonus) expect(box.order.at(-1)).toBe('p0');
      expect(boxTurn(box)).toBeNull(); // all bots: everything picked
    }
  });

  test('first box: the first item taken comes with a copy (once)', () => {
    const state = game(1);
    const vex = state.players[0];
    vex.commander = 'vex';
    state.round = roundAt(1, 4);
    openBox(state);
    const box = state.box!;
    const items = () => box.prizes.flatMap((x, i) => (x.kind === 'item' && !box.picks.includes(i) ? [i] : []));
    const [a, b] = items();
    expect(applyAction(state, 'p0', { type: 'pickBox', prize: a }).ok).toBe(true);
    expect(boxTurn(box)).toBe('p0'); // the bonus pick
    expect(applyAction(state, 'p0', { type: 'pickBox', prize: b }).ok).toBe(true);
    const ids = vex.items.map((i) => i.id);
    const id = (i: number) => (box.prizes[i] as { id: string }).id;
    expect(ids.filter((x) => x === id(a))).toHaveLength(a === b ? 3 : 2);
    expect(ids.filter((x) => x === id(b))).toHaveLength(id(a) === id(b) ? 3 : 1);
  });

  test("her card: another bonus pick on the first 4 boxes, for anyone; stacks on Vex", () => {
    const state = game(0);
    const [vex, other] = state.players;
    vex.commander = 'vex';
    vex.commanderCard = 'vex';
    other.commanderCard = 'vex';
    expect([1, 3, 4, 5].map((s) => bonusPicks(vex, s))).toEqual([2, 2, 1, 0]);
    expect([1, 4, 5].map((s) => bonusPicks(other, s))).toEqual([1, 1, 0]);
    expect(other.gold).toBe(state.players[2].gold); // the card alone pays no gold
    state.round = roundAt(1, 4);
    openBox(state);
    // Bonus picks go one round at a time, in pick order: p1 (less hp) before p0, then p0's second.
    expect(state.box!.order.slice(8)).toEqual(['p1', 'p0', 'p0']);
  });
});
