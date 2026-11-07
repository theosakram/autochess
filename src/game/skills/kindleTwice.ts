import { pct } from '../traits/format';
import type { SkillDef, SkillFighter } from './types';

// Cici (1g Cult of Fire / Weapon Master). Per star, index 0 = 1★.
export const KINDLE_TWICE = {
  hits: 2,
  power: [2.35, 2.35, 3.25], // of its attack (its basic attack power), per hit
};

export const kindleTwice: SkillDef = {
  id: 'kindletwice',
  name: 'Kindle Twice',
  desc: `Strikes its target ${KINDLE_TWICE.hits} times, each an enhanced basic attack for {power} of its attack.`,
  damage: { power: 'attack' },
  values: () => ({ power: KINDLE_TWICE.power.map(pct) }),
  cast(api, caster, target) {
    const i = caster.star - 1;
    const power = api.attackPower(caster);
    let victim: SkillFighter | null = target;
    for (let n = 0; n < KINDLE_TWICE.hits; n++) {
      if (!victim || victim.hp <= 0) victim = api.nearestEnemy(caster);
      if (!victim) return;
      api.basicHit(caster, victim, power.amount * KINDLE_TWICE.power[i], power.type, 'kindletwice');
    }
  },
};
