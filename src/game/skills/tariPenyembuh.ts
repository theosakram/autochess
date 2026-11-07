import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Angela (2g Gustiwana / Scavenger): a healer. Per star, index 0 = 1★.
export const TARI_PENYEMBUH = {
  ap: [2.4, 2.4, 3], // of its magic attack, healed to one ally
};

export const tariPenyembuh: SkillDef = {
  id: 'taripenyembuh',
  name: 'Tari Penyembuh',
  desc: 'Dances for the most wounded ally (lowest HP %, itself included), healing it for {ap} of magic attack.',
  values: () => ({ ap: TARI_PENYEMBUH.ap.map(pct) }),
  cast(api, caster) {
    const hurt = api
      .alliesOf(caster)
      .filter((a) => a.hp < a.maxHp)
      .reduce<ReturnType<typeof api.alliesOf>[number] | null>((low, a) => (!low || a.hp / a.maxHp < low.hp / low.maxHp ? a : low), null);
    if (hurt) api.heal(hurt, caster.stats.ap * TARI_PENYEMBUH.ap[caster.star - 1]);
  },
};
