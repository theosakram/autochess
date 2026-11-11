import { Container, Graphics } from 'pixi.js';
import type { Placer } from './actor';
import { lerp3, vec3, type Vec3 } from './camera';
import { FORESHORTENING, WORLD, type StageLayout } from './layout';
import type { TokenView } from './token';
import type { Tweens } from './tween';

// A fight's flying and circling effects, in world space: each projects itself every frame, so it shrinks with
// depth and arcs through the air like the pieces do.

export interface FxContext {
  L: StageLayout;
  tweens: Tweens;
  place: Placer;
  air: Container; // above the pieces
  floor: Container; // on the board, under the pieces (shadows)
}

// How a flight bends: its peak height per cell travelled, and at most; and optionally how far it swings out
// sideways at the midpoint (cells, + to the right of its heading), for volleys that fan out and curve in.
export interface Arc {
  perCell: number;
  max: number;
  swerve?: number;
}
const LOB: Arc = { perCell: 0.22, max: 1.2 }; // skill orbs, lobbed
const ARROW_ARC: Arc = { perCell: 0.08, max: 0.4 }; // arrows fly nearly flat
const BOLT_ARC: Arc = { perCell: 0.12, max: 0.6 };
const SHADOW_ALPHA = 0.3;

// One sprite of a flying thing: the head (lag 0), or a trail mark that far behind it (a share of the flight).
export interface Part {
  sprite: Container;
  lag: number;
}

// Flies `parts` from `from` to `to` (world points) over `ms` along an arc, a shadow of `shadowRadius` cells sliding
// on the floor under the head. With `orient`, the head turns to point where it's going. `onLand` runs on arrival.
export function flight(fx: FxContext, parts: Part[], from: Vec3, to: Vec3, ms: number, arc: Arc, shadowRadius: number, orient: boolean, onLand?: () => void): void {
  const [dx, dz] = [to.x - from.x, to.z - from.z];
  const length = Math.hypot(dx, dz);
  const peak = Math.min(arc.max, length * arc.perCell);
  // Sideways: perpendicular to the heading on the floor (right of it for a positive swerve).
  const [sx, sz] = length && arc.swerve ? [(-dz / length) * arc.swerve, (dx / length) * arc.swerve] : [0, 0];
  const ground = (k: number) => {
    const p = lerp3(from, to, k);
    const out = Math.sin(Math.PI * k);
    return vec3(p.x + sx * out, p.y, p.z + sz * out);
  };
  const path = (k: number) => {
    const p = ground(k);
    return vec3(p.x, p.y + Math.sin(Math.PI * k) * peak, p.z);
  };
  const r = fx.L.unit * shadowRadius;
  const shadow = new Graphics().ellipse(0, 0, r, r * FORESHORTENING.floor).fill({ color: 0x000000, alpha: SHADOW_ALPHA });
  fx.floor.addChild(shadow);
  for (const { sprite } of parts) fx.air.addChild(sprite);
  const step = (k: number) => {
    if (shadow.destroyed) return;
    for (const { sprite, lag } of parts) fx.place(sprite, path(Math.max(0, k - lag)));
    if (orient) {
      const [a, b] = [fx.L.project(path(Math.max(0, k - 0.02))), fx.L.project(path(Math.min(1, k + 0.02)))];
      parts[0].sprite.rotation = Math.atan2(b.y - a.y, b.x - a.x);
    }
    const under = ground(k);
    fx.place(shadow, vec3(under.x, WORLD.tileTop, under.z));
  };
  step(0);
  fx.tweens.add(ms, step, () => {
    for (const { sprite } of parts) if (!sprite.destroyed) sprite.destroy();
    if (!shadow.destroyed) shadow.destroy();
    onLand?.();
  });
}

const ORB_SIZE = 0.12; // radius, in cells

// A skill's orb from `from` to `to` (world points at shield height), lobbed over, its shadow sliding along the floor.
export function flyOrb(fx: FxContext, from: Vec3, to: Vec3, color: number, ms: number): void {
  const orb = new Graphics().circle(0, 0, fx.L.unit * ORB_SIZE).fill(color).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
  flight(fx, [{ sprite: orb, lag: 0 }], from, to, ms, LOB, ORB_SIZE, false);
}

// A basic attack's shot: how long it flies (quick, a little longer for far targets).
const SHOT_MS_PER_CELL = 70;
const SHOT_MS = { min: 140, max: 360 };
export const shotMs = (from: Vec3, to: Vec3) =>
  Math.min(SHOT_MS.max, Math.max(SHOT_MS.min, Math.hypot(to.x - from.x, to.z - from.z) * SHOT_MS_PER_CELL));

// An arrow pointing along +x: a shaft ending in a head at (0, 0), sizes in cells.
function arrow(unit: number, color: number): Graphics {
  const [length, width, head] = [unit * 0.34, Math.max(2, unit * 0.03), unit * 0.08];
  return new Graphics()
    .moveTo(-length, 0)
    .lineTo(-head, 0)
    .stroke({ width, color, cap: 'round' })
    .poly([0, 0, -head * 1.4, -head * 0.6, -head * 1.4, head * 0.6])
    .fill(color)
    .moveTo(-length, 0)
    .lineTo(-length + head, -head * 0.5)
    .moveTo(-length, 0)
    .lineTo(-length + head, head * 0.5)
    .stroke({ width: width * 0.8, color: 0xffffff, alpha: 0.7 });
}

// A magic bolt: a white-hot core in a glow of its colour, and fading marks trailing it.
const BOLT_TRAIL = [
  { lag: 0.07, alpha: 0.5, size: 0.75 },
  { lag: 0.14, alpha: 0.3, size: 0.55 },
  { lag: 0.21, alpha: 0.15, size: 0.4 },
];
function bolt(unit: number, color: number): Part[] {
  const r = unit * 0.09;
  const head = new Graphics().circle(0, 0, r * 1.8).fill({ color, alpha: 0.35 }).circle(0, 0, r).fill(0xffffff).stroke({ width: 2, color });
  const trail = BOLT_TRAIL.map(({ lag, alpha, size }) => ({ sprite: new Graphics().circle(0, 0, r * size * 1.4).fill({ color, alpha }), lag }));
  return [{ sprite: head, lag: 0 }, ...trail];
}

export type ShotLook = 'arrow' | 'bolt';

// A ranged unit's basic attack in flight, `from` its shield to `to` its target's; bursts on arrival, then `onLand`.
export function fireShot(fx: FxContext, look: ShotLook, from: Vec3, to: Vec3, color: number, onLand: () => void): void {
  const parts = look === 'arrow' ? [{ sprite: arrow(fx.L.unit, color) as Container, lag: 0 }] : bolt(fx.L.unit, color);
  flight(fx, parts, from, to, shotMs(from, to), look === 'arrow' ? ARROW_ARC : BOLT_ARC, 0.07, look === 'arrow', () => {
    impact(fx, to, color);
    onLand();
  });
}

const IMPACT_MS = 200;

// A ring bursting out from where a shot hit, fading as it grows.
export function impact(fx: FxContext, at: Vec3, color: number): void {
  const r = fx.L.unit * 0.16;
  const ring = new Graphics().circle(0, 0, r).stroke({ width: 3, color });
  fx.place(ring, at);
  const base = ring.scale.x;
  fx.air.addChild(ring);
  fx.tweens.add(
    IMPACT_MS,
    (k) => {
      if (ring.destroyed) return;
      ring.scale.set(base * (0.6 + k * 1.2));
      ring.alpha = 1 - k;
    },
    () => ring.destroyed || ring.destroy(),
  );
}

// Slash looks for projectile effects (instead of a flying orb): the half-moon's size in board cells and how far
// it sweeps (radians) as it fades.
export const SLASHES: Record<string, { radius: number; sweep: number }> = {
  kerisslash: { radius: 1.7, sweep: 0.9 },
  kerisslashall: { radius: 7, sweep: 0.7 },
};

// A half-moon facing +x: its outer edge an arc of `radius`, thickest (`thickness`) in the middle and sharp at the tips.
function crescent(radius: number, thickness: number, color: number, alpha: number): Graphics {
  const spread = Math.PI * 0.42;
  const steps = 24;
  const points: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = -spread + (2 * spread * i) / steps;
    points.push(Math.cos(t) * radius, Math.sin(t) * radius);
  }
  for (let i = steps; i >= 0; i--) {
    const t = -spread + (2 * spread * i) / steps;
    const r = radius - thickness * Math.cos((t / spread) * (Math.PI / 2));
    points.push(Math.cos(t) * r, Math.sin(t) * r);
  }
  return new Graphics().poly(points).fill({ color, alpha });
}

// A slash: a half-moon lying on the floor at `to`, facing away from `from`, that sweeps across and fades.
export function sweepSlash(fx: FxContext, from: Vec3, to: Vec3, look: { radius: number; sweep: number }, color: number, ms: number): void {
  const radius = fx.L.unit * look.radius;
  const moon = new Container();
  moon.addChild(crescent(radius, radius * 0.32, color, 0.85), crescent(radius * 0.97, radius * 0.12, 0xffffff, 0.9));
  // Pivot on the blade itself (its thick middle), so the blade sits over the struck area.
  moon.pivot.set(radius * 0.85, 0);
  // Laid flat: the moon turns in floor space, and its holder squashes that floor the way the camera does.
  const flat = new Container();
  flat.addChild(moon);
  fx.place(flat, to);
  flat.scale.y *= FORESHORTENING.floor;
  fx.air.addChild(flat);
  const angle = Math.atan2(to.z - from.z, to.x - from.x); // screen y runs with world z
  fx.tweens.add(
    ms,
    (k) => {
      if (flat.destroyed) return;
      const ease = 1 - (1 - k) ** 3;
      moon.rotation = angle - look.sweep / 2 + look.sweep * ease;
      moon.scale.set(0.75 + 0.35 * ease);
      flat.alpha = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
    },
    () => flat.destroyed || flat.destroy({ children: true }),
  );
}

const ORBIT_RADIUS = 0.62; // in cells
const ORBIT_ORB = 0.07;
const ORBIT_FAR_ALPHA = 0.55; // orbs on the far side of the circle are dimmer, so the ring reads as round

// `count` orbs circling a piece's shield flat (a ring around it, not a wheel), `turns` times over `ms`.
export function orbit(fx: FxContext, owner: TokenView, count: number, color: number, ms: number, turns: number): void {
  const { L } = fx;
  const ring = new Container();
  const r = L.unit * ORBIT_RADIUS;
  for (let j = 0; j < count; j++) ring.addChild(new Graphics().circle(0, 0, L.unit * ORBIT_ORB).fill(color).stroke({ width: 1, color: 0xffffff, alpha: 0.6 }));
  // Above the pieces so neighbours don't cover it; it follows the shield (and its depth) each frame.
  fx.air.addChild(ring);
  const step = (k: number) => {
    if (ring.destroyed) return;
    ring.position.copyFrom(owner.body.getGlobalPosition());
    ring.scale.copyFrom(owner.root.scale);
    ring.visible = owner.root.alpha > 0.05;
    ring.children.forEach((orb, j) => {
      const a = k * Math.PI * 2 * turns + (j / count) * Math.PI * 2;
      orb.position.set(Math.cos(a) * r, Math.sin(a) * r * FORESHORTENING.floor);
      orb.alpha = Math.sin(a) < 0 ? ORBIT_FAR_ALPHA : 1;
    });
    ring.alpha = k > 0.9 ? (1 - k) * 10 : 1;
  };
  step(0);
  fx.tweens.add(ms, step, () => ring.destroyed || ring.destroy({ children: true }));
}
