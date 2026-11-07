import { pct } from '../traits/format';
import { enemiesOn, lineThrough, wideLine } from './areas';
import type { SkillDef } from './types';

// Moscow (Plane Wanderer, Deadeye). Per star, index 0 = 1★.
export const WANDERERS_VOLLEY = {
  atk: [3.2, 3.4, 8], // of attack, physical, to each enemy in the path
};

export const wanderersVolley: SkillDef = {
  id: 'wanderersvolley',
  name: "Wanderer's Volley",
  desc: 'Looses a projectile 3 tiles wide through its target to the edge of the board, hitting every enemy in its path for {atk} of attack as physical damage.',
  damage: { atk: 'physical' },
  values: () => ({ atk: WANDERERS_VOLLEY.atk.map(pct) }),
  cast(api, caster, target) {
    // Aimed at a living enemy: its target, else the nearest.
    const aim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!aim || (aim.x === caster.x && aim.y === caster.y)) return;
    const line = lineThrough(caster, aim);
    api.showProjectile(caster, line[line.length - 1] ?? aim, 0.3, 'wanderersvolley');
    const raw = caster.stats.atk * WANDERERS_VOLLEY.atk[caster.star - 1];
    for (const e of enemiesOn(api, caster, wideLine(caster, aim))) api.hit(caster, e, raw, 'physical', 'wanderersvolley');
  },
};
