import { enemiesOn, row3 } from './areas';
import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Polaris (4g Deadeye). Per star, index 0 = 1★.
export const POLAR_BARRAGE = {
  area: [2.2, 2.6, 5.2], // of attack, physical, to each enemy in the 3x1 row around its target
  charged: 3, // basic attacks enhanced afterwards
  bonus: [0.6, 0.7, 1.5], // extra basic attack damage on those
};

export const polarBarrage: SkillDef = {
  id: 'polarbarrage',
  name: 'Polar Barrage',
  desc:
    'Strikes a 3x1 row centered on its target for {area} of attack as physical damage, ' +
    `then its next ${POLAR_BARRAGE.charged} attacks deal +{bonus} damage.`,
  values: () => ({ area: POLAR_BARRAGE.area.map(pct), bonus: POLAR_BARRAGE.bonus.map(pct) }),
  cast(api, caster, target) {
    const center = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!center) return;
    const i = caster.star - 1;
    const raw = caster.stats.atk * POLAR_BARRAGE.area[i];
    for (const victim of enemiesOn(api, caster, row3(center))) api.hit(caster, victim, raw, 'physical', 'polarbarrage');
    api.buff(caster, [{ stat: 'basicAmp', add: POLAR_BARRAGE.bonus[i] }], Infinity, 'polarcharged', caster);
    caster.skill.charged = POLAR_BARRAGE.charged;
  },
  onBasicHit(api, caster) {
    if (!caster.skill.charged) return;
    if (--caster.skill.charged === 0) api.unbuff(caster, 'polarcharged');
  },
};
