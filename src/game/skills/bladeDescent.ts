import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillDef } from './types';

// Wandering Fist (Plane Wanderer, Fighter). Per star, index 0 = 1★.
export const BLADE_DESCENT = {
  stun: [1, 1.25, 1.75], // seconds, everyone around where it lands
  bonus: [4.5, 5.5, 12], // its next basic attack: extra damage
  shield: [0.25, 0.3, 0.5], // of its max hp
  seconds: 4,
};

export const bladeDescent: SkillDef = {
  id: 'bladedescent',
  name: 'Meteor Fist',
  desc:
    'Leaps into the thick of the enemy (the spot with the most of them around it), stunning everyone around it for {stun}. ' +
    `Its next basic attack deals {bonus} more damage, and it gains a shield of {shield} of its max HP for ${BLADE_DESCENT.seconds}s.`,
  damage: { bonus: 'attack' },
  values: () => ({ stun: BLADE_DESCENT.stun.map((s) => `${s}s`), bonus: BLADE_DESCENT.bonus.map(pct), shield: BLADE_DESCENT.shield.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (spot) api.dashTo(caster, spot);
    for (const e of enemiesOn(api, caster, around(caster))) api.stun(e, BLADE_DESCENT.stun[i], caster);
    // Charged until its next basic attack (see onBasicHit).
    api.buff(caster, [{ stat: 'basicAmp', add: BLADE_DESCENT.bonus[i] }], Infinity, 'bladecharged', caster);
    api.shield(caster, caster.maxHp * BLADE_DESCENT.shield[i], BLADE_DESCENT.seconds, 'bladedescent');
  },
  onBasicHit(api, caster) {
    if (api.hasBuff(caster, 'bladecharged')) api.unbuff(caster, 'bladecharged');
  },
};
