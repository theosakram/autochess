import type { Container } from 'pixi.js';
import { lerp3, vec3, type Vec3 } from './camera';
import type { TokenView } from './token';
import type { Tweens } from './tween';

// Puts a board object at a world point (the stage's projection: position, depth scale, draw order).
export type Placer = (obj: Container, at: Vec3) => void;

// How pieces move in a fight, in cells and milliseconds.
export const MOTION = {
  lungeReach: 0.3, // a melee swing leans this far toward its target and back
  lungeMs: 220,
  hopHeight: 0.22, // a hit knocks the shield up this high
  hopMs: 240,
  deathDrop: 0.5, // a dead piece's shield sinks onto its plinth as it fades
  deathMs: 450,
};

// A piece in a fight: where it stands in the world, and how it moves there. Each kind of motion has its own tween
// (keyed per actor), so a lunge can play during a walk; what's drawn is always the stand plus every offset.
export class Actor {
  private stand: Vec3;
  private air = 0; // a leap's current height
  private reach = vec3(0); // a lunge's current lean
  private dead = false;

  constructor(
    readonly token: TokenView,
    at: Vec3,
    private readonly tweens: Tweens,
    private readonly place: Placer,
    private readonly key: string,
  ) {
    this.stand = at;
    this.put();
  }

  // Where it stands (its cell, or partway along a move).
  get position(): Vec3 {
    return this.stand;
  }

  // Slides to `to` in `ms`; with `arc`, leaps that high at the midpoint.
  moveTo(to: Vec3, ms: number, arc = 0): void {
    const from = this.stand;
    this.tween('move', ms, (k) => {
      this.stand = lerp3(from, to, k);
      this.air = Math.sin(Math.PI * k) * arc;
    });
  }

  // Leans toward a point and back: a melee swing.
  lunge(toward: Vec3): void {
    const [dx, dz] = [toward.x - this.stand.x, toward.z - this.stand.z];
    const length = Math.hypot(dx, dz);
    if (!length) return;
    const [ux, uz] = [(dx / length) * MOTION.lungeReach, (dz / length) * MOTION.lungeReach];
    this.tween('lunge', MOTION.lungeMs, (k) => {
      const s = Math.sin(Math.PI * k);
      this.reach = vec3(ux * s, 0, uz * s);
    });
  }

  // The shield jolts up and settles: it took a hit.
  hop(): void {
    if (this.dead) return;
    this.tween('lift', MOTION.hopMs, (k) => this.token.setLift(Math.sin(Math.PI * k) * MOTION.hopHeight));
  }

  // A coloured flash over the shield, fading over `ms`.
  flash(color: number, ms: number): void {
    const overlay = this.token.flash(color);
    this.tween('flash', ms, (k) => (overlay.alpha = 1 - k));
  }

  // The shield sinks onto the plinth while the whole piece fades out.
  die(): void {
    this.dead = true;
    this.tween('lift', MOTION.deathMs, (k) => {
      this.token.setLift(-MOTION.deathDrop * k * k);
      this.token.root.alpha = 1 - k;
    });
  }

  private put(): void {
    const { stand, reach } = this;
    this.place(this.token.root, vec3(stand.x + reach.x, stand.y + this.air, stand.z + reach.z));
  }

  // Every motion redraws the piece where it now is.
  private tween(motion: string, ms: number, step: (k: number) => void): void {
    this.tweens.add(
      ms,
      (k) => {
        step(k);
        this.put();
      },
      undefined,
      `${this.key}:${motion}`,
    );
  }
}
