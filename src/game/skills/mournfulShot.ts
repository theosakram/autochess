import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Natalie (2g Necromancer / Hunter). Per star, index 0 = 1★.
export const MOURNFUL_SHOT = {
  power: [3.9, 4, 5], // of attack: the whole enhanced attack
};

export const mournfulShot: SkillDef = {
  id: 'mournfulshot',
  name: 'Mournful Shot',
  desc: 'Enhances its next attack to deal {power} of attack.',
  damage: { power: 'attack' },
  values: () => ({ power: MOURNFUL_SHOT.power.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const power = api.attackPower(caster);
    api.basicHit(caster, victim, power.amount * MOURNFUL_SHOT.power[caster.star - 1], power.type, 'mournfulshot');
  },
};
