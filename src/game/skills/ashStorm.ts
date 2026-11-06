import { pct } from '../traits/format';
import { around } from './areas';
import type { SkillDef } from './types';

// Ashbinder (2g Mage). Per star, index 0 = 1★.
export const ASH_STORM = {
  ap: [0.5, 0.6, 1.1], // of magic attack, magic, every 0.5s to each enemy in the 3x3
  seconds: 2,
};

export const ashStorm: SkillDef = {
  id: 'ashstorm',
  name: 'Ash Storm',
  desc: `Sets the 3x3 around its target ablaze for ${ASH_STORM.seconds}s: every 0.5s, each enemy in it takes {ap} of magic attack as magic damage.`,
  values: () => ({ ap: ASH_STORM.ap.map(pct) }),
  cast(api, caster, target) {
    const center = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!center) return;
    // Burning ground ticks every 0.5s for half its per-second amount.
    const perSecond = caster.stats.ap * ASH_STORM.ap[caster.star - 1] * 2;
    api.burn(caster, [{ x: center.x, y: center.y }, ...around(center)], perSecond, 'magic', ASH_STORM.seconds, 'ashstorm');
  },
};
