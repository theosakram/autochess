import { pct } from '../traits/format';
import { enemiesOn, row3 } from './areas';
import type { SkillDef } from './types';

// Altar Keeper (2g Stargazer): a cheap little row hit to spam. Per star, index 0 = 1★.
export const ALTAR_SPARK = {
  ap: [0.9, 1.1, 2], // of magic attack, magic, to each enemy in the row
};

export const altarSpark: SkillDef = {
  id: 'altarspark',
  name: 'Altar Spark',
  desc: 'Sparks the 3x1 row around its target for {ap} of magic attack as magic damage.',
  values: () => ({ ap: ALTAR_SPARK.ap.map(pct) }),
  cast(api, caster, target) {
    const center = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!center) return;
    const raw = caster.stats.ap * ALTAR_SPARK.ap[caster.star - 1];
    for (const e of enemiesOn(api, caster, row3(center))) api.hit(caster, e, raw, 'magic', 'altarspark');
  },
};
