import { GRID_H, GRID_W, type Point } from '../grid';
import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Soulreaper (3g Hunter). Per star, index 0 = 1★.
export const SOUL_ORBIT = {
  ap: [0.45, 0.5, 1], // of magic attack per orb hit, as magic damage
  orbs: 5,
  seconds: 4, // how long they orbit
  step: 0.5, // seconds per cell the orbs move
};

// The 8 cells around a unit, clockwise from the top-left.
const RING: Point[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
];

// Where the orbs are after `step` moves: spread evenly round the ring, each one cell further along.
export function orbCells(center: Point, step: number): Point[] {
  return Array.from({ length: SOUL_ORBIT.orbs }, (_, j) => RING[(Math.floor((j * RING.length) / SOUL_ORBIT.orbs) + step) % RING.length])
    .map((d) => ({ x: center.x + d.x, y: center.y + d.y }))
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x < GRID_W && p.y < GRID_H);
}

export const soulOrbit: SkillDef = {
  id: 'soulorbit',
  name: 'Soul Orbit',
  desc:
    `Releases ${SOUL_ORBIT.orbs} soul orbs that circle it for ${SOUL_ORBIT.seconds}s. ` +
    `Every ${SOUL_ORBIT.step}s they move one cell, and each orb hits the enemy in its cell for {ap} of magic attack as magic damage.`,
  values: () => ({ ap: SOUL_ORBIT.ap.map(pct) }),
  cast(api, caster) {
    const raw = caster.stats.ap * SOUL_ORBIT.ap[caster.star - 1];
    api.showOrbit(caster, SOUL_ORBIT.orbs, SOUL_ORBIT.seconds, 'soulorbit');
    let step = 0;
    api.repeat(caster, SOUL_ORBIT.step, Math.round(SOUL_ORBIT.seconds / SOUL_ORBIT.step), () => {
      step++;
      for (const cell of orbCells(caster, step)) {
        const victim = api.occupant(cell);
        if (victim && victim.side !== caster.side) api.hit(caster, victim, raw, 'magic', 'soulorbit');
      }
    });
  },
};
