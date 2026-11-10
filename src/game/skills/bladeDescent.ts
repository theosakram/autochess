import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillDef } from './types';

// Gatotkaca (Plane Wanderer, Fighter). Per star, index 0 = 1★.
export const BLADE_DESCENT = {
  stun: [1, 1.5, 2.5], // seconds, everyone around where it lands
  bonus: [3, 4.2, 14], // its next basic attack: extra damage (400 / 520 / 1500% in all)
  heal: [0.2, 0.3, 0.6], // of its max hp, as it lands
};

export const bladeDescent: SkillDef = {
  id: 'bladedescent',
  name: 'Meteor Fist',
  desc:
    'Leaps into the thick of the enemy (the spot with the most of them around it), stunning everyone around it for {stun}. ' +
    'Its next basic attack deals {bonus} more damage, and it heals {heal} of its max HP.',
  damage: { bonus: 'attack' },
  values: () => ({ stun: BLADE_DESCENT.stun.map((s) => `${s}s`), bonus: BLADE_DESCENT.bonus.map(pct), heal: BLADE_DESCENT.heal.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (spot) api.dashTo(caster, spot);
    for (const e of enemiesOn(api, caster, around(caster))) api.stun(e, BLADE_DESCENT.stun[i], caster);
    // Charged until its next basic attack (see onBasicHit).
    api.buff(caster, [{ stat: 'basicAmp', add: BLADE_DESCENT.bonus[i] }], Infinity, 'bladecharged', caster);
    api.heal(caster, caster.maxHp * BLADE_DESCENT.heal[i]);
  },
  onBasicHit(api, caster) {
    if (api.hasBuff(caster, 'bladecharged')) api.unbuff(caster, 'bladecharged');
  },
};
