import { pct } from '../traits/format';
import { ahead3x3, enemiesOn } from './areas';
import type { SkillDef } from './types';

// High Pyromancer (4g Dauntless). Per star, index 0 = 1★.
export const PYRE_BLAST = {
  atk: [1.6, 1.9, 4], // of attack, physical, to each enemy in the 3x3 ahead
  stun: 1, // seconds
  shield: [0.2, 0.25, 0.4], // of its max hp
  seconds: 4,
};

export const pyreBlast: SkillDef = {
  id: 'pyreblast',
  name: 'Pyre Blast',
  desc:
    `Blasts the 3x3 in front of it: every enemy there takes {atk} of attack as physical damage and is stunned for ${PYRE_BLAST.stun}s. ` +
    `It then gains a shield of {shield} of its max HP for ${PYRE_BLAST.seconds}s.`,
  values: () => ({ atk: PYRE_BLAST.atk.map(pct), shield: PYRE_BLAST.shield.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    for (const e of enemiesOn(api, caster, ahead3x3(caster))) {
      if (!api.hit(caster, e, caster.stats.atk * PYRE_BLAST.atk[i], 'physical', 'pyreblast')) api.stun(e, PYRE_BLAST.stun, caster);
    }
    api.shield(caster, caster.maxHp * PYRE_BLAST.shield[i], PYRE_BLAST.seconds, 'pyreblast');
  },
};
