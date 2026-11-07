import type { SkillDef } from './types';

// Uranus (1g Mistbender / Dauntless): a cheap shield to spam for Mist coins. Per star, index 0 = 1★.
export const MIST_WARD = {
  shield: [400, 650, 1500], // flat
  seconds: 4,
};

export const mistWard: SkillDef = {
  id: 'mistward',
  name: 'Mist Ward',
  desc: `Wraps itself in a {shield} shield for ${MIST_WARD.seconds}s.`,
  values: () => ({ shield: MIST_WARD.shield.map(String) }),
  cast(api, caster) {
    api.shield(caster, MIST_WARD.shield[caster.star - 1], MIST_WARD.seconds, 'mistward');
  },
};
