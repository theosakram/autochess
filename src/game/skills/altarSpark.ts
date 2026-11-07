import { pct } from '../traits/format';
import { coneBehind, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Luo Yi (2g Dragon Altar / Stargazer). Per star, index 0 = 1★.
export const ALTAR_SPARK = {
  ap: [2.15, 2.25, 2.95], // of magic attack, magic, to the target and each enemy in the cone behind it
  depth: 2, // the cone: 3 cells wide just behind the target, 5 wide behind that
};

export const altarSpark: SkillDef = {
  id: 'altarspark',
  name: 'Altar Spark',
  desc:
    'Fires a bolt at its target that bursts through it: the target and every enemy in a cone behind it ' +
    `(${ALTAR_SPARK.depth} rows deep, widening) take {ap} of magic attack as magic damage.`,
  damage: { ap: 'magic' },
  values: () => ({ ap: ALTAR_SPARK.ap.map(pct) }),
  cast(api, caster, target) {
    const center = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!center) return;
    api.showProjectile(caster, center, 0.2, 'altarspark');
    const raw = caster.stats.ap * ALTAR_SPARK.ap[caster.star - 1];
    const cone = enemiesOn(api, caster, coneBehind(caster, center, ALTAR_SPARK.depth));
    for (const e of [center, ...cone]) if (e.hp > 0) api.hit(caster, e, raw, 'magic', 'altarspark');
  },
};
