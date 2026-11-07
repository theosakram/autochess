import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Eudora (1g Skybringer / Stargazer): a lightning bolt that leaves the target Weak. Per star, index 0 = 1★.
export const GALE_SHOT = {
  ap: [4.3, 4.3, 5.2], // of magic attack, magic
  weak: [0.05, 0.06, 0.1], // more damage taken from every source
  seconds: 3,
};

export const galeShot: SkillDef = {
  id: 'galeshot',
  name: 'Gale Shot',
  desc:
    'Calls lightning down on its target for {ap} of magic attack as magic damage, leaving it Weak: ' +
    `it takes +{weak} damage from every source for ${GALE_SHOT.seconds}s.`,
  damage: { ap: 'magic' },
  values: () => ({ ap: GALE_SHOT.ap.map(pct), weak: GALE_SHOT.weak.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const i = caster.star - 1;
    if (api.hit(caster, victim, caster.stats.ap * GALE_SHOT.ap[i], 'magic', 'galeshot')) return;
    api.buff(victim, [{ stat: 'damageTaken', add: GALE_SHOT.weak[i] }], GALE_SHOT.seconds, 'weak', caster);
  },
};
