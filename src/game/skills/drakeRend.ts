import { pct } from '../traits/format';
import { enemiesOn, row3 } from './areas';
import type { SkillDef, SkillFighter } from './types';

// Suyu (4g Dragon Altar / Weapon Master). Per star, index 0 = 1★.
export const DRAKE_REND = {
  every: 0.3, // seconds between slashes
  slash: [0.9, 0.9, 2.2], // of attack, physical, the first two slashes (each enemy in the 3x1 row)
  finisher: [1.8, 1.8, 4.4], // of attack, physical, the third
  heal: [2.4, 2.6, 7.2], // of attack: it heals this much when the finisher lands
};

export const drakeRend: SkillDef = {
  id: 'drakerend',
  name: 'Drake Rend',
  desc:
    `Slashes the 3x1 row around its target 3 times, ${DRAKE_REND.every}s apart: twice for {slash} of attack, ` +
    'then a finisher for {finisher}. All physical. If the finisher hits, it heals for {heal} of its attack.',
  damage: { slash: 'physical', finisher: 'physical' },
  values: () => ({ slash: DRAKE_REND.slash.map(pct), finisher: DRAKE_REND.finisher.map(pct), heal: DRAKE_REND.heal.map(pct) }),
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
        for (const e of victims) api.hit(caster, e, raw, 'physical', last ? 'drakerendfinisher' : 'drakerend');
        if (last && victims.length) api.heal(caster, caster.stats.atk * DRAKE_REND.heal[i]);
      }
      if (++n >= 3 || !center) api.busy(caster, false);
    };
    api.busy(caster, true);
    slash();
    api.repeat(caster, DRAKE_REND.every, 2, slash);
  },
};
