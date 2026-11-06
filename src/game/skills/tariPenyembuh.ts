import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Penari (2g Scavenger): a healer. Per star, index 0 = 1★.
export const TARI_PENYEMBUH = {
  atk: [3, 3.5, 7], // of its attack, healed to one ally
};

export const tariPenyembuh: SkillDef = {
  id: 'taripenyembuh',
  name: 'Tari Penyembuh',
  desc: 'Dances for the most wounded ally (lowest HP %, itself included), healing it for {atk} of attack.',
  values: () => ({ atk: TARI_PENYEMBUH.atk.map(pct) }),
  cast(api, caster) {
    const hurt = api
      .alliesOf(caster)
      .filter((a) => a.hp < a.maxHp)
      .reduce<ReturnType<typeof api.alliesOf>[number] | null>((low, a) => (!low || a.hp / a.maxHp < low.hp / low.maxHp ? a : low), null);
    if (hurt) api.heal(hurt, caster.stats.atk * TARI_PENYEMBUH.atk[caster.star - 1]);
  },
};
