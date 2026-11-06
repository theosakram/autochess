import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Galekin (1g Stargazer): a cheap shot that leaves the target Weak. Per star, index 0 = 1★.
export const GALE_SHOT = {
  atk: [1, 1.2, 2.2], // of attack, physical
  weak: [0.12, 0.15, 0.25], // more damage taken from every source
  seconds: 3,
};

export const galeShot: SkillDef = {
  id: 'galeshot',
  name: 'Gale Shot',
  desc:
    'Fires a gust at its target for {atk} of attack as physical damage, leaving it Weak: ' +
    `it takes +{weak} damage from every source for ${GALE_SHOT.seconds}s.`,
  values: () => ({ atk: GALE_SHOT.atk.map(pct), weak: GALE_SHOT.weak.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const i = caster.star - 1;
    api.showProjectile(caster, victim, 0.2, 'galeshot');
    if (api.hit(caster, victim, caster.stats.atk * GALE_SHOT.atk[i], 'physical', 'galeshot')) return;
    api.buff(victim, [{ stat: 'damageTaken', add: GALE_SHOT.weak[i] }], GALE_SHOT.seconds, 'weak', caster);
  },
};
