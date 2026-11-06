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
