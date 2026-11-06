import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillDef } from './types';

// Wraithlord (5g Dauntless). Per star, index 0 = 1★.
export const DREAD_DESCENT = {
  atk: [2.2, 2.6, 6], // of attack, physical, to each enemy around where it lands
  stun: 1.5, // seconds
};

export const dreadDescent: SkillDef = {
  id: 'dreaddescent',
  name: 'Dread Descent',
  desc:
    'Leaps into the thick of the enemy, onto the spot with the most of them around it: ' +
    `every enemy on the tiles around where it lands takes {atk} of attack as physical damage and is stunned for ${DREAD_DESCENT.stun}s.`,
  values: () => ({ atk: DREAD_DESCENT.atk.map(pct) }),
  cast(api, caster) {
    const spot = densestDrop(api, caster);
    if (spot) api.dashTo(caster, spot);
    const raw = caster.stats.atk * DREAD_DESCENT.atk[caster.star - 1];
    for (const e of enemiesOn(api, caster, around(caster))) {
      if (!api.hit(caster, e, raw, 'physical', 'dreaddescent')) api.stun(e, DREAD_DESCENT.stun, caster);
    }
  },
};
