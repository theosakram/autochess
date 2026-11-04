import { describe, expect, test } from 'bun:test';
import { applyAction, type Action } from './actions';
import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS, POOL_SIZE, REROLL_COST } from './config';
import { createGame, startRound } from './game';
import { nextInt } from './rng';
import type { GameState } from './types';
import { UNIT_BY_ID, UNITS } from './units';

const SEEDS = [
  { id: 'you', name: 'You', isBot: false },
  { id: 'bot1', name: 'Bot 1', isBot: true },
  { id: 'bot2', name: 'Bot 2', isBot: true },
];

function newGame(seed = 42): GameState {
  return createGame(seed, SEEDS);
}

function you(state: GameState) {
  return state.players[0];
}

// Every copy is always somewhere: pool, a shop, a bench or a board.
function totalCopies(state: GameState): number {
  let n = Object.values(state.pool).reduce((a, b) => a + b, 0);
  for (const p of state.players) {
    n += p.shop.filter(Boolean).length;
    for (const u of [...p.bench, ...p.board]) if (u) n += 3 ** (u.star - 1);
  }
  return n;
}

const POOL_TOTAL = UNITS.reduce((n, u) => n + POOL_SIZE[u.tier - 1], 0);

describe('game setup', () => {
  test('same seed gives same game', () => {
    expect(JSON.stringify(newGame(7))).toBe(JSON.stringify(newGame(7)));
  });

  test('round 1 gives 5 gold and a full level-1 shop', () => {
    const p = you(newGame());
    expect(p.gold).toBe(5);
    expect(p.shop.every((id) => id && UNIT_BY_ID[id].tier === 1)).toBe(true);
  });
});

describe('shop', () => {
  test('reroll costs gold and replaces the shop', () => {
    const state = newGame();
    const p = you(state);
    p.gold = 10;
    expect(applyAction(state, p.id, { type: 'reroll' })).toEqual({ ok: true });
    expect(p.gold).toBe(10 - REROLL_COST);
    expect(p.shop.filter(Boolean).length).toBe(5);
  });

  test('reroll fails without gold', () => {
    const state = newGame();
    const p = you(state);
    p.gold = 1;
    expect(applyAction(state, p.id, { type: 'reroll' }).ok).toBe(false);
    expect(p.gold).toBe(1);
  });

  test('buy moves unit to bench and charges its tier', () => {
    const state = newGame();
    const p = you(state);
    const defId = p.shop[0]!;
    const gold = p.gold;
    expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    expect(p.shop[0]).toBeNull();
    expect(p.bench[0]?.defId).toBe(defId);
    expect(p.gold).toBe(gold - UNIT_BY_ID[defId].tier);
    expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(false);
  });

  test('buy fails when bench is full', () => {
    const state = newGame();
    const p = you(state);
    p.gold = 100;
    for (let i = 0; i < BENCH_SIZE; i++) p.bench[i] = { uid: 1000 + i, defId: 'footman', star: 1 };
    expect(applyAction(state, p.id, { type: 'buy', slot: 0 })).toEqual({ ok: false, error: 'Bench is full' });
  });

  test('sell refunds gold and returns the copy to the pool', () => {
    const state = newGame();
    const p = you(state);
    applyAction(state, p.id, { type: 'buy', slot: 0 });
    const defId = p.bench[0]!.defId;
    const pool = state.pool[defId];
    const gold = p.gold;
    expect(applyAction(state, p.id, { type: 'sell', from: { area: 'bench', index: 0 } }).ok).toBe(true);
    expect(p.bench[0]).toBeNull();
    expect(state.pool[defId]).toBe(pool + 1);
    expect(p.gold).toBe(gold + UNIT_BY_ID[defId].tier);
  });
});

describe('board', () => {
  test('board is capped at player level', () => {
    const state = newGame();
    const p = you(state);
    p.bench[0] = { uid: 900, defId: 'footman', star: 1 };
    p.bench[1] = { uid: 901, defId: 'archer', star: 1 };
    const move = (i: number, to: number): Action => ({
      type: 'move',
      from: { area: 'bench', index: i },
      to: { area: 'board', index: to },
    });
    expect(applyAction(state, p.id, move(0, 0)).ok).toBe(true);
    expect(applyAction(state, p.id, move(1, 1)).ok).toBe(false);
    expect(p.bench[1]?.uid).toBe(901);
    // Swapping into an occupied cell keeps the count, so it's allowed.
    expect(applyAction(state, p.id, move(1, 0)).ok).toBe(true);
    expect(p.board[0]?.uid).toBe(901);
    expect(p.bench[1]?.uid).toBe(900);
  });

  test('rejects out-of-range locations', () => {
    const state = newGame();
    const p = you(state);
    p.bench[0] = { uid: 900, defId: 'footman', star: 1 };
    const bad: Action = { type: 'move', from: { area: 'bench', index: 0 }, to: { area: 'board', index: BOARD_COLS * BOARD_ROWS } };
    expect(applyAction(state, p.id, bad).ok).toBe(false);
  });
});

describe('merge', () => {
  // Stock the shop with one unit and enough gold to buy it repeatedly.
  function buyCopies(state: GameState, defId: string, n: number) {
    const p = you(state);
    for (let i = 0; i < n; i++) {
      p.gold = 100;
      state.pool[defId]--;
      p.shop[0] = defId;
      expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    }
  }

  const units = (state: GameState) => [...you(state).bench, ...you(state).board].filter((u) => u !== null);

  test('three 1★ become one 2★', () => {
    const state = newGame();
    buyCopies(state, 'footman', 3);
    expect(units(state).map((u) => u.star)).toEqual([2]);
  });

  test('nine 1★ cascade into one 3★', () => {
    const state = newGame();
    buyCopies(state, 'footman', 9);
    expect(units(state).map((u) => u.star)).toEqual([3]);
  });

  test('different units do not merge', () => {
    const state = newGame();
    buyCopies(state, 'footman', 2);
    buyCopies(state, 'archer', 1);
    expect(units(state).length).toBe(3);
  });

  test('merge keeps the unit on the board', () => {
    const state = newGame();
    const p = you(state);
    buyCopies(state, 'footman', 1);
    applyAction(state, p.id, { type: 'move', from: { area: 'bench', index: 0 }, to: { area: 'board', index: 5 } });
    buyCopies(state, 'footman', 2);
    expect(p.board[5]?.star).toBe(2);
    expect(p.bench.every((u) => u === null)).toBe(true);
  });

  test('full bench still allows a buy that completes a merge', () => {
    const state = newGame();
    const p = you(state);
    const filler = ['footman', 'footman', 'archer', 'imp', 'grunt', 'acolyte', 'knight', 'druid'];
    filler.forEach((defId, i) => (p.bench[i] = { uid: 1000 + i, defId, star: 1 }));
    buyCopies(state, 'footman', 1);
    expect(p.bench.filter((u) => u?.defId === 'footman').map((u) => u!.star)).toEqual([2]);
    expect(p.bench.filter((u) => u === null).length).toBe(1);

    p.shop[0] = 'archer';
    expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(true); // took the freed slot
    p.shop[1] = 'imp';
    expect(applyAction(state, p.id, { type: 'buy', slot: 1 })).toEqual({ ok: false, error: 'Bench is full' });
  });
});

describe('invariants', () => {
  test('unit copies are conserved across random play', () => {
    const state = newGame(123);
    const fuzz = { rng: 99 };
    const loc = () => {
      const area = nextInt(fuzz, 2) ? 'bench' : 'board';
      return { area, index: nextInt(fuzz, area === 'bench' ? BENCH_SIZE : BOARD_COLS * BOARD_ROWS) } as const;
    };
    for (let i = 0; i < 2000; i++) {
      const p = state.players[nextInt(fuzz, state.players.length)];
      p.gold += nextInt(fuzz, 3);
      const actions: Action[] = [
        { type: 'reroll' },
        { type: 'buyXp' },
        { type: 'buy', slot: nextInt(fuzz, 5) },
        { type: 'sell', from: loc() },
        { type: 'move', from: loc(), to: loc() },
      ];
      applyAction(state, p.id, actions[nextInt(fuzz, actions.length)]);
      if (i % 50 === 0) startRound(state);
      for (const pl of state.players) expect(pl.board.filter(Boolean).length).toBeLessThanOrEqual(pl.level);
    }
    expect(totalCopies(state)).toBe(POOL_TOTAL);
    expect(Object.values(state.pool).every((n) => n >= 0)).toBe(true);
  });
});
