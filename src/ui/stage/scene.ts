import { FillGradient, Graphics } from 'pixi.js';
import { BENCH_SIZE } from '../../game/config';
import { GRID_H, GRID_W, type Point } from '../../game/grid';
import { vec3, type Vec3 } from './camera';
import { WORLD, type StageLayout } from './layout';
import { SCENE_COLORS } from './theme';

// The board's 3D-looking body, drawn from world geometry: the shapes (screen polygons for Graphics.poly) and the
// static base under the tiles. What's interactive or changes per view (tile colours, outlines) is the stage's.

// Screen polygon of world points, flat [x0, y0, x1, y1, ...].
export function shape(L: StageLayout, points: Vec3[]): number[] {
  return points.flatMap((p) => {
    const s = L.project(p);
    return [s.x, s.y];
  });
}

// A horizontal rectangle at height y.
export const floorRect = (L: StageLayout, x0: number, z0: number, x1: number, z1: number, y: number) =>
  shape(L, [vec3(x0, y, z0), vec3(x1, y, z0), vec3(x1, y, z1), vec3(x0, y, z1)]);

// A vertical face toward the viewer, at depth z.
const frontFace = (L: StageLayout, x0: number, x1: number, z: number, top: number, bottom: number) =>
  shape(L, [vec3(x0, top, z), vec3(x1, top, z), vec3(x1, bottom, z), vec3(x0, bottom, z)]);

// A grid cell's tile top, `inset` in from the cell edge on every side (the tile gap by default).
export function tileTop(L: StageLayout, p: Point, inset = WORLD.tileGap / 2): number[] {
  const c = L.cellWorld(p);
  const h = 0.5 - inset;
  return floorRect(L, c.x - h, c.z - h, c.x + h, c.z + h, c.y);
}

function octagon(center: Vec3, radius: number): Vec3[] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    return vec3(center.x + Math.cos(a) * radius, center.y, center.z + Math.sin(a) * radius);
  });
}

export const padTop = (L: StageLayout, index: number) => shape(L, octagon(L.benchWorld(index), WORLD.bench.padRadius));

// The pad's walls that face the viewer, down to the tray.
function padSides(L: StageLayout, index: number): number[][] {
  const top = octagon(L.benchWorld(index), WORLD.bench.padRadius);
  const center = L.benchWorld(index);
  const drop = (p: Vec3) => vec3(p.x, WORLD.bench.trayTop, p.z);
  return top.flatMap((a, i) => {
    const b = top[(i + 1) % top.length];
    return (a.z + b.z) / 2 > center.z ? [shape(L, [a, b, drop(b), drop(a)])] : [];
  });
}

// An upright box's faces that face the camera (which sits at x = 0, so only the side toward the middle shows),
// back to front: side, front, top.
function box(L: StageLayout, cx: number, cz: number, half: number, bottom: number, top: number): { side: number[] | null; front: number[]; top: number[] } {
  const [x0, x1, z0, z1] = [cx - half, cx + half, cz - half, cz + half];
  const sideX = x1 < 0 ? x1 : x0 > 0 ? x0 : null; // the face toward x = 0, if the box is off to one side
  return {
    side: sideX === null ? null : shape(L, [vec3(sideX, top, z0), vec3(sideX, top, z1), vec3(sideX, bottom, z1), vec3(sideX, bottom, z0)]),
    front: frontFace(L, x0, x1, z1, top, bottom),
    top: floorRect(L, x0, z0, x1, z1, top),
  };
}

// Light falling down a front face: brighter at its top edge.
const shaded = (top: number, bottom: number) =>
  new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: top },
      { offset: 1, color: bottom },
    ],
    textureSpace: 'local',
  });

// Behind everything: a pool of light around the board, fading into the page at the stage's edges (the vignette).
export function drawBackdrop(L: StageLayout): Graphics {
  const middle = L.project(vec3(0));
  const glow = new FillGradient({
    type: 'radial',
    center: { x: middle.x / L.width, y: middle.y / L.height },
    innerRadius: 0,
    outerCenter: { x: middle.x / L.width, y: middle.y / L.height },
    outerRadius: 0.62,
    colorStops: [
      { offset: 0, color: SCENE_COLORS.glow },
      { offset: 1, color: SCENE_COLORS.page },
    ],
    textureSpace: 'local',
  });
  return new Graphics().rect(0, 0, L.width, L.height).fill(glow);
}

// Everything under the tiles: the rim with its corner posts and front wall, the well, each tile's front edge, the
// bench tray and the pads' walls. Static per layout.
export function drawBase(L: StageLayout): Graphics {
  const g = new Graphics();
  const halfW = GRID_W / 2;
  const halfD = GRID_H / 2;
  const { rim, rimTop, wallBottom, tileTop: tile, tileGap, post } = WORLD;

  g.poly(frontFace(L, -halfW - rim, halfW + rim, halfD + rim, rimTop, wallBottom)).fill(shaded(SCENE_COLORS.wallTop, SCENE_COLORS.wall));
  g.poly(floorRect(L, -halfW - rim, -halfD - rim, halfW + rim, halfD + rim, rimTop)).fill(SCENE_COLORS.rimTop);
  g.poly(shape(L, [vec3(-halfW - rim, rimTop, halfD + rim), vec3(halfW + rim, rimTop, halfD + rim)]), false).stroke({
    width: 2,
    color: SCENE_COLORS.rimEdge,
  });
  // The well: the rim's inner front face, then its floor.
  g.poly(frontFace(L, -halfW, halfW, halfD, rimTop, 0)).fill(SCENE_COLORS.well);
  g.poly(floorRect(L, -halfW, -halfD, halfW, halfD, 0)).fill(SCENE_COLORS.well);
  // Tile thickness: only the front faces show.
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const c = L.cellWorld({ x, y });
      const h = 0.5 - tileGap / 2;
      g.poly(frontFace(L, c.x - h, c.x + h, c.z + h, tile, 0)).fill(SCENE_COLORS.tileSide);
    }
  }
  // A post on each corner of the rim, capped in the accent colour; back ones first so the front ones overlap them.
  const corner = { x: halfW + rim / 2, z: halfD + rim / 2 };
  for (const z of [-corner.z, corner.z]) {
    for (const x of [-corner.x, corner.x]) {
      const body = box(L, x, z, post.half, rimTop, rimTop + post.height);
      if (body.side) g.poly(body.side).fill(SCENE_COLORS.postSide);
      g.poly(body.front).fill(SCENE_COLORS.post);
      g.poly(body.top).fill(SCENE_COLORS.postCap);
    }
  }

  const b = WORLD.bench;
  const trayHalf = L.benchWorld(BENCH_SIZE - 1).x + b.padRadius + b.trayMargin;
  g.poly(frontFace(L, -trayHalf, trayHalf, b.z + b.trayFront, b.trayTop, b.trayBottom)).fill(shaded(SCENE_COLORS.trayTop, SCENE_COLORS.trayFront));
  g.poly(floorRect(L, -trayHalf, b.z - b.trayBack, trayHalf, b.z + b.trayFront, b.trayTop)).fill(SCENE_COLORS.trayTop);
  for (let i = 0; i < BENCH_SIZE; i++) for (const side of padSides(L, i)) g.poly(side).fill(SCENE_COLORS.padSide);

  return g;
}

// Over the tiles: a lit back edge on each (light from behind the board) and the line between the halves.
export function drawTileDetails(L: StageLayout): Graphics {
  const g = new Graphics();
  const y = WORLD.tileTop + 0.005;
  const h = 0.5 - WORLD.tileGap / 2;
  for (let row = 0; row < GRID_H; row++) {
    for (let col = 0; col < GRID_W; col++) {
      const c = L.cellWorld({ x: col, y: row });
      g.poly(shape(L, [vec3(c.x - h, y, c.z - h), vec3(c.x + h, y, c.z - h)]), false);
    }
  }
  g.stroke({ width: 1, color: SCENE_COLORS.tileLight, alpha: 0.12 });
  g.poly(shape(L, [vec3(-GRID_W / 2, y, 0), vec3(GRID_W / 2, y, 0)]), false).stroke({ width: 2, color: SCENE_COLORS.midline, alpha: 0.35 });
  return g;
}
