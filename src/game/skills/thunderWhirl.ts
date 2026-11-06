import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Thunderhawk (2g Dauntless). Per star, index 0 = 1★.
export const THUNDER_WHIRL = {
  every: 0.25,
  seconds: 1.5,
  atk: [0.35, 0.42, 0.85], // of attack, physical, per pulse to each enemy around it
};

export const thunderWhirl: SkillDef = {
  id: 'thunderwhirl',
  name: 'Thunder Whirl',
  desc:
    `Whirls for ${THUNDER_WHIRL.seconds}s: every ${THUNDER_WHIRL.every}s, each enemy on the tiles around it ` +
    'takes {atk} of attack as physical damage.',
  values: () => ({ atk: THUNDER_WHIRL.atk.map(pct) }),
  cast(api, caster) {
    const raw = caster.stats.atk * THUNDER_WHIRL.atk[caster.star - 1];
    const pulse = () => {
      for (const e of enemiesOn(api, caster, around(caster))) if (e.hp > 0) api.hit(caster, e, raw, 'physical', 'thunderwhirl');
    };
    pulse();
    api.repeat(caster, THUNDER_WHIRL.every, Math.round(THUNDER_WHIRL.seconds / THUNDER_WHIRL.every) - 1, pulse);
  },
};
