import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS } from '../../game/config';
import { GRID_H, GRID_W, type Point } from '../../game/grid';
import type { Loc } from '../../game/types';
import { Camera, vec3, type CameraSpec, type Projected, type Vec3 } from './camera';

// Geometry of the stage, in world units (one board cell = 1; see camera.ts for the axes). The 7x6 combat grid is
// centred on the origin, enemy half at the back (-z), yours at the front; the bench is a row of pads in front of it.
export const WORLD = {
  tileGap: 0.08, // between neighbouring tiles
  tileTop: 0.05, // tiles are slabs this thick, sunk in the board's well
  rim: 0.35, // the frame around the grid
  rimTop: 0.12,
  wallBottom: -0.55, // the board's front wall drops this far
  post: { half: 0.17, height: 0.32 }, // the rim's corner posts, centred on the rim
  bench: {
    z: GRID_H / 2 + 1.25, // the pads' centre line
    pitch: 0.98, // pad to pad
    padRadius: 0.42,
    padTop: 0.06,
    trayTop: -0.1, // the pads stand on a tray lower than the board
    trayBottom: -0.45,
    trayBack: 0.62, // tray edges, from the pads' centre line
    trayFront: 0.7,
    trayMargin: 0.25, // past the outer pads
  },
  // A piece (see token.ts): a plinth on the cell, its hero's shield floating above. The shield and what's on it are
  // billboards (screen-flat, in cells at the piece's depth); only bodyY is a world height.
  piece: {
    bodyY: 0.85, // the shield's centre above the floor
    shieldW: 0.6,
    shieldH: 0.66,
    topRoom: 0.2, // over the shield: hp and mana bars, badges
    bob: 0.035, // idle float, up and down
  },
};

// The one fixed view, for prep and fights alike.
export const CAMERA: CameraSpec = { pitch: (62 * Math.PI) / 180, distance: 45, target: vec3(0, 0, 0.9) };

// How the camera squashes things on a cell: a floor circle's height per unit of width, and how tall a unit of world
// height looks. Pieces are drawn flat (billboards) and use these to sit right on the board under them.
export const FORESHORTENING = { floor: Math.sin(CAMERA.pitch), up: Math.cos(CAMERA.pitch) };

// How high a piece reaches, as a world height: the stage leaves room for it above the back row.
const { piece } = WORLD;
export const PIECE_HEADROOM = piece.bodyY + piece.bob + (piece.shieldH / 2 + piece.topRoom) / FORESHORTENING.up;

export interface StageLayout {
  width: number;
  height: number;
  unit: number; // screen pixels per world unit where the camera looks: the reference size for pieces and effects
  project(p: Vec3): Projected;
  cellWorld(p: Point, y?: number): Vec3; // a grid cell's centre, at height y
  benchWorld(index: number, y?: number): Vec3;
  gridCenter(p: Point): Projected; // on screen, on the tile's top
  benchCenter(index: number): Projected; // on screen, on the pad's top
  // Your board cell or bench slot under a screen point, or null.
  locAt(x: number, y: number): Loc | null;
  // The point on the board's floor under a screen point (where a dragged piece would stand), or null.
  floorAt(x: number, y: number): Vec3 | null;
}

export const cellWorld = (p: Point, y: number = WORLD.tileTop): Vec3 => vec3(p.x - GRID_W / 2 + 0.5, y, p.y - GRID_H / 2 + 0.5);
export const benchWorld = (index: number, y: number = WORLD.bench.padTop): Vec3 =>
  vec3((index - (BENCH_SIZE - 1) / 2) * WORLD.bench.pitch, y, WORLD.bench.z);

// The world box corners the stage must show: the back posts, tall pieces over the back row, the front wall, the
// bench tray.
function extremes(): Vec3[] {
  const halfW = GRID_W / 2 + WORLD.rim;
  const front = GRID_H / 2 + WORLD.rim;
  const b = WORLD.bench;
  const trayHalf = benchWorld(BENCH_SIZE - 1).x + b.padRadius + b.trayMargin;
  return [-1, 1].flatMap((side) => [
    vec3(side * halfW, WORLD.rimTop + WORLD.post.height, -GRID_H / 2 - WORLD.rim),
    vec3(side * (GRID_W / 2 - 0.5), PIECE_HEADROOM, -GRID_H / 2 + 0.5),
    vec3(side * halfW, WORLD.wallBottom, front),
    vec3(side * trayHalf, b.trayBottom, b.z + b.trayFront),
  ]);
}

// Height is proportional to width (the camera only zooms), so one sample gives the ratio.
export function stageWidthForHeight(height: number): number {
  return height / stageLayout(1).height;
}

export function stageLayout(width: number): StageLayout {
  const { camera, height } = new Camera(CAMERA).framed(extremes(), width);
  const project = (p: Vec3) => camera.project(p);
  const b = WORLD.bench;

  const boardLoc = (x: number, y: number): Loc | null => {
    const hit = camera.pick(x, y, WORLD.tileTop);
    if (!hit) return null;
    const col = Math.floor(hit.x + GRID_W / 2);
    const row = Math.floor(hit.z + GRID_H / 2);
    if (col < 0 || col >= GRID_W || row < 0 || row >= GRID_H) return null;
    // Only your half (the front BOARD_ROWS rows) takes units; row 0 of it is the front line.
    return row >= BOARD_ROWS ? { area: 'board', index: (row - BOARD_ROWS) * BOARD_COLS + col } : null;
  };
  const benchLoc = (x: number, y: number): Loc | null => {
    const hit = camera.pick(x, y, b.padTop);
    if (!hit || Math.abs(hit.z - b.z) > b.pitch / 2) return null;
    const index = Math.round(hit.x / b.pitch + (BENCH_SIZE - 1) / 2);
    return index >= 0 && index < BENCH_SIZE ? { area: 'bench', index } : null;
  };

  return {
    width,
    height,
    unit: project(CAMERA.target).scale,
    project,
    cellWorld,
    benchWorld,
    gridCenter: (p) => project(cellWorld(p)),
    benchCenter: (i) => project(benchWorld(i)),
    locAt: (x, y) => (x < 0 || x > width || y < 0 || y > height ? null : (boardLoc(x, y) ?? benchLoc(x, y))),
    floorAt: (x, y) => camera.pick(x, y, WORLD.tileTop),
  };
}
