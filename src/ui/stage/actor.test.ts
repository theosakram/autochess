import { describe, expect, test } from 'bun:test';
import type { Container, Graphics } from 'pixi.js';
import { Actor, MOTION } from './actor';
import { vec3, type Vec3 } from './camera';
import type { TokenView } from './token';
import { Tweens } from './tween';

// A token that only records what the actor does to it.
function fakeToken() {
  const root = { alpha: 1 } as Container;
  const overlay = { alpha: 0 } as Graphics;
  const lifts: number[] = [];
  const token: TokenView = {
    root,
    body: {} as Container,
    setBar: () => {},
    flash: () => {
      overlay.alpha = 1;
      return overlay;
    },
    ring: () => ({}) as Graphics,
    setLift: (h) => lifts.push(h),
    setTurn: () => {},
  };
  return { token, overlay, lifts };
}

function rig(at: Vec3 = vec3(0, 0, 0)) {
  const tweens = new Tweens();
  const placed: Vec3[] = [];
  const fake = fakeToken();
  const actor = new Actor(fake.token, at, tweens, (_, p) => placed.push(p), 'a');
  const last = () => placed[placed.length - 1];
  return { ...fake, tweens, actor, placed, last };
}

describe('actor', () => {
  test('is placed where it stands from the start', () => {
    const { last } = rig(vec3(1, 0, 2));
    expect(last()).toEqual(vec3(1, 0, 2));
  });

  test('a move ends on the target, a leap rises midway and lands', () => {
    const { actor, tweens, last } = rig();
    actor.moveTo(vec3(2, 0, 0), 100, 0.6);
    tweens.update(50);
    expect(last().x).toBeCloseTo(1, 6);
    expect(last().y).toBeCloseTo(0.6, 6);
    tweens.update(50);
    expect(last().x).toBeCloseTo(2, 6);
    expect(last().y).toBeCloseTo(0, 6);
    expect(actor.position).toEqual(vec3(2, 0, 0));
  });

  test('a lunge leans toward the target and comes back, the stand unchanged', () => {
    const { actor, tweens, last } = rig();
    actor.lunge(vec3(0, 0, -3));
    tweens.update(MOTION.lungeMs / 2);
    expect(last().z).toBeCloseTo(-MOTION.lungeReach, 6);
    tweens.update(MOTION.lungeMs / 2);
    expect(last().z).toBeCloseTo(0, 6);
    expect(actor.position).toEqual(vec3(0, 0, 0));
  });

  test('a lunge plays during a walk without cutting it short', () => {
    const { actor, tweens, last } = rig();
    actor.moveTo(vec3(0, 0, 2), MOTION.lungeMs * 2);
    actor.lunge(vec3(3, 0, 0));
    tweens.update(MOTION.lungeMs * 2);
    expect(last().x).toBeCloseTo(0, 6);
    expect(last().z).toBeCloseTo(2, 6);
  });

  test('a hop lifts the shield and settles', () => {
    const { actor, tweens, lifts } = rig();
    actor.hop();
    tweens.update(MOTION.hopMs / 2);
    expect(lifts.at(-1)).toBeCloseTo(MOTION.hopHeight, 6);
    tweens.update(MOTION.hopMs / 2);
    expect(lifts.at(-1)).toBeCloseTo(0, 6);
  });

  test('death sinks the shield and fades the piece; later hits do not revive the hop', () => {
    const { actor, tweens, lifts, token } = rig();
    actor.die();
    actor.hop();
    tweens.update(MOTION.deathMs);
    expect(lifts.at(-1)).toBeCloseTo(-MOTION.deathDrop, 6);
    expect(token.root.alpha).toBe(0);
  });

  test('a flash fades out', () => {
    const { actor, tweens, overlay } = rig();
    actor.flash(0xffffff, 100);
    expect(overlay.alpha).toBe(1);
    tweens.update(100);
    expect(overlay.alpha).toBe(0);
  });
});
