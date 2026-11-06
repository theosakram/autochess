import { pct } from '../traits/format';
import { enemiesOn, pathTo } from './areas';
import type { SkillDef } from './types';

// Mist Oracle (5g Mistbender): like Tidal Surge, but it throws the wave instead of riding it.
// Per star, index 0 = 1★.
export const MIST_BOOMERANG = {
  ap: [2.6, 3.1, 8], // of magic attack, magic, to each enemy on the path, per pass (out and back)
  back: 0.3, // seconds before it flies back
};

export const mistBoomerang: SkillDef = {
  id: 'mistboomerang',
  name: 'Mist Boomerang',
  desc:
    'Throws a boomerang of mist at its target that flies back a moment later, ' +
    'hitting every enemy on the path both ways for {ap} of magic attack as magic damage each pass.',
  values: () => ({ ap: MIST_BOOMERANG.ap.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const raw = caster.stats.ap * MIST_BOOMERANG.ap[caster.star - 1];
    // The path is fixed when it's thrown; whoever stands on it when it passes gets hit.
    const from = { x: caster.x, y: caster.y };
    const end = { x: victim.x, y: victim.y };
    const path = pathTo(from, end);
    const pass = () => {
      for (const e of enemiesOn(api, caster, path)) if (e.hp > 0) api.hit(caster, e, raw, 'magic', 'mistboomerang');
    };
    api.showProjectile(from, end, MIST_BOOMERANG.back, 'mistboomerang');
    pass();
    api.repeat(caster, MIST_BOOMERANG.back, 1, () => {
      api.showProjectile(end, from, MIST_BOOMERANG.back, 'mistboomerang');
      pass();
    });
  },
};
