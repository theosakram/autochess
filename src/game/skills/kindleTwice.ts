import { pct } from '../traits/format';
import { withStat } from './lend';
import type { SkillDef, SkillFighter } from './types';

// Kindler (1g Weapon Master). Per star, index 0 = 1★.
export const KINDLE_TWICE = {
  hits: 2,
  power: [1.1, 1.3, 2.2], // of its attack (its basic attack power), per hit
  lifesteal: [0.4, 0.5, 0.8], // of each hit's damage
};

export const kindleTwice: SkillDef = {
  id: 'kindletwice',
  name: 'Kindle Twice',
  desc:
    `Strikes its target ${KINDLE_TWICE.hits} times, each a basic attack for {power} of its attack, ` +
    'healing it for {lifesteal} of the damage dealt.',
  values: () => ({ power: KINDLE_TWICE.power.map(pct), lifesteal: KINDLE_TWICE.lifesteal.map(pct) }),
  cast(api, caster, target) {
    const i = caster.star - 1;
    const power = api.attackPower(caster);
    let victim: SkillFighter | null = target;
    withStat(api, caster, 'lifesteal', KINDLE_TWICE.lifesteal[i], 'kindleleech', () => {
      for (let n = 0; n < KINDLE_TWICE.hits; n++) {
        if (!victim || victim.hp <= 0) victim = api.nearestEnemy(caster);
        if (!victim) return;
        api.basicHit(caster, victim, power.amount * KINDLE_TWICE.power[i], power.type, 'kindletwice');
      }
    });
  },
};
