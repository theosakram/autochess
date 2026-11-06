import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Crypt Warden (3g Defender). Per star, index 0 = 1★.
export const CRYPT_SEAL = {
  atk: [0.7, 0.9, 1.8], // of attack, physical, to each enemy around it
  stun: 1,
  shield: [0.2, 0.25, 0.4], // of its max hp
  seconds: 4,
};

export const cryptSeal: SkillDef = {
  id: 'cryptseal',
  name: 'Crypt Seal',
  desc:
    `Seals the tiles around it: every enemy there takes {atk} of attack as physical damage and is stunned for ${CRYPT_SEAL.stun}s. ` +
    `It then gains a shield of {shield} of its max HP for ${CRYPT_SEAL.seconds}s.`,
  values: () => ({ atk: CRYPT_SEAL.atk.map(pct), shield: CRYPT_SEAL.shield.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    for (const e of enemiesOn(api, caster, around(caster))) {
      if (!api.hit(caster, e, caster.stats.atk * CRYPT_SEAL.atk[i], 'physical', 'cryptseal')) api.stun(e, CRYPT_SEAL.stun, caster);
    }
    api.shield(caster, caster.maxHp * CRYPT_SEAL.shield[i], CRYPT_SEAL.seconds, 'cryptseal');
  },
};
