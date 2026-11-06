import { pct } from '../traits/format';
import { empoweredAttack } from './empoweredAttack';
import type { SkillDef } from './types';

// Prajurit (1g Fighter). Per star, index 0 = 1★.
export const PRAJURITS_OATH = {
  lifesteal: [0.1, 0.15, 0.25], // passive: hybrid, to the allies directly left and right, for the fight
  bonus: [1, 1.25, 2], // active: empowered attack
};

const strike = empoweredAttack({ id: 'prajuritsoath', name: "Prajurit's Oath", bonus: PRAJURITS_OATH.bonus });

export const prajuritsOath: SkillDef = {
  ...strike,
  desc: 'Passive: when combat starts, the allies directly left and right of it gain {lifesteal} hybrid lifesteal (attacks and skills) for the fight. Active: ' + strike.desc,
  values: () => ({ ...strike.values(), lifesteal: PRAJURITS_OATH.lifesteal.map(pct) }),
  atStart(api, caster) {
    const add = PRAJURITS_OATH.lifesteal[caster.star - 1];
    for (const ally of api.alliesOf(caster)) {
      if (ally.y !== caster.y || Math.abs(ally.x - caster.x) !== 1) continue;
      api.buff(
        ally,
        [
          { stat: 'lifesteal', add },
          { stat: 'spellLifesteal', add },
        ],
        Infinity,
        `oath${caster.id}`,
        caster,
      );
    }
  },
};
