import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Arjuna (5g Deadeye): a summoner. Per star, index 0 = 1★.
export const SPIRIT_ARCHERS = {
  archer: 'spiritarcher',
  count: [1, 2, 3], // archers kept summoned
  hp: 0.3, // of Arjuna's max hp, each
  mirror: [0.35, 0.4, 0.6], // of each of Arjuna's basic attacks, repeated by each archer
  attackSpeed: [0.3, 0.4, 0.8],
  damageAmp: [0.2, 0.25, 0.5],
  seconds: 5,
};

export const spiritArchers: SkillDef = {
  id: 'spiritarchers',
  name: 'Spirit Archers',
  desc:
    'Summons spirit archers beside it, up to {count} (fallen ones come back on the next cast). ' +
    `Each has ${pct(SPIRIT_ARCHERS.hp)} of its max HP and, whenever it attacks, shoots the same target for {mirror} of that attack, ` +
    `critting when it crits. The archers vanish if it falls. Arjuna itself (not its archers) gains +{as} attack speed and +{amp} damage for ${SPIRIT_ARCHERS.seconds}s.`,
  values: () => ({
    count: SPIRIT_ARCHERS.count.map(String),
    mirror: SPIRIT_ARCHERS.mirror.map(pct),
    as: SPIRIT_ARCHERS.attackSpeed.map(pct),
    amp: SPIRIT_ARCHERS.damageAmp.map(pct),
  }),
  cast(api, caster) {
    const i = caster.star - 1;
    for (let n = api.minionsOf(caster).length; n < SPIRIT_ARCHERS.count[i]; n++) {
      if (!api.summon(caster, SPIRIT_ARCHERS.archer, { hpShare: SPIRIT_ARCHERS.hp, mirror: SPIRIT_ARCHERS.mirror[i] })) break;
    }
    api.buff(
      caster,
      [
        { stat: 'attackSpeed', add: SPIRIT_ARCHERS.attackSpeed[i] },
        { stat: 'damageAmp', add: SPIRIT_ARCHERS.damageAmp[i] },
      ],
      SPIRIT_ARCHERS.seconds,
      'spiritarchers',
      caster,
    );
  },
};
