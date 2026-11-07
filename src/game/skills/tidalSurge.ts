import { pct } from '../traits/format';
import { enemiesOn, lineThrough } from './areas';
import type { SkillDef } from './types';

// Kanina (3g Mooneater / Phasewarper / Mage): a wave rolls from her through her target. Per star, index 0 = 1★.
export const TIDAL_SURGE = {
  ap: [5, 5.2, 6.4], // of magic attack, magic, to each enemy in the line
};

export const tidalSurge: SkillDef = {
  id: 'tidalsurge',
  name: 'Tidal Surge',
  desc: 'Sends a wave 1 tile wide in a straight line through her target to the edge of the board, hitting every enemy it passes for {ap} of magic attack as magic damage.',
  damage: { ap: 'magic' },
  values: () => ({ ap: TIDAL_SURGE.ap.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const line = lineThrough(caster, victim);
    api.showProjectile(caster, line[line.length - 1], 0.3, 'tidalsurge');
    const raw = caster.stats.ap * TIDAL_SURGE.ap[caster.star - 1];
    for (const e of enemiesOn(api, caster, line)) api.hit(caster, e, raw, 'magic', 'tidalsurge');
  },
};
