import { pct } from '../traits/format';
import { empoweredAttack } from './empoweredAttack';
import type { SkillDef } from './types';

// Wyrmfang (4g Fighter). Per star, index 0 = 1★.
export const WYRM_FRENZY = {
  bonus: [2, 2.4, 5], // empowered attack
  attackSpeed: [0.5, 0.6, 1],
  lifesteal: [0.3, 0.4, 0.7],
  seconds: 4,
};

const bite = empoweredAttack({ id: 'wyrmfrenzy', name: 'Wyrm Frenzy', bonus: WYRM_FRENZY.bonus });

export const wyrmFrenzy: SkillDef = {
  ...bite,
  desc: bite.desc.replace(/\.$/, '') + `, then frenzies for ${WYRM_FRENZY.seconds}s: +{as} attack speed and {lifesteal} lifesteal.`,
  values: () => ({ ...bite.values(), as: WYRM_FRENZY.attackSpeed.map(pct), lifesteal: WYRM_FRENZY.lifesteal.map(pct) }),
  cast(api, caster, target) {
    bite.cast(api, caster, target);
    const i = caster.star - 1;
    api.buff(
      caster,
      [
        { stat: 'attackSpeed', add: WYRM_FRENZY.attackSpeed[i] },
        { stat: 'lifesteal', add: WYRM_FRENZY.lifesteal[i] },
      ],
      WYRM_FRENZY.seconds,
      'wyrmfrenzy',
      caster,
    );
  },
};
