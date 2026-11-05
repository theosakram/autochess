import { describe, expect, test } from 'bun:test';
import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS } from '../../game/config';
import { boardToGrid } from '../../game/grid';
import { stageLayout } from './layout';

describe('stage layout', () => {
  const L = stageLayout(660);

  test('every cell centre maps back to the same cell', () => {
    for (let index = 0; index < BOARD_COLS * BOARD_ROWS; index++) {
      const c = L.gridCenter(boardToGrid(0, index));
      expect(L.locAt(c.x, c.y)).toEqual({ area: 'board', index });
    }
    for (let index = 0; index < BENCH_SIZE; index++) {
      const c = L.benchCenter(index);
      expect(L.locAt(c.x, c.y)).toEqual({ area: 'bench', index });
    }
  });

  test('the enemy half, the gap between panels and outside the stage take nothing', () => {
    const enemy = L.gridCenter({ x: 3, y: 0 });
    expect(L.locAt(enemy.x, enemy.y)).toBeNull();
    expect(L.locAt(L.width / 2, L.boardHeight + 2)).toBeNull();
    expect(L.locAt(-5, 50)).toBeNull();
    expect(L.locAt(L.width / 2, L.height + 5)).toBeNull();
  });

  test('your front row sits right under the middle line', () => {
    expect(L.locAt(L.gridCenter({ x: 0, y: BOARD_ROWS }).x, L.gridCenter({ x: 0, y: BOARD_ROWS }).y)).toEqual({ area: 'board', index: 0 });
  });
});
