import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { roundAt } from './config';
import { createGame, startRound } from './game';
import { orbOptions } from './orb';
import { traitCounts } from './traits';
import type { GameState } from './types';
import { UNIT_BY_ID } from './units';

function newGame(): GameState {
  const state = createGame(3, [{ id: 'a', name: 'A', isBot: false }]);
  const p = state.players[0];
  p.bench.fill(null);
  p.board.fill(null);
  return state;
}

describe('Magic Orb', () => {
  test("offers the unit's own traits plus one random other, the same every time", () => {
    const opts = orbOptions(1234, 'lance');
    expect(opts.slice(0, 2)).toEqual(UNIT_BY_ID.lance.traits);
    expect(opts).toHaveLength(3);
    expect(UNIT_BY_ID.lance.traits).not.toContain(opts[2]);
    expect(orbOptions(1234, 'lance')).toEqual(opts);
  });

  test('handed out on the fixed rounds', () => {
    const state = newGame();
    const p = state.players[0];
    while (state.round < roundAt(3, 1)) startRound(state);
    expect(p.orbs).toHaveLength(2);
  });

  test('Lance with a Gustiwana orb counts 2; sold it is 0; rebought it is 2 again; a new orb moves it', () => {
    const state = newGame();
    const p = state.players[0];
    p.orbs.push(42);
    p.board[0] = { uid: 900, defId: 'lance', star: 1 };
    expect(applyAction(state, p.id, { type: 'useOrb', unit: 900, trait: 'gustiwana' }).ok).toBe(true);
    expect(p.orbs).toHaveLength(0);
    expect(traitCounts(p.board, p.orb).gustiwana).toBe(2);

    p.gold = 10;
    applyAction(state, p.id, { type: 'sell', from: { area: 'board', index: 0 } });
    expect(traitCounts(p.board, p.orb).gustiwana).toBeUndefined();

    p.board[4] = { uid: 901, defId: 'lance', star: 1 };
    expect(traitCounts(p.board, p.orb).gustiwana).toBe(2);

    // A second orb on another unit replaces the first.
    p.orbs.push(7);
    p.board[5] = { uid: 902, defId: 'dyroth', star: 1 };
    expect(applyAction(state, p.id, { type: 'useOrb', unit: 902, trait: 'gustiwana' }).ok).toBe(true);
    expect(p.orb).toEqual({ defId: 'dyroth', trait: 'gustiwana' });
    expect(traitCounts(p.board, p.orb).gustiwana).toBe(3); // Lance 1 + Dyroth 2
  });

  test('the random option adds the unit to a trait it does not have', () => {
    const state = newGame();
    const p = state.players[0];
    p.orbs.push(42);
    p.board[0] = { uid: 900, defId: 'lance', star: 1 };
    const extra = orbOptions(42, 'lance')[2];
    applyAction(state, p.id, { type: 'useOrb', unit: 900, trait: extra });
    expect(traitCounts(p.board, p.orb)[extra]).toBe(1);
  });

  test('only offered traits, only with an orb in hand', () => {
    const state = newGame();
    const p = state.players[0];
    p.board[0] = { uid: 900, defId: 'lance', star: 1 };
    expect(applyAction(state, p.id, { type: 'useOrb', unit: 900, trait: 'gustiwana' }).ok).toBe(false);
    p.orbs.push(42);
    const notOffered = ['hunter', 'stargazer', 'deadeye'].find((t) => !orbOptions(42, 'lance').includes(t))!;
    expect(applyAction(state, p.id, { type: 'useOrb', unit: 900, trait: notOffered }).ok).toBe(false);
  });
});

describe('merging keeps items', () => {
  test('items on absorbed copies move onto the merged unit', () => {
    const state = newGame();
    const p = state.players[0];
    p.board[0] = { uid: 1, defId: 'footman', star: 1 };
    p.bench[0] = { uid: 2, defId: 'footman', star: 1 };
    p.items.push({ uid: 50, id: 'keris', tier: 2, holder: 2 });
    p.gold = 10;
    p.shop[0] = 'footman';
    state.pool.footman--;
    applyAction(state, p.id, { type: 'buy', slot: 0 });
    expect(p.board[0]?.star).toBe(2);
    expect(p.items[0].holder).toBe(1);
  });
});
