import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Odette (5g Astral / Mage). Per star, index 0 = 1★.
export const STARFALL_AEGIS = {
  shield: [600, 1300, 9685], // flat, lasts the whole channel
  ap: [1.2, 1.2, 4.5], // of magic attack, to every enemy, per strike
  every: 0.5, // seconds between strikes
  seconds: 5, // the channel
};

export const starfallAegis: SkillDef = {
  id: 'starfallaegis',
  name: 'Starfall Aegis',
  desc:
    `Gains a {shield} shield and channels for ${STARFALL_AEGIS.seconds}s (no attacking or moving), calling down stars on ` +
    `the entire enemy board every ${STARFALL_AEGIS.every}s, each strike dealing {ap} of magic attack as magic damage.`,
  damage: { ap: 'magic' },
  values: () => ({ shield: STARFALL_AEGIS.shield.map(String), ap: STARFALL_AEGIS.ap.map(pct) }),
  cast(api, caster) {
    const S = STARFALL_AEGIS;
    const i = caster.star - 1;
    const times = Math.round(S.seconds / S.every);
    api.shield(caster, S.shield[i], S.seconds, 'starfallaegis');
    api.busy(caster, true);
    let n = 0;
    api.repeat(caster, S.every, times, () => {
      const raw = caster.stats.ap * S.ap[i];
      for (const enemy of api.enemiesOf(caster)) api.hit(caster, enemy, raw, 'magic', 'starfall');
      if (++n >= times || !api.enemiesOf(caster).length) api.busy(caster, false);
    });
  },
};
