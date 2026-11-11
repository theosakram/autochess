import { describe, expect, test } from 'bun:test';
import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS } from '../../game/config';
import { boardToGrid, GRID_H } from '../../game/grid';
import { Camera, vec3 } from './camera';
import { CAMERA, PIECE_HEADROOM, stageLayout, stageWidthForHeight, WORLD } from './layout';

describe('camera', () => {
  const cam = new Camera(CAMERA, 500, { x: 300, y: 200 });

  test('the target lands on the offset', () => {
    const p = cam.project(CAMERA.target);
    expect(p.x).toBeCloseTo(300, 6);
    expect(p.y).toBeCloseTo(200, 6);
  });

  test('picking a projected point gives it back', () => {
    for (const w of [vec3(-3, 0, -2.5), vec3(2.2, 0, 1.4), vec3(0.5, 0.3, 4)]) {
      const s = cam.project(w);
      const hit = cam.pick(s.x, s.y, w.y)!;
      expect(hit.x).toBeCloseTo(w.x, 6);
      expect(hit.z).toBeCloseTo(w.z, 6);
    }
  });

  test('farther is smaller and higher on screen', () => {
    const [back, front] = [cam.project(vec3(0, 0, -3)), cam.project(vec3(0, 0, 3))];
    expect(back.scale).toBeLessThan(front.scale);
    expect(back.y).toBeLessThan(front.y);
  });

  test('framing fits the points to the width, top at 0', () => {
    const points = [vec3(-4, 0, -3), vec3(4, 0, 3), vec3(0, 1, -3)];
    const { camera, height } = cam.framed(points, 640);
    const ps = points.map((p) => camera.project(p));
    expect(Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x))).toBeCloseTo(640, 6);
    expect(Math.min(...ps.map((p) => p.y))).toBeCloseTo(0, 6);
    expect(Math.max(...ps.map((p) => p.y))).toBeCloseTo(height, 6);
  });
});

describe('stage layout', () => {
  const L = stageLayout(660);

  test('a stage sized for a height is exactly that tall', () => {
    for (const h of [480, 640, 900]) expect(stageLayout(stageWidthForHeight(h)).height).toBeCloseTo(h, 6);
  });

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

  test('the whole scene is on the stage', () => {
    for (const index of [0, BENCH_SIZE - 1]) {
      const c = L.benchCenter(index);
      expect(c.x).toBeGreaterThan(0);
      expect(c.x).toBeLessThan(L.width);
      expect(c.y).toBeLessThan(L.height);
    }
    expect(L.project(vec3(0, PIECE_HEADROOM, -GRID_H / 2 + 0.5)).y).toBeGreaterThanOrEqual(0);
  });

  test('the back row is drawn smaller than the front row', () => {
    expect(L.gridCenter({ x: 3, y: 0 }).scale).toBeLessThan(L.gridCenter({ x: 3, y: GRID_H - 1 }).scale);
  });

  test('the enemy half, the gap before the bench and outside the stage take nothing', () => {
    const enemy = L.gridCenter({ x: 3, y: 0 });
    expect(L.locAt(enemy.x, enemy.y)).toBeNull();
    const gap = L.project(vec3(0, WORLD.tileTop, GRID_H / 2 + WORLD.rim / 2)); // on the rim, in front of the grid
    expect(L.locAt(gap.x, gap.y)).toBeNull();
    expect(L.locAt(-5, 50)).toBeNull();
    expect(L.locAt(L.width / 2, L.height + 5)).toBeNull();
  });

  test('your front row sits right under the middle line', () => {
    const c = L.gridCenter({ x: 0, y: BOARD_ROWS });
    expect(L.locAt(c.x, c.y)).toEqual({ area: 'board', index: 0 });
  });
});
