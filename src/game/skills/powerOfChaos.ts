import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Per star, index 0 = 1★.
export const POWER_OF_CHAOS = {
  atk: [4, 4.5, 12], // of magic attack per Chaos Assault (one attack stat until AP exists)
  assaults: 3,
};

export const powerOfChaos: SkillDef = {
  id: 'powerofchaos',
  name: 'Power of Chaos',
  desc:
    `Dashes to a safe location and releases ${POWER_OF_CHAOS.assaults} Chaos Assaults, enhanced basic attacks at the nearest enemy, ` +
    'each dealing {atk} of magic attack as magic damage. Killing an enemy grants 1 more Chaos Assault.',
  values: () => ({ atk: POWER_OF_CHAOS.atk.map(pct) }),
  cast(api, caster) {
    const safe = api.safestCell(caster);
    if (safe.x !== caster.x || safe.y !== caster.y) api.dashTo(caster, safe);
    const raw = caster.stats.atk * POWER_OF_CHAOS.atk[caster.star - 1];
    for (let left = POWER_OF_CHAOS.assaults; left > 0; left--) {
      const target = api.nearestEnemy(caster);
      if (!target) return;
      if (api.basicHit(caster, target, raw, 'magic', 'chaosassault')) left++;
    }
  },
};
