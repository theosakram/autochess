import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Aldo (3g Mistbender / Fighter): a cheap jab to spam for Mist coins. Per star, index 0 = 1★.
export const MISTY_JAB = {
  atk: [1.3, 1.3, 1.3], // of attack, physical, as an enhanced basic hit
  every: 3, // every third cast is a big one
  bigAtk: [1.7, 1.8, 2.95], // of attack, on that cast
  shield: 1, // of its attack, every cast
  seconds: 4, // shield
};

export const mistyJab: SkillDef = {
  id: 'mistyjab',
  name: 'Misty Jab',
  desc:
    `Empowers its next attack to deal {atk} of attack as physical damage (every ${MISTY_JAB.every}rd cast: {big}), ` +
    `then shields itself for ${pct(MISTY_JAB.shield)} of its attack for ${MISTY_JAB.seconds}s.`,
  damage: { atk: 'physical', big: 'physical' },
  values: () => ({ atk: MISTY_JAB.atk.map(pct), big: MISTY_JAB.bigAtk.map(pct) }),
  cast(api, caster, target) {
    const i = caster.star - 1;
    caster.skill.casts = (caster.skill.casts ?? 0) + 1;
    const big = caster.skill.casts % MISTY_JAB.every === 0;
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (victim) api.basicHit(caster, victim, caster.stats.atk * (big ? MISTY_JAB.bigAtk : MISTY_JAB.atk)[i], 'physical', 'mistyjab');
    api.shield(caster, caster.stats.atk * MISTY_JAB.shield, MISTY_JAB.seconds, 'mistyjab');
  },
};
