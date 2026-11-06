import { GRID_H, GRID_W, type Point } from '../grid';
import type { SkillApi, SkillFighter } from './types';

// The 3x1 row centered on a cell: it and the cells directly left and right (on the board).
export function row3(center: Point): Point[] {
  return [-1, 0, 1].map((dx) => ({ x: center.x + dx, y: center.y })).filter((p) => p.x >= 0 && p.x < GRID_W);
}

// Enemies of `f` standing on any of `cells`.
export function enemiesOn(api: SkillApi, f: SkillFighter, cells: Point[]): SkillFighter[] {
  return cells.flatMap((c) => {
    const there = api.occupant(c);
    return there && there.side !== f.side ? [there] : [];
  });
}

// The cells crossed going from `from` to `to` one 8-way step at a time (diagonal while both differ),
// `to` included, `from` not.
export function pathTo(from: Point, to: Point): Point[] {
  const cells: Point[] = [];
  let { x, y } = from;
  while (x !== to.x || y !== to.y) {
    x += Math.sign(to.x - x);
    y += Math.sign(to.y - y);
    cells.push({ x, y });
  }
  return cells;
}

// The cells of a straight line from `from` through `to` (at any angle) on to the board's edge: one
// per step along the longer axis, `from` not included, `to` always on it. `from` and `to` must differ.
export function lineThrough(from: Point, to: Point): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(Math.abs(dx), Math.abs(dy));
  const cells: Point[] = [];
  for (let i = 1; ; i++) {
    const p = { x: from.x + Math.round((dx * i) / len), y: from.y + Math.round((dy * i) / len) };
    if (p.x < 0 || p.y < 0 || p.x >= GRID_W || p.y >= GRID_H) return cells;
    cells.push(p);
  }
}

// The cell `n` steps past `to`, carrying on the line from `from` through it (stopped at the board's edge).
export function beyond(from: Point, to: Point, n: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));
  return { x: clamp(to.x + Math.round((dx / len) * n), GRID_W), y: clamp(to.y + Math.round((dy / len) * n), GRID_H) };
}

// The (up to) 8 cells touching `center`, on the board.
export function around(center: Point): Point[] {
  const cells: Point[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const p = { x: center.x + dx, y: center.y + dy };
      if ((dx || dy) && p.x >= 0 && p.y >= 0 && p.x < GRID_W && p.y < GRID_H) cells.push(p);
    }
  }
  return cells;
}

// Every on-board cell within `r` steps (Chebyshev) of `center`, not counting `center` itself.
export function within(center: Point, r: number): Point[] {
  const cells: Point[] = [];
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const p = { x: center.x + dx, y: center.y + dy };
      if ((dx || dy) && p.x >= 0 && p.y >= 0 && p.x < GRID_W && p.y < GRID_H) cells.push(p);
    }
  }
  return cells;
}

// The 3x3 directly in front of `f`, toward the enemy side: its near edge is the row right ahead of it.
export function ahead3x3(f: Point & { side: 0 | 1 }): Point[] {
  const forward = f.side === 0 ? -1 : 1;
  const cells: Point[] = [];
  for (let depth = 1; depth <= 3; depth++) {
    for (let dx = -1; dx <= 1; dx++) {
      const p = { x: f.x + dx, y: f.y + forward * depth };
      if (p.x >= 0 && p.y >= 0 && p.x < GRID_W && p.y < GRID_H) cells.push(p);
    }
  }
  return cells;
}

// A strip `width` cells wide from `f` toward `toward`, to the board's edge: along whichever axis it's
// mostly off by (vertical on a tie), centred on `f`'s row or column, starting with the cell next to it.
export function facingStrip(f: Point, toward: Point, width = 3): Point[] {
  const dx = toward.x - f.x;
  const dy = toward.y - f.y;
  const vertical = Math.abs(dy) >= Math.abs(dx);
  const step = vertical ? Math.sign(dy) || -1 : Math.sign(dx);
  const half = Math.floor(width / 2);
  const cells: Point[] = [];
  for (let d = 1; ; d++) {
    const along = vertical ? f.y + step * d : f.x + step * d;
    if (along < 0 || along >= (vertical ? GRID_H : GRID_W)) break;
    for (let o = -half; o <= half; o++) {
      const p = vertical ? { x: f.x + o, y: along } : { x: along, y: f.y + o };
      if (p.x >= 0 && p.y >= 0 && p.x < GRID_W && p.y < GRID_H) cells.push(p);
    }
  }
  return cells;
}

// A strip `width` cells wide (centred on `f`'s column) from the row right ahead of it to the far edge.
export function aheadStrip(f: Point & { side: 0 | 1 }, width = 3): Point[] {
  const forward = f.side === 0 ? -1 : 1;
  const half = Math.floor(width / 2);
  const cells: Point[] = [];
  for (let y = f.y + forward; y >= 0 && y < GRID_H; y += forward) {
    for (let dx = -half; dx <= half; dx++) {
      const x = f.x + dx;
      if (x >= 0 && x < GRID_W) cells.push({ x, y });
    }
  }
  return cells;
}
