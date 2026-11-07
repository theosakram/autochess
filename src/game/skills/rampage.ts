import { type Point } from '../grid';
import { dist } from '../grid';
import { pct } from '../traits/format';
import { dashLine } from './phantomExecution';
import type { SkillDef, SkillFighter } from './types';
import { pickSpread } from './unfoldingTale';

// Fanny (5g Cult of Fire / Hunter). Per star, index 0 = 1★.
export const RAMPAGE = {
  dashes: 5,
  stepSeconds: 0.1, // one cell per step
  atk: [0.7, 0.75, 1.5], // of attack, physical, to each enemy it passes (once per dash)
  fireballs: 4, // per dash, at random enemies
  fireball: [1, 1, 4], // of attack, physical, each
  slash: [2.7, 2.7, 6.7], // of attack, physical, to the nearest enemy after the last dash
};

// Each dash heads for the farthest enemy and keeps going to the wall.
function farthest(enemies: SkillFighter[], from: Point): SkillFighter | null {
  return enemies.reduce<SkillFighter | null>((best, e) => (!best || dist(from, e) > dist(from, best) ? e : best), null);
}

export const rampage: SkillDef = {
  id: 'rampage',
  name: 'Rampage',
  desc:
    `Dashes ${RAMPAGE.dashes} times, each toward the farthest enemy and on until it reaches the wall: every enemy it passes takes ` +
    `{atk} of attack as physical damage. As it sets off on each dash it shoots ${RAMPAGE.fireballs} fireballs at random enemies, ` +
    'each dealing {fireball} of attack as physical damage. After the last dash it slashes the nearest enemy for {slash} of attack ' +
    'as physical damage. It can be hit while it dashes.',
  damage: { atk: 'physical', fireball: 'physical', slash: 'physical' },
  values: () => ({ atk: RAMPAGE.atk.map(pct), fireball: RAMPAGE.fireball.map(pct), slash: RAMPAGE.slash.map(pct) }),
  cast(api, caster) {
    const R = RAMPAGE;
    const i = caster.star - 1;
    const pass = caster.stats.atk * R.atk[i];
    let left = R.dashes;
    let path: Point[] = [];
    let passed = new Set<number>();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const near = api.nearestEnemy(caster);
      if (near) api.hit(caster, near, caster.stats.atk * R.slash[i], 'physical', 'rampageslash');
      api.busy(caster, false);
    };
    api.busy(caster, true);
    // Enough steps for every dash to cross the board; it stops early once the last one ends.
    api.repeat(caster, R.stepSeconds, R.dashes * 10, () => {
      if (done) return;
      while (!path.length) {
        const target = left > 0 ? farthest(api.enemiesOf(caster), caster) : null;
        if (!target) return finish();
        left--;
        passed = new Set();
        path = dashLine(caster, target, 99);
        for (const e of pickSpread<SkillFighter>(api, api.enemiesOf(caster), R.fireballs)) {
          if (e.hp <= 0) continue;
          api.showProjectile(caster, e, 0.2, 'rampagefireball');
          api.hit(caster, e, caster.stats.atk * R.fireball[i], 'physical', 'rampagefireball');
        }
      }
      const cell = path.shift()!;
      const there = api.occupant(cell);
      if (!there) api.dashTo(caster, cell);
      else if (there.side !== caster.side && !passed.has(there.id)) {
        passed.add(there.id);
        api.hit(caster, there, pass, 'physical', 'rampage');
      }
      if (!path.length && left === 0) finish();
    });
  },
};
