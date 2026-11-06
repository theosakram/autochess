import { pct } from '../traits/format';
import { beyond, enemiesOn, pathTo } from './areas';
import type { SkillDef, SkillFighter } from './types';

// Mist Oracle (5g Mistbender): like Tidal Surge, but it throws the wave instead of riding it.
// Per star, index 0 = 1★.
export const MIST_BOOMERANG = {
  ap: [2.6, 3.1, 8], // of magic attack, magic, to each enemy on the path, per pass (out and back)
  past: 2, // tiles it flies on past its target before turning back
  back: 0.4, // seconds before it flies back
};

export const mistBoomerang: SkillDef = {
  id: 'mistboomerang',
  name: 'Mist Boomerang',
  desc:
    `Throws a boomerang of mist through its target and ${MIST_BOOMERANG.past} tiles beyond, then it flies back, ` +
    'hitting every enemy on the path both ways for {ap} of magic attack as magic damage each pass.',
  values: () => ({ ap: MIST_BOOMERANG.ap.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const raw = caster.stats.ap * MIST_BOOMERANG.ap[caster.star - 1];
    // The path is fixed when it's thrown; whoever stands on it when it passes gets hit (once per pass).
    const from = { x: caster.x, y: caster.y };
    const at = { x: victim.x, y: victim.y };
    const end = beyond(from, at, MIST_BOOMERANG.past);
    const path = [...pathTo(from, at), ...pathTo(at, end)];
    const pass = () => {
      const struck = new Set<SkillFighter>();
      for (const e of enemiesOn(api, caster, path)) {
        if (e.hp <= 0 || struck.has(e)) continue;
        struck.add(e);
        api.hit(caster, e, raw, 'magic', 'mistboomerang');
      }
    };
    api.showProjectile(from, end, MIST_BOOMERANG.back, 'mistboomerang');
    pass();
    api.repeat(caster, MIST_BOOMERANG.back, 1, () => {
      api.showProjectile(end, from, MIST_BOOMERANG.back, 'mistboomerang');
      pass();
    });
  },
};
