import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Gadjah Mada (Plane Wanderer, Defender): the Palapa Oath, to unite the archipelago. Per star, index 0 = 1★.
export const SUMPAH_PALAPA = {
  shield: [0.08, 0.1, 0.2], // of his max hp, a shield on every ally
  self: 2, // his own shield, this many times theirs
  seconds: 4, // how long the shields last
  taunt: 2, // seconds, every enemy around him
};

const EFFECT = 'sumpahpalapa';

export const sumpahPalapa: SkillDef = {
  id: 'sumpahpalapa',
  name: 'Sumpah Palapa',
  desc:
    `Swears the Palapa Oath: every ally gains a shield of {shield} of his max HP for ${SUMPAH_PALAPA.seconds}s, ` +
    `and he gains ${SUMPAH_PALAPA.self} times as much. Every enemy around him is taunted for ${SUMPAH_PALAPA.taunt}s.`,
  values: () => ({ shield: SUMPAH_PALAPA.shield.map(pct) }),
  cast(api, caster) {
    const P = SUMPAH_PALAPA;
    const amount = caster.maxHp * P.shield[caster.star - 1];
    for (const ally of api.alliesOf(caster)) api.shield(ally, ally === caster ? amount * P.self : amount, P.seconds, EFFECT);
    for (const e of enemiesOn(api, caster, around(caster))) api.taunt(e, caster, P.taunt);
  },
};
