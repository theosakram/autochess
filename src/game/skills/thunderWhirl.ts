import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Balman (2g Skybringer / Dauntless). Per star, index 0 = 1★.
export const THUNDER_WHIRL = {
  pulses: 12,
  every: 0.25, // seconds between pulses
  atk: [0.5, 0.6, 0.8], // of attack, physical, per pulse to each enemy around it
  defense: [10, 20, 40], // armor and magic resist while it whirls
};

// From the first pulse to the last, plus a beat: the defense lasts the whole whirl.
const WHIRL_SECONDS = THUNDER_WHIRL.pulses * THUNDER_WHIRL.every;

export const thunderWhirl: SkillDef = {
  id: 'thunderwhirl',
  name: 'Thunder Whirl',
  desc:
    `Gains +{def} armor and magic resist for ${WHIRL_SECONDS}s and whirls: ${THUNDER_WHIRL.pulses} times, ${THUNDER_WHIRL.every}s apart, ` +
    'each enemy on the tiles around it takes {atk} of attack as physical damage.',
  damage: { atk: 'physical' },
  values: () => ({ atk: THUNDER_WHIRL.atk.map(pct), def: THUNDER_WHIRL.defense.map(String) }),
  cast(api, caster) {
    const i = caster.star - 1;
    const def = THUNDER_WHIRL.defense[i];
    api.buff(
      caster,
      [
        { stat: 'armor', add: def },
        { stat: 'mr', add: def },
      ],
      WHIRL_SECONDS,
      'thunderwhirl',
      caster,
    );
    const raw = caster.stats.atk * THUNDER_WHIRL.atk[i];
    const pulse = () => {
      for (const e of enemiesOn(api, caster, around(caster))) if (e.hp > 0) api.hit(caster, e, raw, 'physical', 'thunderwhirl');
    };
    pulse();
    api.repeat(caster, THUNDER_WHIRL.every, THUNDER_WHIRL.pulses - 1, pulse);
  },
};
