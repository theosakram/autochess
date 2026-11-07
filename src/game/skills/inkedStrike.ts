import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Belle (2g Storyweaver / Fighter). Per star, index 0 = 1★.
export const INKED_STRIKE = {
  ap: [3.5, 3.5, 4.5], // of magic attack, magic damage, as an enhanced basic hit
  heal: 0.1, // of its missing hp, after the hit
};

export const inkedStrike: SkillDef = {
  id: 'inkedstrike',
  name: 'Inked Strike',
  desc: `Empowers its next attack to deal {ap} of magic attack as magic damage, then restores ${pct(INKED_STRIKE.heal)} of its missing HP.`,
  damage: { ap: 'magic' },
  values: () => ({ ap: INKED_STRIKE.ap.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    api.basicHit(caster, victim, caster.stats.ap * INKED_STRIKE.ap[caster.star - 1], 'magic', 'inkedstrike');
    api.heal(caster, (caster.maxHp - caster.hp) * INKED_STRIKE.heal);
  },
};
