import { pct } from '../traits/format';
import { aheadStrip, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Ash Warden (3g Defender). Per star, index 0 = 1★.
export const ASHEN_WALL = {
  atk: [0.8, 1, 2], // of attack, physical: small
  stun: 1.25, // seconds
};

export const ashenWall: SkillDef = {
  id: 'ashenwall',
  name: 'Ashen Wall',
  desc:
    'Sends a wall of ash 3 tiles wide from in front of it to the far end of the enemy board: ' +
    `every enemy in it takes {atk} of attack as physical damage and is stunned for ${ASHEN_WALL.stun}s.`,
  values: () => ({ atk: ASHEN_WALL.atk.map(pct) }),
  cast(api, caster) {
    const raw = caster.stats.atk * ASHEN_WALL.atk[caster.star - 1];
    for (const e of enemiesOn(api, caster, aheadStrip(caster))) {
      if (!api.hit(caster, e, raw, 'physical', 'ashenwall')) api.stun(e, ASHEN_WALL.stun, caster);
    }
  },
};
