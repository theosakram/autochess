import { dist } from '../grid';
import { pct } from '../traits/format';
import { freeCellNextTo } from './dashStrike';
import type { SkillDef, SkillFighter } from './types';

// Wandering Hunter (Plane Wanderer, Hunter). Per star, index 0 = 1★.
export const STALKERS_MARK = {
  execute: [0.08, 0.1, 0.15], // passive: of max hp
  back: 0.5, // seconds away before it strikes
  atk: [6, 9, 21], // of attack, physical
};

export const stalkersMark: SkillDef = {
  id: 'stalkersmark',
  name: "Stalker's Mark",
  desc:
    'Passive: an enemy on the tiles around it left below {execute} of its max HP is executed. ' +
    `Active: vanishes to the safest tile, so its attackers lose it, then ${STALKERS_MARK.back}s later strikes back at its prey for {atk} of attack as physical damage.`,
  damage: { atk: 'physical' },
  values: () => ({ execute: STALKERS_MARK.execute.map(pct), atk: STALKERS_MARK.atk.map(pct) }),
  executeBelow: STALKERS_MARK.execute,
  cast(api, caster, target) {
    let prey: SkillFighter | null = target.hp > 0 ? target : api.nearestEnemy(caster);
    const safe = api.safestCell(caster);
    if (safe.x !== caster.x || safe.y !== caster.y) api.dashTo(caster, safe);
    api.dropAggro(caster);
    api.busy(caster, true);
    api.repeat(caster, STALKERS_MARK.back, 1, () => {
      if (!prey || prey.hp <= 0) prey = api.nearestEnemy(caster);
      if (prey) {
        if (dist(caster, prey) > 1) {
          const spot = freeCellNextTo(api, prey, caster);
          if (spot) api.dashTo(caster, spot);
        }
        api.hit(caster, prey, caster.stats.atk * STALKERS_MARK.atk[caster.star - 1], 'physical', 'stalkersmark');
      }
      api.busy(caster, false);
    });
  },
};
