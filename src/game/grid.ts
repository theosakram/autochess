import { BOARD_COLS, BOARD_ROWS } from './config';

// Combat grid: both players' halves stacked. Home (side 0) is the bottom half;
// away (side 1) is rotated 180° so both front lines (row 0) meet in the middle.

export type Side = 0 | 1;

export interface Point {
  x: number;
  y: number;
}

export const GRID_W = BOARD_COLS;
export const GRID_H = BOARD_ROWS * 2;

export function boardToGrid(side: Side, cell: number): Point {
  const row = Math.floor(cell / BOARD_COLS);
  const col = cell % BOARD_COLS;
  return side === 0 ? { x: col, y: BOARD_ROWS + row } : { x: BOARD_COLS - 1 - col, y: BOARD_ROWS - 1 - row };
}

// Rotates the grid 180° when `flip` is set, so a viewer can always see their side at the bottom.
export function viewPoint(p: Point, flip: boolean): Point {
  return flip ? { x: GRID_W - 1 - p.x, y: GRID_H - 1 - p.y } : p;
}

export const gridIndex = (p: Point) => p.y * GRID_W + p.x;

export const dist = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Free cell (or `from` itself) farthest from every threat; ties go to the cell nearest `from`.
export function safestCell(occupied: Int16Array, from: Point, threats: Point[]): Point {
  let best = from;
  let bestScore = [-1, 0];
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    const p = { x: i % GRID_W, y: Math.floor(i / GRID_W) };
    if (occupied[i] !== -1 && i !== gridIndex(from)) continue;
    const safety = Math.min(...threats.map((t) => dist(p, t)));
    const score = [safety, -dist(p, from)];
    if (score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

// BFS over free cells (8-way) to the closest cell that puts `target` within `range`.
// `occupied` holds -1 for free cells. Returns the first step of that path, or null if boxed in.
export function stepToward(occupied: Int16Array, from: Point, target: Point, range: number): Point | null {
  const start = gridIndex(from);
  const prev = new Int16Array(GRID_W * GRID_H).fill(-1);
  prev[start] = start;
  const queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    const p = { x: cur % GRID_W, y: Math.floor(cur / GRID_W) };
    if (cur !== start && dist(p, target) <= range) {
      let c = cur;
      while (prev[c] !== start) c = prev[c];
      return { x: c % GRID_W, y: Math.floor(c / GRID_W) };
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
        const n = ny * GRID_W + nx;
        if (prev[n] !== -1 || occupied[n] !== -1) continue;
        prev[n] = cur;
        queue.push(n);
      }
    }
  }
  return null;
}
