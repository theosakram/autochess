import { GRID_H } from '../grid';
import { pct } from '../traits/format';
import { aheadStrip, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Wandering Eye (Plane Wanderer, Deadeye). Per star, index 0 = 1★.
export const WANDERERS_VOLLEY = {
  atk: [2.8, 3.6, 8.5], // of attack, physical, to each enemy in the path
};

export const wanderersVolley: SkillDef = {
  id: 'wanderersvolley',
  name: "Wanderer's Volley",
  desc: 'Looses a projectile 3 tiles wide that flies to the far end of the board ahead of it, hitting every enemy in its path for {atk} of attack as physical damage.',
  values: () => ({ atk: WANDERERS_VOLLEY.atk.map(pct) }),
  cast(api, caster) {
    const end = { x: caster.x, y: caster.side === 0 ? 0 : GRID_H - 1 };
    api.showProjectile(caster, end, 0.3, 'wanderersvolley');
    const raw = caster.stats.atk * WANDERERS_VOLLEY.atk[caster.star - 1];
    for (const e of enemiesOn(api, caster, aheadStrip(caster))) api.hit(caster, e, raw, 'physical', 'wanderersvolley');
  },
};
