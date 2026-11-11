import { Graphics } from 'pixi.js';
import { lerp3, vec3, type Vec3 } from './camera';
import { flight, impact, type FxContext, type Part } from './fx';
import { WORLD } from './layout';
import { EFFECT_COLORS, mix } from './theme';
import { shieldPath, type TokenView } from './token';

// Looks of their own for particular skills, by effect id: what plays on the board when that skill dashes a piece,
// sends a hit flying or lands one, on top of the generic motion (the slide, the flash, the jolt). Give a skill a look
// by adding an entry; the stage looks it up and needs no change.

export interface Dash {
  from: Vec3; // floor points
  to: Vec3;
  ms: number; // how long the slide takes
}

export interface Volley {
  from: Vec3; // shield-height points: the source's and the target's
  to: Vec3;
  index: number; // which of the source's same-moment hits this is (0 for the first)
}

export interface SkillLook {
  dash?(fx: FxContext, dash: Dash): void;
  // The hit arrives as this projectile from its source; `land` plays the hit (flash, jolt, number) on arrival.
  shot?(fx: FxContext, volley: Volley, land: () => void): void;
  hit?(fx: FxContext, target: TokenView): void;
}

// ---------- building blocks

// A wisp of wind: its offset across the path and height (cells), and where its wave starts.
const WISPS = [
  { across: -0.24, y: 0.3, phase: 0 },
  { across: 0.06, y: 0.72, phase: 2.1 },
  { across: 0.26, y: 0.48, phase: 4.2 },
  { across: -0.06, y: 1.0, phase: 1.3 },
];
const WIND = { length: 0.55, wave: 0.08, waves: 2.5, steps: 16, fadeMs: 300, glow: 7, core: 2 };

// A gust along the path: wavy streaks of wind racing through with the piece, then blowing out past where it landed.
function windGust(fx: FxContext, { from, to, ms }: Dash, color: number): void {
  const [dx, dz] = [to.x - from.x, to.z - from.z];
  const length = Math.hypot(dx, dz);
  if (!length) return;
  const [px, pz] = [-dz / length, dx / length]; // across the path
  const at = (w: (typeof WISPS)[number], k: number) => {
    const side = w.across + Math.sin(k * Math.PI * 2 * WIND.waves + w.phase) * WIND.wave;
    return vec3(from.x + dx * k + px * side, w.y, from.z + dz * k + pz * side);
  };
  const core = mix(color, 0xffffff, 0.6);
  const g = new Graphics();
  fx.air.addChild(g);
  const total = ms + WIND.fadeMs;
  fx.tweens.add(
    total,
    (k) => {
      if (g.destroyed) return;
      const t = k * total;
      // The gust's front keeps going past the landing as its tail catches up, so it blows through and out.
      const head = t / ms;
      const tail = Math.min(1, Math.max(0, head - WIND.length));
      const front = Math.min(1 + WIND.length * 0.4, head);
      g.clear();
      if (front <= tail) return;
      for (const w of WISPS) {
        const points = Array.from({ length: WIND.steps + 1 }, (_, i) => fx.L.project(at(w, tail + ((front - tail) * i) / WIND.steps)));
        const line = () => points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        line();
        g.stroke({ width: WIND.glow, color, alpha: 0.28, cap: 'round', join: 'round' });
        line();
        g.stroke({ width: WIND.core, color: core, alpha: 0.9, cap: 'round', join: 'round' });
      }
      g.alpha = t <= ms ? 1 : 1 - (t - ms) / WIND.fadeMs;
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

const AFTERIMAGE = { count: 4, fadeMs: 260, alpha: 0.5 };

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
      const reach = -half + 2 * half * Math.min(1, t / CUT.drawMs);
      const strokes = () => g.moveTo(-half, -half).lineTo(reach, reach).moveTo(half, -half).lineTo(-reach, reach);
      g.clear();
      strokes().stroke({ width: CUT.width + 3, color, alpha: 0.6 });
      strokes().stroke({ width: CUT.width, color: 0xffffff });
      g.alpha = t <= CUT.drawMs ? 1 : 1 - (t - CUT.drawMs) / (CUT.totalMs - CUT.drawMs);
    },
    () => g.destroyed || g.destroy(),
  );
}

// Dusk's colours, from the last light to night: a bolt's core, then its trail.
const DUSK = { gold: 0xffd27a, rose: 0xff7ab8, violet: EFFECT_COLORS.chaosassault, night: 0x5b3cff };
const TWILIGHT_TRAIL = [
  { lag: 0.06, color: DUSK.gold, alpha: 0.7, size: 0.85 },
  { lag: 0.12, color: DUSK.rose, alpha: 0.55, size: 0.7 },
  { lag: 0.18, color: DUSK.violet, alpha: 0.4, size: 0.55 },
  { lag: 0.24, color: DUSK.night, alpha: 0.25, size: 0.45 },
];

// A twilight bolt: a gold-white core in rings of violet and night, trailing gold into rose into violet into dark.
function twilightBolt(unit: number): Part[] {
  const r = unit * 0.085;
  const head = new Graphics()
    .circle(0, 0, r * 2.6)
    .fill({ color: DUSK.night, alpha: 0.22 })
    .circle(0, 0, r * 1.8)
    .fill({ color: DUSK.violet, alpha: 0.4 })
    .circle(0, 0, r)
    .fill(0xfff2cc)
    .stroke({ width: 2, color: DUSK.gold });
  const trail = TWILIGHT_TRAIL.map(({ lag, color, alpha, size }) => ({ sprite: new Graphics().circle(0, 0, r * size * 1.6).fill({ color, alpha }), lag }));
  return [{ sprite: head, lag: 0 }, ...trail];
}

// A volley's bolts leave one after another and fan out (left, straight, right) to curve in on the target.
const TWILIGHT = { staggerMs: 110, swerves: [-0.55, 0, 0.55], arc: { perCell: 0.15, max: 0.8 }, msPerCell: 85, ms: { min: 200, max: 420 } };

function twilightShot(fx: FxContext, { from, to, index }: Volley, land: () => void): void {
  const cells = Math.hypot(to.x - from.x, to.z - from.z);
  const ms = Math.min(TWILIGHT.ms.max, Math.max(TWILIGHT.ms.min, cells * TWILIGHT.msPerCell));
  const arc = { ...TWILIGHT.arc, swerve: TWILIGHT.swerves[index % TWILIGHT.swerves.length] };
  const launch = () =>
    flight(fx, twilightBolt(fx.L.unit), from, to, ms, arc, 0.08, false, () => {
      impact(fx, to, DUSK.violet);
      impact(fx, to, DUSK.gold);
      land();
    });
  fx.tweens.add(index * TWILIGHT.staggerMs, () => {}, launch);
}

// ---------- the looks

// Lance's Phantom Execution: a blue-green gust through his dash, afterimages along it, a cross on everyone he cuts
// through. Once his Phantom passive is on, a deep-teal Phantom chases each dash.
const WINDBLADE = EFFECT_COLORS.phantomexecution;
const PHANTOM = EFFECT_COLORS.phantom;

export const SKILL_LOOKS: Record<string, SkillLook> = {
  phantomexecution: {
    dash(fx, d) {
      windGust(fx, d, WINDBLADE);
      afterimages(fx, d, WINDBLADE);
    },
    hit: (fx, target) => cross(fx, target, WINDBLADE),
  },
  phantom: {
    dash(fx, d) {
      windGust(fx, d, WINDBLADE);
      afterimages(fx, d, WINDBLADE);
      chaser(fx, d, PHANTOM);
    },
    hit: (fx, target) => cross(fx, target, PHANTOM),
  },
  // Lunox's Power of Chaos: each Chaos Assault flies as a twilight bolt.
  chaosassault: { shot: twilightShot },
};
