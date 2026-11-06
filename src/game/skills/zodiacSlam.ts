import { pct } from '../traits/format';
import { enemiesOn, row3 } from './areas';
import type { SkillDef } from './types';

// Zodiac Blade (3g Dauntless). Per star, index 0 = 1★.
export const ZODIAC_SLAM = {
  atk: [1.8, 2.2, 4.5], // of attack, physical, to each enemy in the 3x1 row
  shield: [0.6, 0.7, 1.2], // of the damage the slam dealt
  seconds: 4,
};

export const zodiacSlam: SkillDef = {
  id: 'zodiacslam',
  name: 'Zodiac Slam',
  desc:
    'Slams the 3x1 row around its target for {atk} of attack as physical damage, ' +
    `then gains a shield of {shield} of the damage it dealt for ${ZODIAC_SLAM.seconds}s.`,
  values: () => ({ atk: ZODIAC_SLAM.atk.map(pct), shield: ZODIAC_SLAM.shield.map(pct) }),
  cast(api, caster, target) {
    const center = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!center) return;
    const i = caster.star - 1;
    const before = caster.dealt;
    for (const e of enemiesOn(api, caster, row3(center))) api.hit(caster, e, caster.stats.atk * ZODIAC_SLAM.atk[i], 'physical', 'zodiacslam');
    const dealt = caster.dealt - before;
    if (dealt > 0) api.shield(caster, dealt * ZODIAC_SLAM.shield[i], ZODIAC_SLAM.seconds, 'zodiacslam');
  },
};
