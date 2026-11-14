import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Zhizong (4g Skybringer / Weapon Master). Per star, index 0 = 1★. No passive: on a Weapon Master board his
// every-3rd-attack Masterstroke is the trait's, like any member's.
export const SKY_REAP = {
  damage: [0.5, 1.5, 4], // basic attack damage added while it lasts: x1.5 / x2.5 / x5 (3★ 4g must beat 2★ 5g)
  attackSpeed: 0.6,
  seconds: 6,
};

const EFFECT = 'skyreap';

export const skyReap: SkillDef = {
  id: 'skyreap',
  name: 'Sky Reap',
  desc: `For ${SKY_REAP.seconds}s, gains +${pct(SKY_REAP.attackSpeed)} attack speed and his basic attacks deal {mult} damage.`,
  values: () => ({ mult: SKY_REAP.damage.map((d) => `${1 + d}x`) }),
  cast(api, caster) {
    api.buff(
      caster,
      [
        { stat: 'attackSpeed', add: SKY_REAP.attackSpeed },
        { stat: 'basicAmp', add: SKY_REAP.damage[caster.star - 1] },
      ],
      SKY_REAP.seconds,
      EFFECT,
      caster,
    );
  },
};
