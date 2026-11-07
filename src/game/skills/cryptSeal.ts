import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Tig (3g Necromancer / Defender). Per star, index 0 = 1★.
export const CRYPT_SEAL = {
  shield: [0.1, 0.12, 0.16], // of its max hp, first
  seconds: 4, // shield
  atk: [3.15, 3.15, 6.4], // of attack, physical, to each enemy around it
  stun: [0.6, 0.8, 1.2], // seconds
};

export const cryptSeal: SkillDef = {
  id: 'cryptseal',
  name: 'Crypt Seal',
  desc:
    `Gains a shield of {shield} of its max HP for ${CRYPT_SEAL.seconds}s, then slams the tiles around it: ` +
    'every enemy there takes {atk} of attack as physical damage and is stunned for {stun}.',
  damage: { atk: 'physical' },
  values: () => ({ shield: CRYPT_SEAL.shield.map(pct), atk: CRYPT_SEAL.atk.map(pct), stun: CRYPT_SEAL.stun.map((s) => `${s}s`) }),
  cast(api, caster) {
    const i = caster.star - 1;
    api.shield(caster, caster.maxHp * CRYPT_SEAL.shield[i], CRYPT_SEAL.seconds, 'cryptseal');
    for (const e of enemiesOn(api, caster, around(caster))) {
      if (!api.hit(caster, e, caster.stats.atk * CRYPT_SEAL.atk[i], 'physical', 'cryptseal')) api.stun(e, CRYPT_SEAL.stun[i], caster);
    }
  },
};
