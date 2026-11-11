import { Graphics } from 'pixi.js';
import { lerp3, vec3, type Vec3 } from './camera';
import type { FxContext } from './fx';
import { WORLD } from './layout';
import { shape } from './scene';
import { EFFECT_COLORS } from './theme';
import { shieldPath, type TokenView } from './token';

// Looks of their own for particular skills, by effect id: what plays on the board when that skill dashes a piece
// or lands a hit, on top of the generic motion (the slide, the flash, the jolt). Give a skill a look by adding an
// entry; the stage looks it up and needs no change.

export interface Dash {
  from: Vec3; // floor points
  to: Vec3;
  ms: number; // how long the slide takes
}

export interface SkillLook {
  dash?(fx: FxContext, dash: Dash): void;
  hit?(fx: FxContext, target: TokenView): void;
}

// ---------- building blocks

const STREAK = { width: 0.32, core: 0.1, fadeMs: 320, alpha: 0.35 }; // in cells and ms

// A glowing band on the floor drawn along the path as the piece crosses it, then fading.
function floorStreak(fx: FxContext, { from, to, ms }: Dash, color: number): void {
  const [dx, dz] = [to.x - from.x, to.z - from.z];
  const length = Math.hypot(dx, dz);
  if (!length) return;
  const [px, pz] = [-dz / length, dx / length]; // across the path
  const y = WORLD.tileTop + 0.01;
  const band = (head: Vec3, width: number) =>
    shape(fx.L, [
      vec3(from.x + (px * width) / 2, y, from.z + (pz * width) / 2),
      vec3(head.x + (px * width) / 2, y, head.z + (pz * width) / 2),
      vec3(head.x - (px * width) / 2, y, head.z - (pz * width) / 2),
      vec3(from.x - (px * width) / 2, y, from.z - (pz * width) / 2),
    ]);
  const g = new Graphics();
  fx.floor.addChild(g);
  const total = ms + STREAK.fadeMs;
  fx.tweens.add(
    total,
    (k) => {
      if (g.destroyed) return;
      const t = k * total;
      const head = lerp3(from, to, Math.min(1, t / ms));
      g.clear().poly(band(head, STREAK.width)).fill({ color, alpha: STREAK.alpha }).poly(band(head, STREAK.core)).fill({ color: 0xffffff, alpha: 0.6 });
      g.alpha = t <= ms ? 1 : 1 - (t - ms) / STREAK.fadeMs;
    },
    () => g.destroyed || g.destroy(),
  );
}

// A flat shield silhouette, centred, sized like a piece's: for ghosts of a piece.
function ghostShield(fx: FxContext, color: number, alpha: number): Graphics {
  const { shieldW, shieldH } = WORLD.piece;
  const g = shieldPath(new Graphics(), shieldW * fx.L.unit, shieldH * fx.L.unit)
    .fill({ color, alpha })
    .stroke({ width: 2, color: 0xffffff, alpha: alpha * 0.8 });
  g.alpha = 0;
  return g;
}

const atShield = (p: Vec3) => vec3(p.x, WORLD.piece.bodyY, p.z);

const AFTERIMAGE = { count: 4, fadeMs: 260, alpha: 0.55 };

// Ghost shields left behind along the path, each appearing as the piece passes and fading after.
function afterimages(fx: FxContext, { from, to, ms }: Dash, color: number): void {
  const ghosts = Array.from({ length: AFTERIMAGE.count }, (_, i) => {
    const at = i / AFTERIMAGE.count; // share of the path (and of the slide's time)
    const g = ghostShield(fx, color, AFTERIMAGE.alpha);
    fx.place(g, atShield(lerp3(from, to, at)));
    fx.air.addChild(g);
    return { g, at };
  });
  const total = ms + AFTERIMAGE.fadeMs;
  fx.tweens.add(
    total,
    (k) => {
      const t = k * total;
      for (const { g, at } of ghosts) {
        if (g.destroyed) continue;
        const since = t - at * ms;
        g.alpha = since < 0 ? 0 : Math.max(0, 1 - since / AFTERIMAGE.fadeMs);
      }
    },
    () => ghosts.forEach(({ g }) => g.destroyed || g.destroy()),
  );
}

const CHASER = { delayMs: 90, fadeMs: 160, alpha: 0.7 };

// A dark copy of the piece retracing the path right behind it.
function chaser(fx: FxContext, { from, to, ms }: Dash, color: number): void {
  const g = ghostShield(fx, color, CHASER.alpha);
  fx.place(g, atShield(from));
  fx.air.addChild(g);
  const total = CHASER.delayMs + ms + CHASER.fadeMs;
  fx.tweens.add(
    total,
    (k) => {
      if (g.destroyed) return;
      const t = k * total - CHASER.delayMs;
      if (t < 0) return;
      fx.place(g, atShield(lerp3(from, to, Math.min(1, t / ms))));
      g.alpha = t <= ms ? 1 : 1 - (t - ms) / CHASER.fadeMs;
    },
    () => g.destroyed || g.destroy(),
  );
}

const CUT = { drawMs: 80, totalMs: 240, width: 3 };

// Two quick crossing slashes over a struck piece's shield.
function cross(fx: FxContext, target: TokenView, color: number): void {
  const half = (WORLD.piece.shieldW * fx.L.unit) / 2;
  const g = new Graphics();
  target.body.addChild(g);
  fx.tweens.add(
    CUT.totalMs,
    (k) => {
      if (g.destroyed) return;
      const t = k * CUT.totalMs;
      const drawn = Math.min(1, t / CUT.drawMs);
      const reach = -half + 2 * half * drawn;
      g.clear()
        .moveTo(-half, -half)
        .lineTo(reach, reach)
        .moveTo(half, -half)
        .lineTo(-reach, reach)
        .stroke({ width: CUT.width + 3, color, alpha: 0.6 })
        .moveTo(-half, -half)
        .lineTo(reach, reach)
        .moveTo(half, -half)
        .lineTo(-reach, reach)
        .stroke({ width: CUT.width, color: 0xffffff });
      g.alpha = t <= CUT.drawMs ? 1 : 1 - (t - CUT.drawMs) / (CUT.totalMs - CUT.drawMs);
    },
    () => g.destroyed || g.destroy(),
  );
}

// ---------- the looks

// Lance's Phantom Execution: a violet streak on the floor, afterimages along it, a cross on everyone he cuts through.
// Once his Phantom passive is on, a dark Phantom chases each dash.
const EXECUTION = EFFECT_COLORS.phantomexecution;
const PHANTOM = EFFECT_COLORS.phantom;

export const SKILL_LOOKS: Record<string, SkillLook> = {
  phantomexecution: {
    dash(fx, d) {
      floorStreak(fx, d, EXECUTION);
      afterimages(fx, d, EXECUTION);
    },
    hit: (fx, target) => cross(fx, target, EXECUTION),
  },
  phantom: {
    dash(fx, d) {
      floorStreak(fx, d, PHANTOM);
      afterimages(fx, d, EXECUTION);
      chaser(fx, d, PHANTOM);
    },
    hit: (fx, target) => cross(fx, target, PHANTOM),
  },
};
