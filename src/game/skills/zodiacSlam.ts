import { dist } from '../grid';
import { pct } from '../traits/format';
import { enemiesOn, facingStrip } from './areas';
import type { SkillDef } from './types';

// Hilman (3g Astral / Dauntless). Per star, index 0 = 1★.
export const ZODIAC_SLAM = {
  atk: [2.85, 2.85, 3.5], // of attack, physical, to each enemy in the 3 tiles in front of it
  shield: [0.1, 0.1, 0.12], // of its max hp
  seconds: 4,
};

export const zodiacSlam: SkillDef = {
  id: 'zodiacslam',
  name: 'Zodiac Slam',
  desc:
    'Slashes the 3 tiles in front of it (toward its target) for {atk} of attack as physical damage, ' +
    `then gains a shield of {shield} of its max HP for ${ZODIAC_SLAM.seconds}s.`,
  damage: { atk: 'physical' },
  values: () => ({ atk: ZODIAC_SLAM.atk.map(pct), shield: ZODIAC_SLAM.shield.map(pct) }),
  cast(api, caster, target) {
    const i = caster.star - 1;
    const facing = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (facing) {
      // The first row of the strip toward its target: the 3 tiles right in front of it.
      const front = facingStrip(caster, facing).filter((p) => dist(caster, p) === 1);
      for (const e of enemiesOn(api, caster, front)) api.hit(caster, e, caster.stats.atk * ZODIAC_SLAM.atk[i], 'physical', 'zodiacslam');
    }
    api.shield(caster, caster.maxHp * ZODIAC_SLAM.shield[i], ZODIAC_SLAM.seconds, 'zodiacslam');
  },
};
