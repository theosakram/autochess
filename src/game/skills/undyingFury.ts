import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillDef } from './types';

// Revenant (5g Weapon Master): a necromantic berserk. Per star, index 0 = 1★.
export const UNDYING_FURY = {
  seconds: 4,
  every: 0.5,
  hp: [0.025, 0.03, 0.06], // of its max hp, magic, per tick to each enemy around it
  attackSpeed: [0.5, 0.6, 1],
  lifesteal: [0.3, 0.4, 0.7], // on its attacks and its aura alike
};

export const undyingFury: SkillDef = {
  id: 'undyingfury',
  name: 'Undying Fury',
  desc:
    'Leaps into the thick of the enemy (the spot with the most of them around it) and rages: ' +
    `for ${UNDYING_FURY.seconds}s, every ${UNDYING_FURY.every}s, each enemy around it takes {hp} of its max HP as magic damage, ` +
    'and it gains +{as} attack speed and {lifesteal} lifesteal on everything, its aura included.',
  values: () => ({ hp: UNDYING_FURY.hp.map(pct), as: UNDYING_FURY.attackSpeed.map(pct), lifesteal: UNDYING_FURY.lifesteal.map(pct) }),
  cast(api, caster) {
    const U = UNDYING_FURY;
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (spot) api.dashTo(caster, spot);
    api.buff(
      caster,
      [
        { stat: 'attackSpeed', add: U.attackSpeed[i] },
        { stat: 'lifesteal', add: U.lifesteal[i] },
        { stat: 'spellLifesteal', add: U.lifesteal[i] },
      ],
      U.seconds,
      'undyingfury',
      caster,
    );
    const tick = () => {
      const raw = caster.maxHp * U.hp[i];
      for (const e of enemiesOn(api, caster, around(caster))) if (e.hp > 0) api.hit(caster, e, raw, 'magic', 'undyingfuryaura');
    };
    tick();
    api.repeat(caster, U.every, Math.round(U.seconds / U.every) - 1, tick);
  },
};
