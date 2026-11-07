import { pct } from '../traits/format';
import { ahead3x3, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Edith (3g Cult of Fire / Defender). Per star, index 0 = 1★.
export const ASHEN_WALL = {
  atk: [5, 5, 8.9], // of attack, physical, to each enemy in the 3x3 ahead
  stun: [0.8, 0.9, 1], // seconds: knocked up
  shield: [0.08, 0.08, 0.1], // of its max hp, after the knock
  seconds: 4, // shield
};

export const ashenWall: SkillDef = {
  id: 'ashenwall',
  name: 'Ashen Wall',
  desc:
    'Knocks up the 3x3 area in front of it: every enemy there takes {atk} of attack as physical damage and is stunned for {stun}. ' +
    `Then it gains a shield of {shield} of its max HP for ${ASHEN_WALL.seconds}s.`,
  damage: { atk: 'physical' },
  values: () => ({ atk: ASHEN_WALL.atk.map(pct), stun: ASHEN_WALL.stun.map((s) => `${s}s`), shield: ASHEN_WALL.shield.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    const raw = caster.stats.atk * ASHEN_WALL.atk[i];
    for (const e of enemiesOn(api, caster, ahead3x3(caster))) {
      if (!api.hit(caster, e, raw, 'physical', 'ashenwall')) api.stun(e, ASHEN_WALL.stun[i], caster);
    }
    api.shield(caster, caster.maxHp * ASHEN_WALL.shield[i], ASHEN_WALL.seconds, 'ashenwall');
  },
};
