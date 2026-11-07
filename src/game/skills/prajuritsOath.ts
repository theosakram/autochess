import { pct } from '../traits/format';
import { empoweredAttack } from './empoweredAttack';
import type { SkillDef } from './types';

// Dyroth (1g Gustiwana / Fighter). Per star, index 0 = 1★.
export const PRAJURITS_OATH = {
  lifesteal: 0.05, // passive: hybrid, for itself and the allies directly left and right, for the fight
  bonus: [1.7, 1.7, 2.6], // active: extra on top of a normal attack, so 270% / 270% / 360% in all
  heal: [0.05, 0.05, 0.05], // active: of its max hp
};

const strike = empoweredAttack({ id: 'prajuritsoath', name: "Prajurit's Oath", bonus: PRAJURITS_OATH.bonus, heal: PRAJURITS_OATH.heal });

export const prajuritsOath: SkillDef = {
  ...strike,
  desc:
    `Passive: when combat starts, it and the allies directly left and right of it gain ${pct(PRAJURITS_OATH.lifesteal)} hybrid lifesteal ` +
    '(attacks and skills) for the fight. Active: ' + strike.desc,
  atStart(api, caster) {
    const add = PRAJURITS_OATH.lifesteal;
    for (const ally of api.alliesOf(caster)) {
      if (ally.y !== caster.y || Math.abs(ally.x - caster.x) > 1) continue;
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
