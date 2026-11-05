import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS } from '../../game/config';
import { GRID_H, GRID_W, type Point } from '../../game/grid';
import type { Loc } from '../../game/types';

// Pure geometry of the stage: the 7x6 combat grid on top (enemy half above, yours below),
// the bench row under it. All in CSS pixels, relative to the canvas.

export const PAD = 8; // inside each panel
export const GAP = 4; // between cells
export const BENCH_GAP = 14; // between the board panel and the bench panel

export interface StageLayout {
  width: number;
  height: number;
  boardCell: number;
  benchCell: number;
  boardHeight: number; // board panel, padding included
  benchTop: number; // y of the bench panel
  gridCenter(p: Point): Point;
  benchCenter(index: number): Point;
  // Your board cell or bench slot under a point, or null.
  locAt(x: number, y: number): Loc | null;
}

export function stageLayout(width: number): StageLayout {
  const boardCell = (width - PAD * 2 - GAP * (GRID_W - 1)) / GRID_W;
  const benchCell = (width - PAD * 2 - GAP * (BENCH_SIZE - 1)) / BENCH_SIZE;
  const boardHeight = PAD * 2 + GRID_H * boardCell + (GRID_H - 1) * GAP;
  const benchTop = boardHeight + BENCH_GAP;
  const height = benchTop + PAD * 2 + benchCell;
  const slot = (i: number, size: number) => PAD + i * (size + GAP);

  return {
    width,
    height,
    boardCell,
    benchCell,
    boardHeight,
    benchTop,
    gridCenter: (p) => ({ x: slot(p.x, boardCell) + boardCell / 2, y: slot(p.y, boardCell) + boardCell / 2 }),
    benchCenter: (i) => ({ x: slot(i, benchCell) + benchCell / 2, y: benchTop + PAD + benchCell / 2 }),
    locAt(x, y) {
      if (x < PAD || x > width - PAD) return null;
      if (y >= PAD && y < boardHeight - PAD) {
        const col = Math.min(GRID_W - 1, Math.floor((x - PAD) / (boardCell + GAP)));
        const row = Math.min(GRID_H - 1, Math.floor((y - PAD) / (boardCell + GAP)));
        // Only your half (the lower BOARD_ROWS rows) takes units; row 0 of it is the front line.
        return row >= BOARD_ROWS ? { area: 'board', index: (row - BOARD_ROWS) * BOARD_COLS + col } : null;
      }
      if (y >= benchTop + PAD && y < height - PAD) {
        return { area: 'bench', index: Math.min(BENCH_SIZE - 1, Math.floor((x - PAD) / (benchCell + GAP))) };
      }
      return null;
    },
  };
}
