import { pct } from '../traits/format';
import { enemiesOn, row3 } from './areas';
import { withStat } from './lend';
import type { SkillDef, SkillFighter } from './types';

// Drake Rider (4g Weapon Master). Per star, index 0 = 1★.
export const DRAKE_REND = {
  every: 0.3, // seconds between slashes
  slash: [1, 1.2, 2.4], // of attack, physical, the first two slashes (each enemy in the 3x1 row)
  finisher: [2, 2.4, 5], // of attack, physical, the third
  lifesteal: [1, 1.2, 2], // of the third slash's damage
};

export const drakeRend: SkillDef = {
  id: 'drakerend',
  name: 'Drake Rend',
  desc:
    `Slashes the 3x1 row around its target 3 times, ${DRAKE_REND.every}s apart: twice for {slash} of attack, ` +
    'then a finisher for {finisher} that heals it for {lifesteal} of the damage it deals. All physical.',
  values: () => ({ slash: DRAKE_REND.slash.map(pct), finisher: DRAKE_REND.finisher.map(pct), lifesteal: DRAKE_REND.lifesteal.map(pct) }),
  cast(api, caster, target) {
    const i = caster.star - 1;
    let center: SkillFighter | null = target;
    let n = 0;
    const slash = () => {
      if (!center || center.hp <= 0) center = api.nearestEnemy(caster);
      const last = n === 2;
      if (center) {
        const victims = enemiesOn(api, caster, row3(center));
        const raw = caster.stats.atk * (last ? DRAKE_REND.finisher[i] : DRAKE_REND.slash[i]);
        const hit = () => victims.forEach((e) => api.hit(caster, e, raw, 'physical', last ? 'drakerendfinisher' : 'drakerend'));
        // Skill hits heal by spell lifesteal: lend some for the finisher only.
        if (last) withStat(api, caster, 'spellLifesteal', DRAKE_REND.lifesteal[i], 'drakeleech', hit);
        else hit();
      }
      if (++n >= 3 || !center) api.busy(caster, false);
    };
    api.busy(caster, true);
    slash();
    api.repeat(caster, DRAKE_REND.every, 2, slash);
  },
};
