import { Container, Graphics } from 'pixi.js';
import { lerp3, vec3, type Vec3 } from './camera';
import { crescent, flight, impact, type FxContext, type Part } from './fx';
import { FORESHORTENING, WORLD } from './layout';
import { STORM_PURSUIT } from '../../game/skills/stormPursuit';
import { COLORS, EFFECT_COLORS, mix } from './theme';
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
}

export interface SkillLook {
  cast?(fx: FxContext, caster: TokenView): void; // as the skill goes off
  projectile?(fx: FxContext, from: Vec3, to: Vec3, ms: number): void; // its showProjectile, between floor points
  dash?(fx: FxContext, dash: Dash): void;
  // The hit arrives as this projectile from its source; `land` plays the hit (flash, jolt, number) on arrival.
  shot?(fx: FxContext, volley: Volley, land: () => void): void;
  hit?(fx: FxContext, target: TokenView): void;
}

// ---------- building blocks

// A tunnel of wind around the dash: rings swelling open as the piece passes through them, and strands
// spiralling along the tunnel's wall, spinning, then all blowing out.
const TUNNEL = { radius: 0.42, rings: 5, ringSteps: 20, strands: 3, turns: 2.5, steps: 48, spin: 2.5, openMs: 120, fadeMs: 320, glow: 6, core: 2 };

function windTunnel(fx: FxContext, { from, to, ms }: Dash, color: number): void {
  const [dx, dz] = [to.x - from.x, to.z - from.z];
  const length = Math.hypot(dx, dz);
  if (!length) return;
  const [px, pz] = [-dz / length, dx / length]; // across the path
  const y = WORLD.piece.bodyY;
  // A point on the tunnel's wall: `k` along the path, `a` around it, `r` out from its axis.
  const wall = (k: number, a: number, r: number) =>
    fx.L.project(vec3(from.x + dx * k + px * Math.cos(a) * r, y + Math.sin(a) * r, from.z + dz * k + pz * Math.cos(a) * r));
  const core = mix(color, 0xffffff, 0.6);
  const g = new Graphics();
  fx.air.addChild(g);
  const total = ms + TUNNEL.fadeMs;
  fx.tweens.add(
    total,
    (k) => {
      if (g.destroyed) return;
      const t = k * total;
      const head = Math.min(1, t / ms);
      const spin = (t / 1000) * TUNNEL.spin * Math.PI * 2;
      const R = TUNNEL.radius;
      g.clear();
      const stroke = (points: { x: number; y: number }[], glow: number, alpha: number) => {
        const line = () => points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        line();
        g.stroke({ width: glow, color, alpha: alpha * 0.3, cap: 'round', join: 'round' });
        line();
        g.stroke({ width: TUNNEL.core, color: core, alpha, cap: 'round', join: 'round' });
      };
      for (let s = 0; s < TUNNEL.strands; s++) {
        const turn = (s / TUNNEL.strands) * Math.PI * 2 + spin;
        stroke(Array.from({ length: TUNNEL.steps + 1 }, (_, i) => {
          const along = (head * i) / TUNNEL.steps;
          return wall(along, along * TUNNEL.turns * Math.PI * 2 + turn, R);
        }), TUNNEL.glow, 0.9);
      }
      for (let r = 0; r < TUNNEL.rings; r++) {
        const along = (r + 0.5) / TUNNEL.rings;
        const open = Math.min(1, ((head - along) * ms) / TUNNEL.openMs + (t > ms ? 1 : 0));
        if (open <= 0) continue;
        stroke(Array.from({ length: TUNNEL.ringSteps + 1 }, (_, j) => wall(along, (j / TUNNEL.ringSteps) * Math.PI * 2, R * open)), TUNNEL.glow - 2, 0.55);
      }
      g.alpha = t <= ms ? 1 : 1 - (t - ms) / TUNNEL.fadeMs;
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

const TWILIGHT = { arc: { perCell: 0.15, max: 0.8 }, msPerCell: 85, ms: { min: 200, max: 420 } };

function twilightShot(fx: FxContext, { from, to }: Volley, land: () => void): void {
  const cells = Math.hypot(to.x - from.x, to.z - from.z);
  const ms = Math.min(TWILIGHT.ms.max, Math.max(TWILIGHT.ms.min, cells * TWILIGHT.msPerCell));
  flight(fx, twilightBolt(fx.L.unit), from, to, ms, TWILIGHT.arc, 0.08, false, () => {
    impact(fx, to, DUSK.violet);
    impact(fx, to, DUSK.gold);
    land();
  });
}

const MOONRISE = { ms: 700, radius: 0.42, rise: 0.35 }; // ms, cells

// A crescent moon rising over a piece: it swells in, glowing, drifts up and fades.
function moonrise(fx: FxContext, caster: TokenView, color: number): void {
  const r = fx.L.unit * MOONRISE.radius;
  const moon = new Container();
  moon.addChild(crescent(r * 1.25, r * 0.55, color, 0.3), crescent(r, r * 0.4, color, 0.95), crescent(r * 0.96, r * 0.14, 0xffffff, 0.85));
  moon.rotation = -Math.PI / 2 - 0.5; // horns up and to the right, a moon in the sky
  const top = -(WORLD.piece.shieldH * fx.L.unit) / 2;
  caster.body.addChild(moon);
  fx.tweens.add(
    MOONRISE.ms,
    (k) => {
      if (moon.destroyed) return;
      const ease = 1 - (1 - k) ** 3;
      moon.scale.set(0.4 + 0.6 * ease);
      moon.y = top - fx.L.unit * MOONRISE.rise * ease;
      moon.alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    },
    () => moon.destroyed || moon.destroy({ children: true }),
  );
}

// A throwing knife pointing along +x: a steel blade with a lightning-yellow edge, a guard and a dark grip.
function knife(unit: number, glow: number): Graphics {
  const [blade, grip, w] = [unit * 0.2, unit * 0.09, unit * 0.04];
  return new Graphics()
    .poly([blade, 0, 0, -w, 0, w])
    .fill({ color: glow, alpha: 0.35 })
    .poly([blade * 0.92, 0, 0, -w * 0.6, 0, w * 0.6])
    .fill(0xe8edf4)
    .stroke({ width: 1, color: glow })
    .rect(-w * 0.3, -w * 0.9, w * 0.3, w * 1.8)
    .fill(glow)
    .rect(-grip, -w * 0.35, grip, w * 0.7)
    .fill(0x3a2e24);
}

const KNIFE = { stuckY: 0.12, tilt: 1.15, fadeMs: 120 }; // cells, radians from flat (blade down), ms
const STORM = EFFECT_COLORS.stormpursuit;
const knifeArc = { perCell: 0.06, max: 0.35 };

// Gufron's throw: a knife flies out and sticks in the floor, blade down, until he pulls it back.
function throwKnife(fx: FxContext, from: Vec3, to: Vec3, ms: number): void {
  const stuckAt = vec3(to.x, WORLD.tileTop + KNIFE.stuckY, to.z);
  flight(fx, [{ sprite: knife(fx.L.unit, STORM), lag: 0 }], atShield(from), stuckAt, ms, knifeArc, 0.05, true, () => {
    const k = knife(fx.L.unit, STORM);
    // Leaning the way it flew, point in the floor.
    const [a, b] = [fx.L.project(from), fx.L.project(to)];
    k.rotation = b.x >= a.x ? KNIFE.tilt : Math.PI - KNIFE.tilt;
    fx.place(k, stuckAt);
    fx.air.addChild(k);
    impact(fx, vec3(to.x, WORLD.tileTop, to.z), STORM);
    const stuck = (STORM_PURSUIT.recall - STORM_PURSUIT.throw) * 1000;
    fx.tweens.add(
      stuck,
      (t) => {
        if (k.destroyed) return;
        const left = stuck * (1 - t);
        k.alpha = left < KNIFE.fadeMs ? left / KNIFE.fadeMs : 1;
      },
      () => k.destroyed || k.destroy(),
    );
  });
}

// ...and the pull: it tears out of the floor and streaks back to him, sparks trailing.
function recallKnife(fx: FxContext, from: Vec3, to: Vec3, ms: number): void {
  const spark = (alpha: number, lag: number) => ({ sprite: new Graphics().circle(0, 0, fx.L.unit * 0.03).fill({ color: STORM, alpha }), lag });
  flight(fx, [{ sprite: knife(fx.L.unit, STORM), lag: 0 }, spark(0.7, 0.06), spark(0.45, 0.12), spark(0.25, 0.18)], vec3(from.x, WORLD.tileTop + KNIFE.stuckY, from.z), atShield(to), ms, knifeArc, 0.05, true);
}

// A boomerang: a bent wooden blade (two arms meeting at an elbow), pale-mist edged.
function boomerang(unit: number, color: number): Graphics {
  const [arm, w] = [unit * 0.17, unit * 0.05];
  // Elbow at the origin, arms out to the lower left and lower right, each a tapered quad.
  const side = (dir: number) => [0, -w * 0.6, dir * arm, arm * 0.45, dir * arm * 0.85, arm * 0.62, 0, w * 0.7];
  return new Graphics()
    .poly(side(-1))
    .poly(side(1))
    .fill(0xb0805a)
    .stroke({ width: 1.5, color, alpha: 0.9 });
}

// Spins, and swings out to its right as it flies (out and back, it traces a loop), mist puffs trailing.
const BOOMERANG = { swerve: 0.9, spins: 4, puffs: 4, puffLag: 0.06 }; // cells, turns per flight

function boomerangFlight(fx: FxContext, from: Vec3, to: Vec3, ms: number): void {
  const color = EFFECT_COLORS.mistboomerang;
  const [a, b] = [atShield(from), atShield(to)];
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const length = Math.hypot(dx, dz) || 1;
  const [sx, sz] = [(-dz / length) * BOOMERANG.swerve, (dx / length) * BOOMERANG.swerve];
  const at = (k: number) => {
    const p = lerp3(a, b, k);
    const out = Math.sin(Math.PI * k);
    return vec3(p.x + sx * out, p.y, p.z + sz * out);
  };
  const head = boomerang(fx.L.unit, color);
  const puffs = Array.from({ length: BOOMERANG.puffs }, (_, i) => {
    const g = new Graphics().circle(0, 0, fx.L.unit * (0.07 - i * 0.012)).fill({ color, alpha: 0.4 - i * 0.08 });
    fx.air.addChild(g);
    return g;
  });
  fx.air.addChild(head);
  fx.tweens.add(
    ms,
    (k) => {
      if (head.destroyed) return;
      fx.place(head, at(k));
      head.rotation = k * BOOMERANG.spins * Math.PI * 2;
      puffs.forEach((g, i) => fx.place(g, at(Math.max(0, k - (i + 1) * BOOMERANG.puffLag))));
    },
    () => [head, ...puffs].forEach((g) => g.destroyed || g.destroy()),
  );
}

// A sharp shard pointing along +x: a long, thin, jagged crystal splinter, white-hot core in a glow of its colour.
function shard(unit: number, color: number): Graphics {
  const [l, w] = [unit * 0.2, unit * 0.04];
  return new Graphics()
    .poly([l * 1.15, 0, l * 0.1, -w * 1.6, -l * 0.55, -w * 0.4, -l * 0.35, w * 1.3])
    .fill({ color, alpha: 0.35 })
    .poly([l, 0, l * 0.15, -w, -l * 0.45, -w * 0.25, -l * 0.25, w * 0.8])
    .fill(mix(color, 0xffffff, 0.55))
    .stroke({ width: 1, color: 0xffffff, alpha: 0.9 })
    .moveTo(l * 0.9, 0)
    .lineTo(-l * 0.3, w * 0.1)
    .stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
}

// Amon's blades (knives, or 3★ shards): out at every enemy and to the edge, then curving round to home in on his
// target. Each swings out to one side as it flies, alternating, so a volley fans out both ways even when two
// share a path.
const BLADE_BEND = { out: 0.25, home: 0.8 }; // cells it swings out sideways
let bladeSide = 1;

function curvedBlade(fx: FxContext, sprite: Graphics, from: Vec3, to: Vec3, ms: number, bend: number, color: number): void {
  const [a, b] = [atShield(from), atShield(to)];
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const length = Math.hypot(dx, dz) || 1;
  const side = (bladeSide = -bladeSide) * bend;
  const at = (k: number) => {
    const p = lerp3(a, b, k);
    const out = Math.sin(Math.PI * k) * side;
    return vec3(p.x + (-dz / length) * out, p.y, p.z + (dx / length) * out);
  };
  const trail = [0.06, 0.12, 0.18].map((lag, i) => ({ lag, g: new Graphics().circle(0, 0, fx.L.unit * (0.035 - i * 0.008)).fill({ color, alpha: 0.6 - i * 0.18 }) }));
  for (const t of trail) fx.air.addChild(t.g);
  fx.air.addChild(sprite);
  fx.tweens.add(
    ms,
    (k) => {
      if (sprite.destroyed) return;
      fx.place(sprite, at(k));
      const [p, q] = [fx.L.project(at(Math.max(0, k - 0.02))), fx.L.project(at(Math.min(1, k + 0.02)))];
      sprite.rotation = Math.atan2(q.y - p.y, q.x - p.x);
      for (const t of trail) fx.place(t.g, at(Math.max(0, k - t.lag)));
    },
    () => {
      for (const g of [sprite, ...trail.map((t) => t.g)]) if (!g.destroyed) g.destroy();
      impact(fx, b, color);
    },
  );
}

const amonBlade = (make: (unit: number, color: number) => Graphics, bend: number, color: number) => (fx: FxContext, from: Vec3, to: Vec3, ms: number) =>
  curvedBlade(fx, make(fx.L.unit, color), from, to, ms, bend, color);

// Roro's Southern Tide: a wall of sea-green water rolling along the floor from her to the far edge, a curling
// crest of white foam on top, then breaking (sinking and fading).
const TIDE = { width: 3, height: 0.55, depth: 0.5, steps: 16, breakMs: 260 }; // cells, ms

function tidalWave(fx: FxContext, from: Vec3, to: Vec3, ms: number): void {
  const color = EFFECT_COLORS.southerntide;
  const [dx, dz] = [to.x - from.x, to.z - from.z];
  const length = Math.hypot(dx, dz);
  if (!length) return;
  const [ux, uz] = [dx / length, dz / length]; // along
  const [px, pz] = [-uz, ux]; // across
  const half = TIDE.width / 2;
  const floor = WORLD.tileTop + 0.01;
  const g = new Graphics();
  fx.air.addChild(g);
  const total = ms + TIDE.breakMs;
  fx.tweens.add(
    total,
    (k) => {
      if (g.destroyed) return;
      const t = k * total;
      const along = Math.min(1, t / ms) * length;
      const sink = t <= ms ? 1 : 1 - (t - ms) / TIDE.breakMs; // the crest drops as it breaks
      const at = (o: number, back: number, y: number) => fx.L.project(vec3(from.x + ux * (along - back) + px * o, y, from.z + uz * (along - back) + pz * o));
      // Taller in the middle, lower at the ends; rippling a little across.
      const crest = (j: number) => {
        const o = -half + (TIDE.width * j) / TIDE.steps;
        const h = TIDE.height * sink * (1 - 0.45 * (o / half) ** 2) * (1 + 0.12 * Math.sin(j * 1.7 + t / 60));
        return { o, h };
      };
      const tops = Array.from({ length: TIDE.steps + 1 }, (_, j) => crest(j));
      const body = [...tops.map(({ o, h }) => at(o, 0, floor + h)), ...[...tops].reverse().map(({ o }) => at(o, TIDE.depth, floor))];
      g.clear().poly(body.flatMap((p) => [p.x, p.y])).fill({ color, alpha: 0.55 });
      // The face: a darker band low on the front.
      const face = [...tops.map(({ o, h }) => at(o, 0, floor + h * 0.45)), ...[...tops].reverse().map(({ o }) => at(o, 0, floor))];
      g.poly(face.flatMap((p) => [p.x, p.y])).fill({ color: mix(color, 0x00303a, 0.45), alpha: 0.55 });
      // Foam along the crest.
      tops.forEach(({ o, h }, j) => {
        const p = at(o, -0.04, floor + h);
        if (j) g.lineTo(p.x, p.y);
        else g.moveTo(p.x, p.y);
      });
      g.stroke({ width: 4, color: 0xffffff, alpha: 0.85, cap: 'round', join: 'round' });
      g.alpha = sink;
    },
    () => g.destroyed || g.destroy(),
  );
}

// Gadjah Mada's oath: gold rings bursting out across the floor from under him, one after another.
const OATH = { rings: 3, gapMs: 110, ms: 520, radius: 2.4 }; // radius in cells

function oathBurst(fx: FxContext, caster: TokenView, color: number): void {
  for (let n = 0; n < OATH.rings; n++) {
    const g = new Graphics();
    fx.tweens.add(n * OATH.gapMs, () => {}, () => {
      if (caster.root.destroyed) return;
      caster.root.addChildAt(g, 1); // over its plinth, under its shield
      fx.tweens.add(
        OATH.ms,
        (k) => {
          if (g.destroyed) return;
          const r = fx.L.unit * OATH.radius * (1 - (1 - k) ** 2);
          g.clear().ellipse(0, 0, r, r * FORESHORTENING.floor).stroke({ width: 4 - n, color, alpha: 0.9 * (1 - k) });
        },
        () => g.destroyed || g.destroy(),
      );
    });
  }
}

// ---------- the looks

// Lance's Phantom Execution: a blue-green tunnel of wind around his dash, afterimages along it, a cross on everyone he cuts
// through. Once his Phantom passive is on, a deep-teal Phantom chases each dash.
const WINDBLADE = EFFECT_COLORS.phantomexecution;
const PHANTOM = EFFECT_COLORS.phantom;

export const SKILL_LOOKS: Record<string, SkillLook> = {
  phantomexecution: {
    dash(fx, d) {
      windTunnel(fx, d, WINDBLADE);
      afterimages(fx, d, WINDBLADE);
    },
    hit: (fx, target) => cross(fx, target, WINDBLADE),
  },
  phantom: {
    dash(fx, d) {
      windTunnel(fx, d, WINDBLADE);
      afterimages(fx, d, WINDBLADE);
      chaser(fx, d, PHANTOM);
    },
    hit: (fx, target) => cross(fx, target, PHANTOM),
  },
  // Lunox's Power of Chaos: each Chaos Assault (an enhanced attack) flies as a twilight bolt.
  chaosassault: { shot: twilightShot },
  // Amon's Stalker's Mark: knives out at everyone, then homing in on his target.
  stalkersthrow: { projectile: amonBlade(knife, BLADE_BEND.out, EFFECT_COLORS.stalkersknife) },
  stalkershome: { projectile: amonBlade(knife, BLADE_BEND.home, EFFECT_COLORS.stalkersmark) },
  // ...at 3★, sharp shards, twice as many.
  stalkersshard: { projectile: amonBlade(shard, BLADE_BEND.out, EFFECT_COLORS.stalkersknife) },
  stalkersshardhome: { projectile: amonBlade(shard, BLADE_BEND.home, EFFECT_COLORS.stalkersmark) },
  // Roro's Southern Tide: a tidal wave rolling out.
  southerntide: { projectile: tidalWave },
  // Nana's Mist Boomerang: a spinning boomerang, out and back in a loop.
  mistboomerang: { projectile: boomerangFlight },
  // Gufron's Storm Pursuit: knives thrown into the floor, then pulled back to him.
  stormknife: { projectile: throwKnife },
  stormrecall: { projectile: recallKnife },
  // Gadjah Mada's Sumpah Palapa: gold oath rings bursting out from under him.
  sumpahpalapa: { cast: (fx, caster) => oathBurst(fx, caster, EFFECT_COLORS.sumpahpalapa) },
  // Melina's Spirit Archers: a violet crescent moon rises over him as he casts.
  spiritarchers: { cast: (fx, caster) => moonrise(fx, caster, COLORS.comet) },
};
