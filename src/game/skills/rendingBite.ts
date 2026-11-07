import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Si Yun Yin (1g Dragon Altar / Hunter). Per star, index 0 = 1★.
export const RENDING_BITE = {
  power: [3.75, 3.75, 5.3], // of attack: the whole enhanced attack
  defense: [12, 14, 20], // armor and magic resist torn off the target
  seconds: 10,
};

export const rendingBite: SkillDef = {
  id: 'rendingbite',
  name: 'Rending Bite',
  desc:
    'Enhances its next attack to deal {power} of attack, then tears the target\'s defenses: ' +
    `-{defense} armor and magic resist for ${RENDING_BITE.seconds}s.`,
  damage: { power: 'attack' },
  values: () => ({ power: RENDING_BITE.power.map(pct), defense: RENDING_BITE.defense.map(String) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const i = caster.star - 1;
    const power = api.attackPower(caster);
    api.basicHit(caster, victim, power.amount * RENDING_BITE.power[i], power.type, 'rendingbite');
    if (victim.hp <= 0) return;
    const d = RENDING_BITE.defense[i];
    api.debuff(victim, { armor: d, mr: d }, RENDING_BITE.seconds, 'rendingbite');
  },
};
