import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Lunox (4g Gustiwana / Stargazer). Per star, index 0 = 1★.
export const POWER_OF_CHAOS = {
  ap: [4.5, 5, 13.5], // of magic attack per Chaos Assault
  assaults: 3,
};

const EFFECT = 'chaosassault';

export const powerOfChaos: SkillDef = {
  id: 'powerofchaos',
  name: 'Power of Chaos',
  desc:
    `Her next ${POWER_OF_CHAOS.assaults} attacks become Chaos Assaults, enhanced basic attacks at the nearest enemy, ` +
    'each dealing {ap} of magic attack as magic damage. The first one dashes her to a safe location first. ' +
    'Killing an enemy grants 1 more Chaos Assault.',
  damage: { ap: 'magic' },
  values: () => ({ ap: POWER_OF_CHAOS.ap.map(pct) }),
  cast(api, caster) {
    caster.skill.left = POWER_OF_CHAOS.assaults;
    caster.skill.dashed = 0;
    api.showMarks(caster, caster.skill.left, EFFECT);
  },
  // While charged, each attack is a Chaos Assault instead.
  enhancedAttack(api, caster) {
    if (!(caster.skill.left > 0)) return false;
    if (!caster.skill.dashed) {
      caster.skill.dashed = 1;
      const safe = api.safestCell(caster);
      if (safe.x !== caster.x || safe.y !== caster.y) api.dashTo(caster, safe);
    }
    const target = api.nearestEnemy(caster);
    caster.skill.left--;
    if (target && api.basicHit(caster, target, caster.stats.ap * POWER_OF_CHAOS.ap[caster.star - 1], 'magic', EFFECT)) caster.skill.left++;
    api.showMarks(caster, caster.skill.left, EFFECT);
    return true;
  },
};
