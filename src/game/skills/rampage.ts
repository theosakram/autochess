import { type Point } from '../grid';
import { dist } from '../grid';
import { pct } from '../traits/format';
import { dashLine } from './phantomExecution';
import type { SkillDef, SkillFighter } from './types';

// Abomination (5g Hunter). Per star, index 0 = 1★.
export const RAMPAGE = {
  dashes: 5,
  stepSeconds: 0.2, // a slow charge: one cell per step
  atk: [1.2, 1.4, 3], // of attack, physical, to each enemy it crashes into (once per dash)
  burn: [0.2, 0.25, 0.6], // of attack per second, magic, to enemies standing in the trail
  burnSeconds: 3,
};

// Each dash charges at the farthest enemy and keeps going to the edge of the board.
function farthest(enemies: SkillFighter[], from: Point): SkillFighter | null {
  return enemies.reduce<SkillFighter | null>((best, e) => (!best || dist(from, e) > dist(from, best) ? e : best), null);
}

export const rampage: SkillDef = {
  id: 'rampage',
  name: 'Rampage',
  desc:
    `Charges across the board ${RAMPAGE.dashes} times, slowly, at the farthest enemy and on to the edge. ` +
    'It crashes into every enemy in its path for {atk} of attack as physical damage, and leaves a trail of fire: ' +
    `enemies standing in it take {burn} of attack per second as magic damage for ${RAMPAGE.burnSeconds}s. It can be hit while it rampages.`,
  values: () => ({ atk: RAMPAGE.atk.map(pct), burn: RAMPAGE.burn.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    const crash = caster.stats.atk * RAMPAGE.atk[i];
    const burn = caster.stats.atk * RAMPAGE.burn[i];
    let left = RAMPAGE.dashes;
    let path: Point[] = [];
    let crashed = new Set<number>();
    api.busy(caster, true);
    // Enough steps for every dash to cross the board; it stops early once the last one ends.
    api.repeat(caster, RAMPAGE.stepSeconds, RAMPAGE.dashes * 10, () => {
      while (!path.length) {
        const target = left > 0 ? farthest(api.enemiesOf(caster), caster) : null;
        if (!target) {
          api.busy(caster, false);
          return;
        }
        left--;
        crashed = new Set();
        path = dashLine(caster, target, 99);
      }
      const cell = path.shift()!;
      const there = api.occupant(cell);
      if (!there) api.dashTo(caster, cell);
      else if (there.side !== caster.side && !crashed.has(there.id)) {
        crashed.add(there.id);
        api.hit(caster, there, crash, 'physical', 'rampage');
      }
      api.burn(caster, [cell], burn, 'magic', RAMPAGE.burnSeconds, 'rampageburn');
      if (!path.length && left === 0) api.busy(caster, false);
    });
  },
};
