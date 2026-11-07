import { pct } from '../traits/format';
import { beyond, enemiesOn, pathTo } from './areas';
import type { SkillDef, SkillFighter } from './types';

// Nana (5g Mistbender / Stargazer): a boomerang of mist, thrown through its target and back.
// Per star, index 0 = 1★.
export const MIST_BOOMERANG = {
  out: [3, 3, 20], // of magic attack, magic, to each enemy on the path on the way out
  back: [3.3, 3.3, 11], // ...and on the way back
  past: 2, // tiles it flies on past its target before turning back
  turn: 0.4, // seconds before it flies back
};

export const mistBoomerang: SkillDef = {
  id: 'mistboomerang',
  name: 'Mist Boomerang',
  desc:
    `Throws a boomerang of mist through its target and ${MIST_BOOMERANG.past} tiles beyond, then it flies back, ` +
    'hitting every enemy on the path: {out} of magic attack as magic damage on the way out, {back} on the way back.',
  damage: { out: 'magic', back: 'magic' },
  values: () => ({ out: MIST_BOOMERANG.out.map(pct), back: MIST_BOOMERANG.back.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const i = caster.star - 1;
    // The path is fixed when it's thrown; whoever stands on it when it passes gets hit (once per pass).
    const from = { x: caster.x, y: caster.y };
    const at = { x: victim.x, y: victim.y };
    const end = beyond(from, at, MIST_BOOMERANG.past);
    const path = [...pathTo(from, at), ...pathTo(at, end)];
    const pass = (share: number) => {
      const raw = caster.stats.ap * share;
      const struck = new Set<SkillFighter>();
      for (const e of enemiesOn(api, caster, path)) {
        if (e.hp <= 0 || struck.has(e)) continue;
        struck.add(e);
        api.hit(caster, e, raw, 'magic', 'mistboomerang');
      }
    };
    api.showProjectile(from, end, MIST_BOOMERANG.turn, 'mistboomerang');
    pass(MIST_BOOMERANG.out[i]);
    api.repeat(caster, MIST_BOOMERANG.turn, 1, () => {
      api.showProjectile(end, from, MIST_BOOMERANG.turn, 'mistboomerang');
      pass(MIST_BOOMERANG.back[i]);
    });
  },
};
