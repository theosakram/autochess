import { around, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Hazeguard (1g Mistbender): a cheap shield to spam for Mist coins. Per star, index 0 = 1★.
export const MIST_WARD = {
  shield: [60, 90, 200], // flat; the blast deals the same, as magic damage
  seconds: 2,
};

export const mistWard: SkillDef = {
  id: 'mistward',
  name: 'Mist Ward',
  desc:
    `Wraps itself in a {shield} shield for ${MIST_WARD.seconds}s. When the shield ends (broken, run out or recast), ` +
    'it bursts: every enemy around it takes {shield} magic damage.',
  values: () => ({ shield: MIST_WARD.shield.map(String) }),
  cast(api, caster) {
    const amount = MIST_WARD.shield[caster.star - 1];
    api.shield(caster, amount, MIST_WARD.seconds, 'mistward', () => {
      for (const e of enemiesOn(api, caster, around(caster))) api.hit(caster, e, amount, 'magic', 'mistblast');
    });
  },
};
