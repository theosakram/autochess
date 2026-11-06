import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Per star, index 0 = 1★.
export const STARFALL_AEGIS = {
  shield: [0.1, 0.2, 0.75], // of max hp, lasts the whole starfall
  ap: [0.95, 1, 4], // of magic attack, to every enemy, per strike
  every: 0.5, // seconds between strikes
  seconds: 5, // starfall duration
};

export const starfallAegis: SkillDef = {
  id: 'starfallaegis',
  name: 'Starfall Aegis',
  desc:
    `Gains a shield of {shield} max HP and calls down stars on the entire enemy board every ${STARFALL_AEGIS.every}s ` +
    `for ${STARFALL_AEGIS.seconds}s, each strike dealing {ap} of magic attack as magic damage.`,
  values: () => ({ shield: STARFALL_AEGIS.shield.map(pct), ap: STARFALL_AEGIS.ap.map(pct) }),
  cast(api, caster) {
    const S = STARFALL_AEGIS;
    const i = caster.star - 1;
    api.shield(caster, caster.maxHp * S.shield[i], S.seconds, 'starfallaegis');
    const raw = caster.stats.ap * S.ap[i];
    api.repeat(caster, S.every, Math.round(S.seconds / S.every), () => {
      for (const enemy of api.enemiesOf(caster)) api.hit(caster, enemy, raw, 'magic', 'starfall');
    });
  },
};
