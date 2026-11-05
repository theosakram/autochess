import { pct } from '../traits/format';
import type { SkillDef, SkillFighter } from './types';

// Gloomshot (2g Deadeye). Per star, index 0 = 1★.
export const GLOOM_VOLLEY = {
  shots: 5,
  every: 0.15, // seconds between shots
  first: [0.4, 0.45, 0.9], // of attack, the first shot
  ramp: [0.2, 0.225, 0.45], // added to each shot after the first
};

// Shot `n` (0-based) at `star`: each one stronger than the last.
export const volleyShot = (star: number, n: number) => GLOOM_VOLLEY.first[star - 1] + n * GLOOM_VOLLEY.ramp[star - 1];

export const gloomVolley: SkillDef = {
  id: 'gloomvolley',
  name: 'Gloom Volley',
  desc:
    `Fires ${GLOOM_VOLLEY.shots} shots at its target, each stronger than the last: from {first} up to {last} of attack ({total} in all). ` +
    'Every shot is a basic attack, so it can crit. If the target falls, the rest go to the nearest enemy.',
  values: () => ({
    first: [1, 2, 3].map((s) => pct(volleyShot(s, 0))),
    last: [1, 2, 3].map((s) => pct(volleyShot(s, GLOOM_VOLLEY.shots - 1))),
    total: [1, 2, 3].map((s) => pct(Array.from({ length: GLOOM_VOLLEY.shots }, (_, n) => volleyShot(s, n)).reduce((a, b) => a + b))),
  }),
  cast(api, caster, target) {
    let victim: SkillFighter | null = target;
    let n = 0;
    api.busy(caster, true);
    api.repeat(caster, GLOOM_VOLLEY.every, GLOOM_VOLLEY.shots, () => {
      if (!victim || victim.hp <= 0) victim = api.nearestEnemy(caster);
      if (victim) {
        const power = api.attackPower(caster);
        api.basicHit(caster, victim, power.amount * volleyShot(caster.star, n), power.type, 'gloomvolley');
      }
      if (++n >= GLOOM_VOLLEY.shots || !victim) api.busy(caster, false);
    });
  },
};
