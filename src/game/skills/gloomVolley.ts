import { pct } from '../traits/format';
import type { SkillDef, SkillFighter } from './types';

// Ginger (2g Spectre / Deadeye). Per star, index 0 = 1★.
export const GLOOM_VOLLEY = {
  shots: 5,
  every: 0.15, // seconds between shots
  shot: [2, 2, 2.75], // of attack, each shot
};

export const gloomVolley: SkillDef = {
  id: 'gloomvolley',
  name: 'Gloom Volley',
  desc:
    `Rapidly fires ${GLOOM_VOLLEY.shots} shots at its target, each for {shot} of attack. ` +
    'Every shot is a basic attack, so it can crit. If the target falls, the rest go to the nearest enemy.',
  damage: { shot: 'attack' },
  values: () => ({ shot: GLOOM_VOLLEY.shot.map(pct) }),
  cast(api, caster, target) {
    let victim: SkillFighter | null = target;
    let n = 0;
    api.busy(caster, true);
    api.repeat(caster, GLOOM_VOLLEY.every, GLOOM_VOLLEY.shots, () => {
      if (!victim || victim.hp <= 0) victim = api.nearestEnemy(caster);
      if (victim) {
        const power = api.attackPower(caster);
        api.basicHit(caster, victim, power.amount * GLOOM_VOLLEY.shot[caster.star - 1], power.type, 'gloomvolley');
      }
      if (++n >= GLOOM_VOLLEY.shots || !victim) api.busy(caster, false);
    });
  },
};
