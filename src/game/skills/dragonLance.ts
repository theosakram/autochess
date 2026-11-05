import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Wyrmcaller (3g Deadeye): a plain single-target nuke. Per star, index 0 = 1★.
export const DRAGON_LANCE = {
  atk: [3.8, 4.5, 9.5], // of attack, physical
};

export const dragonLance: SkillDef = {
  id: 'dragonlance',
  name: 'Dragon Lance',
  desc: 'Hurls a lance at its target for {atk} of attack as physical damage.',
  values: () => ({ atk: DRAGON_LANCE.atk.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (victim) api.hit(caster, victim, caster.stats.atk * DRAGON_LANCE.atk[caster.star - 1], 'physical', 'dragonlance');
  },
};
