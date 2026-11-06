import { describe, expect, test } from 'bun:test';
import { formation } from './formation';
import { applyAction, type Action } from './actions';
import { BASE_INCOME, BENCH_SIZE, BOARD_COLS, BOARD_ROWS, FREE_UNITS, MAX_LEVEL, POOL_SIZE, REROLL_COST, SHOP_ODDS, START_LEVEL } from './config';
import { boardCount, interest, levelUpCost } from './player';
import { runBot } from './bot';
import { createGame, resolveCombat, startRound } from './game';
import { copiesOf } from './merge';
import { DRAGON_ALTAR, SCAVENGER } from './traits';
import { nextInt } from './rng';
import { isItemCard } from './items';
import { returnShop } from './shop';
import type { GameState } from './types';
import { UNIT_BY_ID, UNITS } from './units';

const SEEDS = [
  { id: 'you', name: 'You', isBot: false },
  { id: 'bot1', name: 'Bot 1', isBot: true },
  { id: 'bot2', name: 'Bot 2', isBot: true },
];

// Most tests want an empty start, so starter units go back to the pool.
function newGame(seed = 42, keepStarters = false): GameState {
  const state = createGame(seed, SEEDS);
  if (!keepStarters) {
    for (const p of state.players) {
      for (const slots of [p.bench, p.board]) {
        slots.forEach((u, i) => {
          // Commander pieces never came from the pool.
          if (u && u.defId in state.pool) state.pool[u.defId] += copiesOf(u);
          slots[i] = null;
        });
      }
    }
  }
  return state;
}

function you(state: GameState) {
  return state.players[0];
}

// Every copy is always somewhere: pool, a shop, a bench or a board.
function totalCopies(state: GameState): number {
  let n = Object.values(state.pool).reduce((a, b) => a + b, 0);
  for (const p of state.players) {
    // Upgrade cards aren't units, so they hold no copies.
    n += p.shop.filter((id) => id && !isItemCard(id)).length;
    // Units with no pool (Plane Wanderers, raised by the grave) were never copies of anything.
    for (const u of [...p.bench, ...p.board]) if (u && u.defId in state.pool) n += copiesOf(u);
    n += p.gifts?.length ?? 0;
  }
  return n;
}

// Units that are only handed out (shop: false) have no pool.
const POOL_TOTAL = UNITS.filter((u) => u.shop !== false).reduce((n, u) => n + POOL_SIZE[u.tier], 0);

describe('game setup', () => {
  test('same seed gives same game', () => {
    expect(JSON.stringify(newGame(7))).toBe(JSON.stringify(newGame(7)));
  });

  test('players start at level 3 with free units on the bench, taken from the pool', () => {
    const state = newGame(42, true);
    const p = you(state);
    expect(p.level).toBe(START_LEVEL);
    expect(p.gold).toBe(5);
    expect(p.board.every((u) => u === null)).toBe(true);
    const starters = p.bench.filter((u) => u !== null);
    expect(starters.reduce((n, u) => n + copiesOf(u), 0)).toBe(FREE_UNITS);
    // Drawn at level-3 odds, which top out at 3-gold.
    expect(starters.every((u) => SHOP_ODDS[START_LEVEL - 1][UNIT_BY_ID[u.defId].tier - 1] > 0)).toBe(true);
    expect(totalCopies(state)).toBe(POOL_TOTAL);
  });

  test('bots field their free units', () => {
    const bot = newGame(42, true).players[1];
    expect(boardCount(bot)).toBe(START_LEVEL);
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
    p.level = 1;
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
    const filler = ['footman', 'footman', 'archer', 'imp', 'wisp', 'galekin', 'knight', 'prajurit'];
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
        { type: 'levelUp' },
        { type: 'buy', slot: nextInt(fuzz, 5) },
        { type: 'sell', from: loc() },
        { type: 'move', from: loc(), to: loc() },
      ];
      applyAction(state, p.id, actions[nextInt(fuzz, actions.length)]);
      if (i % 50 === 0) {
        resolveCombat(state);
        startRound(state);
      }
      // Free-slot units (Plane Wanderers) don't count toward the limit.
      for (const pl of state.players) expect(boardCount(pl)).toBeLessThanOrEqual(pl.level);
    }
    expect(totalCopies(state)).toBe(POOL_TOTAL);
    expect(Object.values(state.pool).every((n) => n >= 0)).toBe(true);
  });
});

describe('bots', () => {
  test('bots seat Dragon Altar units on altar tiles', () => {
    const state = createGame(1, [{ id: 'bot', name: 'Bot', isBot: true }]);
    const p = state.players[0];
    p.board.fill(null);
    p.bench.fill(null);
    p.shop.fill(null);
    p.level = 5;
    p.gold = 0;
    // Neutral units sit on the altar cells, Dragon Altar units elsewhere.
    const tiles = DRAGON_ALTAR.tiles[0];
    p.board[tiles[0]] = { uid: 1, defId: 'footman', star: 1 };
    p.board[tiles[1]] = { uid: 2, defId: 'archer', star: 1 };
    p.board[1] = { uid: 3, defId: 'drakeling', star: 1 };
    p.board[5] = { uid: 4, defId: 'wyrmfang', star: 1 };
    p.board[8] = { uid: 5, defId: 'imp', star: 1 };
    runBot(state, p);
    const onAltar = tiles.map((t) => p.board[t]?.defId);
    expect(onAltar).toContain('drakeling');
    expect(onAltar).toContain('wyrmfang');
    expect(onAltar.filter(Boolean).length).toBe(4);
  });
});

describe('scavenger', () => {
  // Empty start with these units fielded; the next startRound pays out.
  function setup(units: string[]) {
    const state = newGame();
    const p = you(state);
    units.forEach((defId, i) => (p.board[i] = { uid: 500 + i, defId, star: 1 }));
    return { state, p };
  }

  test('level 2 takes the cheapest shop unit for free, after the refresh', () => {
    const { state, p } = setup(['wisp', 'penari']);
    const bonuses = startRound(state);
    const mine = bonuses.find((b) => b.playerId === p.id)!;
    expect(mine.trait).toBe('scavenger');
    expect(mine.gold).toBe(SCAVENGER.gold[0]);
    // The looted unit was the cheapest left in the refreshed shop and is now on the bench.
    const looted = mine.looted!;
    const cheapestLeft = Math.min(...p.shop.flatMap((id) => (id ? [UNIT_BY_ID[id].tier] : [99])));
    expect(UNIT_BY_ID[looted].tier).toBeLessThanOrEqual(cheapestLeft);
    expect(p.bench.some((u) => u?.defId === looted)).toBe(true);
    expect(p.shop.filter(Boolean)).toHaveLength(4);
    expect(totalCopies(state)).toBe(POOL_TOTAL + 2); // the two hand-placed Scavengers aren't from the pool
  });

  test('level 3 also pays 2 gold', () => {
    const { state, p } = setup(['wisp', 'penari', 'graverobber']);
    const gold = p.gold;
    const mine = startRound(state).find((b) => b.playerId === p.id)!;
    expect(mine.gold).toBe(SCAVENGER.gold[1]);
    expect(mine.looted).not.toBeNull();
    // +2 on top of normal income and interest
    expect(p.gold).toBe(gold + BASE_INCOME + interest(gold) + SCAVENGER.gold[1]);
  });

  test('skipped when the bench is full and the unit would not merge', () => {
    const { state, p } = setup(['wisp', 'penari']);
    p.bench.fill(null).forEach((_, i) => (p.bench[i] = { uid: 600 + i, defId: 'titan', star: 1 }));
    const mine = startRound(state).find((b) => b.playerId === p.id)!;
    expect(mine.looted).toBeNull();
    expect(p.shop.filter(Boolean)).toHaveLength(5);
  });

  test('no Scavenger active, no payout', () => {
    const state = newGame();
    expect(startRound(state).filter((b) => b.playerId === you(state).id)).toHaveLength(0);
  });
});

describe('economy', () => {
  test('shop odds cover every level and each row sums to 100', () => {
    expect(SHOP_ODDS).toHaveLength(MAX_LEVEL);
    for (const row of SHOP_ODDS) expect(row.reduce((a, b) => a + b, 0)).toBe(100);
  });

  test('interest is +2 per 10 gold, capped at +4', () => {
    expect([0, 9, 10, 19, 20, 35, 99].map(interest)).toEqual([0, 0, 2, 2, 4, 4, 4]);
  });

  test('level up buys exactly the missing xp, in one click', () => {
    const state = newGame();
    const p = you(state);
    p.xp = 1;
    const cost = levelUpCost(p)!;
    const level = p.level;
    p.gold = cost - 1;
    expect(applyAction(state, p.id, { type: 'levelUp' })).toEqual({ ok: false, error: `Need ${cost} gold to level up` });
    p.gold = cost;
    expect(applyAction(state, p.id, { type: 'levelUp' }).ok).toBe(true);
    expect([p.level, p.xp, p.gold]).toEqual([level + 1, 0, 0]);
  });

  test('no level up past max level', () => {
    const state = newGame();
    const p = you(state);
    p.level = MAX_LEVEL;
    p.gold = 999;
    expect(levelUpCost(p)).toBeNull();
    expect(applyAction(state, p.id, { type: 'levelUp' }).ok).toBe(false);
  });
});

describe('shop lock', () => {
  test('a locked shop skips one refresh, keeps its gaps, then unlocks', () => {
    const state = newGame();
    const p = you(state);
    returnShop(state, p); // hand-built shop below, so the old one goes back to the pool first
    p.shop = ['wraithlord', null, null, null, null];
    state.pool.wraithlord--;
    expect(applyAction(state, p.id, { type: 'toggleLock' }).ok).toBe(true);
    startRound(state);
    expect(p.shop).toEqual(['wraithlord', null, null, null, null]);
    expect(p.shopLocked).toBe(false);
    startRound(state);
    expect(p.shop.filter(Boolean)).toHaveLength(5);
    expect(totalCopies(state)).toBe(POOL_TOTAL);
  });

  test('Scavenger loots from the kept shop: lock a lone 5-cost and get it next round', () => {
    const state = newGame();
    const p = you(state);
    p.board[0] = { uid: 700, defId: 'wisp', star: 1 };
    p.board[1] = { uid: 701, defId: 'penari', star: 1 };
    returnShop(state, p);
    p.shop = [null, null, 'titan', null, null];
    state.pool.titan--;
    applyAction(state, p.id, { type: 'toggleLock' });
    const mine = startRound(state).find((b) => b.playerId === p.id)!;
    expect(mine.looted).toBe('titan');
    expect(p.bench.some((u) => u?.defId === 'titan')).toBe(true);
    expect(p.shop.every((id) => id === null)).toBe(true);
  });

  test('reroll still works while locked, and the lock stays', () => {
    const state = newGame();
    const p = you(state);
    p.gold = 10;
    applyAction(state, p.id, { type: 'toggleLock' });
    expect(applyAction(state, p.id, { type: 'reroll' }).ok).toBe(true);
    expect(p.shopLocked).toBe(true);
  });
});

describe('formation', () => {
  test('more melee than a row holds: the rest go to the next row, every cell different', () => {
    const ids = ['hazeguard', 'thunderhawk', 'zodiacblade', 'dalang', 'pyromancer', 'wraithlord', 'footman', 'knight', 'archer'];
    const cells = formation(ids);
    expect(new Set(cells).size).toBe(ids.length);
    expect(cells.every((c) => c >= 0 && c < BOARD_COLS * BOARD_ROWS)).toBe(true);
    // 8 melee: 7 on the front row, 1 on the middle row; the archer on the back row.
    const row = (c: number) => Math.floor(c / BOARD_COLS);
    expect(cells.slice(0, 8).filter((c) => row(c) === 0)).toHaveLength(7);
    expect(row(cells[8])).toBe(BOARD_ROWS - 1);
  });
});
