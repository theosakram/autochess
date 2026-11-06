import { around, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Hazeguard (1g Mistbender): a cheap shield to spam for Mist coins. Per star, index 0 = 1★.
export const MIST_WARD = {
  shield: [50, 90, 220], // flat
  blast: [25, 40, 100], // magic damage
  seconds: 2,
};

export const mistWard: SkillDef = {
  id: 'mistward',
  name: 'Mist Ward',
  desc:
    `Wraps itself in a {shield} shield for ${MIST_WARD.seconds}s. When the shield ends (broken, run out or recast), ` +
    'it bursts: every enemy around it takes {blast} magic damage.',
  values: () => ({ shield: MIST_WARD.shield.map(String), blast: MIST_WARD.blast.map(String) }),
  cast(api, caster) {
    const blast = MIST_WARD.blast[caster.star - 1];
    api.shield(caster, MIST_WARD.shield[caster.star - 1], MIST_WARD.seconds, 'mistward', () => {
      for (const e of enemiesOn(api, caster, around(caster))) api.hit(caster, e, blast, 'magic', 'mistblast');
    });
  },
};
