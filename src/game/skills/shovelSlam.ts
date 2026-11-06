import { pct } from '../traits/format';
import { enemiesOn, row3 } from './areas';
import type { SkillDef, SkillFighter } from './types';

// Grave Robber (4g Scavenger). Per star, index 0 = 1★.
export const SHOVEL_SLAM = {
  slams: 3,
  every: 0.4, // seconds between slams
  atk: [1.2, 1.4, 2.8], // of attack, physical, per slam to each enemy in the row
  stun: 0.5, // seconds, per slam
};

export const shovelSlam: SkillDef = {
  id: 'shovelslam',
  name: 'Shovel Slam',
  desc:
    `Slams ${SHOVEL_SLAM.slams} times, ${SHOVEL_SLAM.every}s apart, into the 3x1 row around its target: ` +
    `each slam deals {atk} of attack as physical damage and stuns for ${SHOVEL_SLAM.stun}s.`,
  values: () => ({ atk: SHOVEL_SLAM.atk.map(pct) }),
  cast(api, caster, target) {
    let center: SkillFighter | null = target;
    let n = 0;
    const raw = caster.stats.atk * SHOVEL_SLAM.atk[caster.star - 1];
    const slam = () => {
      if (!center || center.hp <= 0) center = api.nearestEnemy(caster);
      if (center) {
        for (const victim of enemiesOn(api, caster, row3(center))) {
          if (!api.hit(caster, victim, raw, 'physical', 'shovelslam')) api.stun(victim, SHOVEL_SLAM.stun, caster);
        }
      }
      if (++n >= SHOVEL_SLAM.slams || !center) api.busy(caster, false);
    };
    api.busy(caster, true);
    slam(); // the first lands on cast
    api.repeat(caster, SHOVEL_SLAM.every, SHOVEL_SLAM.slams - 1, slam);
  },
};
